import { NextRequest } from "next/server"
import { Innertube, UniversalCache } from "youtubei.js"

const SEARCH_TIMEOUT = 8000
const STREAM_TIMEOUT = 15000

let yt: Innertube | null = null
let ytInit: Promise<Innertube> | null = null

function getInnertube(): Promise<Innertube> {
  if (yt) return Promise.resolve(yt)
  if (!ytInit) {
    ytInit = Innertube.create({ cache: new UniversalCache(false) })
      .then((instance) => {
        yt = instance
        ytInit = null
        return instance
      })
      .catch((err) => {
        ytInit = null
        console.warn("[fallback] Innertube.create failed:", err instanceof Error ? err.message : String(err))
        throw err
      })
  }
  return ytInit
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

async function resolveAudioUrl(query: string): Promise<string | null> {
  const instance = await getInnertube()
  const searchResults = await instance.search(query, { type: "video" })
  if (!searchResults.videos || searchResults.videos.length === 0) {
    console.warn("[fallback] no search results")
    return null
  }
  const video = searchResults.videos[0]
  const videoId = video.id
  if (!videoId) {
    console.warn("[fallback] search result missing videoId")
    return null
  }
  console.warn(`[fallback] found video: ${video.title?.slice(0, 60)} (${videoId})`)

  const signal = AbortSignal.timeout(SEARCH_TIMEOUT)
  const info = await instance.getBasicInfo(videoId, "IOS")
  signal.throwIfAborted()

  const formats = info.streaming_data?.adaptive_formats || info.streaming_data?.formats || []
  const audio = formats.find(
    (f) =>
      f.mime_type?.startsWith("audio/") &&
      f.url
  )
  if (!audio?.url) {
    console.warn(`[fallback] no audio format in ${formats.length} formats`)
    return null
  }
  console.warn(`[fallback] audio: ${audio.mime_type} ${audio.bitrate}bps`)
  return audio.url
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
      signal: AbortSignal.timeout(STREAM_TIMEOUT),
    })

    if (!res.ok) {
      console.warn(`[fallback] stream HTTP ${res.status} for ${audioUrl.slice(0, 80)}`)
      return null
    }

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
  } catch (err) {
    console.warn(`[fallback] stream error: ${err instanceof Error ? err.message : String(err)}`)
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
