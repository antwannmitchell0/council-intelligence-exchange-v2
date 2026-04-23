"use client"

import { useEffect, useState } from "react"
import { council } from "@/design/tokens"
import { cn } from "@/lib/utils"

type Status = "idle" | "submitting" | "ok" | "error"

export function EarlyAccessForm() {
  const [email, setEmail] = useState("")
  const [agentId, setAgentId] = useState<string>("")
  const [company, setCompany] = useState("")
  const [useCase, setUseCase] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    const match = hash.match(/agent=([\w-]+)/)
    if (match) setAgentId(match[1])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("submitting")
    setError(null)

    try {
      const res = await fetch("/api/marketplace/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          agent_id: agentId || null,
          company: company.trim() || null,
          use_case: useCase.trim() || null,
        }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setStatus("error")
        setError(json.error ?? "Something went wrong. Try again.")
        return
      }
      setStatus("ok")
      setEmail("")
      setCompany("")
      setUseCase("")
    } catch {
      setStatus("error")
      setError("Network error. Check your connection and retry.")
    }
  }

  if (status === "ok") {
    return (
      <div
        id="early-access"
        className="rounded-[12px] border border-cyan/30 bg-obsidian/60 p-10 text-center"
      >
        <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-cyan">
          Request received
        </p>
        <h3 className="mb-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-ink">
          The Council will be in touch.
        </h3>
        <p className="mx-auto max-w-[52ch] text-[15px] leading-[1.6] text-ink-body/80">
          Your request is logged. When the agent you selected is ready for your
          profile, you'll hear from us. No newsletter, no drip sequence.
        </p>
      </div>
    )
  }

  return (
    <form
      id="early-access"
      onSubmit={handleSubmit}
      className="rounded-[12px] border border-graphite bg-obsidian/40 p-8 sm:p-10"
    >
      <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
        Early access
      </p>
      <h3 className="mb-4 max-w-[24ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]">
        Request access to the Council.
      </h3>
      <p className="mb-8 max-w-[56ch] text-[15px] leading-[1.6] text-ink-body/75">
        Tell us what you're trying to solve and which agent(s) you want on.
        We'll reply when your slot opens.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Email <span className="text-danger">*</span>
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="rounded-[8px] border border-graphite bg-void/60 px-4 py-3 text-[15px] text-ink placeholder:text-ink-veiled focus:border-violet focus:outline-none"
            disabled={status === "submitting"}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Company
          </span>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional"
            className="rounded-[8px] border border-graphite bg-void/60 px-4 py-3 text-[15px] text-ink placeholder:text-ink-veiled focus:border-violet focus:outline-none"
            disabled={status === "submitting"}
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Primary agent of interest
          </span>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="rounded-[8px] border border-graphite bg-void/60 px-4 py-3 text-[15px] text-ink focus:border-violet focus:outline-none"
            disabled={status === "submitting"}
          >
            <option value="">No preference</option>
            {council.agent.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Use case
          </span>
          <textarea
            rows={4}
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            placeholder="What are you trying to solve? Be specific — the Council prefers specific."
            className="rounded-[8px] border border-graphite bg-void/60 px-4 py-3 text-[15px] text-ink placeholder:text-ink-veiled focus:border-violet focus:outline-none"
            disabled={status === "submitting"}
          />
        </label>
      </div>

      {error && (
        <p className="mono mt-5 text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="mono text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
          One request. No spam. No drip sequence.
        </p>
        <button
          type="submit"
          disabled={status === "submitting"}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-[8px] bg-violet px-6 py-3.5 text-[15px] font-medium text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-violet-glow disabled:opacity-50"
          )}
        >
          {status === "submitting" ? "Submitting…" : "Submit request"}
          <span
            aria-hidden
            className="transition-transform duration-[120ms] group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>
      </div>
    </form>
  )
}
