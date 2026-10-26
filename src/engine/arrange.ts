import { visualLength } from '../i18n/lang'
/**
 * Automatic spacing for scene actors. The AI says roughly where things go; this pushes them apart so no
 * sprite, label or speech bubble ever covers another one, and keeps everything inside the stage.
 */
export interface ArrangeInput {
  id: string
  /** Wanted position, 0 to 100. */
  x: number
  y: number
  label: string
  say: string
}

export interface Placed {
  /** Centre of the sprite, in stage units. */
  x: number
  y: number
}

export const STAGE_W = 640
export const STAGE_H = 320

/** Few actors get bigger sprites, so the stage is never mostly empty. */
export const spritePx = (count: number) => (count <= 2 ? 128 : count === 3 ? 112 : count <= 5 ? 96 : 72)

const labelWidth = (s: string) => visualLength(s) * 9 + 12
const bubbleWidth = (s: string) => visualLength(s) * 8.4 + 24
/** Extra room above (speech bubble) and below (label) the sprite. */
const BUBBLE = 44
const LABEL = 26

interface Box {
  cx: number
  cy: number
  halfW: number
  top: number
  bottom: number
}

export interface ArrowInput {
  from: string
  to: string
  label: string
}

export function arrange(
  actors: ArrangeInput[],
  px = spritePx(actors.length),
  W = STAGE_W,
  H = STAGE_H,
  arrows: ArrowInput[] = [],
): Record<string, Placed> {
  const boxes: Box[] = actors.map((a) => {
    const halfW = Math.max(px, a.label ? labelWidth(a.label) : 0, a.say ? bubbleWidth(a.say) : 0) / 2 + 6
    const top = px / 2 + (a.say ? BUBBLE : 0) + 4
    const bottom = px / 2 + (a.label ? LABEL : 0) + 4
    return { cx: 0, cy: 0, halfW, top, bottom }
  })
  const clamp = (b: Box) => {
    b.cx = Math.min(Math.max(b.cx, b.halfW + 6), W - b.halfW - 6)
    b.cy = Math.min(Math.max(b.cy, b.top + 4), H - b.bottom - 4)
  }
  actors.forEach((a, i) => {
    boxes[i].cx = 40 + (Math.min(Math.max(a.x, 0), 100) / 100) * (W - 80)
    boxes[i].cy = 40 + (Math.min(Math.max(a.y, 0), 100) / 100) * (H - 80)
    clamp(boxes[i])
  })

  const index = new Map(actors.map((a, i) => [a.id, i]))
  const shown = new Set<string>()
  for (let pass = 0; pass < 200; pass++) {
    let moved = false
    // Actors joined by an arrow need a gap wide enough for the arrow and its label.
    shown.clear()
    for (const r of arrows) {
      const i = index.get(r.from)
      const j = index.get(r.to)
      if (i === undefined || j === undefined) continue
      const a = boxes[i]
      const b = boxes[j]
      const horizontal = Math.abs(b.cx - a.cx) >= Math.abs(b.cy - a.cy)
      const labelKey = r.label.trim().toLowerCase()
      const first = labelKey !== '' && !shown.has(labelKey)
      if (first) shown.add(labelKey)
      const need = (first ? (horizontal ? labelWidth(r.label) : 26) : 0) + 56
      const gap = (horizontal ? Math.abs(b.cx - a.cx) : Math.abs(b.cy - a.cy)) - px
      if (gap >= need - 0.5) continue
      moved = true
      const push = (need - gap) / 2 + 0.5
      if (horizontal) {
        const dir = b.cx === a.cx ? 1 : Math.sign(b.cx - a.cx)
        a.cx -= dir * push
        b.cx += dir * push
      } else {
        const dir = b.cy === a.cy ? 1 : Math.sign(b.cy - a.cy)
        a.cy -= dir * push
        b.cy += dir * push
      }
      clamp(a)
      clamp(b)
    }
    // A line between two actors is a corridor. Anything sitting in it is pushed up or down, with clearance.
    for (const r of arrows) {
      const i = index.get(r.from)
      const j = index.get(r.to)
      if (i === undefined || j === undefined) continue
      const A = boxes[i]
      const B = boxes[j]
      const x0 = Math.min(A.cx, B.cx)
      const x1 = Math.max(A.cx, B.cx)
      for (let k = 0; k < boxes.length; k++) {
        if (k === i || k === j) continue
        const C = boxes[k]
        if (C.cx + C.halfW < x0 || C.cx - C.halfW > x1) continue // not between them
        const t = Math.min(1, Math.max(0, (C.cx - A.cx) / (B.cx - A.cx || 1)))
        const lineY = A.cy + (B.cy - A.cy) * t
        const clear = 14
        if (lineY < C.cy - C.top - clear || lineY > C.cy + C.bottom + clear) continue // already clear
        const above = lineY - clear - C.bottom
        const below = lineY + clear + C.top
        const room = (cy: number) => cy - C.top >= 4 && cy + C.bottom <= H - 4
        const options = [above, below].filter(room)
        const next = (options.length ? options : [above, below]).reduce((p, q) => (Math.abs(p - C.cy) <= Math.abs(q - C.cy) ? p : q))
        if (Math.abs(next - C.cy) > 0.5) {
          C.cy = next
          clamp(C)
          moved = true
        }
      }
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const ox = a.halfW + b.halfW - Math.abs(b.cx - a.cx)
        const oy = Math.min(a.cy + a.bottom, b.cy + b.bottom) - Math.max(a.cy - a.top, b.cy - b.top)
        if (ox <= 0 || oy <= 0) continue
        moved = true
        // Push apart along the direction that needs the smaller move. Equal spots split by order.
        // The stage is twice as wide as it is tall, so prefer moving sideways.
        if (ox < oy * 1.6) {
          const dir = b.cx === a.cx ? 1 : Math.sign(b.cx - a.cx)
          a.cx -= (dir * ox) / 2 + dir * 0.5
          b.cx += (dir * ox) / 2 + dir * 0.5
        } else {
          const dir = b.cy === a.cy ? 1 : Math.sign(b.cy - a.cy)
          a.cy -= (dir * oy) / 2 + dir * 0.5
          b.cy += (dir * oy) / 2 + dir * 0.5
        }
        clamp(a)
        clamp(b)
      }
    }
    if (!moved) break
  }

  if (hasOverlap(boxes)) gridFallback(boxes, actors, W, H)
  centreAndFill(boxes, W, H)
  return Object.fromEntries(actors.map((a, i) => [a.id, { x: boxes[i].cx, y: boxes[i].cy }]))
}

/**
 * The AI often puts everything low or to one side. Move the whole group to the middle of the stage, then
 * spread it out as far as it fits. Only distances grow, so nothing can start to overlap.
 */
function centreAndFill(boxes: Box[], W: number, H: number) {
  if (boxes.length === 0) return
  const centre = () => {
    const l = Math.min(...boxes.map((b) => b.cx - b.halfW))
    const r = Math.max(...boxes.map((b) => b.cx + b.halfW))
    const t = Math.min(...boxes.map((b) => b.cy - b.top))
    const bt = Math.max(...boxes.map((b) => b.cy + b.bottom))
    const dx = W / 2 - (l + r) / 2
    const dy = H / 2 - (t + bt) / 2
    for (const b of boxes) {
      b.cx += dx
      b.cy += dy
    }
  }
  // The largest spread (up to 2x) that keeps every box inside the stage. Exact, so laying out the same scene
  // again changes nothing.
  const maxSpread = () => {
    let f = 2
    for (const b of boxes) {
      const dx = b.cx - W / 2
      const dy = b.cy - H / 2
      if (dx > 0) f = Math.min(f, (W / 2 - 8 - b.halfW) / dx)
      if (dx < 0) f = Math.min(f, (W / 2 - 8 - b.halfW) / -dx)
      if (dy > 0) f = Math.min(f, (H / 2 - 6 - b.bottom) / dy)
      if (dy < 0) f = Math.min(f, (H / 2 - 6 - b.top) / -dy)
    }
    return Math.max(1, f)
  }
  // Pictures with a name underneath are taller below than above, so spreading shifts the group a little.
  // Centre, spread, centre again; it settles in a few rounds.
  for (let round = 0; round < 4; round++) {
    centre()
    const f = maxSpread()
    if (f > 1.001) {
      for (const b of boxes) {
        b.cx = W / 2 + (b.cx - W / 2) * f
        b.cy = H / 2 + (b.cy - H / 2) * f
      }
    }
  }
  centre()
}

function hasOverlap(boxes: Box[]) {
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const ox = a.halfW + b.halfW - Math.abs(b.cx - a.cx)
      const oy = Math.min(a.cy + a.bottom, b.cy + b.bottom) - Math.max(a.cy - a.top, b.cy - b.top)
      if (ox > 0.5 && oy > 0.5) return true
    }
  return false
}

/**
 * Guaranteed tidy layout for crowded scenes: shelves (rows) of actors in the AI's top-to-bottom,
 * left-to-right order. Tries 1, 2, 3... rows and takes the first that fits the stage.
 */
function gridFallback(boxes: Box[], actors: ArrangeInput[], W: number, H: number) {
  const order = actors.map((_, i) => i).sort((i, j) => actors[i].y - actors[j].y || actors[i].x - actors[j].x)
  const height = (i: number) => boxes[i].top + boxes[i].bottom
  const width = (i: number) => boxes[i].halfW * 2

  let best: number[][] | null = null
  let bestOverflow = Infinity
  for (let rows = 1; rows <= order.length; rows++) {
    const per = Math.ceil(order.length / rows)
    const shelves = Array.from({ length: Math.ceil(order.length / per) }, (_, r) => order.slice(r * per, (r + 1) * per))
    const heights = shelves.map((row) => Math.max(...row.map(height)))
    const overflow = Math.max(0, heights.reduce((x, y) => x + y, 0) - H) + Math.max(...shelves.map((row) => Math.max(0, row.reduce((x, i) => x + width(i), 0) - W)))
    if (overflow < bestOverflow) {
      bestOverflow = overflow
      best = shelves
    }
    if (overflow === 0) break
  }
  const shelves = best!
  const heights = shelves.map((row) => Math.max(...row.map(height)))
  const gap = Math.max(0, (H - heights.reduce((x, y) => x + y, 0)) / (shelves.length + 1))
  let y = gap
  shelves.forEach((row, r) => {
    const sorted = [...row].sort((i, j) => actors[i].x - actors[j].x)
    const free = Math.max(0, W - sorted.reduce((x, i) => x + width(i), 0)) / (sorted.length + 1)
    let x = free
    for (const i of sorted) {
      const b = boxes[i]
      b.cx = x + b.halfW
      b.cy = y + b.top
      x += width(i) + free
    }
    y += heights[r] + gap
  })
}

/** Test helper: true when no two actors' boxes overlap. */
export function overlaps(actors: ArrangeInput[], placed: Record<string, Placed>, px = spritePx(actors.length)): string[] {
  const out: string[] = []
  const box = (a: ArrangeInput) => {
    const p = placed[a.id]
    const halfW = Math.max(px, a.label ? labelWidth(a.label) : 0, a.say ? bubbleWidth(a.say) : 0) / 2
    return { l: p.x - halfW, r: p.x + halfW, t: p.y - px / 2 - (a.say ? BUBBLE : 0), b: p.y + px / 2 + (a.label ? LABEL : 0) }
  }
  for (let i = 0; i < actors.length; i++)
    for (let j = i + 1; j < actors.length; j++) {
      const a = box(actors[i])
      const b = box(actors[j])
      if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) out.push(`${actors[i].id} / ${actors[j].id}`)
    }
  return out
}
