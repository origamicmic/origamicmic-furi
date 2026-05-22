import { NextRequest } from "next/server"
import { getSupabase } from "@/lib/supabase"

const VOTE_DAILY_LIMIT = 50

const voteCounters = new Map<string, { date: string; count: number }>()
let lastCleanup = Date.now()

function cleanExpiredCounters() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  const today = new Date().toISOString().slice(0, 10)
  for (const [key, record] of voteCounters) {
    if (record.date !== today) voteCounters.delete(key)
  }
}

function hashIp(ip: string): string {
  let hash = 0
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function checkVoteLimit(ipHash: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  const record = voteCounters.get(ipHash)
  if (!record || record.date !== today) {
    voteCounters.set(ipHash, { date: today, count: 0 })
    return true
  }
  return record.count < VOTE_DAILY_LIMIT
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) {
    return Response.json({ error: "数据库未配置" }, { status: 503 })
  }

  try {
    if (!(request.headers.get("content-type") || "").includes("application/json")) {
      return Response.json({ error: "不支持的媒体类型" }, { status: 415 })
    }

    const text = await request.text()
    cleanExpiredCounters()
    if (text.length > 1000) return Response.json({ error: "请求体过大" }, { status: 413 })

    const body = JSON.parse(text)
    const { recommendation_id, vote: voteType }: { recommendation_id: string; vote: string } = body

    if (!recommendation_id || !["up", "down"].includes(voteType)) {
      return Response.json({ error: "参数错误" }, { status: 400 })
    }

    const forwarded = request.headers.get("x-forwarded-for")
    const ipHash = hashIp(forwarded?.split(",")[0]?.trim() ?? "unknown")
    if (!checkVoteLimit(ipHash)) {
      return Response.json({ error: "今日投票次数已达上限" }, { status: 429 })
    }

    const column = voteType === "up" ? "votes_up" : "votes_down"

    const { data: current } = await supabase
      .from("recommendations")
      .select("votes_up, votes_down")
      .eq("id", recommendation_id)
      .single()

    if (!current) {
      return Response.json({ error: "推荐不存在" }, { status: 404 })
    }

    const record = current as any

    const { error: updateErr } = await supabase
      .from("recommendations")
      .update({ [column]: ((record[column] as number) || 0) + 1 } as any)
      .eq("id", recommendation_id)

    if (updateErr) {
      console.error("Vote update error:", updateErr.message ?? updateErr)
      return Response.json({ error: "投票失败" }, { status: 500 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const record = voteCounters.get(ipHash)
    if (record && record.date === today) record.count++
    else voteCounters.set(ipHash, { date: today, count: 1 })

    return Response.json({
      success: true,
      votes: {
        votes_up: ((record.votes_up as number) || 0) + (voteType === "up" ? 1 : 0),
        votes_down: ((record.votes_down as number) || 0) + (voteType === "down" ? 1 : 0),
      },
    })
  } catch {
    return Response.json({ error: "投票失败" }, { status: 500 })
  }
}
