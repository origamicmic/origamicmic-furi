import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return new Response(null, { status: 400 })

  const upstreamHeaders: Record<string, string> = {
    "Referer": "https://music.163.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  }

  // Forward client Range header so upstream returns 206 Partial Content
  const clientRange = request.headers.get("range")
  if (clientRange) upstreamHeaders["Range"] = clientRange

  for (const suffix of ["", ".mp3"]) {
    try {
      const url = `https://music.163.com/song/media/outer/url?id=${id}${suffix}`
      const res = await fetch(url, {
        redirect: "follow",
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(12000),
      })

      const ct = (res.headers.get("content-type") || "").toLowerCase()
      const isAudio = ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet-stream")

      if (!res.ok || !res.body || !isAudio) continue

      const proxiedHeaders: Record<string, string> = {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=1800",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Range",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      }

      // Forward upstream length / range headers for duration + seeking
      const cl = res.headers.get("content-length")
      if (cl) proxiedHeaders["Content-Length"] = cl
      const cr = res.headers.get("content-range")
      if (cr) proxiedHeaders["Content-Range"] = cr

      return new Response(res.body, {
        status: res.status,  // pass through 206 / 200
        headers: proxiedHeaders,
      })
    } catch {}
  }

  return new Response(null, { status: 404 })
}

// Handle CORS preflight for Range requests
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
