import { NextRequest } from "next/server"
import crypto from "crypto"

const EAPI_KEY = process.env.EAPI_KEY || "e82ckenh8dichen8"

// Cache resolved audio URLs per song ID (avoids re-resolving on each Range/seek)
const urlCache = new Map<string, { url: string; time: number }>()
const URL_CACHE_TTL = 10 * 60 * 1000

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
  "X-Real-IP": process.env.CN_PROXY_IP || "118.88.88.88",
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

      // Connection timeout only — body streaming is not limited
      const controller = new AbortController()
      const connectTimeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal })
      clearTimeout(connectTimeout)

      if (!res.ok) {
        console.warn(`[audio] CDN fetch HTTP ${res.status} for ${url.slice(0, 80)}`)
        return null
      }

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
  for (const br of [320000, 128000, 999000]) {
    for (let retry = 0; retry < 2; retry++) {
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
            signal: AbortSignal.timeout(10000),
          }
        )

        if (!res.ok) {
          console.warn(`[audio] EAPI HTTP ${res.status} for br=${br / 1000}k id=${id}${retry > 0 ? ` retry=${retry}` : ""}`)
          break
        }
        const data = await res.json()
        const song = data.data?.[0]
        if (!song?.url) {
          if (song?.freeTrialInfo != null) {
            console.warn(`[audio] EAPI trial-only br=${br / 1000}k id=${id}`)
          } else {
            console.warn(`[audio] EAPI no-url br=${br / 1000}k id=${id} code=${data.code} freeTrialInfo=${JSON.stringify(song?.freeTrialInfo)}`)
          }
          break
        }
        const hasTrial =
          song.freeTrialInfo != null &&
          typeof song.freeTrialInfo === "object" &&
          !Array.isArray(song.freeTrialInfo) &&
          Number((song.freeTrialInfo as Record<string, unknown>).end) > 0
        if (hasTrial) {
          console.warn(`[audio] EAPI trial-restricted br=${br / 1000}k id=${id}`)
          break
        }

        const audioUrl = song.url.replace(/^http:\/\//, "https://")
        const result = await streamFromCDN(audioUrl, request)
        if (result) return result
        console.warn(`[audio] CDN stream failed br=${br / 1000}k id=${id}`)
        break
      } catch (err) {
        console.warn(`[audio] EAPI exception br=${br / 1000}k id=${id}${retry > 0 ? ` retry=${retry}` : ""}: ${err instanceof Error ? err.message : String(err)}`)
        if (retry < 1) {
          await new Promise((r) => setTimeout(r, 400))
        }
      }
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

async function streamFromProxy(
  id: string,
  request: NextRequest
): Promise<Response | null> {
  const PROXY_APIS = [
    `https://api.baka.plus/meting/?type=url&id=${id}&br=320`,
    `https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=${id}&br=320`,
    `https://api.qijieya.cn/meting/?type=url&id=${id}`,
  ]

  for (const apiUrl of PROXY_APIS) {
    try {
      const res = await fetch(apiUrl, {
        headers: { "User-Agent": UPSTREAM_HEADERS["User-Agent"] },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      })

      // Handle redirect (baka returns 302 with Location header)
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location")
        if (location) {
          const audioUrl = location.startsWith("http") ? location : `https://${location}`
          console.warn(`[audio] proxy redirect to: ${audioUrl.slice(0, 80)}`)
          const result = await streamFromCDN(audioUrl, request)
          if (result) return result
        }
        continue
      }

      // Handle raw text URL
      const text = await res.text()
      if (text.startsWith("http") && text.length < 500) {
        const audioUrl = text.trim()
        console.warn(`[audio] proxy text URL: ${audioUrl.slice(0, 80)}`)
        const result = await streamFromCDN(audioUrl, request)
        if (result) return result
        continue
      }

      // Handle JSON response
      try {
        const json = JSON.parse(text)
        const audioUrl = json.url as string | undefined
        if (audioUrl) {
          console.warn(`[audio] proxy JSON URL: ${audioUrl.slice(0, 80)}`)
          const result = await streamFromCDN(audioUrl, request)
          if (result) return result
        }
      } catch {}
    } catch (err) {
      console.warn(`[audio] proxy API error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return null
}

async function resolveNetEaseUrl(id: string): Promise<string | null> {
  // Try EAPI
  for (const br of [320000, 128000, 999000]) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        const params = eapiEncrypt("/api/song/enhance/player/url", { ids: `[${id}]`, br })
        const res = await fetch("https://interface3.music.163.com/eapi/song/enhance/player/url", {
          method: "POST",
          headers: { ...UPSTREAM_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "Cookie": "os=pc" },
          body: `params=${encodeURIComponent(params)}`,
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) break
        const data = await res.json()
        const song = data.data?.[0]
        if (!song?.url) break
        const hasTrial = song.freeTrialInfo != null && typeof song.freeTrialInfo === "object" && !Array.isArray(song.freeTrialInfo) && Number((song.freeTrialInfo as Record<string, unknown>).end) > 0
        if (hasTrial) break
        return song.url.replace(/^http:\/\//, "https://")
      } catch { if (retry < 1) await new Promise((r) => setTimeout(r, 400)) }
    }
  }

  // Try Legacy
  for (const suffix of ["", ".mp3"]) {
    const url = `https://music.163.com/song/media/outer/url?id=${id}${suffix}`
    try {
      const res = await fetch(url, { headers: UPSTREAM_HEADERS, redirect: "follow", signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const ct = (res.headers.get("content-type") || "").toLowerCase()
        if (ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet-stream")) return res.url
      }
    } catch {}
  }

  // Try community proxy APIs
  const PROXY_APIS = [
    `https://api.baka.plus/meting/?type=url&id=${id}&br=320`,
    `https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=${id}&br=320`,
    `https://api.qijieya.cn/meting/?type=url&id=${id}`,
  ]
  for (const apiUrl of PROXY_APIS) {
    try {
      const res = await fetch(apiUrl, {
        headers: { "User-Agent": UPSTREAM_HEADERS["User-Agent"] },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (loc) return loc.startsWith("http") ? loc : `https://${loc}`
        continue
      }
      const text = await res.text()
      if (text.startsWith("http") && text.length < 500) return text.trim()
      try { const j = JSON.parse(text); if (j.url) return j.url } catch {}
    } catch {}
  }

  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !/^\d+$/.test(id)) {
    return new Response(null, { status: 400 })
  }

  // Check cache for Range/seek requests
  const cached = urlCache.get(id)
  if (cached && Date.now() - cached.time < URL_CACHE_TTL) {
    const result = await streamFromCDN(cached.url, request)
    if (result) {
      result.headers.set("X-Audio-Source", "cache")
      result.headers.set("X-Cache", "HIT")
      return result
    }
    urlCache.delete(id)
  }

  // Resolve URL (EAPI → Legacy → Proxy)
  let source = "unknown"
  let audioUrl = await resolveNetEaseUrl(id)
  if (audioUrl) {
    source = audioUrl.includes("music.163.com") ? "netease" : "community-proxy"
  }

  if (!audioUrl) {
    return new Response(null, { status: 404 })
  }

  // Cache for future Range requests
  urlCache.set(id, { url: audioUrl, time: Date.now() })
  if (urlCache.size > 200) {
    const oldest = [...urlCache.entries()].sort((a, b) => a[1].time - b[1].time)[0]
    if (oldest) urlCache.delete(oldest[0])
  }

  const result = await streamFromCDN(audioUrl, request)
  if (result) {
    result.headers.set("X-Audio-Source", source)
    return result
  }
  urlCache.delete(id)
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
