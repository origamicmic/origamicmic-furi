import { NextRequest } from "next/server"

let YT_KEY = ""
let YT_WEB_VERSION = ""
let YT_IOS_VERSION = ""
let YT_KEY_PROMISE: Promise<void> | null = null

async function ensureKey() {
  if (YT_KEY) return
  if (YT_KEY_PROMISE) return YT_KEY_PROMISE
  YT_KEY_PROMISE = (async () => {
    const html = await fetch("https://www.youtube.com/embed/UNIQUE_ID", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    }).then((r) => r.text())

    const keyMatch = html.match(/"INNERTUBE_API_KEY":"(AIza[^"]+)"/)
    if (keyMatch) YT_KEY = keyMatch[1]

    const webMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"(\d+\.\d+\.\d+)"/)
    if (webMatch) YT_WEB_VERSION = webMatch[1]

    const iosMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"[^}]*"INNERTUBE_CONTEXT_CLIENT_NAME":"IOS"/)
    if (!iosMatch) {
      const m = html.match(/"INNERTUBE_CONTEXT_CLIENT_NAME":"IOS"[^}]*?"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/)
      if (m) YT_IOS_VERSION = m[1]
    } else {
      YT_IOS_VERSION = iosMatch[1]
    }
    if (!YT_IOS_VERSION && /"INNERTUBE_CLIENT_VERSION":"(\d{2}\.\d{2}\.\d+\.\d+)"/.test(html)) {
      YT_IOS_VERSION = html.match(/"INNERTUBE_CLIENT_VERSION":"(\d{2}\.\d{2}\.\d+\.\d+)"/)?.[1] ?? ""
    }
  })()
  await YT_KEY_PROMISE
  YT_KEY_PROMISE = null
  if (!YT_KEY) throw new Error("Failed to extract YT key")
}

const SEARCH_TIMEOUT = 6000
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

async function ytFetch(path: string, body: Record<string, unknown>, signal: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(`https://www.youtube.com/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://www.youtube.com",
      "Referer": "https://www.youtube.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    console.warn(`[fallback] yt ${path} HTTP ${res.status}`)
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json()
}

async function searchVideo(query: string): Promise<string | null> {
  await ensureKey()
  const signal = AbortSignal.timeout(SEARCH_TIMEOUT)
  try {
    const data = await ytFetch("youtubei/v1/search?key=" + YT_KEY, {
      context: {
        client: {
          hl: "ja",
          gl: "JP",
          clientName: "WEB",
          clientVersion: YT_WEB_VERSION || "2.20250518.00.00",
        },
      },
      query,
      params: "EgWKAQIIAWoKEAoQCRADEAAYASgB",
    }, signal)
    const contents = (data as Record<string, unknown>).contents
      ?.twoColumnSearchResultsRenderer
      ?.primaryContents
      ?.sectionListRenderer
      ?.contents
    if (!contents) { console.warn("[fallback] search: no contents"); return null }
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents
      if (!items) continue
      for (const item of items) {
        const id = item?.videoRenderer?.videoId
        if (id) {
          console.warn(`[fallback] found: ${item.videoRenderer.title?.runs?.[0]?.text?.slice(0, 50)} (${id})`)
          return id
        }
      }
    }
    console.warn("[fallback] search: no videoId found")
    return null
  } catch (err) {
    console.warn(`[fallback] search error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function getAudioUrl(videoId: string): Promise<string | null> {
  await ensureKey()
  const signal = AbortSignal.timeout(SEARCH_TIMEOUT)
  try {
    const data = await ytFetch("youtubei/v1/player?key=" + YT_KEY, {
      context: {
        client: {
          hl: "ja",
          gl: "JP",
          clientName: "IOS",
          clientVersion: YT_IOS_VERSION || "19.29.1",
          deviceMake: "Apple",
          deviceModel: "iPhone16,2",
          osName: "iOS",
          osVersion: "17.5.1.21F90",
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }, signal)
    const formats = (data as Record<string, unknown>).streamingData?.adaptiveFormats || []
    const audio = formats.find(
      (f: Record<string, unknown>) => typeof f.mimeType === "string" && f.mimeType.startsWith("audio/") && f.url
    )
    if (!audio) {
      console.warn(`[fallback] player: no audio in ${formats.length} formats`)
      return null
    }
    console.warn(`[fallback] audio: ${audio.mimeType} ${audio.bitrate}bps`)
    return audio.url as string
  } catch (err) {
    console.warn(`[fallback] player error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function streamAudio(
  audioUrl: string,
  request: NextRequest
): Promise<Response | null> {
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }
    const range = request.headers.get("range")
    if (range) reqHeaders["Range"] = range

    const res = await fetch(audioUrl, {
      headers: reqHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(STREAM_TIMEOUT),
    })

    if (!res.ok) {
      console.warn(`[fallback] stream HTTP ${res.status}`)
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
    const videoId = await searchVideo(q.trim())
    if (!videoId) return new Response(null, { status: 404 })

    const audioUrl = await getAudioUrl(videoId)
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
