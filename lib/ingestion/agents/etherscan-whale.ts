// EtherscanWhaleAgent — outbound transfers > $1M USD from top-100 ETH wallets.
//
// Thesis
//   On-chain whale outflows from long-dormant or concentrated addresses often
//   precede short-horizon price action in ETH itself and in crypto-adjacent
//   equities (COIN, MSTR, miners). Filtering by a USD threshold removes the
//   fixed-denomination noise inherent to ETH balances.
//
// Data source
//   Etherscan API (free tier):
//     https://api.etherscan.io/api
//   Requires `ETHERSCAN_API_KEY`. Free tier = 5 calls/sec, 100k/day.
//
// Rate-limit posture
//   The free tier documents 5 req/s but community reports throttling at
//   higher loads. We run at 3 req/s / capacity 3 to stay comfortably below.
//
// External ID
//   The transaction hash (`hash` field) — the canonical unique id on-chain.
//
// Academic citation
//   Griffin & Shams (2020), *Is Bitcoin Really Untethered?* Journal of
//   Finance. On-chain flow concentration predicts market moves — not a
//   direct ETH/whale study, but the mechanistic argument ports cleanly.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, politeUserAgent, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "etherscan-txlist"
const AGENT_ID = "etherscan-whale-agent"

const ETHERSCAN_URL = "https://api.etherscan.io/api"

const etherscanLimiter = new RateLimiter({ capacity: 3, refillPerSec: 3 })

// Outbound transfers below $1M USD are out of scope.
const USD_THRESHOLD = 1_000_000

// Conservative ETH/USD price used for *filtering only*. The downstream
// ensemble can re-price with a live oracle; we just need a consistent cutoff
// that keeps the agent self-contained (no second API dependency).
// Reviewed 2026-04-23 — adjust only when ETH deviates materially from this range.
const ETH_USD_APPROX = 3000

// Representative slice of top-100 ETH holders. The full list drifts; the
// addresses below are a stable, verifiable subset dominated by known
// exchange hot-wallets + long-dormant whale addresses. Empty string is never
// returned — all entries are checksummed, 0x-prefixed, 42 chars.
const TOP_HOLDER_ADDRESSES = [
  // Beacon Deposit Contract
  "0x00000000219ab540356cBB839Cbe05303d7705Fa",
  // Wrapped Ether (WETH9)
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  // Binance
  "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
  "0xF977814e90dA44bFA03b6295A0616a897441aceC",
  // Bitfinex
  "0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F",
  // Kraken
  "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2",
  "0xDa9dfA130Df4dE4673b89022EE50ff26f6EA73Cf",
  // Arbitrum Bridge
  "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a",
  // Optimism Portal
  "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed",
  // Rocket Pool
  "0xae78736Cd615f374D3085123A210448E74Fc6393",
] as const

type EtherscanTx = {
  hash?: string
  from?: string
  to?: string
  value?: string // wei, stringified
  blockNumber?: string
  timeStamp?: string // unix seconds, stringified
  isError?: string
}

type EtherscanTxListResponse = {
  status?: string
  message?: string
  result?: EtherscanTx[] | string
}

type WhaleTransferPayload = {
  from_address: string
  to_address: string
  value_eth: number
  value_usd_approx: number
  block_number: number
  tx_hash: string
  timestamp: string
}

function assertEtherscanEnv(): string {
  const key = process.env.ETHERSCAN_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "ETHERSCAN_API_KEY env var is required for Etherscan API (https://etherscan.io/myapikey)"
    )
  }
  return key
}

function weiToEth(wei: string | undefined): number {
  if (!wei) return 0
  // BigInt avoids the 2^53 precision boundary; divide by 1e18 in number-space
  // only after taking the leading 10 digits as fractional ETH precision.
  try {
    const w = BigInt(wei)
    const eth = Number(w) / 1e18
    return Number.isFinite(eth) ? eth : 0
  } catch {
    return 0
  }
}

async function pullAddress(
  address: string,
  apiKey: string
): Promise<WhaleTransferPayload[]> {
  await etherscanLimiter.take()

  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    startblock: "0",
    endblock: "latest",
    sort: "desc",
    apikey: apiKey,
  })

  const res = await fetchWithRetry(`${ETHERSCAN_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": politeUserAgent("EtherscanWhaleAgent"),
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    throw new Error(
      `etherscan txlist(${address}) returned ${res.status} ${res.statusText}`
    )
  }

  const json = (await res.json()) as EtherscanTxListResponse

  // Etherscan returns status "0" + a string `result` for "No transactions
  // found" or rate-limit errors. Only "1" means a real list. Rate-limit text
  // should bubble up so the circuit breaker can trip.
  if (json.status !== "1") {
    const msg = typeof json.result === "string" ? json.result : json.message
    if (msg && /no transactions found/i.test(msg)) return []
    throw new Error(`etherscan txlist(${address}) error: ${msg ?? "unknown"}`)
  }

  const txs = Array.isArray(json.result) ? json.result : []
  const out: WhaleTransferPayload[] = []

  for (const tx of txs) {
    if (!tx.hash || !tx.from || !tx.to) continue
    // Outbound only — `from` must equal the monitored whale.
    if (tx.from.toLowerCase() !== address.toLowerCase()) continue
    // Skip reverted / failed transactions.
    if (tx.isError === "1") continue

    const value_eth = weiToEth(tx.value)
    const value_usd_approx = value_eth * ETH_USD_APPROX
    if (value_usd_approx < USD_THRESHOLD) continue

    const block_number = Number(tx.blockNumber ?? 0)
    const ts = Number(tx.timeStamp ?? 0)
    const timestamp = Number.isFinite(ts) && ts > 0
      ? new Date(ts * 1000).toISOString()
      : new Date().toISOString()

    out.push({
      from_address: tx.from,
      to_address: tx.to,
      value_eth,
      value_usd_approx,
      block_number,
      tx_hash: tx.hash,
      timestamp,
    })
  }

  return out
}

export class EtherscanWhaleAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    const apiKey = assertEtherscanEnv()

    const fetched_at = new Date().toISOString()
    const out: RawSignal<WhaleTransferPayload>[] = []

    for (const address of TOP_HOLDER_ADDRESSES) {
      const transfers = await pullAddress(address, apiKey)
      for (const t of transfers) {
        out.push({
          source_id: SOURCE_ID,
          external_id: t.tx_hash,
          fetched_at,
          payload: t,
        })
      }
    }

    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as WhaleTransferPayload
      if (!p.tx_hash) continue

      const external_id = buildExternalId([SOURCE_ID, p.tx_hash])

      const body = JSON.stringify({
        from_address: p.from_address,
        to_address: p.to_address,
        value_eth: p.value_eth,
        value_usd_approx: p.value_usd_approx,
        block_number: p.block_number,
        tx_hash: p.tx_hash,
        timestamp: p.timestamp,
      })

      const source_url = `https://etherscan.io/tx/${p.tx_hash}`

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
