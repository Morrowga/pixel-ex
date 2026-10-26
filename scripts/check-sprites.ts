import { SPRITES } from '../src/sprites/library'
import { validateGrid } from '../src/sprites/grid'

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
console.log(bad ? `${bad} bad` : 'all sprites valid')
