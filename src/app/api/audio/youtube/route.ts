import { NextRequest } from "next/server"

const YT_KEY = process.env.YOUTUBE_API_KEY || "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
const YT_CLIENT_VERSION = process.env.YOUTUBE_CLIENT_VERSION || "2.20250423.00.00"

const YT_CLIENT = {
  hl: "ja",
  gl: "JP",
  clientName: "WEB",
  clientVersion: YT_CLIENT_VERSION,
}

const YT_ORIGIN = "https://www.youtube.com"

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async function searchVideo(query: string): Promise<string | null> {
  const res = await fetch(`${YT_ORIGIN}/youtubei/v1/search?key=${YT_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": YT_ORIGIN,
      "Referer": YT_ORIGIN,
      "User-Agent": BROWSER_UA,
    },
    body: JSON.stringify({
      context: { client: YT_CLIENT },
      query,
      params: "EgWKAQIIAWoKEAoQCRADEAAYASgB",
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return null

  const data = await res.json()
  const contents =
    data.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents

  if (!contents) return null
  for (const item of contents) {
    const videoId = item.videoRenderer?.videoId
    if (videoId) return videoId
  }
  return null
}

async function getAudioStream(videoId: string): Promise<string | null> {
  const res = await fetch(`${YT_ORIGIN}/youtubei/v1/player?key=${YT_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": YT_ORIGIN,
      "Referer": YT_ORIGIN,
      "User-Agent": BROWSER_UA,
    },
    body: JSON.stringify({
      context: { client: YT_CLIENT },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return null

  const data = await res.json()
  const formats =
    data.streamingData?.adaptiveFormats || data.streamingData?.formats
  if (!formats) return null

  const audio = formats
    .filter(
      (f: Record<string, unknown>) =>
        typeof f.mimeType === "string" && f.mimeType.startsWith("audio/")
    )
    .sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0)
    )

  if (audio.length > 0 && typeof audio[0].url === "string") {
    return audio[0].url as string
  }
  return null
}

async function streamAudio(
  audioUrl: string,
  request: NextRequest
): Promise<Response | null> {
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent": BROWSER_UA,
      "Referer": YT_ORIGIN,
      "Origin": YT_ORIGIN,
    }
    const range = request.headers.get("range")
    if (range) reqHeaders["Range"] = range

    const res = await fetch(audioUrl, {
      headers: reqHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) return null

    const responseHeaders = new Headers()
    responseHeaders.set(
      "Content-Type",
      res.headers.get("content-type") || "audio/mp4"
    )
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

    return new Response(res.body, {
      status: res.status,
      headers: responseHeaders,
    })
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")
  if (!q || q.trim().length === 0) {
    return new Response(null, { status: 400 })
  }

  try {
    const videoId = await searchVideo(q.trim())
    if (!videoId) return new Response(null, { status: 404 })

    const audioUrl = await getAudioStream(videoId)
    if (!audioUrl) return new Response(null, { status: 404 })

    const result = await streamAudio(audioUrl, request)
    if (!result) return new Response(null, { status: 404 })

    return result
  } catch {
    return new Response(null, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Max-Age": "86400",
    },
  })
}
