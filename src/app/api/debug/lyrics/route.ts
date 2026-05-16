import { NextRequest } from "next/server"

const BROWSER_HEADERS: Record<string, string> = {
  "Referer": "https://music.163.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !/^\d+$/.test(id)) return Response.json({ error: "需要网易云歌曲ID" }, { status: 400 })

  try {
    const res = await fetch(
      `https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=1&kv=1`,
      { headers: BROWSER_HEADERS }
    )

    if (!res.ok) {
      return Response.json({ error: `Netease API error: ${res.status}` }, { status: res.status })
    }

    const data = await res.json()

    const kanaCount = (text: string) => (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length
    const density = (text: string) => {
      const clean = text.replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, "").replace(/<\d+,\d+>/g, "")
      const total = clean.replace(/\s/g, "").length || 1
      return ((clean.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length / total * 100).toFixed(1)
    }

    const lrcLyric = data.lrc?.lyric || ""
    const kLyric = data.klyric?.lyric || ""
    const tLyric = data.tlyric?.lyric || ""

    return Response.json({
      id,
      nolyric: data.nolyric,
      uncollected: data.uncollected,
      sgc: data.sgc,
      fields: {
        lrc: {
          length: lrcLyric.length,
          kanaCount: kanaCount(lrcLyric),
          kanaDensity: density(lrcLyric) + "%",
          preview: lrcLyric.slice(0, 300),
        },
        klyric: {
          length: kLyric.length,
          kanaCount: kanaCount(kLyric),
          kanaDensity: density(kLyric) + "%",
          preview: kLyric.slice(0, 300),
        },
        tlyric: {
          length: tLyric.length,
          kanaCount: kanaCount(tLyric),
          kanaDensity: density(tLyric) + "%",
          preview: tLyric.slice(0, 300),
        },
      },
    })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
