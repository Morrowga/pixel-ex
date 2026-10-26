import { writeFileSync } from 'node:fs'
import { overlap } from '../src/engine/quiz'

/**
 * Runs the same questions against a running API and records how each lesson turned out.
 * Usage: tsx scripts/compare-models.ts http://localhost:8788 label out.json
 * Start the API with LLM_MODEL=<model> so each label is a different model. Questions run one at a time.
 */
const [base, label, out] = process.argv.slice(2)
const QUESTIONS: { lang: string; q: string }[] = [
  { lang: 'en', q: 'what is photosynthesis' },
  { lang: 'en', q: 'what is inflation' },
  { lang: 'en', q: 'what is RAM in a computer' },
  { lang: 'en', q: '15% of 200' },
  { lang: 'en', q: 'I have 12 cookies and 3 friends' },
  { lang: 'en', q: 'what is a vaccine' },
  { lang: 'ja', q: '光合成ってなに？' },
  { lang: 'ja', q: '5 / 6 はいくつ？' },
  { lang: 'my', q: 'ငွေကြေးဖောင်းပွမှု ဆိုတာ ဘာလဲ' },
  { lang: 'my', q: 'ကွန်ပျူတာ CPU ဆိုတာ ဘာလဲ' },
]

const rows = []
for (const { lang, q } of QUESTIONS) {
  const t0 = Date.now()
  let row: Record<string, unknown> = { label, lang, q }
  try {
    const res = await fetch(`${base}/api/lesson`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, lang }) })
    const data = (await res.json()) as any
    const seconds = +((Date.now() - t0) / 1000).toFixed(1)
    if (data.ok) {
      const steps = data.lesson.steps as any[]
      const scenes = steps.filter((s) => s.visual?.kind === 'scene')
      const actors = scenes.flatMap((s) => s.visual.actors as any[])
      const arrows = scenes.flatMap((s) => s.visual.arrows as any[])
      const ask = [...steps].reverse().find((s) => s.ask)?.caption?.replace(/\*\*/g, '') ?? ''
      const options: string[] = data.lesson.answerMode?.options ?? []
      row = { ...row, ok: true, seconds, steps: steps.length, parts: data.lesson.chunks.length, scenes: scenes.length,
        sprites: [...new Set(actors.map((a) => a.sprite))].length, customSprites: Object.keys(data.lesson.sprites ?? {}).length,
        arrows: arrows.length, unlabelledArrows: arrows.filter((a) => !a.label?.trim()).length,
        // a quiz option that is mostly the question's own words is a warning sign
        maxOptionEcho: options.length ? +Math.max(...options.map((o) => overlap(o, ask))).toFixed(2) : null,
        checkedBy: data.lesson.checkedBy, askCaption: ask }
    } else row = { ...row, ok: false, seconds, message: data.message ?? data.error }
  } catch (e) {
    row = { ...row, ok: false, seconds: +((Date.now() - t0) / 1000).toFixed(1), message: String(e) }
  }
  rows.push(row)
  console.log(`${label} ${row.ok ? 'ok  ' : 'FAIL'} ${row.seconds}s  [${lang}] ${q}`)
}
writeFileSync(out, JSON.stringify(rows, null, 1))
