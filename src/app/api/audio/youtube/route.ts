import { NextRequest } from "next/server"

const SC_PROXY = (process.env.SC_PROXY || "").trim()

const SC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

const SC_API_HEADERS: Record<string, string> = {
  "User-Agent": SC_UA,
  "Accept": "application/json",
  "Origin": "https://soundcloud.com",
  "Referer": "https://soundcloud.com/",
}

const SC_FALLBACK_CLIENT_ID = "5gMqC97v0l66zeEvGFHnZzO3hIi1xpUX"

let SC_CLIENT_ID = ""
let SC_INIT_PROMISE: Promise<void> | null = null

async function scFetch(input: string, init?: RequestInit): Promise<Response> {
  if (SC_PROXY) {
    try {
      const undici = await import("undici")
      return fetch(input, { ...init, dispatcher: new undici.ProxyAgent(SC_PROXY) } as RequestInit)
    } catch (e) {
      console.warn(`[fallback] sc proxy init failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return fetch(input, init)
}

if (!SC_CLIENT_ID) {
  console.warn(`[fallback] sc proxy ${SC_PROXY ? `enabled: ${SC_PROXY}` : "disabled (SC_PROXY not set)"}`)
}

async function ensureClientId() {
  if (SC_CLIENT_ID) return
  if (SC_INIT_PROMISE) return SC_INIT_PROMISE
  SC_INIT_PROMISE = (async () => {
    const CID_RE = /client_id\s*:\s*"([^"]+)"/g

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const html = await scFetch("https://soundcloud.com/", {
          headers: { "User-Agent": SC_UA },
          signal: AbortSignal.timeout(10000),
        }).then((r) => r.text())

        // Extract ALL script src URLs
        const scripts = [...html.matchAll(/<script[^>]+src\s*=\s*"([^"]+)"[^>]*>/gi)]

        // Check scripts in reverse order (newest/most relevant first)
        for (let i = scripts.length - 1; i >= 0; i--) {
          const src = scripts[i][1]
          try {
            const js = await scFetch(src, {
              headers: { "User-Agent": SC_UA },
              signal: AbortSignal.timeout(10000),
            }).then((r) => r.text())
            const m = CID_RE.exec(js)
            if (m) {
              SC_CLIENT_ID = m[1]
              CID_RE.lastIndex = 0
              console.warn(`[fallback] sc client_id extracted on attempt ${attempt + 1}`)
              return
            }
            CID_RE.lastIndex = 0
          } catch {
            // skip script that can't be fetched
          }
        }
        console.warn(`[fallback] sc client_id extraction attempt ${attempt + 1} failed`)
      } catch (err) {
        console.warn(
          `[fallback] sc client_id attempt ${attempt + 1} error: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500))
    }
    if (SC_FALLBACK_CLIENT_ID) {
      SC_CLIENT_ID = SC_FALLBACK_CLIENT_ID
      console.warn("[fallback] sc using hardcoded fallback client_id")
    }
  })()
  await SC_INIT_PROMISE
  SC_INIT_PROMISE = null
  if (!SC_CLIENT_ID) throw new Error("Failed to extract SoundCloud client_id")
}

const SEARCH_TIMEOUT = 8000
const STREAM_TIMEOUT = 60000

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

async function resolveAudioUrl(
  query: string,
  expectTitle: string | null,
  expectArtist: string | null,
  diag?: Record<string, unknown>
): Promise<string | null> {
  await ensureClientId()
  const signal = AbortSignal.timeout(SEARCH_TIMEOUT)

  // Clean query: strip unusual punctuations/repetitive chars, replace & with space
  const cleanQuery = query
    .replace(/&/g, " ")
    .replace(/[･・]{2,}/g, " ")
    .replace(/[~～…\.]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  try {
    const searchUrl =
      `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(cleanQuery)}&limit=5&client_id=${SC_CLIENT_ID}`
    const searchRes = await scFetch(searchUrl, {
      headers: SC_API_HEADERS,
      signal,
    })
    if (!searchRes.ok) {
      console.warn(`[fallback] sc search HTTP ${searchRes.status}`)
      if (diag) { diag.step = "search_http"; diag.status = searchRes.status }
      return null
    }
    const searchData = await searchRes.json() as Record<string, unknown>
    const collection = searchData.collection as Record<string, unknown>[] | undefined
    if (!collection || collection.length === 0) {
      console.warn("[fallback] sc no results")
      if (diag) { diag.step = "search_empty" }
      return null
    }

    // Sort results by title similarity to the expected title
    if (expectTitle) {
      const et = expectTitle.toLowerCase().trim()
          .replace(/[･・]{2,}/g, " ")
          .replace(/[~～…\.]{2,}/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      const ea = (expectArtist || "").toLowerCase().trim()
          .replace(/&/g, "and")
          .replace(/[･・]{2,}/g, " ")
          .replace(/[~～…\.]{2,}/g, " ")
          .replace(/\s+/g, " ")
          .trim()

      const isCover = (t: string) => /cover|カバー|covered|remix|リミックス|remixed|arrange|アレンジ|instrumental|インスト|off vocal|offvocal|カラオケ|karaoke/i.test(t)
      const scoreTitle = (t: string, u: string) => {
        const tl = t.toLowerCase().trim()
        const ul = u.toLowerCase()
        let score = 0
        // Title matching
        if (tl === et) { score += 50 }
        else if (tl.startsWith(et + " ") || tl.startsWith(et + " -") || tl.startsWith(et + " –") || tl.startsWith(et + " ~")) { score += 45 }
        else if (tl.startsWith(et + " (")) { score += 40 }
        else if (tl.startsWith(et + " /") || tl.startsWith(et + " |")) { score += 25 }
        else if (tl.includes(et)) { score += 15 }
        const words = et.replace(/[\(\[\{].*?[\)\]\}]/g, "").trim().split(/\s+/)
        score += Math.min(words.filter((w) => w.length >= 2 && tl.includes(w)).length * 5, 15)
        // Artist matching bonus
        if (ea) {
          if (ul.includes(ea)) score += 30
          else if (ea.split(/\s+/).some((w) => w.length >= 2 && ul.includes(w))) score += 10
          // Bonus: artist name appears in title (original artist credit)
          if (tl.includes(ea)) score += 25
        }
        // Penalize covers/remixes/instrumentals
        if (isCover(tl)) score -= 20
        return score
      }
      ;(collection as Record<string, unknown>[]).sort((a, b) => {
        return scoreTitle(String(b.title || ""), String(b.user?.username || "")) -
               scoreTitle(String(a.title || ""), String(a.user?.username || ""))
      })
      if (diag) {
        diag.sortedByTitle = expectTitle
        diag.artistHint = ea || null
        diag.searchScores = (collection as Record<string, unknown>[]).slice(0, 5).map((t) => ({
          title: String(t.title || "").slice(0, 50),
          user: String((t.user as Record<string, unknown>)?.username || ""),
          score: scoreTitle(String(t.title || ""), String((t.user as Record<string, unknown>)?.username || "")),
        }))
      }
    }
    for (let ti = 0; ti < collection.length; ti++) {
      const track = collection[ti]
      console.warn(`[fallback] sc track ${ti + 1}: ${String(track.title || "").slice(0, 50)}`)
      if (diag) {
        diag.foundTrack = String(track.title || "").slice(0, 60)
        diag.trackId = String(track.id || "")
        diag.trackIndex = ti
      }

      const media = track.media as Record<string, unknown> | undefined
      const transcodings = media?.transcodings as Record<string, unknown>[] | undefined
      if (!transcodings || transcodings.length === 0) continue

      // Only use progressive (non-DRM, non-HLS) transcodings
      const progressiveTc = transcodings.filter(
        (t: Record<string, unknown>) =>
          typeof t.format?.protocol === "string" && t.format.protocol === "progressive"
      )
      if (progressiveTc.length === 0) continue
      if (diag) { diag.transcodeProtocol = "progressive"; diag.transcodingsTotal = transcodings.length; diag.progressiveCount = progressiveTc.length }

      for (const tcEntry of progressiveTc) {
        const tcUrl = String((tcEntry as Record<string, unknown>).url || "")
        if (!tcUrl) continue
        const transcodeRes = await scFetch(`${tcUrl}?client_id=${SC_CLIENT_ID}`, {
          headers: SC_API_HEADERS,
          signal: AbortSignal.timeout(SEARCH_TIMEOUT),
        })
        if (!transcodeRes.ok) {
          console.warn(`[fallback] sc transcode HTTP ${transcodeRes.status} for ${tcUrl.slice(0, 60)}`)
          if (diag) { diag.transcodeUrl = tcUrl.slice(0, 120); diag.step = "transcode_http"; diag.status = transcodeRes.status }
          continue
        }
        const transcodeData = await transcodeRes.json() as Record<string, unknown>
        const audioUrl = transcodeData.url as string | undefined
        if (!audioUrl) continue
        // Verify it's not an HLS manifest (some progressive labels still return HLS)
        if (audioUrl.includes("/hls") || audioUrl.includes("playback.media-streaming")) {
          console.warn(`[fallback] sc skipping HLS/streaming URL: ${audioUrl.slice(0, 60)}`)
          continue
        }
        console.warn(`[fallback] sc audio: ${audioUrl.slice(0, 80)}`)
        return audioUrl
      }
    }
    // Second pass: progressive failed on all results, try non-DRM non-progressive
    console.warn("[fallback] sc progressive exhausted, trying non-progressive")
    for (let ti = 0; ti < collection.length; ti++) {
      const track = collection[ti]
      const media = track.media as Record<string, unknown> | undefined
      const transcodings = media?.transcodings as Record<string, unknown>[] | undefined
      if (!transcodings || transcodings.length === 0) continue

      for (const tcEntry of transcodings) {
        const protocol = String((tcEntry as Record<string, unknown>).format?.protocol || "")
        // Skip progressive (already tried), encrypted/DRM, and empty URLs
        if (protocol === "progressive") continue
        if (protocol.includes("encrypted") || protocol.includes("cbc") || protocol.includes("ctr")) continue
        const tcUrl = String((tcEntry as Record<string, unknown>).url || "")
        if (!tcUrl) continue
        // Skip known streaming/HLS CDN URLs
        if (tcUrl.includes("playback.media-streaming")) continue

        console.warn(`[fallback] sc trying ${protocol}: ${tcUrl.slice(0, 60)}`)
        const transcodeRes = await scFetch(`${tcUrl}?client_id=${SC_CLIENT_ID}`, {
          headers: SC_API_HEADERS,
          signal: AbortSignal.timeout(SEARCH_TIMEOUT),
        })
        if (!transcodeRes.ok) continue
        const transcodeData = await transcodeRes.json() as Record<string, unknown>
        const audioUrl = transcodeData.url as string | undefined
        if (!audioUrl) continue
        if (audioUrl.includes("/hls") || audioUrl.includes("playback.media-streaming")) continue
        console.warn(`[fallback] sc audio (fallback): ${audioUrl.slice(0, 80)}`)
        return audioUrl
      }
    }
    if (diag && !diag.step) { diag.step = "all_tracks_failed" }
    return null
  } catch (err) {
    console.warn(`[fallback] sc error: ${err instanceof Error ? err.message : String(err)}`)
    if (diag) { diag.step = "exception"; diag.errorMsg = err instanceof Error ? err.message : String(err) }
    return null
  }
}

async function streamAudio(
  audioUrl: string,
  request: NextRequest
): Promise<Response | null> {
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent": SC_UA,
      "Origin": "https://soundcloud.com",
      "Referer": "https://soundcloud.com/",
    }
    const range = request.headers.get("range")
    if (range) reqHeaders["Range"] = range

    const res = await scFetch(audioUrl, {
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
  const title = searchParams.get("title")
  const artist = searchParams.get("artist")
  const debug = searchParams.get("debug")
  if (!q || q.trim().length === 0) {
    return new Response(null, { status: 400 })
  }

  const diag: Record<string, unknown> = { query: q.trim() }
  try {
    const t0 = Date.now()
    await ensureClientId().catch(() => {})
    diag.clientIdReady = !!SC_CLIENT_ID
    diag.clientIdTime = Date.now() - t0

    if (!SC_CLIENT_ID) {
      diag.error = "no_client_id"
      return Response.json(diag, { status: 404 })
    }

    const audioUrl = await resolveAudioUrl(q.trim(), title?.trim() || null, artist?.trim() || null, diag)
    diag.audioUrlResolved = !!audioUrl
    if (!audioUrl) {
      diag.error = "no_audio_url"
      return debug ? Response.json(diag, { status: 404 }) : new Response(null, { status: 404 })
    }

    if (debug) {
      diag.error = null
      return Response.json(diag, { status: 200 })
    }

    const result = await streamAudio(audioUrl, request)
    if (!result) {
      diag.error = "stream_failed"
      return debug ? Response.json(diag, { status: 404 }) : new Response(null, { status: 404 })
    }

    return result
  } catch (err) {
    diag.error = `exception: ${err instanceof Error ? err.message : String(err)}`
    return debug ? Response.json(diag, { status: 500 }) : new Response(null, { status: 500 })
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
