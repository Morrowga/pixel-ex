import { arrange, spritePx, type Placed } from './arrange'
import { attachPoints, dedupeArrowLabels, placeLabel, sampleRoute, type Pill } from './declutter'
import { routeArrow, type Pt, type Rect, type Route } from './route'
import { visualLength } from '../i18n/lang'
import type { SceneActor, SceneArrow } from './types'

/** Where each actor was, so the next step keeps it there instead of jumping to a new spot. */
export type Memory = Record<string, { wx: number; wy: number; fx: number; fy: number }>

export interface SceneLayout {
  actors: SceneActor[]
  arrows: SceneArrow[]
  px: number
  placed: Record<string, Placed>
  routes: Route[]
  /** One per arrow: where its label sits, or null when it has no label or no clean spot for it. */
  pills: (Pill | null)[]
  /** What the next step needs to remember so the same actors stay where they are. */
  memory: Memory
  /** Rectangles taken up by each actor's sprite, label and speech bubble. */
  footprint: Record<string, { sprite: Rect; extras: Rect[] }>
}

/**
 * The whole layout of one scene, in the order that keeps it clean:
 * remove repeated text, spread the actors, spread where arrows attach, route the lines around everything,
 * then put each label on its own arrow where nothing is covered.
 */
export interface LayoutOptions {
  /** Show a repeated arrow label once (default). Off when the caller decides which arrow keeps it. */
  dedupeArrowLabels?: boolean
}

function layoutOnce(rawActors: SceneActor[], rawArrows: SceneArrow[], W: number, H: number, options: LayoutOptions = {}): SceneLayout {
  // Names under pictures always stay. Only the floating arrow labels are shown once.
  const actors = rawActors
  const arrows = options.dedupeArrowLabels === false ? rawArrows : dedupeArrowLabels(rawArrows)
  const px = spritePx(actors.length)
  const placed = arrange(actors, px, W, H, arrows)

  const footprint: SceneLayout['footprint'] = {}
  for (const a of actors) {
    const { x, y } = placed[a.id]
    const extras: Rect[] = []
    if (a.label) {
      const w = Math.max(px, visualLength(a.label) * 9 + 12) / 2
      extras.push({ l: x - w, r: x + w, t: y + px / 2 + 2, b: y + px / 2 + 28 })
    }
    if (a.say) {
      const w = (visualLength(a.say) * 8.4 + 24) / 2
      extras.push({ l: x - w, r: x + w, t: y - px / 2 - 48, b: y - px / 2 - 2 })
    }
    footprint[a.id] = { sprite: { l: x - px / 2 - 12, r: x + px / 2 + 12, t: y - px / 2 - 12, b: y + px / 2 + 12 }, extras }
  }

  // Lines keep clear of pictures AND of the text under and above them, with some breathing room.
  const inflate = (r: Rect, by: number): Rect => ({ l: r.l - by, r: r.r + by, t: r.t - by, b: r.b + by })
  const obstaclesFor = (r: SceneArrow): Rect[] =>
    actors.flatMap((a) => {
      const text = footprint[a.id].extras.map((e) => inflate(e, 8))
      return a.id === r.from || a.id === r.to ? text : [footprint[a.id].sprite, ...text] // its own text still blocks the line, its sprite does not
    })
  const taken = Object.fromEntries(actors.map((a) => [a.id, { top: !!a.say, bottom: !!a.label }]))
  const attach = attachPoints(placed, arrows, px, taken)
  const used: Pt[] = []
  const routes = arrows.map((r, i) => {
    const route = routeArrow(placed[r.from], placed[r.to], obstaclesFor(r), px, { minY: 10, maxY: H - 10 }, used, attach[i])
    used.push(route.start, route.end)
    return route
  })

  const lines = routes.map((r) => sampleRoute(r))
  const blocked: Rect[] = actors.flatMap((a) => [footprint[a.id].sprite, ...footprint[a.id].extras])
  const pills = arrows.map((r, i) => {
    if (!r.label.trim()) return null
    const pill = placeLabel(routes[i], r.label, blocked, lines.filter((_, j) => j !== i))
    if (pill) blocked.push(pill)
    return pill
  })

  return { actors, arrows, px, placed, routes, pills, footprint, memory: {} }
}

const polyline = (r: Route, n = 28): Pt[] => Array.from({ length: n + 1 }, (_, i) => r.at(i / n))

/** Do two line segments cross? */
function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** How many pairs of arrows cross each other. */
export function arrowCrossings(routes: Route[]): number {
  const lines = routes.map((r) => polyline(r))
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      let crossed = false
      for (let a = 0; a < lines[i].length - 1 && !crossed; a++)
        for (let b = 0; b < lines[j].length - 1 && !crossed; b++) crossed = segmentsCross(lines[i][a], lines[i][a + 1], lines[j][b], lines[j][b + 1])
      if (crossed) n++
    }
  }
  return n
}

/**
 * How bad a layout is, lower is better. Lines through pictures or text count most, then arrows crossing
 * each other, then labels with no clean spot, then curves (straight is calmer), and finally how far the
 * actors were moved from where the AI put them (so a scene does not jump around between steps).
 */
export function layoutScore(L: SceneLayout, wanted?: SceneActor[], W = 640, H = 320): number {
  const crossings = L.routes.reduce((n, r) => n + r.hits, 0)
  const lostLabels = L.arrows.reduce((n, r, i) => n + (r.label.trim() && !L.pills[i] ? 1 : 0), 0)
  const curves = L.routes.filter((r) => r.curved).length
  let moved = 0
  if (wanted && wanted.length) {
    for (const a of wanted) {
      const p = L.placed[a.id]
      if (p) moved += Math.hypot(p.x - (40 + (a.x / 100) * (W - 80)), p.y - (40 + (a.y / 100) * (H - 80)))
    }
    moved /= wanted.length
  }
  return crossings * 100 + arrowCrossings(L.routes) * 40 + lostLabels * 10 + curves * 6 + moved * 0.5
}

const TRIES = 30

/**
 * The best layout of a scene. The first try keeps the AI's own placement; if it has problems, try slightly
 * different placements and keep the cleanest. Same input always gives the same result.
 */
export function layoutScene(actors: SceneActor[], arrows: SceneArrow[], W: number, H: number, memory: Memory = {}, options: LayoutOptions = {}): SceneLayout {
  // An actor the AI left (about) where it was stays exactly where the last step put it. An actor the AI
  // moved on purpose goes where the AI says. So scenes keep still between steps unless something is meant to move.
  const STAY = 12
  const seeded = actors.map((a) => {
    const m = memory[a.id]
    if (!m || Math.abs(a.x - m.wx) > STAY || Math.abs(a.y - m.wy) > STAY) return a
    return { ...a, x: ((m.fx * W - 40) / (W - 80)) * 100, y: ((m.fy * H - 40) / (H - 80)) * 100 }
  })
  // Movement is measured against where each actor stood in the last step, so staying put is the cheap choice.
  const best = search(seeded, arrows, W, H, seeded, options)
  const next: Memory = {}
  for (const a of actors) {
    const p = best.placed[a.id]
    if (p) next[a.id] = { wx: a.x, wy: a.y, fx: p.x / W, fy: p.y / H }
  }
  return { ...best, memory: next }
}

function search(actors: SceneActor[], arrows: SceneArrow[], W: number, H: number, wantedForScore: SceneActor[], options: LayoutOptions): SceneLayout {
  let best = layoutOnce(actors, arrows, W, H, options)
  if (arrows.length === 0) return best
  let bestScore = layoutScore(best, wantedForScore, W, H)
  // Already clean: straight lines, nothing crossing, every label placed. Keep the AI's placement.
  const clean = (L: SceneLayout) => L.routes.every((r) => r.hits === 0 && !r.curved) && arrowCrossings(L.routes) === 0 && L.arrows.every((r, i) => !r.label.trim() || L.pills[i])
  if (clean(best)) return best

  let seed = 12345
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const clamp = (v: number) => Math.min(100, Math.max(0, v))
  for (let t = 1; t <= TRIES; t++) {
    const spread = 14 + t * 1.5 // wander further from the AI's placement the longer it takes
    const moved = actors.map((a) => ({ ...a, x: clamp(a.x + (rnd() - 0.5) * spread * 1.6), y: clamp(a.y + (rnd() - 0.5) * spread * 2) }))
    const L = layoutOnce(moved, arrows, W, H, options)
    const score = layoutScore(L, wantedForScore, W, H)
    if (score < bestScore) {
      best = L
      bestScore = score
    }
  }
  return best
}
