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

const UPSTREAM_HEADERS: Record<string, string> = {
  "Referer": "https://music.163.com",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !/^\d+$/.test(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 })
  }

  const results: Record<string, unknown> = {
    id,
    eapiResults: [] as unknown[],
    legacyResults: [] as unknown[],
  }

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

      const data = await res.json()
      const song = data.data?.[0] as Record<string, unknown> | undefined

      const entry: Record<string, unknown> = {
        br,
        status: res.status,
        ok: res.ok,
        hasUrl: !!song?.url,
        freeTrialInfo: song?.freeTrialInfo,
        freeTrialInfoType: typeof song?.freeTrialInfo,
        hasTrialRestriction:
          song?.freeTrialInfo != null &&
          typeof song.freeTrialInfo === "object" &&
          !Array.isArray(song.freeTrialInfo) &&
          Number((song.freeTrialInfo as Record<string, unknown>)?.end) > 0,
        url: typeof song?.url === "string" ? (song.url as string).slice(0, 120) + "..." : null,
      }
      ;(results.eapiResults as unknown[]).push(entry)
    } catch (err) {
      ;(results.eapiResults as unknown[]).push({
        br,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  for (const suffix of ["", ".mp3"]) {
    try {
      const url = `https://music.163.com/song/media/outer/url?id=${id}${suffix}`
      const res = await fetch(url, {
        headers: UPSTREAM_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      })
      ;(results.legacyResults as unknown[]).push({
        suffix: suffix || "(none)",
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get("content-type"),
        finalUrl: res.url.slice(0, 120),
      })
    } catch (err) {
      ;(results.legacyResults as unknown[]).push({
        suffix: suffix || "(none)",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return Response.json(results)
}
