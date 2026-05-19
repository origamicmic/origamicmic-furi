import { NextRequest } from "next/server"

const QQ_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

const QQ_HEADERS: Record<string, string> = {
  "User-Agent": QQ_UA,
  "Accept": "application/json",
  "Referer": "https://y.qq.com",
  "Origin": "https://y.qq.com",
}

const SEARCH_TIMEOUT = 10000
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

interface QQTrack {
  mid: string
  title: string
  artist: string
  duration: number
}

async function searchQQ(query: string): Promise<QQTrack[]> {
  const body = JSON.stringify({
    comm: { ct: "19", cv: "1859", uin: "0" },
    req: {
      method: "DoSearchForQQMusicDesktop",
      module: "music.search.SearchCgiService",
      param: {
        grp: 1,
        num_per_page: 20,
        page_num: 1,
        query,
        search_type: 0,
      },
    },
  })

  const res = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    method: "POST",
    headers: { ...QQ_HEADERS, "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(SEARCH_TIMEOUT),
  })

  if (!res.ok) {
    console.warn(`[qq] search HTTP ${res.status}`)
    return []
  }

  const data = await res.json() as Record<string, unknown>
  const list = (data.req as Record<string, unknown>)?.data as Record<string, unknown>
  const songs = list?.body?.song?.list as Record<string, unknown>[] | undefined
  if (!songs || songs.length === 0) {
    console.warn("[qq] no results")
    return []
  }

  return songs.map((s) => ({
    mid: String(s.mid || ""),
    title: String(s.name || ""),
    artist: ((s.singer as Array<Record<string, string>>)?.[0]?.name) || "Unknown",
    duration: (Number(s.interval) || 0) * 1000,
  }))
}

async function getAudioURL(mid: string): Promise<string | null> {
  const file = `M500${mid}${mid}.mp3`
  const body = JSON.stringify({
    req_1: {
      module: "vkey.GetVkeyServer",
      method: "CgiGetVkey",
      param: {
        filename: [file],
        guid: "10000",
        songmid: [mid],
        songtype: [0],
        uin: "0",
        loginflag: 1,
        platform: "20",
      },
    },
    comm: { uin: "0", format: "json", ct: 24, cv: 0 },
  })

  const res = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    method: "POST",
    headers: { ...QQ_HEADERS, "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(SEARCH_TIMEOUT),
  })

  if (!res.ok) {
    console.warn(`[qq] vkey HTTP ${res.status}`)
    return null
  }

  const data = await res.json() as Record<string, unknown>
  const reqData = (data.req_1 as Record<string, unknown>)?.data as Record<string, unknown>
  const midInfo = (reqData?.midurlinfo as Record<string, unknown>[])?.[0]
  const purl = midInfo?.purl as string | undefined
  if (!purl) {
    console.warn(`[qq] VIP/restricted: ${mid}`)
    return null
  }

  const sip = (reqData?.sip as string[])?.[0] || ""
  const url = sip + purl
  return url.startsWith("http") ? url : `https://${url}`
}

function scoreTrack(track: QQTrack, expectTitle: string | null, expectArtist: string | null, durationMs: number | null): number {
  let score = 0
  if (expectTitle) {
    const tl = track.title.toLowerCase()
    const et = expectTitle.toLowerCase().trim()
    if (tl === et) score += 50
    else if (tl.startsWith(et)) score += 40
    else if (tl.includes(et)) score += 25
  }
  if (expectArtist) {
    const al = track.artist.toLowerCase()
    const ea = expectArtist.toLowerCase().trim().replace(/&/g, "and")
    if (al === ea) score += 40
    else if (al.includes(ea) || ea.includes(al)) score += 25
  }
  if (durationMs && track.duration) {
    const ratio = Math.abs(track.duration - durationMs) / durationMs
    if (ratio <= 0.05) score += 30
    else if (ratio <= 0.15) score += 15
  }
  return score
}

async function streamAudio(audioUrl: string, request: NextRequest): Promise<Response | null> {
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent": QQ_UA,
      "Referer": "https://y.qq.com",
    }
    const range = request.headers.get("range")
    if (range) reqHeaders["Range"] = range

    const controller = new AbortController()
    const connectTimeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(audioUrl, {
      headers: reqHeaders,
      redirect: "follow",
      signal: controller.signal,
    })
    clearTimeout(connectTimeout)

    if (!res.ok) {
      console.warn(`[qq] stream HTTP ${res.status}`)
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
    console.warn(`[qq] stream error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")
  const title = searchParams.get("title")
  const artist = searchParams.get("artist")
  const dur = searchParams.get("dur")
  const debug = searchParams.get("debug")

  if (!q || q.trim().length === 0) {
    return new Response(null, { status: 400 })
  }

  const durationMs = dur ? Number(dur) : null
  const diag: Record<string, unknown> = { query: q.trim() }

  try {
    const tracks = await searchQQ(q.trim())
    if (diag) { diag.totalResults = tracks.length }

    if (tracks.length === 0) {
      diag.error = "no_results"
      return Response.json(diag, { status: 404 })
    }

    // Score and sort
    const scored = tracks.map((t) => ({
      track: t,
      score: scoreTrack(t, title?.trim() || null, artist?.trim() || null, durationMs),
    })).sort((a, b) => b.score - a.score)

    if (diag) {
      diag.searchScores = scored.slice(0, 5).map((s) => ({
        title: s.track.title,
        artist: s.track.artist,
        duration: s.track.duration,
        score: s.score,
      }))
    }

    // Try tracks in score order
    for (const { track } of scored) {
      console.warn(`[qq] trying: ${track.title} - ${track.artist} score=${scored.find((s) => s.track === track)?.score}`)
      const audioUrl = await getAudioURL(track.mid)
      if (!audioUrl) continue

      console.warn(`[qq] audio: ${audioUrl.slice(0, 80)}`)

      if (debug) {
        diag.foundTrack = `${track.title} - ${track.artist}`
        diag.audioUrlResolved = true
        diag.duration = track.duration
        return Response.json(diag, { status: 200 })
      }

      const result = await streamAudio(audioUrl, request)
      if (result) return result
    }

    diag.error = "no_playable"
    return debug ? Response.json(diag, { status: 404 }) : new Response(null, { status: 404 })
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
