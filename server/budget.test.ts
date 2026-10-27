import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addTokens, budgetLimit, overBudget, resetBudget, tokensUsed } from './budget'

describe('site-wide token budget', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    delete process.env.KV_REST_API_URL
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.TOKEN_BUDGET
    delete process.env.VERCEL
    resetBudget()
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  it('has no limit on your own computer by default', async () => {
    expect(budgetLimit()).toBe(Infinity)
    await addTokens(10_000_000)
    expect(await overBudget()).toBe(false)
  })

  it('defaults to 500,000 on Vercel', () => {
    process.env.VERCEL = '1'
    expect(budgetLimit()).toBe(500_000)
  })

  it('counts everyone together and stops at the limit', async () => {
    process.env.TOKEN_BUDGET = '1000'
    await addTokens(400)
    await addTokens(500)
    expect(await tokensUsed()).toBe(900)
    expect(await overBudget()).toBe(false)
    await addTokens(100)
    expect(await overBudget()).toBe(true)
  })
})
