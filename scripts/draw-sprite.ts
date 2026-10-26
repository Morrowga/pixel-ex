import { generateSprite } from '../server/llm'
import { validateGrid } from '../src/sprites/grid'
import { mkdirSync, writeFileSync } from 'node:fs'

/** Try the AI sprite drawer on its own. Usage: tsx --env-file=.env scripts/draw-sprite.ts "tractor" outDir */
const [subject, out] = [process.argv[2], process.argv[3]]
const rows = await generateSprite(subject)
console.log(rows ? `${subject}: ${validateGrid(rows) ?? 'valid'}` : `${subject}: failed`)
if (rows && out) {
  mkdirSync(out, { recursive: true })
  writeFileSync(`${out}/${subject.replace(/\W+/g, '_')}.json`, JSON.stringify({ frames: [rows] }))
}
