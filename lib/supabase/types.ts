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
  price_monthly_cents: number | null
  tier_label: string | null
}

export type EarlyAccessRequestRow = {
  id: string
  email: string
  agent_id: string | null
  use_case: string | null
  company: string | null
  created_at: string
}

export type StageTag =
  | "pending"
  | "backtest-verified"
  | "broker-paper-tracking"
  | "live-verified"
  | "live-trading"

export type OrderSide = "buy" | "sell"

export type SignalRow = {
  id: string
  agent_id: string
  body: string
  confidence: number | null
  source_url: string | null
  created_at: string
  status: VerificationStatus
  symbol: string | null
  side: OrderSide | null
  target_weight: number | null
  stage_tag: StageTag
  source_id: string | null
  external_id: string | null
}

export type TradeTicketStatus =
  | "submitted"
  | "accepted"
  | "filled"
  | "partially_filled"
  | "canceled"
  | "rejected"
  | "expired"

export type TradeTicketRow = {
  id: string
  signal_id: string
  agent_id: string
  alpaca_order_id: string | null
  client_order_id: string
  symbol: string
  side: OrderSide
  qty: number | null
  notional: number | null
  filled_avg_price: number | null
  order_status: TradeTicketStatus
  submitted_at: string | null
  filled_at: string | null
  broker: string
  raw: Record<string, unknown> | null
  created_at: string
  updated_at: string
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

export type SourceKind =
  | "realtime"
  | "api"
  | "feed"
  | "scrape"
  | "filing"
  | "on-chain"
  | "webhook"
  | "database"

export type SourceCategory =
  | "markets"
  | "regulatory"
  | "infrastructure"
  | "geopolitics"
  | "science"
  | "private-capital"
  | "on-chain"
  | "language"
  | "internal"

export type HiveEventKind =
  | "signal-published"
  | "signal-corroborated"
  | "agent-awake"
  | "agent-sleep"
  | "message"

export type HiveEventRow = {
  id: string
  kind: HiveEventKind
  from_agent: string | null
  to_agent: string | null
  signal_id: string | null
  payload: Record<string, unknown> | null
  occurred_at: string
}

export type SourceRow = {
  id: string
  agent_id: string
  name: string
  kind: SourceKind
  category: SourceCategory
  description: string | null
  cadence: string | null
  endpoint_public: boolean
  endpoint: string | null
  status: VerificationStatus
  verified_at: string | null
  created_at: string
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
      v2_sources: {
        Row: SourceRow
        Insert: Partial<SourceRow>
        Update: Partial<SourceRow>
      }
      v2_hive_events: {
        Row: HiveEventRow
        Insert: Partial<HiveEventRow> & { kind: HiveEventKind }
        Update: Partial<HiveEventRow>
      }
      v2_early_access_requests: {
        Row: EarlyAccessRequestRow
        Insert: {
          id?: string
          email: string
          agent_id?: string | null
          use_case?: string | null
          company?: string | null
          created_at?: string
        }
        Update: Partial<EarlyAccessRequestRow>
      }
      v2_trade_tickets: {
        Row: TradeTicketRow
        Insert: Partial<TradeTicketRow> & {
          signal_id: string
          agent_id: string
          client_order_id: string
          symbol: string
          side: OrderSide
          order_status: TradeTicketStatus
        }
        Update: Partial<TradeTicketRow>
      }
    }
  }
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}
