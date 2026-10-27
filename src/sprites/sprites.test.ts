import { describe, expect, it } from 'vitest'
import { SIZE, repairGrid, validateGrid } from './grid'
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

describe('repairGrid', () => {
  const good = SPRITES.car.frames[0]
  it('leaves nothing to fix in a valid drawing', () => {
    expect(repairGrid(good)).toEqual(good)
  })
  it('pads a row that is one character short and trims one that is one long', () => {
    const rows = [...good]
    rows[4] = rows[4].slice(0, SIZE - 1)
    rows[9] = rows[9] + '.'
    const fixed = repairGrid(rows)
    expect(fixed).not.toBeNull()
    expect(validateGrid(fixed)).toBeNull()
  })
  it('fixes a missing or extra empty row', () => {
    expect(validateGrid(repairGrid(good.slice(0, 15)))).toBeNull()
    expect(validateGrid(repairGrid([...good, '.'.repeat(SIZE)]))).toBeNull()
  })
  it('turns letters outside the palette into empty pixels', () => {
    const rows = [...good]
    rows[5] = rows[5].replace(/[^.]/, '?')
    expect(validateGrid(repairGrid(rows))).toBeNull()
  })
  it('gives up when the drawing is far off', () => {
    expect(repairGrid(good.slice(0, 8))).toBeNull()
    expect(repairGrid(good.map((r) => r.slice(0, 8)))).toBeNull()
    expect(repairGrid('nope')).toBeNull()
  })
})
