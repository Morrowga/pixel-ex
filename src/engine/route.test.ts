import { describe, expect, it } from 'vitest'
import { routeArrow, type Rect } from './route'
import { arrange, overlaps, type ArrangeInput } from './arrange'

const box = (x: number, y: number, px = 96): Rect => ({ l: x - px / 2 - 6, r: x + px / 2 + 6, t: y - px / 2 - 6, b: y + px / 2 + 6 })

/** Points along a route's path, so a test can check it against obstacles. */
function points(d: string, n = 60) {
  const m = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
  const [sx, sy] = m
  const out: { x: number; y: number }[] = []
  if (d.includes('C')) {
    const [c1x, c1y, c2x, c2y, ex, ey] = m.slice(2)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const k = 1 - t
      out.push({ x: k ** 3 * sx + 3 * k * k * t * c1x + 3 * k * t * t * c2x + t ** 3 * ex, y: k ** 3 * sy + 3 * k * k * t * c1y + 3 * k * t * t * c2y + t ** 3 * ey })
    }
  } else if (d.includes('Q')) {
    const [cx, cy, ex, ey] = m.slice(2)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      out.push({ x: (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t ** 2 * ex, y: (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t ** 2 * ey })
    }
  } else {
    const [ex, ey] = m.slice(2)
    for (let i = 0; i <= n; i++) out.push({ x: sx + ((ex - sx) * i) / n, y: sy + ((ey - sy) * i) / n })
  }
  return out
}
const crosses = (d: string, r: Rect) => points(d).some((p) => p.x > r.l && p.x < r.r && p.y > r.t && p.y < r.b)

describe('arrow routing', () => {
  it('goes straight when nothing is in the way', () => {
    const r = routeArrow({ x: 100, y: 160 }, { x: 500, y: 160 }, [], 96)
    expect(r.curved).toBe(false)
    expect(r.d).toContain('L')
  })

  it('the CPU -> screen arrow no longer runs through the book that sits between them', () => {
    const chip = { x: 130, y: 160 }
    const screen = { x: 520, y: 160 }
    const book = box(325, 160)
    const r = routeArrow(chip, screen, [book], 96)
    expect(r.curved).toBe(true)
    expect(r.hits).toBe(0)
    expect(crosses(r.d, book)).toBe(false)
  })

  it('curves around several obstacles when it can, and never into a sprite it starts or ends at', () => {
    const r = routeArrow({ x: 80, y: 160 }, { x: 560, y: 160 }, [box(220, 160), box(400, 160)], 80)
    expect(r.hits).toBe(0)
    expect(crosses(r.d, box(220, 160))).toBe(false)
    expect(crosses(r.d, box(400, 160))).toBe(false)
  })

  it('the arrowhead sits at the end of the line, and the label sits mid-way', () => {
    const r = routeArrow({ x: 100, y: 100 }, { x: 500, y: 100 }, [], 96)
    expect(r.head).toMatch(/^M [\d. -]+ L 4\d\d/) // the point of the head is near x ~ 440
    expect(r.mid.x).toBeGreaterThan(200)
    expect(r.mid.x).toBeLessThan(400)
  })
})

describe('arrows that cannot be drawn through the middle', () => {
  it('arch over a whole row, staying on screen', () => {
    const obstacles = [box(220, 180, 80), box(330, 180, 80), box(440, 180, 80)]
    const r = routeArrow({ x: 90, y: 180 }, { x: 570, y: 180 }, obstacles, 80, { minY: 10, maxY: 310 })
    expect(r.hits).toBe(0)
    for (const o of obstacles) expect(crosses(r.d, o)).toBe(false)
    for (const p of points(r.d)) {
      expect(p.y).toBeGreaterThanOrEqual(10)
      expect(p.y).toBeLessThanOrEqual(310)
    }
  })
  it('goes under when there is no room above', () => {
    const obstacles = [box(220, 60, 80), box(330, 60, 80)]
    const r = routeArrow({ x: 90, y: 60 }, { x: 480, y: 60 }, obstacles, 80, { minY: 10, maxY: 310 })
    expect(r.hits).toBe(0)
    for (const o of obstacles) expect(crosses(r.d, o)).toBe(false)
  })
})

describe('the CPU scene from the screenshot', () => {
  it('the arrow leaving the CPU avoids its own speech bubble and label, and the book in the middle', () => {
    const px = 96
    const chip = { x: 150, y: 170 }
    const screen = { x: 520, y: 170 }
    const bubble: Rect = { l: chip.x - 90, r: chip.x + 90, t: chip.y - px / 2 - 48, b: chip.y - px / 2 - 2 }
    const label: Rect = { l: chip.x - 50, r: chip.x + 50, t: chip.y + px / 2 + 2, b: chip.y + px / 2 + 28 }
    const book = box(335, 170, px)
    const screenLabel: Rect = { l: screen.x - 50, r: screen.x + 50, t: screen.y + px / 2 + 2, b: screen.y + px / 2 + 28 }
    const obstacles = [bubble, label, book, screenLabel]
    const r = routeArrow(chip, screen, obstacles, px, { minY: 10, maxY: 310 })
    expect(r.hits).toBe(0)
    for (const o of obstacles) expect(crosses(r.d, o), JSON.stringify(o)).toBe(false)
  })
})

describe('two arrows on one sprite', () => {
  it('the second arrow does not leave from the spot where the first arrow lands', () => {
    const px = 112
    const chip = { x: 190, y: 176 }
    const book = { x: 700, y: 176 }
    const screen = { x: 1180, y: 176 }
    const first = routeArrow(book, chip, [], px, { minY: 10, maxY: 310 })
    const bookBox = box(book.x, book.y, px)
    // without knowing about the first arrow, the second one happily starts at the same spot
    const blind = routeArrow(chip, screen, [bookBox], px, { minY: 10, maxY: 310 })
    expect(Math.hypot(blind.start.x - first.end.x, blind.start.y - first.end.y)).toBeLessThan(px * 0.4)
    // knowing about it, the second arrow keeps clear, and still avoids the book
    const aware = routeArrow(chip, screen, [bookBox], px, { minY: 10, maxY: 310 }, [first.start, first.end])
    expect(Math.hypot(aware.start.x - first.end.x, aware.start.y - first.end.y)).toBeGreaterThan(px * 0.4)
    expect(aware.hits).toBe(0)
    expect(crosses(aware.d, bookBox)).toBe(false)
  })
})

describe('room for labelled arrows', () => {
  const a = (id: string, x: number, y: number, label = ''): ArrangeInput => ({ id, x, y, label, say: '' })

  it('actors joined by an arrow with a label are spaced so the label fits between them', () => {
    const actors = [a('chip', 40, 50, 'CPU'), a('book', 50, 50, 'program'), a('pc', 60, 50, 'result')]
    const arrows = [{ from: 'book', to: 'chip', label: 'instructions' }, { from: 'chip', to: 'pc', label: 'work' }]
    const px = 96
    const p = arrange(actors, px, 640, 320, arrows)
    expect(overlaps(actors, p, px)).toEqual([])
    // gap between neighbours (edge to edge) is at least the label's width
    const gap = (x: string, y: string) => Math.abs(p[x].x - p[y].x) - px
    expect(gap('book', 'chip')).toBeGreaterThanOrEqual('instructions'.length * 9)
  })

  it('without arrows nothing changes', () => {
    const actors = [a('l', 15, 50), a('r', 85, 50)]
    expect(arrange(actors, 96, 640, 320, [])).toEqual(arrange(actors, 96, 640, 320))
  })
})
