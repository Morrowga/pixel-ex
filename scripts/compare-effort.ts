import { writeFileSync } from 'node:fs'
import { planLesson, type Effort } from '../server/llm'
import { prepareVerify } from '../src/engine/verify'
import { buildSteps } from '../src/engine/simulate'
import { isTechTopic } from '../src/engine/topic'
import type { Lang } from '../src/i18n/lang'

/**
 * Asks for the SAME lessons at different thinking efforts and records time, tokens and whether the plan passes
 * the checks on the first try. Pictures are not drawn. Usage: tsx --env-file=.env scripts/compare-effort.ts out.json [efforts...]
 * Efforts: default (the model's own), none, low, medium, high.
 */
const out = process.argv[2] ?? 'effort.json'
const efforts = (process.argv.slice(3).length ? process.argv.slice(3) : ['default', 'low', 'none']) as (Effort | 'default')[]
const QUESTIONS: { lang: Lang; q: string }[] = [
  { lang: 'en', q: '3 + 4' },
  { lang: 'en', q: 'I have 12 cookies and 3 friends' },
  { lang: 'en', q: '15% of 200' },
  { lang: 'en', q: 'solve 2x + 3 = 11' },
  { lang: 'en', q: 'differentiate x^3 + 2x' },
  { lang: 'en', q: 'what is photosynthesis' },
  { lang: 'en', q: 'what is RAM in a computer' },
  { lang: 'en', q: '7 squares' },
  { lang: 'ja', q: '光合成ってなに？' },
  { lang: 'my', q: 'ကွန်ပျူတာ CPU ဆိုတာ ဘာလဲ' },
]

async function once(effort: Effort | 'default', lang: Lang, q: string) {
  const t0 = Date.now()
  const row: Record<string, unknown> = { effort, lang, q }
  try {
    const plan = await planLesson(q, lang, [], effort === 'default' ? undefined : effort)
    row.seconds = +((Date.now() - t0) / 1000).toFixed(1)
    if (plan.status !== 'complete') return { ...row, status: plan.status }
    const prepared = prepareVerify(plan.verify, lang)
    if ('error' in prepared) return { ...row, status: 'verify-rejected', problems: [prepared.error] }
    const built = buildSteps(plan, {
      allowTech: lang === 'en' ? isTechTopic(q) : plan.about_technology,
      kind: plan.verify.kind, target: prepared.target, answer: prepared.answer, inputs: prepared.inputs, intermediates: prepared.intermediates,
    })
    if ('errors' in built) return { ...row, status: 'rejected', problems: built.errors }
    const captions = built.steps.map((s) => s.caption.replace(/\*\*/g, ''))
    return { ...row, status: 'passed', steps: built.steps.length, captions }
  } catch (e) {
    return { ...row, status: 'error', seconds: +((Date.now() - t0) / 1000).toFixed(1), problems: [String(e).slice(0, 160)] }
  }
}

const rows: Record<string, unknown>[] = []
// every effort runs at the same time; questions go one after another
for (const { lang, q } of QUESTIONS) {
  const res = await Promise.all(efforts.map((e) => once(e, lang, q)))
  for (const r of res) {
    rows.push(r)
    console.log(`${String(r.effort).padEnd(8)} ${String(r.seconds ?? '-').padStart(5)}s  ${String(r.status).padEnd(9)} [${lang}] ${q}${r.problems ? '  <- ' + (r.problems as string[])[0]?.slice(0, 90) : ''}`)
  }
  writeFileSync(out, JSON.stringify(rows, null, 1))
}
const sum = (e: string, f: (r: any) => number) => rows.filter((r) => r.effort === e).reduce((a, r) => a + f(r), 0)
for (const e of efforts) {
  const mine = rows.filter((r) => r.effort === e)
  console.log(`\n${e}: avg ${(sum(e, (r) => r.seconds ?? 0) / mine.length).toFixed(1)}s, passed first try ${mine.filter((r) => r.status === 'passed').length}/${mine.length}`)
}
