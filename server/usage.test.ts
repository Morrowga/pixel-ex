import { describe, expect, it } from 'vitest'
import { costOf, prices, recordUsage, summarize, tracked, usd } from './usage'

describe('token accounting', () => {
  it('adds up every call made inside one question, including parallel ones', async () => {
    const seen: string[] = []
    const orig = console.log
    console.log = (m: string) => seen.push(String(m))
    try {
      await tracked('TOTAL', async () => {
        recordUsage('plan', { prompt_tokens: 7500, completion_tokens: 600, completion_tokens_details: { reasoning_tokens: 200 } })
        await Promise.all([
          Promise.resolve().then(() => recordUsage('sprite', { prompt_tokens: 650, completion_tokens: 2500 })),
          Promise.resolve().then(() => recordUsage('sprite', { prompt_tokens: 650, completion_tokens: 2000 })),
        ])
        recordUsage('plan', { prompt_tokens: 7600, completion_tokens: 700, prompt_tokens_details: { cached_tokens: 5000 } })
      })
    } finally {
      console.log = orig
    }
    const line = seen.join('\n')
    expect(line).toContain('22,200 tokens') // 7500+600+650+2500+650+2000+7600+700
    expect(line).toContain('(16,400 in + 5,800 out')
    // 16,400 input x $0.2/M + 5,800 output x $1.2/M = 0.00328 + 0.00696
    expect(line).toContain('COST $0.01024')
    expect(line).toContain('4 call(s)')
    expect(line).toMatch(/plan x2: 16,400 tokens, \$0\.0/)
    expect(line).toMatch(/sprite x2: 5,800 tokens, \$0\.0/)
    expect(line).toContain('200 thinking')
    expect(line).toContain('5,000 cached')
  })

  it('two questions at once keep separate totals', async () => {
    const out: string[] = []
    const orig = console.log
    console.log = (m: string) => out.push(String(m))
    try {
      await Promise.all([
        tracked('A', async () => { await new Promise((r) => setTimeout(r, 5)); recordUsage('plan', { prompt_tokens: 100, completion_tokens: 10 }) }),
        tracked('B', async () => { recordUsage('plan', { prompt_tokens: 1000, completion_tokens: 100 }) }),
      ])
    } finally {
      console.log = orig
    }
    expect(out.find((l) => l.includes('A:'))).toContain('110 tokens')
    expect(out.find((l) => l.includes('B:'))).toContain('1,100 tokens')
  })

  it('says so when no OpenAI call was made', async () => {
    const out: string[] = []
    const orig = console.log
    console.log = (m: string) => out.push(String(m))
    try { await tracked('X', async () => 1) } finally { console.log = orig }
    expect(out.join('')).toContain('no OpenAI calls (COST $0, 0 tokens)')
    expect(summarize([])).toContain('COST $0.00000')
  })

  it('prices: $0.2 per 1M input, $1.2 per 1M output, thinking billed as output', () => {
    expect(prices()).toEqual({ input: 0.2, output: 1.2, cached: 0.2 })
    // the two questions I measured live: a simple one and one that drew two sprites
    expect(costOf([{ kind: 'plan', input: 8301, output: 345, reasoning: 43, cached: 8292 }])).toBeCloseTo(0.0020742, 6)
    expect(costOf([{ kind: 'plan', input: 9569, output: 2819, reasoning: 1750, cached: 8292 }])).toBeCloseTo(0.0052966, 6)
    expect(usd(0.0020742)).toBe('$0.00207')
    expect(usd(1.23456)).toBe('$1.2346')
  })

  it('a cheaper cached-input price lowers the cost; env prices are respected', () => {
    process.env.PRICE_CACHED_INPUT_PER_M = '0.02'
    try {
      const withCache = costOf([{ kind: 'plan', input: 8301, output: 345, reasoning: 0, cached: 8292 }])
      expect(withCache).toBeCloseTo((9 * 0.2 + 8292 * 0.02 + 345 * 1.2) / 1e6, 8)
      process.env.PRICE_INPUT_PER_M = '1'
      process.env.PRICE_OUTPUT_PER_M = '2'
      expect(prices()).toMatchObject({ input: 1, output: 2 })
    } finally {
      delete process.env.PRICE_CACHED_INPUT_PER_M
      delete process.env.PRICE_INPUT_PER_M
      delete process.env.PRICE_OUTPUT_PER_M
    }
  })
})
