import { beforeAll, describe, expect, it, vi } from 'vitest'
import { algebraPlan, applesPlan, conceptPlan } from '../src/engine/examples'
import type { Plan } from '../src/engine/plan'

// The AI is replaced by a fake that returns a fixed plan, so these tests cost nothing.
let nextPlan: Plan = applesPlan
vi.mock('./llm', () => ({
  planLesson: async () => nextPlan,
  gradeAnswer: async () => ({ verdict: 'wrong', feedback: 'fake grader' }),
  generateSprite: async () => null,
}))

beforeAll(() => {
  process.env.LESSON_SECRET = 'a-long-test-secret'
})

const post = (app: { request: (u: string, i: RequestInit) => Promise<Response> | Response }, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

async function newApp() {
  vi.resetModules() // a brand new copy of the whole server: no memory of anything before
  return (await import('./app')).default
}

describe('sealed tokens', () => {
  it('round-trip, and a changed, foreign or expired token is refused', async () => {
    const { seal, unseal } = await import('./seal')
    const token = seal({ hello: 'world' }, 60_000)
    expect(unseal<{ hello: string }>(token)).toEqual({ hello: 'world' })
    expect(unseal(token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA'))).toBeNull() // changed
    expect(unseal('not a token')).toBeNull()
    expect(unseal('')).toBeNull()
    expect(unseal(seal({ x: 1 }, -1))).toBeNull() // expired
    process.env.LESSON_SECRET = 'another-secret'
    expect(unseal(token)).toBeNull() // sealed with a different key
    process.env.LESSON_SECRET = 'a-long-test-secret'
  })
  it('the hidden answer cannot be read out of the token', async () => {
    const { seal } = await import('./seal')
    const token = seal({ verify: { kind: 'choice', options: ['secret-option-text'], correct: 0 } }, 60_000)
    const decoded = Buffer.from(token, 'base64url').toString('latin1')
    expect(token).not.toContain('secret-option-text')
    expect(decoded).not.toContain('secret-option-text')
  })
})

describe('the API remembers nothing between requests', () => {
  it('a lesson made on one server instance is answered by a different, brand new one', async () => {
    nextPlan = applesPlan
    const a = await newApp()
    const made = await (await post(a, '/api/lesson', { question: 'I have 3 apples and get 4 more', lang: 'en' })).json()
    expect(made.ok).toBe(true)
    const token: string = made.lesson.lessonId

    const b = await newApp() // another "machine": nothing carried over
    const right = await (await post(b, '/api/check', { lessonId: token, answer: '7', attempt: 1 })).json()
    expect(right.kind).toBe('correct')
    const wrong = await (await post(b, '/api/check', { lessonId: token, answer: '3', attempt: 1 })).json()
    expect(wrong.kind).toBe('hint')
  })

  it('the lesson sent to the browser holds no answer, checker or hints', async () => {
    nextPlan = applesPlan
    const app = await newApp()
    const text = JSON.stringify(await (await post(app, '/api/lesson', { question: 'x', lang: 'en' })).json())
    expect(text).not.toMatch(/"verify"|"calc"|"correct"|"why_wrong"|"reference"|"rubric"/)
  })

  it('a changed token is refused with a "lesson expired" message in the learner’s language', async () => {
    nextPlan = applesPlan
    const app = await newApp()
    const made = await (await post(app, '/api/lesson', { question: 'x', lang: 'ja' })).json()
    const bad = made.lesson.lessonId.slice(0, -3) + 'abc'
    const res = await post(app, '/api/check', { lessonId: bad, answer: '7', lang: 'ja' })
    expect(res.status).toBe(410)
    expect((await res.json()).error).toContain('期限切れ')
  })

  it('answers come back in the language the lesson was made in, even if the request says another', async () => {
    nextPlan = applesPlan
    const app = await newApp()
    const made = await (await post(app, '/api/lesson', { question: 'x', lang: 'my' })).json()
    const fb = await (await post(app, '/api/check', { lessonId: made.lesson.lessonId, answer: '၇', lang: 'en' })).json()
    expect(fb.kind).toBe('correct')
    expect(fb.message).toMatch(/[က-႟]/)
  })

  it('the try number selects the hint: each wrong try shows one more', async () => {
    nextPlan = algebraPlan
    const app = await newApp()
    const made = await (await post(app, '/api/lesson', { question: 'x + 3 = 10', lang: 'en' })).json()
    const id = made.lesson.lessonId
    const one = await (await post(app, '/api/check', { lessonId: id, answer: '2', attempt: 1 })).json()
    const two = await (await post(app, '/api/check', { lessonId: id, answer: '2', attempt: 2 })).json()
    expect(one.message).toContain(algebraPlan.verify.hints[0])
    expect(two.message).toContain(algebraPlan.verify.hints[1])
    expect(one.message).not.toContain(algebraPlan.verify.hints[1])
  })

  it('multiple choice works the same way (the shuffled order travels inside the token)', async () => {
    nextPlan = conceptPlan
    const app = await newApp()
    const made = await (await post(app, '/api/lesson', { question: 'what is AI', lang: 'en' })).json()
    const options: string[] = made.lesson.answerMode.options
    const rightIndex = options.findIndex((o) => o.startsWith('A program that learns'))
    expect(rightIndex).toBeGreaterThanOrEqual(0)
    expect((await (await post(app, '/api/check', { lessonId: made.lesson.lessonId, answer: String(rightIndex) })).json()).kind).toBe('correct')
    const wrongIndex = (rightIndex + 1) % options.length
    expect((await (await post(app, '/api/check', { lessonId: made.lesson.lessonId, answer: String(wrongIndex) })).json()).kind).toBe('hint')
  })

  it('bad requests get clear, translated errors', async () => {
    const app = await newApp()
    expect((await post(app, '/api/lesson', { question: '  ', lang: 'ja' })).status).toBe(400)
    expect((await (await post(app, '/api/lesson', { question: '', lang: 'en' })).json()).error).toBe('Type a question first.')
    expect((await (await post(app, '/api/check', { lessonId: '', answer: '' })).json()).kind).toBe('invalid')
    expect((await post(app, '/api/lesson', { question: 'x'.repeat(600) })).status).toBe(400)
  })

  it('the progress stream ends with the lesson', async () => {
    nextPlan = applesPlan
    const app = await newApp()
    const res = await post(app, '/api/lesson', { question: 'x', lang: 'en' }, { Accept: 'application/x-ndjson' })
    expect(res.headers.get('content-type')).toContain('ndjson')
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l))
    expect(events.at(-1).type).toBe('result')
    expect(events.at(-1).result.ok).toBe(true)
    expect(events.some((e) => e.type === 'stage')).toBe(true)
  })

  it('has a health check', async () => {
    const app = await newApp()
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true })
  })
})
