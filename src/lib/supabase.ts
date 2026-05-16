import { createClient } from "@supabase/supabase-js"

let client: ReturnType<typeof createClient> | null | undefined = undefined

export function getSupabase() {
  if (client !== undefined) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    client = null
    return null
  }
  client = createClient(url, key)
  return client
}
