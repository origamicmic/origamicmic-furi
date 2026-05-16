import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return new Response(null, { status: 400 })

  const upstreamHeaders: Record<string, string> = {
    "Referer": "https://music.163.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  }

  for (const suffix of ["", ".mp3"]) {
    try {
      const url = `https://music.163.com/song/media/outer/url?id=${id}${suffix}`
      const res = await fetch(url, {
        redirect: "manual",
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(8000),
      })

      // Follow redirects manually to capture the final CDN URL
      let current = res
      let redirects = 0
      while ([301, 302, 303, 307, 308].includes(current.status) && redirects < 5) {
        const location = current.headers.get("location")
        if (!location) break
        current = await fetch(location, {
          redirect: "manual",
          headers: upstreamHeaders,
          signal: AbortSignal.timeout(8000),
        })
        redirects++
      }

      const finalUrl = current.url
      const ct = (current.headers.get("content-type") || "").toLowerCase()
      const isAudio = ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet-stream")

      if (!isAudio) continue

      // Redirect client to the CDN URL so the <audio> element streams directly
      return new Response(null, {
        status: 302,
        headers: {
          Location: finalUrl,
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch {}
  }

  return new Response(null, { status: 404 })
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Max-Age": "86400",
    },
  })
}
