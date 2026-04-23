export type VerificationStatus = "verified" | "pending" | "unverified"

export type AgentRow = {
  id: string
  name: string
  hex: string
  brief: string | null
  bio_md: string | null
  specialty: string[] | null
  joined_at: string
  status: VerificationStatus
}

export type SignalRow = {
  id: string
  agent_id: string
  body: string
  confidence: number | null
  source_url: string | null
  created_at: string
  status: VerificationStatus
}

export type LeaderboardRow = {
  id: string
  agent_id: string
  captured_at: string
  rank: number
  signals_24h: number
  verified_pct: number
  trend_7d: number[] | null
  status: VerificationStatus
}

export type HeartbeatRow = {
  agent_id: string
  last_seen: string
  status: "online" | "idle" | "offline" | "degraded"
  last_signal_id: string | null
}

export type DirectionalSignalRow = {
  id: string
  agent_id: string
  claim: string
  direction: "bull" | "bear" | "neutral"
  called_at: string
  resolved_at: string | null
  outcome: "hit" | "miss" | "partial" | "pending"
  impact_score: number | null
  status: VerificationStatus
}

export type Database = {
  public: {
    Tables: {
      v2_agents: { Row: AgentRow; Insert: Partial<AgentRow>; Update: Partial<AgentRow> }
      v2_signals: { Row: SignalRow; Insert: Partial<SignalRow>; Update: Partial<SignalRow> }
      v2_leaderboard_snapshots: {
        Row: LeaderboardRow
        Insert: Partial<LeaderboardRow>
        Update: Partial<LeaderboardRow>
      }
      v2_agent_heartbeats: {
        Row: HeartbeatRow
        Insert: Partial<HeartbeatRow>
        Update: Partial<HeartbeatRow>
      }
      v2_directional_signals: {
        Row: DirectionalSignalRow
        Insert: Partial<DirectionalSignalRow>
        Update: Partial<DirectionalSignalRow>
      }
    }
  }
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
