import { log } from './log'

/**
 * One token budget for the whole site, for every visitor together (not per person).
 * TOKEN_BUDGET sets it. On Vercel it defaults to 500,000; on your own computer there is no limit unless you set it.
 *
 * The running total has to live somewhere all the server copies can see. If an Upstash Redis (Vercel "KV") is
 * connected (KV_REST_API_URL + KV_REST_API_TOKEN), the total lives there and the limit is shared and exact.
 * Without it the total lives in memory, which is per server copy and resets when it restarts: fine locally,
 * only a rough guard on Vercel.
 */
const KEY = 'qe:tokens'
let memory = 0

export const budgetLimit = (): number => {
  const v = process.env.TOKEN_BUDGET
  if (v !== undefined && v !== '' && Number.isFinite(Number(v))) return Number(v)
  return process.env.VERCEL ? 500_000 : Infinity
}

const remote = () => {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

async function call(path: string): Promise<number | null> {
  const r = remote()
  if (!r) return null
  try {
    const res = await fetch(`${r.url}/${path}`, { headers: { Authorization: `Bearer ${r.token}` } })
    const body = (await res.json()) as { result?: string | number | null }
    return Number(body.result ?? 0)
  } catch (e) {
    log(`  ⚠ token budget store unreachable (${e instanceof Error ? e.message : e}); using this server's own count`)
    return null
  }
}

/** Tokens used so far by everyone. */
export async function tokensUsed(): Promise<number> {
  return (await call(`get/${KEY}`)) ?? memory
}

/** True when the shared budget is used up, so no new lessons should start. */
export async function overBudget(): Promise<boolean> {
  const limit = budgetLimit()
  return limit !== Infinity && (await tokensUsed()) >= limit
}

/** Adds tokens just used by an OpenAI call. */
export async function addTokens(n: number): Promise<void> {
  if (!(n > 0)) return
  memory += n
  await call(`incrby/${KEY}/${Math.round(n)}`)
}

export const resetBudget = () => {
  memory = 0
}
