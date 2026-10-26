import { AsyncLocalStorage } from 'node:async_hooks'
import { log } from './log'

export interface CallUsage {
  kind: string
  input: number
  output: number
  /** Hidden "thinking" tokens, already counted inside output. */
  reasoning: number
  /** Input tokens served from the provider's cache, already counted inside input. */
  cached: number
}

const store = new AsyncLocalStorage<CallUsage[]>()

/**
 * Prices in US dollars per 1 million tokens. Set PRICE_INPUT_PER_M / PRICE_OUTPUT_PER_M in .env to change them.
 * Thinking tokens are part of "output" and are billed as output. Cached input is billed at the normal input
 * price unless PRICE_CACHED_INPUT_PER_M is set, so the shown cost is a safe upper bound.
 */
export function prices() {
  const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d)
  const input = num(process.env.PRICE_INPUT_PER_M, 0.2)
  return {
    input,
    output: num(process.env.PRICE_OUTPUT_PER_M, 1.2),
    cached: num(process.env.PRICE_CACHED_INPUT_PER_M, input),
  }
}

/** Dollars for a set of calls. */
export function costOf(calls: CallUsage[]): number {
  const p = prices()
  return calls.reduce((sum, c) => sum + ((c.input - c.cached) * p.input + c.cached * p.cached + c.output * p.output) / 1_000_000, 0)
}

export const usd = (x: number) => `$${x.toFixed(x < 0.1 ? 5 : 4)}`

// Running totals since the server started, so you can see the average at a glance.
const session = { questions: 0, cost: 0 }

/** Called after each OpenAI response. Adds to whichever question is being processed. */
export function recordUsage(
  kind: string,
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
    prompt_tokens_details?: { cached_tokens?: number }
  },
) {
  if (!usage) return
  store.getStore()?.push({
    kind,
    input: usage.prompt_tokens ?? 0,
    output: usage.completion_tokens ?? 0,
    reasoning: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    cached: usage.prompt_tokens_details?.cached_tokens ?? 0,
  })
}

const n = (x: number) => x.toLocaleString('en-US')

export function summarize(calls: CallUsage[]): string {
  const input = calls.reduce((a, c) => a + c.input, 0)
  const output = calls.reduce((a, c) => a + c.output, 0)
  const reasoning = calls.reduce((a, c) => a + c.reasoning, 0)
  const cached = calls.reduce((a, c) => a + c.cached, 0)
  const byKind = new Map<string, { calls: number; tokens: number }>()
  for (const c of calls) {
    const k = byKind.get(c.kind) ?? { calls: 0, tokens: 0 }
    byKind.set(c.kind, { calls: k.calls + 1, tokens: k.tokens + c.input + c.output })
  }
  const byKindCost = new Map<string, number>()
  for (const c of calls) {
    byKindCost.set(c.kind, (byKindCost.get(c.kind) ?? 0) + costOf([c]))
  }
  const parts = [...byKind].map(([kind, v]) => `${kind} x${v.calls}: ${n(v.tokens)} tokens, ${usd(byKindCost.get(kind) ?? 0)}`).join(' | ')
  const extra = [reasoning ? `${n(reasoning)} thinking` : '', cached ? `${n(cached)} cached` : ''].filter(Boolean).join(', ')
  return `COST ${usd(costOf(calls))} | ${n(input + output)} tokens (${n(input)} in + ${n(output)} out${extra ? `; of which ${extra}` : ''}) | ${calls.length} call(s) | ${parts}`
}

/** Runs `fn`, collects every OpenAI call made inside it, and prints one line with the total. */
export async function tracked<T>(label: string, fn: () => Promise<T>, opts: { countAsQuestion?: boolean } = {}): Promise<T> {
  const calls: CallUsage[] = []
  try {
    return await store.run(calls, fn)
  } finally {
    log(calls.length ? `  ◆ ${label}: ${summarize(calls)}` : `  ◆ ${label}: no OpenAI calls (COST $0, 0 tokens)`)
    session.cost += costOf(calls)
    if (opts.countAsQuestion) {
      session.questions++
      log(`  ◆ since the server started: ${session.questions} question(s), ${usd(session.cost)} spent in total, ${usd(session.cost / session.questions)} per question on average`)
    }
  }
}
