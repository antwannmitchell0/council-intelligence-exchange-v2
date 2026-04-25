// AgentDetailPanel — shown over the floor when a desk is clicked.
//
// Reveals the real specialty behind the codename: real display name,
// thesis, what-this-actually-does paragraph, academic citation, lifetime
// signals, last-signal time, and a CTA to subscribe for the actual
// signal stream.

"use client"

import Link from "next/link"
import type { FloorNickname } from "@/lib/floor/nicknames"
import {
  formatRelativePublic,
  type PublicAgentEntry,
} from "@/lib/public/operations"

type Props = {
  nickname: FloorNickname
  // Live agent data (heartbeat + signal counts) — null if Supabase
  // unavailable.
  entry: PublicAgentEntry | null
  onClose: () => void
}

export function AgentDetailPanel({ nickname, entry, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-label={`${nickname.nickname} agent detail`}
      className="pointer-events-auto absolute left-1/2 top-1/2 z-30 w-[min(520px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-violet/30 bg-void/95 p-7 shadow-2xl shadow-violet/10 backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close detail panel"
        className="mono absolute right-4 top-4 text-[11px] uppercase tracking-[0.18em] text-ink-veiled transition-colors duration-[120ms] hover:text-ink"
      >
        Close ✕
      </button>

      {/* Codename block */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-md border text-[16px] font-bold"
          style={{
            backgroundColor: `${nickname.hex}1f`,
            borderColor: `${nickname.hex}55`,
            color: nickname.hex,
          }}
        >
          {nickname.letter}
        </span>
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-ink-veiled">
            Agent codename
          </p>
          <p className="text-[24px] font-semibold tracking-[0.04em] text-ink">
            {nickname.nickname}
          </p>
        </div>
      </div>

      {/* Real specialty */}
      <div className="mt-6 border-t border-graphite pt-5">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-violet-glow/80">
          What this agent actually does
        </p>
        <p className="mt-2 text-[16px] font-semibold tracking-tight text-ink">
          {nickname.display_name}
        </p>
        <p className="mt-2 text-[13px] italic leading-[1.5] text-ink-body/85">
          {nickname.thesis}
        </p>
        <p className="mt-4 text-[13px] leading-[1.65] text-ink-body/80">
          {nickname.detail}
        </p>
      </div>

      {/* Live stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-graphite pt-5">
        <div className="flex flex-col gap-1 rounded-md border border-graphite bg-void/40 px-3 py-2">
          <p className="mono text-[9px] uppercase tracking-[0.18em] text-ink-veiled">
            Lifetime signals
          </p>
          <p className="text-[18px] font-semibold tracking-tight text-ink">
            {entry?.signals_lifetime.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-graphite bg-void/40 px-3 py-2">
          <p className="mono text-[9px] uppercase tracking-[0.18em] text-ink-veiled">
            Last signal
          </p>
          <p className="text-[14px] font-semibold tracking-tight text-ink">
            {formatRelativePublic(entry?.hours_since_last_signal ?? null)}
          </p>
        </div>
      </div>

      {/* Citation */}
      <p className="mono mt-5 text-[10px] uppercase tracking-[0.14em] text-ink-veiled">
        Anchor · {nickname.citation}
      </p>

      {/* Subscribe CTA */}
      <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-violet/30 bg-violet/[0.06] px-4 py-3">
        <p className="text-[12px] leading-[1.5] text-ink-body/80">
          Subscribers see the actual signals as {nickname.nickname} fires
          them — symbols, sides, filing references.
        </p>
        <Link
          href="/pricing"
          onClick={onClose}
          className="mono shrink-0 rounded-md bg-violet px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink transition-colors duration-[120ms] hover:bg-violet-glow"
        >
          $49/mo →
        </Link>
      </div>
    </div>
  )
}
