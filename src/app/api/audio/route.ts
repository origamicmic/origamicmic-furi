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

function isValidAudioUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname.endsWith(".126.net") || u.hostname.endsWith(".163.com")
  } catch {
    return false
  }
}

const UPSTREAM_HEADERS: Record<string, string> = {
  "Referer": "https://music.163.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

async function followRedirects(url: string, timeout = 8000): Promise<Response> {
  let current = await fetch(url, {
    redirect: "manual",
    headers: UPSTREAM_HEADERS,
    signal: AbortSignal.timeout(timeout),
  })
  let redirects = 0
  while ([301, 302, 303, 307, 308].includes(current.status) && redirects < 5) {
    const location = current.headers.get("location")
    if (!location) break
    if (!isValidAudioUrl(location)) break
    current = await fetch(location, {
      redirect: "manual",
      headers: UPSTREAM_HEADERS,
      signal: AbortSignal.timeout(timeout),
    })
    redirects++
  }
  return current
}

function redirectToAudio(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.replace(/^http:\/\//, "https://"),
      "Cache-Control": "no-cache",
    },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !/^\d+$/.test(id)) return new Response(null, { status: 400 })

  // Priority 1: EAPI (NetEase web player API — best song coverage)
  // Try bitrates from highest to lowest — some songs only have specific qualities
  let eapiHadTrial = false
  for (const br of [999000, 320000, 128000]) {
    try {
      const params = eapiEncrypt("/api/song/enhance/player/url", {
        ids: `[${id}]`,
        br,
      })
      const res = await fetch("https://interface3.music.163.com/eapi/song/enhance/player/url", {
        method: "POST",
        headers: {
          ...UPSTREAM_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": "os=pc",
        },
        body: `params=${encodeURIComponent(params)}`,
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const data = await res.json()
        const song = data.data?.[0]
        if (song?.url && !song.freeTrialInfo) {
          const validatedUrl = song.url.replace(/^http:\/\//, "https://")
          if (isValidAudioUrl(validatedUrl)) {
            try {
              // Single-hop probe: authenticate with CDN using correct Referer,
              // then pass the resolved stream URL to the browser
              const probe = await fetch(validatedUrl, {
                redirect: "manual",
                headers: UPSTREAM_HEADERS,
                signal: AbortSignal.timeout(5000),
              })
              const target = [301, 302, 303, 307, 308].includes(probe.status)
                ? probe.headers.get("location") || validatedUrl
                : validatedUrl
              if (isValidAudioUrl(target)) return redirectToAudio(target)
            } catch {}
          }
        }
        if (song?.freeTrialInfo) eapiHadTrial = true
      }
    } catch {}
  }

  // Copyright-restricted: EAPI returned trial-only at all bitrates, skip outer/url (which serves 45s previews)
  if (eapiHadTrial) return new Response(null, { status: 404 })

  // Priority 2-3: Legacy /song/media/outer/url
  for (const suffix of ["", ".mp3"]) {
    try {
      const url = `https://music.163.com/song/media/outer/url?id=${id}${suffix}`
      const res = await followRedirects(url)
      const ct = (res.headers.get("content-type") || "").toLowerCase()
      if (ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet-stream")) {
        return redirectToAudio(res.url)
      }
    } catch {}
  }

  return new Response(null, { status: 404 })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  const host = request.headers.get("host") || ""
  const allowed = origin && (origin.includes(host) || origin.endsWith(".vercel.app"))
  return new Response(null, {
    headers: {
      ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Max-Age": "86400",
    },
  })
}
