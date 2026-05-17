import { NextRequest } from "next/server"
import { fetchLyricsFromSource } from "@/lib/lyrics-sources"

export async function POST(request: NextRequest) {
  try {
    if (!(request.headers.get("content-type") || "").includes("application/json")) {
      return Response.json({ error: "不支持的媒体类型" }, { status: 415 })
    }

    const text = await request.text()
    if (text.length > 5000) {
      return Response.json({ error: "请求体过大" }, { status: 413 })
    }

    const body = JSON.parse(text)
    const { song } = body

    if (!song || !song.id || !song.source) {
      return Response.json({ error: "缺少歌曲信息" }, { status: 400 })
    }

    if (typeof song.id !== "string" || typeof song.source !== "string") {
      return Response.json({ error: "参数格式错误" }, { status: 400 })
    }

    const ALLOWED_SOURCES = ["netease", "genius", "lrclib", "lyricsovh"]
    if (!ALLOWED_SOURCES.includes(song.source)) {
      return Response.json({ error: "不支持的歌曲来源" }, { status: 400 })
    }

    const token = process.env.GENIUS_ACCESS_TOKEN?.trim() || ""
    const lyrics = await fetchLyricsFromSource(song, token)

    return Response.json({ lyrics, title: song.title, artist: song.artist })
  } catch (error) {
    console.error("Lyrics fetch error:", error instanceof Error ? error.message : String(error))
    return Response.json(
      { error: "获取歌词失败，请稍后重试" },
      { status: 500 }
    )
  }
}
