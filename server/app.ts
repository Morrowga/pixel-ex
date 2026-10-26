import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { checkAnswer, makeLesson, readToken } from './lesson'
import { log } from './log'
import { normalizeLang } from '../src/i18n/lang'
import { t } from '../src/i18n/messages'

/** The whole API, with no server of its own, so it can run locally (server/index.ts) or as a Vercel function. */
const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/lesson', async (c) => {
  const body = await c.req.json().catch(() => null)
  const lang = normalizeLang(body?.lang)
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  if (!question) return c.json({ error: t(lang, 'err.askFirst') }, 400)
  if (question.length > 500) return c.json({ error: t(lang, 'err.tooLong') }, 400)

  // The browser asks for a stream so the loading screen can show real progress.
  if (c.req.header('accept')?.includes('application/x-ndjson')) {
    c.header('Content-Type', 'application/x-ndjson')
    c.header('Cache-Control', 'no-cache')
    return stream(c, async (s) => {
      const send = (o: unknown) => s.write(JSON.stringify(o) + '\n')
      try {
        const result = await makeLesson(question, lang, (st) => void send({ type: 'stage', ...st }))
        await send({ type: 'result', result })
      } catch (err) {
        log(`  ✖ lesson failed: ${err instanceof Error ? err.message : err}`)
        await send({ type: 'error', error: t(lang, 'err.wentWrong') })
      }
    })
  }

  try {
    return c.json(await makeLesson(question, lang))
  } catch (err) {
    log(`  ✖ lesson failed: ${err instanceof Error ? err.message : err}`)
    return c.json({ error: t(lang, 'err.wentWrong') }, 502)
  }
})

app.post('/api/check', async (c) => {
  const body = await c.req.json().catch(() => null)
  const token = typeof body?.lessonId === 'string' ? body.lessonId : ''
  // The sealed token knows its own language; the request's is only used if the token is not valid.
  const lang = readToken(token)?.lang ?? normalizeLang(body?.lang)
  const answer = typeof body?.answer === 'string' || typeof body?.answer === 'number' ? String(body.answer).trim() : ''
  const attempt = Number.isInteger(body?.attempt) && body.attempt >= 1 && body.attempt <= 50 ? body.attempt : 1
  if (!token || answer === '') return c.json({ kind: 'invalid', message: t(lang, 'answer.empty') })
  const feedback = await checkAnswer(token, answer, attempt)
  log(`  check: guess "${answer.slice(0, 60)}" (try ${attempt}) → ${feedback ? feedback.kind : 'invalid or expired lesson'}`)
  if (!feedback) return c.json({ error: t(lang, 'err.expired') }, 410)
  return c.json(feedback)
})

export default app
