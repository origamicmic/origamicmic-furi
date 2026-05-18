import { NextRequest } from "next/server"

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://inv.tux.pizza",
  "https://invidious.privacyredirect.com",
]

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

async function searchInvidious(query: string, instance: string): Promise<string | null> {
  try {
    const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const data = await res.json()
    const results = Array.isArray(data) ? data : []
    for (const item of results) {
      if (item.videoId) return item.videoId as string
    }
    return null
  } catch {
    return null
  }
}

async function getAudioUrl(videoId: string, instance: string): Promise<string | null> {
  try {
    const url = `${instance}/api/v1/videos/${videoId}`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const data = await res.json()
    const formats = data.adaptiveFormats || data.formatStreams || []
    const audio = formats.find(
      (f: Record<string, unknown>) =>
        typeof f.type === "string" && f.type.startsWith("audio/")
    )
    if (audio && typeof audio.url === "string") return audio.url as string
    return null
  } catch {
    return null
  }
}

async function resolveAudioUrl(query: string): Promise<string | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    const videoId = await searchInvidious(query, instance)
    if (!videoId) continue
    const audioUrl = await getAudioUrl(videoId, instance)
    if (audioUrl) return audioUrl
  }
  return null
}

async function streamAudio(
  audioUrl: string,
  request: NextRequest
): Promise<Response | null> {
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    const range = request.headers.get("range")
    if (range) reqHeaders["Range"] = range

    const res = await fetch(audioUrl, {
      headers: reqHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null

    const rawCt = res.headers.get("content-type") || ""
    const ct = rawCt.split(";")[0].trim()
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")
  if (!q || q.trim().length === 0) {
    return new Response(null, { status: 400 })
  }

  try {
    const audioUrl = await resolveAudioUrl(q.trim())
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
