import { describe, expect, it } from 'vitest'
import { dedupeActorLabels, dedupeArrowLabels, attachPoints, placeLabel, pillSize } from './declutter'
import { layoutScene } from './sceneLayout'
import type { Pt, Rect } from './route'
import type { SceneActor, SceneArrow } from './types'

const actor = (id: string, sprite: string, x: number, y: number, o: Partial<SceneActor> = {}): SceneActor => ({
  id, sprite, x, y, motion: 'none', flip: false, label: '', say: '', ...o,
})
const arrow = (from: string, to: string, label = ''): SceneArrow => ({ from, to, label })

// The scene in the screenshot: a GPU, three picture parts, a screen. Three arrows say "small job".
const gpu = [
  actor('gpu', 'chip', 8, 50, { label: 'GPU', say: 'many jobs' }),
  actor('p1', 'square', 45, 22, { label: 'picture part' }),
  actor('p2', 'square', 38, 70, { label: 'picture part' }),
  actor('p3', 'square', 60, 85, { label: 'picture part' }),
  actor('screen', 'computer', 92, 50, { label: 'screen' }),
]
const gpuArrows = [arrow('p1', 'gpu', 'small job'), arrow('p2', 'gpu', 'small job'), arrow('p3', 'gpu', 'small job'), arrow('gpu', 'screen', 'shows result')]
const W = 1067
const H = 320

const hit = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
const inRect = (p: Pt, r: Rect) => p.x >= r.l && p.x <= r.r && p.y >= r.t && p.y <= r.b

describe('no repeated text', () => {
  it('a repeated actor label is shown once, on the first actor (helper only; the scene keeps every name)', () => {
    const out = dedupeActorLabels(gpu)
    expect(out.filter((a) => a.label === 'picture part')).toHaveLength(1)
  })
  it('the names under the pictures all stay', () => {
    const L = layoutScene(gpu, gpuArrows, 1067, 320)
    expect(L.actors.filter((a) => a.label === 'picture part')).toHaveLength(3)
  })
  it('a repeated arrow label is shown once, however it is capitalised', () => {
    const out = dedupeArrowLabels([arrow('a', 'b', 'Small job'), arrow('c', 'b', 'small job '), arrow('d', 'b', 'other')])
    expect(out.map((r) => r.label)).toEqual(['Small job', '', 'other'])
  })
})

describe('the GPU scene from the screenshot', () => {
  const L = layoutScene(gpu, gpuArrows, W, H)

  it('says "small job" once', () => {
    expect(L.arrows.filter((r) => r.label === 'small job')).toHaveLength(1)
    expect(L.pills.filter(Boolean).length).toBeLessThanOrEqual(2)
  })

  it('no label covers a picture, a text or another label', () => {
    const things: Rect[] = L.actors.flatMap((a) => [L.footprint[a.id].sprite, ...L.footprint[a.id].extras])
    const pills = L.pills.filter((p): p is NonNullable<typeof p> => p !== null)
    for (const p of pills) {
      for (const t of things) expect(hit(p, t), `label at ${p.cx},${p.cy}`).toBe(false)
    }
    for (let i = 0; i < pills.length; i++) for (let j = i + 1; j < pills.length; j++) expect(hit(pills[i], pills[j])).toBe(false)
  })

  it('no label sits on another arrow', () => {
    L.pills.forEach((p, i) => {
      if (!p) return
      L.routes.forEach((r, j) => {
        if (i === j) return
        for (let t = 0; t <= 1; t += 1 / 48) expect(inRect(r.at(t), p), `label ${i} on arrow ${j}`).toBe(false)
      })
    })
  })

  it('every label sits on its own arrow', () => {
    L.pills.forEach((p, i) => {
      if (!p) return
      const onOwn = Array.from({ length: 401 }, (_, k) => L.routes[i].at(k / 400)).some((q) => Math.hypot(q.x - p.cx, q.y - p.cy) < 1.5)
      expect(onOwn).toBe(true)
    })
  })

  it('no line runs through a picture, including the GPU-to-screen line past the middle part', () => {
    L.routes.forEach((route, i) => {
      const r = L.arrows[i]
      for (const a of L.actors) {
        if (a.id === r.from || a.id === r.to) continue
        const box = L.footprint[a.id].sprite
        for (let t = 0.03; t < 0.97; t += 1 / 48) expect(inRect(route.at(t), box), `${r.from}->${r.to} through ${a.id}`).toBe(false)
      }
    })
  })

  it('no line runs through the text under or above a picture either', () => {
    L.routes.forEach((route, i) => {
      const r = L.arrows[i]
      for (const a of L.actors) {
        for (const text of L.footprint[a.id].extras) {
          for (let t = 0.03; t < 0.97; t += 1 / 48) expect(inRect(route.at(t), text), `${r.from}->${r.to} over the text of ${a.id}`).toBe(false)
        }
      }
    })
  })

  it('the arrowheads that meet at the GPU land at different spots', () => {
    const ends = L.routes.map((r, i) => ({ r, to: L.arrows[i].to })).filter((x) => x.to === 'gpu').map((x) => x.r.end)
    expect(ends).toHaveLength(3)
    for (let i = 0; i < ends.length; i++)
      for (let j = i + 1; j < ends.length; j++) expect(Math.hypot(ends[i].x - ends[j].x, ends[i].y - ends[j].y)).toBeGreaterThan(20)
  })
})

describe('arrows that meet at one side are spread along it', () => {
  it('three arrows into one sprite get three different heights, ordered by where they come from', () => {
    const placed = { hub: { x: 100, y: 160 }, up: { x: 400, y: 40 }, mid: { x: 400, y: 160 }, low: { x: 400, y: 280 } }
    const pts = attachPoints(placed, [{ from: 'low', to: 'hub' }, { from: 'up', to: 'hub' }, { from: 'mid', to: 'hub' }], 96)
    const ys = pts.map((p) => p.end.y)
    expect(new Set(ys.map(Math.round)).size).toBe(3)
    // the arrow from the top lands highest, the one from the bottom lowest
    expect(pts[1].end.y).toBeLessThan(pts[2].end.y)
    expect(pts[2].end.y).toBeLessThan(pts[0].end.y)
    // all land on the same (right-hand) side of the hub
    for (const p of pts) expect(p.end.x).toBeGreaterThan(100)
  })
})

describe('a label with no clean spot is left out, not put in a bad place', () => {
  it('returns null when everything along the arrow is blocked', () => {
    const route = { at: (t: number) => ({ x: 100 + t * 300, y: 100 }) } as never
    const wall: Rect = { l: 0, r: 1000, t: 0, b: 1000 }
    expect(placeLabel(route, 'hello', [wall], [])).toBeNull()
    expect(placeLabel(route, 'hello', [], [])).not.toBeNull()
    expect(pillSize('hello').w).toBeGreaterThan(40)
  })
})


describe('actors stay where they are between steps', () => {
  const W = 1067
  const H = 320
  const step1 = [actor('child', 'child', 20, 50, { label: 'child' }), actor('dog', 'dog', 75, 50, { label: 'dog' })]
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

  it('the same actors in the same places do not move, even when a new one joins', () => {
    const one = layoutScene(step1, [arrow('child', 'dog', 'sees')], W, H)
    const two = layoutScene([...step1, actor('pc', 'computer', 50, 15, { label: 'computer' })], [arrow('child', 'dog', 'sees')], W, H, one.memory)
    expect(dist(one.placed.child, two.placed.child)).toBeLessThan(90)
    expect(dist(one.placed.dog, two.placed.dog)).toBeLessThan(90)
    // and with the memory of the first step the second step is steadier than without it
    const cold = layoutScene([...step1, actor('pc', 'computer', 50, 15, { label: 'computer' })], [arrow('child', 'dog', 'sees')], W, H)
    expect(dist(one.placed.child, two.placed.child) + dist(one.placed.dog, two.placed.dog)).toBeLessThanOrEqual(
      dist(one.placed.child, cold.placed.child) + dist(one.placed.dog, cold.placed.dog) + 1,
    )
  })

  it('the identical scene laid out again gives exactly the same places', () => {
    const one = layoutScene(step1, [arrow('child', 'dog', 'sees')], W, H)
    const again = layoutScene(step1, [arrow('child', 'dog', 'sees')], W, H, one.memory)
    expect(dist(one.placed.child, again.placed.child)).toBeLessThan(1)
    expect(dist(one.placed.dog, again.placed.dog)).toBeLessThan(1)
  })

  it('an actor the AI moves on purpose does move', () => {
    const one = layoutScene(step1, [], W, H)
    const moved = layoutScene([actor('child', 'child', 70, 20, { label: 'child' }), step1[1]], [], W, H, one.memory)
    expect(Math.abs(moved.placed.child.x - one.placed.child.x)).toBeGreaterThan(100)
  })
})

describe('the RAM scene from the screenshot: no looping arrow, nothing lands under a speech bubble', () => {
  const ram = [
    actor('cpu', 'chip', 15, 75, { label: 'CPU', motion: 'glow' }),
    actor('ram', 'chip', 80, 78, { label: 'RAM', say: 'work now' }),
    actor('storage', 'folder', 90, 30, { label: 'storage' }),
  ]
  const ramArrows = [arrow('ram', 'cpu', 'shows'), arrow('storage', 'ram', 'sends')]

  for (const W of [700, 1067, 1400]) {
    it(`at stage width ${W}: every arrow runs the direct way, with no loop or hook`, () => {
      const L = layoutScene(ram, ramArrows, W, 320)
      L.routes.forEach((route, i) => {
        const from = L.placed[L.arrows[i].from]
        const to = L.placed[L.arrows[i].to]
        const chord = Math.hypot(to.x - from.x, to.y - from.y)
        let length = 0
        let prev = route.at(0)
        for (let t = 1; t <= 48; t++) {
          const p = route.at(t / 48)
          length += Math.hypot(p.x - prev.x, p.y - prev.y)
          prev = p
        }
        expect(length, `${L.arrows[i].from}->${L.arrows[i].to} wanders`).toBeLessThan(chord * 1.6)
        // it arrives heading toward the target, not backwards
        const end = route.at(1)
        const before = route.at(0.96)
        const ux = to.x - from.x
        const uy = to.y - from.y
        expect((end.x - before.x) * ux + (end.y - before.y) * uy, `${L.arrows[i].from}->${L.arrows[i].to} points backwards`).toBeGreaterThan(0)
      })
    })

    it(`at stage width ${W}: no arrow lands on the edge that holds RAM's speech bubble or a name`, () => {
      const L = layoutScene(ram, ramArrows, W, 320)
      const ramPos = L.placed.ram
      const px = L.px
      L.routes.forEach((route, i) => {
        if (L.arrows[i].to !== 'ram' && L.arrows[i].from !== 'ram') return
        const pt = L.arrows[i].to === 'ram' ? route.end : route.start
        const onTop = pt.y < ramPos.y - px / 2 - 4 && Math.abs(pt.x - ramPos.x) < px / 2
        const onBottom = pt.y > ramPos.y + px / 2 + 4 && Math.abs(pt.x - ramPos.x) < px / 2
        expect(onTop || onBottom, `arrow ${i} attaches above or below RAM`).toBe(false)
      })
    })
  }
})
