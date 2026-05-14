import { NextRequest } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = getSupabase()
  if (!supabase) {
    return Response.json({ error: "数据库未配置" }, { status: 503 })
  }

  try {
    const { error } = await supabase
      .from("corrections")
      .delete()
      .eq("id", id)

    if (error) {
      return Response.json({ error: "删除失败" }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: "删除失败" }, { status: 500 })
  }
}
