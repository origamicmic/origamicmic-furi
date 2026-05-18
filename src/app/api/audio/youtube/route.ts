import { NextRequest } from "next/server"

let SC_CLIENT_ID = ""
let SC_INIT_PROMISE: Promise<void> | null = null

async function ensureClientId() {
  if (SC_CLIENT_ID) return
  if (SC_INIT_PROMISE) return SC_INIT_PROMISE
  SC_INIT_PROMISE = (async () => {
    const html = await fetch("https://soundcloud.com/discover", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    }).then((r) => r.text())

    const match = html.match(/<script[^>]*src="(https:\/\/[^"]*sndcdn\.com\/[^"]*webpack\.js[^"]*)"[^>]*>/)
    if (match) {
      const js = await fetch(match[1], {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      }).then((r) => r.text())
      const m = js.match(/client_id\s*:\s*"([a-zA-Z0-9]{32})"/)
      if (m) SC_CLIENT_ID = m[1]
    }
  })()
  await SC_INIT_PROMISE
  SC_INIT_PROMISE = null
  if (!SC_CLIENT_ID) throw new Error("Failed to extract SoundCloud client_id")
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

async function resolveAudioUrl(query: string): Promise<string | null> {
  await ensureClientId()
  const signal = AbortSignal.timeout(SEARCH_TIMEOUT)
  try {
    const searchUrl =
      `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&limit=3&client_id=${SC_CLIENT_ID}`
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      signal,
    })
    if (!searchRes.ok) {
      console.warn(`[fallback] sc search HTTP ${searchRes.status}`)
      return null
    }
    const searchData = await searchRes.json() as Record<string, unknown>
    const collection = searchData.collection as Record<string, unknown>[] | undefined
    if (!collection || collection.length === 0) {
      console.warn("[fallback] sc no results")
      return null
    }
    const track = collection[0]
    console.warn(`[fallback] sc found: ${String(track.title || "").slice(0, 50)}`)

    const media = track.media as Record<string, unknown> | undefined
    const transcodings = media?.transcodings as Record<string, unknown>[] | undefined
    if (!transcodings || transcodings.length === 0) {
      console.warn("[fallback] sc no transcodings")
      return null
    }
    const prog = transcodings.find(
      (t: Record<string, unknown>) =>
        typeof t.format?.protocol === "string" && t.format.protocol === "progressive"
    ) || transcodings[0]
    const transcodeUrl = String(prog.url || "")

    const transcodeRes = await fetch(`${transcodeUrl}?client_id=${SC_CLIENT_ID}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT),
    })
    if (!transcodeRes.ok) {
      console.warn(`[fallback] sc transcode HTTP ${transcodeRes.status}`)
      return null
    }
    const transcodeData = await transcodeRes.json() as Record<string, unknown>
    const audioUrl = transcodeData.url as string | undefined
    if (!audioUrl) {
      console.warn("[fallback] sc no audio url in transcode")
      return null
    }
    console.warn(`[fallback] sc audio: ${audioUrl.slice(0, 80)}`)
    return audioUrl
  } catch (err) {
    console.warn(`[fallback] sc error: ${err instanceof Error ? err.message : String(err)}`)
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
      console.warn(`[fallback] sc stream HTTP ${res.status}`)
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
    console.warn(`[fallback] sc stream error: ${err instanceof Error ? err.message : String(err)}`)
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
