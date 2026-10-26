import { describe, expect, it } from 'vitest'
import type { Step } from './engine/types'
import { makeReducer } from './usePlayer'

const step = (chunk: number, ask = false): Step => ({
  id: `s${Math.random()}`, chunk, caption: 'x', durationMs: 1000, scene: { items: [], baskets: [], size: 24 }, ask: ask || undefined,
})
// two parts: steps 0,1 | 2,3 (3 is the ask)
const steps = [step(0), step(0), step(1), step(1, true)]
const reduce = makeReducer(steps)
const start = { index: 0, playing: true, run: 0 }

describe('step player', () => {
  it('autoplay runs through every step, across parts, and stops only on the question', () => {
    let s = start
    const seen = [s.index]
    for (let i = 0; i < 6 && s.playing; i++) {
      s = reduce(s, { type: 'advance' })
      seen.push(s.index)
    }
    expect(seen).toEqual([0, 1, 2, 3])
    expect(s).toMatchObject({ index: 3, playing: false })
  })
  it('pausing and resuming keeps going from the same step', () => {
    let s = reduce({ index: 1, playing: true, run: 0 }, { type: 'toggle' })
    expect(s).toMatchObject({ index: 1, playing: false })
    s = reduce(s, { type: 'toggle' })
    expect(s).toMatchObject({ index: 1, playing: true })
  })
  it('replay goes back to the start and restarts the stage (run changes)', () => {
    const end = { index: 3, playing: false, run: 0 }
    expect(reduce(end, { type: 'toggle' })).toEqual({ index: 0, playing: true, run: 1 })
  })
  it('jumping back restarts the stage; stepping forward and playing on do not', () => {
    const at3 = { index: 3, playing: false, run: 4 }
    expect(reduce(at3, { type: 'goto', index: 0 }).run).toBe(5)
    expect(reduce(start, { type: 'goto', index: 2 }).run).toBe(0)
    expect(reduce(start, { type: 'next' }).run).toBe(0)
    expect(reduce(start, { type: 'advance' }).run).toBe(0)
  })
})
