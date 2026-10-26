/**
 * Arrow routing for scenes. An arrow goes straight between two actors unless another actor is in the way;
 * then it bends around it, or arches over (or under) the whole row, so a line never runs through a picture.
 */
export interface Pt {
  x: number
  y: number
}
export interface Rect {
  l: number
  t: number
  r: number
  b: number
}

export interface Route {
  /** Path of the line. */
  d: string
  /** Path of the arrowhead. */
  head: string
  /** Where the label goes. */
  mid: Pt
  curved: boolean
  /** Number of other actors the line still crosses (0 when clear). */
  hits: number
  /** Where the line leaves the first sprite and where the head lands on the second. */
  start: Pt
  end: Pt
  /** A point along the line, t from 0 (start) to 1 (end). */
  at: (t: number) => Pt
}

interface Curve {
  start: Pt
  end: Pt
  /** 0 = straight, 1 = quadratic, 2 = cubic. */
  c: Pt[]
}

const at = ({ start: s, end: e, c }: Curve, t: number): Pt => {
  const m = 1 - t
  if (c.length === 0) return { x: s.x + (e.x - s.x) * t, y: s.y + (e.y - s.y) * t }
  if (c.length === 1) return { x: m * m * s.x + 2 * m * t * c[0].x + t * t * e.x, y: m * m * s.y + 2 * m * t * c[0].y + t * t * e.y }
  return {
    x: m ** 3 * s.x + 3 * m * m * t * c[0].x + 3 * m * t * t * c[1].x + t ** 3 * e.x,
    y: m ** 3 * s.y + 3 * m * m * t * c[0].y + 3 * m * t * t * c[1].y + t ** 3 * e.y,
  }
}

const inside = (p: Pt, r: Rect) => p.x >= r.l && p.x <= r.r && p.y >= r.t && p.y <= r.b

function hitsOf(curve: Curve, obstacles: Rect[]) {
  let hits = 0
  for (const r of obstacles) {
    for (let i = 1; i < 40; i++) {
      if (inside(at(curve, i / 40), r)) {
        hits++
        break
      }
    }
  }
  return hits
}

const onScreen = (curve: Curve, minY: number, maxY: number) => {
  for (let i = 0; i <= 20; i++) {
    const p = at(curve, i / 20)
    if (p.y < minY || p.y > maxY) return false
  }
  return true
}

export function routeArrow(
  from: Pt,
  to: Pt,
  obstacles: Rect[],
  px: number,
  bounds: { minY: number; maxY: number } = { minY: 8, maxY: Infinity },
  /** Points where other arrows already attach. A new arrow prefers to start and end away from them. */
  avoid: Pt[] = [],
  /** Exact points where this arrow should leave and land (spread along the sprite's side), instead of the default. */
  attach?: { start: Pt; end: Pt; startOff?: number; endOff?: number },
): Route {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const u = { x: dx / len, y: dy / len }
  const start = attach?.start ?? { x: from.x + u.x * (px / 2 + 6), y: from.y + u.y * (px / 2 + 6) }
  const end = attach?.end ?? { x: to.x - u.x * (px / 2 + 12), y: to.y - u.y * (px / 2 + 12) }
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const perp = { x: -u.y, y: u.x }
  const upSign = perp.y <= 0 ? 1 : -1

  const candidates: Curve[] = [{ start, end, c: [] }]
  // A gentle bend over or under a single obstacle.
  for (const amount of [1.0, 1.5]) {
    for (const sign of [upSign, -upSign]) {
      candidates.push({ start, end, c: [{ x: mid.x + perp.x * sign * px * amount, y: mid.y + perp.y * sign * px * amount }] })
    }
  }
  // Arches: leave from the top, bottom or side of the first sprite, rise over (or dip under) everything in
  // the way, and land on the top, bottom or side of the second. Every mix is tried, simplest first, because
  // a speech bubble can block one edge and a neighbour can block another.
  const dirx = dx >= 0 ? 1 : -1
  type Kind = 'edge' | 'side'
  const anchor = (p: Pt, kind: Kind, sign: number, isEnd: boolean): Pt => {
    const off = px / 2 + (isEnd ? 12 : 6)
    // Arrows that meet at one sprite are spread along it, so arches land at different spots too.
    const slot = (isEnd ? attach?.endOff : attach?.startOff) ?? 0
    return kind === 'edge' ? { x: p.x + slot, y: p.y + sign * off } : { x: p.x + (isEnd ? -dirx : dirx) * off, y: p.y + slot }
  }
  for (const [sk, ek] of [['edge', 'edge'], ['side', 'edge'], ['edge', 'side'], ['side', 'side']] as [Kind, Kind][]) {
    for (const sign of [-1, 1]) {
      const s = anchor(from, sk, sign, false)
      const e = anchor(to, ek, sign, true)
      const edge = sign < 0 ? Math.min(s.y, e.y, ...obstacles.map((o) => o.t)) : Math.max(s.y, e.y, ...obstacles.map((o) => o.b))
      const need = sign < 0 ? Math.min(s.y, e.y) - (edge - 26) : edge + 26 - Math.max(s.y, e.y)
      const h = Math.max(px * 0.8, need / 0.75)
      candidates.push({
        start: s,
        end: e,
        c: [
          { x: s.x + (sk === 'side' ? dirx * px * 0.3 : 0), y: s.y + sign * h },
          { x: e.x - (ek === 'side' ? dirx * px * 0.3 : 0), y: e.y + sign * h },
        ],
      })
    }
  }

  // A curve must head the right way at both ends and not wander: no loops, no hooks that point backwards.
  const chord = Math.hypot(dx, dy) || 1
  const sane = (curve: Curve) => {
    if (curve.c.length === 0) return true
    const first = curve.c[0]
    const last = curve.c[curve.c.length - 1]
    const dir = (a: Pt, b: Pt) => {
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
      return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
    }
    const t0 = dir(curve.start, first)
    const t1 = dir(last, curve.end)
    if (t0.x * u.x + t0.y * u.y < -0.35 || t1.x * u.x + t1.y * u.y < -0.35) return false
    let length = 0
    let prev = curve.start
    for (let i = 1; i <= 24; i++) {
      const p = at(curve, i / 24)
      length += Math.hypot(p.x - prev.x, p.y - prev.y)
      prev = p
    }
    return length <= chord * 2.1
  }
  const clearOf = (curve: Curve) => avoid.every((a) => Math.hypot(curve.start.x - a.x, curve.start.y - a.y) > px * 0.4 && Math.hypot(curve.end.x - a.x, curve.end.y - a.y) > px * 0.4)
  const pick = (usable: Curve[]) => {
    let best: { curve: Curve; hits: number } | null = null
    for (const curve of usable) {
      if (!onScreen(curve, bounds.minY, bounds.maxY)) continue
      const hits = hitsOf(curve, obstacles)
      if (hits === 0) return { curve, hits }
      if (!best || hits < best.hits) best = { curve, hits }
    }
    return best
  }
  // First choice: a clean route that also keeps clear of the other arrows' ends. Then any clean route.
  const usable = candidates.filter(sane)
  const apart = pick(usable.filter(clearOf))
  const chosen = apart && apart.hits === 0 ? apart : (pick(usable) ?? apart)
  const { curve, hits } = chosen ?? { curve: candidates[0], hits: hitsOf(candidates[0], obstacles) }
  return build(curve, hits)
}

function build(curve: Curve, hits: number): Route {
  const { start, end, c } = curve
  const last = c.length ? c[c.length - 1] : start
  const tx = end.x - last.x
  const ty = end.y - last.y
  const tl = Math.hypot(tx, ty) || 1
  const [ux, uy] = [tx / tl, ty / tl]
  const wing = (a: number): Pt => ({ x: end.x - (ux * Math.cos(a) - uy * Math.sin(a)) * 16, y: end.y - (ux * Math.sin(a) + uy * Math.cos(a)) * 16 })
  const [w1, w2] = [wing(0.5), wing(-0.5)]
  const d =
    c.length === 0 ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
    : c.length === 1 ? `M ${start.x} ${start.y} Q ${c[0].x} ${c[0].y} ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} C ${c[0].x} ${c[0].y} ${c[1].x} ${c[1].y} ${end.x} ${end.y}`
  return { d, head: `M ${w1.x} ${w1.y} L ${end.x} ${end.y} L ${w2.x} ${w2.y}`, mid: at(curve, 0.5), curved: c.length > 0, hits, start, end, at: (t) => at(curve, t) }
}
