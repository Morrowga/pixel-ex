import { makeLesson } from '../server/lesson'
import type { Lang } from '../src/i18n/lang'

/** Times whole lessons end to end, with when each stage began. Usage: tsx --env-file=.env scripts/time-lessons.ts */
const QUESTIONS: { lang: Lang; q: string }[] = [
  { lang: 'en', q: 'what is photosynthesis' },
  { lang: 'en', q: 'what is RAM in a computer' },
  { lang: 'en', q: 'what is a black hole' },
  { lang: 'en', q: 'how does a vaccine work' },
  { lang: 'en', q: 'I have 12 cookies and 3 friends' },
  { lang: 'ja', q: '光合成ってなに？' },
]
for (const { lang, q } of QUESTIONS) {
  const t0 = Date.now()
  const marks: string[] = []
  const res = await makeLesson(q, lang, (s) => marks.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${s.stage}${s.detail ? ':' + s.detail : ''}`))
  const total = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n>>> ${total}s ${res.ok ? 'ok' : 'FAIL'} [${lang}] ${q}\n    ${marks.join(' | ')}`)
}
