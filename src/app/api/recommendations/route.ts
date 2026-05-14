import { NextRequest } from "next/server"
import { getSupabase } from "@/lib/supabase"

const MAX_LENGTH = 100
const DAILY_LIMIT = 5

const ipCounters = new Map<string, { date: string; count: number }>()

function sanitize(str: string): string {
  return str.replace(/[<>"']/g, "").trim()
}

function getIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown"
  return ip
}

function hashIp(ip: string): string {
  let hash = 0
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function checkDailyLimit(ipHash: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  const record = ipCounters.get(ipHash)
  if (!record || record.date !== today) {
    ipCounters.set(ipHash, { date: today, count: 0 })
    return true
  }
  return record.count < DAILY_LIMIT
}

function incrementCounter(ipHash: string): void {
  const today = new Date().toISOString().slice(0, 10)
  const record = ipCounters.get(ipHash)
  if (!record || record.date !== today) {
    ipCounters.set(ipHash, { date: today, count: 1 })
  } else {
    record.count++
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const word = searchParams.get("word")

  if (!word || !word.trim()) {
    return Response.json({ recommendations: [] })
  }

  const supabase = getSupabase()
  if (!supabase) {
    return Response.json({ recommendations: [] })
  }

  try {
    const { data, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("word", sanitize(word))
      .order("is_official", { ascending: false })
      .order("votes_up", { ascending: false })
      .limit(20)

    if (error) {
      console.error("Supabase query error:", error)
      return Response.json({ recommendations: [] })
    }

    return Response.json({ recommendations: data ?? [] })
  } catch {
    return Response.json({ recommendations: [] })
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) {
    return Response.json({ error: "数据库未配置" }, { status: 503 })
  }

  try {
    const text = await request.text()
    if (text.length > 2000) {
      return Response.json({ error: "请求体过大" }, { status: 413 })
    }

    const body = JSON.parse(text)
    const word = sanitize(body.word || "")
    const reading = sanitize(body.reading || "")
    const default_reading = sanitize(body.default_reading || "")

    if (!word || !reading) {
      return Response.json({ error: "缺少必填字段" }, { status: 400 })
    }
    if (word.length > MAX_LENGTH || reading.length > MAX_LENGTH) {
      return Response.json({ error: "字段过长" }, { status: 400 })
    }

    const ipHash = hashIp(getIp(request))
    if (!checkDailyLimit(ipHash)) {
      return Response.json({ error: "今日提交次数已达上限" }, { status: 429 })
    }

    const { data, error } = await supabase
      .from("recommendations")
      .insert({
        word,
        reading,
        default_reading: default_reading || null,
        votes_up: 0,
        votes_down: 0,
        is_official: false,
        ip_hash: ipHash,
      })
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return Response.json({ error: "提交失败" }, { status: 500 })
    }

    incrementCounter(ipHash)
    return Response.json({ recommendation: data?.[0] })
  } catch {
    return Response.json({ error: "提交失败" }, { status: 500 })
  }
}
