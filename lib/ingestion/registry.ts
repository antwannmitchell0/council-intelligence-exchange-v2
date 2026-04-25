// Agent registry — maps `agent_id` strings to BaseIngestionAgent constructors.
// Phase 3 registers the first six concrete trading specialists here. The
// cron route imports `agentRegistry` and resolves by id; adding a new agent
// is (a) drop a file under `lib/ingestion/agents/`, (b) register it here,
// (c) add the cron entry to `vercel.ts`.

import type { BaseIngestionAgent } from "./base-agent"
import { ClinicalTrialOutcomesAgent } from "./agents/clinical-trial-outcomes"
import { CongressAgent } from "./agents/congress"
import { EtherscanWhaleAgent } from "./agents/etherscan-whale"
import { FedFuturesAgent } from "./agents/fed-futures"
import { GdeltEventVolumeAgent } from "./agents/gdelt-event-volume"
import { InsiderFilingAgent } from "./agents/insider-filing"
import { JobsDataAgent } from "./agents/jobs-data"
import { ThirteenFAgent } from "./agents/thirteen-f"
import { ThirteenFDiffAgent } from "./agents/thirteen-f-diff"
import { WikiEditSurgeAgent } from "./agents/wiki-edit-surge"
import { YieldCurveAgent } from "./agents/yield-curve"

export type AgentFactory = () => BaseIngestionAgent

export type AgentRegistry = Record<string, AgentFactory>

export const agentRegistry: AgentRegistry = {
  // SEC EDGAR — 6-hourly cron.
  "insider-filing-agent": () => new InsiderFilingAgent(),
  "thirteen-f-agent": () => new ThirteenFAgent(),
  // Reads thirteen-f-agent's output, computes quarter-over-quarter diffs.
  "thirteen-f-diff-agent": () => new ThirteenFDiffAgent(),

  // Senate Stock Watcher — 6-hourly cron.
  "congress-agent": () => new CongressAgent(),

  // FRED / BLS — daily cron after US market close.
  "yield-curve-agent": () => new YieldCurveAgent(),
  "jobs-data-agent": () => new JobsDataAgent(),
  "fed-futures-agent": () => new FedFuturesAgent(),

  // Phase 6a archetype ingestion — alt-data specialists.
  "gdelt-event-volume-agent": () => new GdeltEventVolumeAgent(),
  "wiki-edit-surge-agent": () => new WikiEditSurgeAgent(),
  "etherscan-whale-agent": () => new EtherscanWhaleAgent(),
  "clinical-trial-outcomes-agent": () => new ClinicalTrialOutcomesAgent(),
}

export function resolveAgent(agent_id: string): BaseIngestionAgent | null {
  const factory = agentRegistry[agent_id]
  if (!factory) return null
  return factory()
}

export function listRegisteredAgents(): string[] {
  return Object.keys(agentRegistry)
}
