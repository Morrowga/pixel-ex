import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import app from './app'
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

  it('when the budget is used up, a lesson request gets a friendly message in the learner\'s language, not an error page', async () => {
    process.env.TOKEN_BUDGET = '100'
    await addTokens(100)
    for (const [lang, word] of [['en', 'limit'], ['ja', '上限'], ['my', 'ကန့်သတ်ချက်']] as const) {
      for (const accept of ['application/json', 'application/x-ndjson']) {
        const res = await app.request('/api/lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: accept },
          body: JSON.stringify({ question: 'what is a cat', lang }),
        })
        expect(res.status).toBe(503)
        expect(res.headers.get('content-type')).toMatch(/application\/json/)
        const body = (await res.json()) as { error: string }
        expect(body.error).toContain(word)
      }
    }
  })

  it('answers to a lesson already made are still checked when the budget is used up', async () => {
    process.env.TOKEN_BUDGET = '100'
    await addTokens(100)
    const res = await app.request('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: 'not-a-real-token', answer: '7', lang: 'en' }) })
    expect(res.status).not.toBe(503)
  })
})
