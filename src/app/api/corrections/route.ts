import { NextRequest } from "next/server"
import { getSupabase } from "@/lib/supabase"

const MAX_WORD_LENGTH = 100

function sanitize(str: string): string {
  return str.replace(/[<>"']/g, "").trim()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const word = searchParams.get("word")

  const supabase = getSupabase()
  if (!supabase) {
    return Response.json({ corrections: [] })
  }

  try {
    let query = supabase.from("corrections").select("*")

    if (word) {
      query = query.eq("word", sanitize(word))
    }

    const { data, error } = await query
      .order("votes", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Supabase query error:", error.message ?? error)
      return Response.json({ corrections: [] })
    }

    return Response.json({ corrections: data ?? [] })
  } catch {
    return Response.json({ corrections: [] })
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) {
    return Response.json(
      { error: "数据库未配置" },
      { status: 503 }
    )
  }

  try {
    if (!(request.headers.get("content-type") || "").includes("application/json")) {
      return Response.json({ error: "不支持的媒体类型" }, { status: 415 })
    }

    const text = await request.text()
    if (text.length > 5000) {
      return Response.json({ error: "请求体过大" }, { status: 413 })
    }

    const body = JSON.parse(text)
    const word = sanitize(body.word || "")
    const default_reading = sanitize(body.default_reading || "")
    const user_reading = sanitize(body.user_reading || "")

    if (!word || !user_reading) {
      return Response.json(
        { error: "缺少必填字段" },
        { status: 400 }
      )
    }

    if (word.length > MAX_WORD_LENGTH || user_reading.length > MAX_WORD_LENGTH) {
      return Response.json({ error: "字段过长" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("corrections")
      .insert({
        word,
        default_reading,
        user_reading,
        song_id: sanitize(body.song_id || "").slice(0, 100) || null,
        song_title: sanitize(body.song_title || "").slice(0, 200) || null,
        artist: sanitize(body.artist || "").slice(0, 200) || null,
      })
      .select()

    if (error) {
      console.error("Supabase insert error:", error.message ?? error)
      return Response.json(
        { error: "提交失败，请稍后重试" },
        { status: 500 }
      )
    }

    return Response.json({ correction: data?.[0] })
  } catch (e) {
    console.error("Correction POST error:", e instanceof Error ? e.message : String(e))
    return Response.json({ error: "提交失败" }, { status: 500 })
  }
}
