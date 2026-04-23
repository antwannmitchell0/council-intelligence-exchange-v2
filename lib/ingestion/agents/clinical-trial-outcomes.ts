// ClinicalTrialOutcomesAgent — Phase 3 trial outcome emissions from
// ClinicalTrials.gov.
//
// Thesis
//   Phase 3 trial readouts are the dominant binary catalyst in biotech
//   equities. Capturing the *completion* event with its primary-outcome
//   status — at the moment ClinicalTrials.gov publishes the update, before
//   mainstream aggregators pick it up — is a direct mechanical edge for
//   catalyst-driven strategies.
//
// Data source
//   ClinicalTrials.gov v2 REST API:
//     https://clinicaltrials.gov/api/v2/studies
//   Free, public, US-government data. No API key required.
//   Docs: https://clinicaltrials.gov/data-api/api
//
// Rate-limit posture
//   ClinicalTrials.gov publishes no hard quota but fair-use norms apply. We
//   run at 5 req/s / capacity 5 — and this agent makes one call per run.
//
// External ID
//   NCT identifier (e.g. `NCT05123456`) — canonical, globally unique.
//
// Academic citation
//   DiMasi, Grabowski, Hansen (2016), *Innovation in the pharmaceutical
//   industry: new estimates of R&D costs*, Journal of Health Economics.
//   Provides well-calibrated Phase 3 approval base rates by therapeutic area.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, politeUserAgent, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "clinicaltrials-gov-studies"
const AGENT_ID = "clinical-trial-outcomes-agent"

const CT_URL = "https://clinicaltrials.gov/api/v2/studies"

const ctLimiter = new RateLimiter({ capacity: 5, refillPerSec: 5 })

type CtProtocolId = {
  nctId?: string
}

type CtPhaseOrStatus = {
  overallStatus?: string
  phases?: string[]
  leadSponsor?: { name?: string; class?: string }
  completionDateStruct?: { date?: string }
}

type CtIdentification = {
  nctId?: string
  briefTitle?: string
}

type CtOutcome = {
  measure?: string
  description?: string
}

type CtStudy = {
  protocolSection?: {
    identificationModule?: CtIdentification
    statusModule?: CtPhaseOrStatus
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string; class?: string }
    }
    designModule?: { phases?: string[] }
    outcomesModule?: {
      primaryOutcomes?: CtOutcome[]
    }
  }
  // Fallback for API shape drift — some endpoints surface id at the top level.
  id?: CtProtocolId
}

type CtResponse = {
  studies?: CtStudy[]
}

type TrialPayload = {
  nct_id: string
  title: string | null
  sponsor: string | null
  phase: string | null
  status: string | null
  primary_outcome: string | null
  lead_sponsor_class: string | null
  completion_date: string | null
}

/** The earliest completion update we care about — recent window only. */
function rangeStartDate(): string {
  // 30-day look-back keeps us well inside the completions the cron should
  // have observed at least once. The DB unique index handles overlap.
  const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function isPhase3(phases: string[] | undefined): boolean {
  if (!phases || phases.length === 0) return false
  // CT.gov uses `PHASE3` (API v2) and legacy `Phase 3`. Match both.
  return phases.some((p) => /PHASE\s*3|Phase\s*3/i.test(p))
}

function firstOutcomeDescription(s: CtStudy): string | null {
  const outcomes = s.protocolSection?.outcomesModule?.primaryOutcomes ?? []
  if (outcomes.length === 0) return null
  const o = outcomes[0]
  // Prefer measure + description; fall back to whichever is present.
  const parts = [o.measure, o.description].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  )
  return parts.length > 0 ? parts.join(" — ") : null
}

export class ClinicalTrialOutcomesAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    // Query: completed studies whose LastUpdatePostDate is within the look-back
    // window. `format=json` is the default for v2 but set explicitly.
    const params = new URLSearchParams({
      "filter.overallStatus": "COMPLETED",
      "filter.advanced": `AREA[LastUpdatePostDate]RANGE[${rangeStartDate()},MAX]`,
      pageSize: "50",
      format: "json",
    })

    await ctLimiter.take()

    const res = await fetchWithRetry(`${CT_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": politeUserAgent("ClinicalTrialOutcomesAgent"),
        Accept: "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(
        `ClinicalTrials.gov returned ${res.status} ${res.statusText}`
      )
    }

    const json = (await res.json()) as CtResponse
    const studies = json.studies ?? []
    const fetched_at = new Date().toISOString()

    const out: RawSignal<TrialPayload>[] = []
    for (const s of studies) {
      const ident = s.protocolSection?.identificationModule
      const status = s.protocolSection?.statusModule
      const design = s.protocolSection?.designModule
      const sponsors = s.protocolSection?.sponsorCollaboratorsModule

      const nct_id = ident?.nctId ?? s.id?.nctId
      if (!nct_id) continue

      const phases = design?.phases ?? status?.phases
      if (!isPhase3(phases)) continue

      const payload: TrialPayload = {
        nct_id,
        title: ident?.briefTitle ?? null,
        sponsor: sponsors?.leadSponsor?.name ?? null,
        phase: phases && phases.length > 0 ? phases[0] : null,
        status: status?.overallStatus ?? null,
        primary_outcome: firstOutcomeDescription(s),
        lead_sponsor_class: sponsors?.leadSponsor?.class ?? null,
        completion_date: status?.completionDateStruct?.date ?? null,
      }

      out.push({
        source_id: SOURCE_ID,
        external_id: nct_id,
        fetched_at,
        payload,
      })
    }

    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as TrialPayload
      if (!p.nct_id) continue

      const external_id = buildExternalId([SOURCE_ID, p.nct_id])

      const body = JSON.stringify({
        nct_id: p.nct_id,
        title: p.title,
        sponsor: p.sponsor,
        phase: p.phase,
        status: p.status,
        primary_outcome: p.primary_outcome,
        lead_sponsor_class: p.lead_sponsor_class,
        completion_date: p.completion_date,
      })

      const source_url = `https://clinicaltrials.gov/study/${p.nct_id}`

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url,
        status: "pending",
      })
    }
    return out
  }
}
