import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SPRITES } from '../src/sprites/library'
import { validateGrid } from '../src/sprites/grid'
import { slug } from '../src/sprites/names'

/**
 * Checks every built-in sprite and every saved drawing (server/sprite-cache by default, or the folder given as
 * the first argument, for example a batch from a chat agent). Usage: tsx scripts/check-sprites.ts [folder]
 */
let bad = 0
for (const [n, s] of Object.entries(SPRITES)) {
  s.frames.forEach((f, i) => {
    const e = validateGrid(f)
    if (e) {
      bad++
      console.log(n, i, e, f.map((r, k) => `${k}:${r.length}`).filter((x) => !x.endsWith(':16')).join(' '))
    }
  })
}

const dir = process.argv[2] ?? 'server/sprite-cache'
let files = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  files++
  const name = file.replace(/\.json$/, '')
  const problems: string[] = []
  if (name !== slug(name)) problems.push(`file name must be lowercase letters, digits and underscores (e.g. "${slug(name) || 'name'}.json")`)
  if (name in SPRITES) problems.push('a built-in picture already has this name, so this file would never be used')
  try {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    if (!Array.isArray(data?.frames) || data.frames.length === 0) problems.push('needs a "frames" list with at least one frame')
    else data.frames.forEach((f: unknown, i: number) => {
      const e = validateGrid(f)
      if (e) problems.push(`frame ${i}: ${e}`)
    })
  } catch (e) {
    problems.push(`not valid JSON (${e instanceof Error ? e.message : e})`)
  }
  if (problems.length) {
    bad++
    console.log(`${file}: ${problems.join('; ')}`)
  }
}
console.log(bad ? `${bad} problem file(s)` : `all sprites valid (${Object.keys(SPRITES).length} built in, ${files} files in ${dir})`)
