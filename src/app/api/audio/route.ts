import { NextRequest } from "next/server"
import crypto from "crypto"

const EAPI_KEY = process.env.EAPI_KEY || "e82ckenh8dichen8"

function eapiEncrypt(path: string, body: Record<string, unknown>): string {
  const text = JSON.stringify(body)
  const message = `nobody${path}use${text}md5forencrypt`
  const digest = crypto.createHash("md5").update(message, "utf8").digest("hex")
  const data = `${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  const cipher = crypto.createCipheriv("aes-128-ecb", EAPI_KEY, "")
  cipher.setAutoPadding(true)
  let encrypted = cipher.update(data, "utf8", "hex")
  encrypted += cipher.final("hex")
  return encrypted.toUpperCase()
}

function isAudioContentType(ct: string): boolean {
  const t = ct.toLowerCase()
  return (
    t.includes("audio") ||
    t.includes("video") ||
    t.includes("mpeg") ||
    t.includes("mp4") ||
    t.includes("webm") ||
    t.includes("octet-stream")
  )
}

const UPSTREAM_HEADERS: Record<string, string> = {
  "Referer": "https://music.163.com",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

function pumpStream(body: ReadableStream<Uint8Array> | null): ReadableStream<Uint8Array> {
  const reader = body!.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) { controller.close() }
        else { controller.enqueue(value) }
      } catch {
        controller.close()
      }
    },
    cancel() { reader.cancel().catch(() => {}) },
  })
}

async function streamFromCDN(
  url: string,
  request: NextRequest
): Promise<Response | null> {
  const fetchAttempt = async (
    extraHeaders: Record<string, string> = {}
  ): Promise<Response | null> => {
    try {
      const headers: Record<string, string> = { ...UPSTREAM_HEADERS, ...extraHeaders }
      const range = request.headers.get("range")
      if (range) headers["Range"] = range

      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) return null

      const rawCt = (res.headers.get("content-type") || "").toLowerCase()
      const ct = rawCt.split(";")[0].trim()
      if (ct && !isAudioContentType(ct)) {
        console.warn(`[audio] unexpected content-type: "${rawCt}" for ${url.slice(0, 80)}`)
        return null
      }

      const responseHeaders = new Headers()
      responseHeaders.set("Content-Type", ct || "application/octet-stream")
      responseHeaders.set("Accept-Ranges", "bytes")
      responseHeaders.set("Cache-Control", "public, max-age=3600")
      responseHeaders.set("Access-Control-Allow-Origin", "*")

      if (res.status === 206) {
        const cr = res.headers.get("content-range")
        if (cr) responseHeaders.set("Content-Range", cr)
        const cl = res.headers.get("content-length")
        if (cl) responseHeaders.set("Content-Length", cl)
      } else {
        const cl = res.headers.get("content-length")
        if (cl) responseHeaders.set("Content-Length", cl)
      }

      return new Response(pumpStream(res.body), {
        status: res.status,
        headers: responseHeaders,
      })
    } catch {
      return null
    }
  }

  const result = await fetchAttempt()
  if (result) return result

  return fetchAttempt({ Referer: "" })
}

async function streamFromEAPI(
  id: string,
  request: NextRequest
): Promise<Response | null> {
  for (const br of [999000, 320000, 128000]) {
    try {
      const params = eapiEncrypt("/api/song/enhance/player/url", {
        ids: `[${id}]`,
        br,
      })
      const res = await fetch(
        "https://interface3.music.163.com/eapi/song/enhance/player/url",
        {
          method: "POST",
          headers: {
            ...UPSTREAM_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": "os=pc",
          },
          body: `params=${encodeURIComponent(params)}`,
          signal: AbortSignal.timeout(12000),
        }
      )

      if (!res.ok) continue
      const data = await res.json()
      const song = data.data?.[0]
      const hasTrial =
        song.freeTrialInfo != null &&
        typeof song.freeTrialInfo === "object" &&
        !Array.isArray(song.freeTrialInfo) &&
        Number((song.freeTrialInfo as Record<string, unknown>).end) > 0
      if (!song?.url || hasTrial) continue

      const audioUrl = song.url.replace(/^http:\/\//, "https://")
      const result = await streamFromCDN(audioUrl, request)
      if (result) return result
    } catch {
      continue
    }
  }
  return null
}

async function streamFromLegacy(
  id: string,
  request: NextRequest
): Promise<Response | null> {
  for (const suffix of ["", ".mp3"]) {
    try {
      const url = `https://music.163.com/song/media/outer/url?id=${id}${suffix}`
      const result = await streamFromCDN(url, request)
      if (result) return result
    } catch {
      continue
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !/^\d+$/.test(id)) {
    return new Response(null, { status: 400 })
  }

  // Priority 1: EAPI
  const eapiResult = await streamFromEAPI(id, request)
  if (eapiResult) return eapiResult

  // Priority 2: Legacy URL (even when EAPI returns freeTrialInfo, legacy may serve full audio)
  const legacyResult = await streamFromLegacy(id, request)
  if (legacyResult) return legacyResult

  return new Response(null, { status: 404 })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  const host = request.headers.get("host") || ""
  const allowed =
    origin && (origin.includes(host) || origin.endsWith(".vercel.app"))
  return new Response(null, {
    headers: {
      ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Max-Age": "86400",
    },
  })
}
