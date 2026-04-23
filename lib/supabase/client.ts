"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

let cached: SupabaseClient<Database> | null = null

export function getBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") return null
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  return cached
}
