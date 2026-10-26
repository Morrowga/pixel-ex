import { describe, expect, it } from 'vitest'
import { SIZE, validateGrid } from './grid'
import { SPRITES } from './library'
import { slug } from './names'

describe('sprite library', () => {
  it('every frame is a valid 16x16 grid in the shared palette', () => {
    for (const [name, s] of Object.entries(SPRITES)) {
      expect(s.frames.length, name).toBeGreaterThan(0)
      s.frames.forEach((f, i) => expect(validateGrid(f), `${name} frame ${i}`).toBeNull())
    }
  })
  it('animated sprites have frames of the same size', () => {
    for (const s of Object.values(SPRITES)) for (const f of s.frames) expect(f).toHaveLength(SIZE)
  })
  it('has the sprites the examples and the prompt rely on', () => {
    for (const n of ['apple', 'cookie', 'cake', 'square', 'child', 'dog', 'computer']) expect(SPRITES[n]).toBeDefined()
  })
})

describe('validateGrid', () => {
  const ok = SPRITES.apple.frames[0]
  it('accepts a good grid', () => expect(validateGrid(ok)).toBeNull())
  it('rejects wrong size, bad characters, empty and full grids', () => {
    expect(validateGrid(ok.slice(1))).toMatch(/16 rows/)
    expect(validateGrid([...ok.slice(1), 'KKKK'])).toMatch(/16 characters/)
    expect(validateGrid([...ok.slice(1), '..........X.....'])).toMatch(/palette/)
    expect(validateGrid(Array(16).fill('.'.repeat(16)))).toMatch(/empty/)
    expect(validateGrid(Array(16).fill('K'.repeat(16)))).toMatch(/whole square/)
    expect(validateGrid('nope')).toMatch(/16 rows/)
  })
})

describe('slug', () => {
  it('makes safe names', () => {
    expect(slug('Tractor!')).toBe('tractor')
    expect(slug('ice cream')).toBe('ice_cream')
    expect(slug('../../etc/passwd')).toBe('etc_passwd')
    expect(slug('   ')).toBe('')
  })
})
