import { serve } from '@hono/node-server'
import app from './app'
import { log } from './log'
import { FALLBACK_MODEL, WANTED_MODEL } from './llm'

// Running on your own machine or server. On Vercel, api/*.js runs the same app as functions instead.
const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, () =>
  log(`API on http://localhost:${port} | model ${process.env.LLM_MODEL ?? WANTED_MODEL} (falls back to ${process.env.LLM_FALLBACK_MODEL ?? FALLBACK_MODEL} if not allowed) | languages: en, ja, my`),
)
