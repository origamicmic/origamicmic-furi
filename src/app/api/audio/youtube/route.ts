import { NextRequest } from "next/server"

const INVIDIOUS_INSTANCES = [
  "https://inv.thepixora.com",
  "https://yt.chocolatemoo53.com",
  "https://invidious.nerdvpn.de",
]

const PIPED_INSTANCES = [
  "https://pipedapi.syncpundit.io",
]

const SEARCH_TIMEOUT = 5000
const VIDEO_TIMEOUT = 5000
const STREAM_TIMEOUT = 15000

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

async function searchInvidious(query: string, instance: string): Promise<{ videoId: string } | null> {
  const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT) })
    if (!res.ok) {
      console.warn(`[fallback] search ${instance} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const results = Array.isArray(data) ? data : []
    for (const item of results) {
      if (item.videoId) return { videoId: item.videoId as string }
    }
    console.warn(`[fallback] search ${instance} no results`)
    return null
  } catch (err) {
    console.warn(`[fallback] search ${instance} error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function getInvidiousProxyUrl(videoId: string, instance: string): Promise<string | null> {
  const url = `${instance}/api/v1/videos/${videoId}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(VIDEO_TIMEOUT) })
    if (!res.ok) {
      console.warn(`[fallback] video ${instance} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const formats = data.adaptiveFormats || []
    const audio = formats.find(
      (f: Record<string, unknown>) =>
        typeof f.type === "string" && f.type.startsWith("audio/")
    )
    if (!audio || typeof audio.itag !== "number") {
      console.warn(`[fallback] video ${instance} no audio itag in ${formats.length} formats`)
      return null
    }
    return `${instance}/latest_version?id=${videoId}&itag=${audio.itag}&local=true`
  } catch (err) {
    console.warn(`[fallback] video ${instance} error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function resolveFromInvidious(query: string): Promise<string | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    const result = await searchInvidious(query, instance)
    if (!result) continue
    const proxyUrl = await getInvidiousProxyUrl(result.videoId, instance)
    if (proxyUrl) {
      console.warn(`[fallback] resolved invidious ${instance}`)
      return proxyUrl
    }
  }
  return null
}

async function searchPiped(query: string, instance: string): Promise<{ videoId: string } | null> {
  const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT) })
    if (!res.ok) {
      console.warn(`[fallback] piped search ${instance} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const items = data.items || []
    for (const item of items) {
      if (item.url) {
        const m = String(item.url).match(/[?&]v=([\w-]+)/)
        if (m) return { videoId: m[1] }
      }
    }
    console.warn(`[fallback] piped search ${instance} no results`)
    return null
  } catch (err) {
    console.warn(`[fallback] piped search ${instance} error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function getPipedProxyUrl(videoId: string, instance: string): Promise<string | null> {
  const url = `${instance}/streams/${videoId}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(VIDEO_TIMEOUT) })
    if (!res.ok) {
      console.warn(`[fallback] piped streams ${instance} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const streams = data.audioStreams || []
    if (streams.length === 0) {
      console.warn(`[fallback] piped streams ${instance} no audio`)
      return null
    }
    const audio = streams[0] as Record<string, unknown>
    if (typeof audio.url !== "string") {
      console.warn(`[fallback] piped streams ${instance} url missing`)
      return null
    }
    return audio.url as string
  } catch (err) {
    console.warn(`[fallback] piped streams ${instance} error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function resolveFromPiped(query: string): Promise<string | null> {
  for (const instance of PIPED_INSTANCES) {
    const result = await searchPiped(query, instance)
    if (!result) continue
    const proxyUrl = await getPipedProxyUrl(result.videoId, instance)
    if (proxyUrl) {
      console.warn(`[fallback] resolved piped ${instance}`)
      return proxyUrl
    }
  }
  return null
}

async function resolveAudioUrl(query: string): Promise<string | null> {
  const invidiousUrl = await resolveFromInvidious(query)
  if (invidiousUrl) return invidiousUrl
  console.warn("[fallback] all invidious instances failed, trying piped")
  return resolveFromPiped(query)
}

async function streamAudio(
  proxyUrl: string,
  request: NextRequest
): Promise<Response | null> {
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    const range = request.headers.get("range")
    if (range) reqHeaders["Range"] = range

    const res = await fetch(proxyUrl, {
      headers: reqHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(STREAM_TIMEOUT),
    })

    if (!res.ok) {
      console.warn(`[fallback] stream HTTP ${res.status} for ${proxyUrl.slice(0, 80)}`)
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
    const proxyUrl = await resolveAudioUrl(q.trim())
    if (!proxyUrl) return new Response(null, { status: 404 })

    const result = await streamAudio(proxyUrl, request)
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
