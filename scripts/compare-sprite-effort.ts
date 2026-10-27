import { generateSprite, type Effort } from '../server/llm'
import { validateGrid } from '../src/sprites/grid'

/** Draws the same pictures at different thinking efforts, to compare time and how they look. Usage: tsx --env-file=.env scripts/compare-sprite-effort.ts */
const SUBJECTS = ['pit', 'black hole', 'fire', 'vaccine syringe', 'volcano', 'telescope']
const efforts: (Effort | 'default')[] = ['default', 'low', 'none']
for (const subject of SUBJECTS) {
  const res = await Promise.all(
    efforts.map(async (e) => {
      const t = Date.now()
      const rows = await generateSprite(subject, e === 'default' ? undefined : e)
      return { e, seconds: ((Date.now() - t) / 1000).toFixed(1), rows }
    }),
  )
  console.log(`\n=== ${subject}`)
  console.log(res.map((r) => `${r.e}: ${r.seconds}s ${r.rows ? (validateGrid(r.rows) ?? 'valid') : 'FAILED'}`).join('   '))
  for (let y = 0; y < 16; y++) console.log(res.map((r) => (r.rows?.[y] ?? ''.padEnd(16)).replace(/\./g, ' ').padEnd(20)).join(''))
}
