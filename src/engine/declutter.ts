/**
 * Keeps a scene clean: no repeated text, arrows that leave and land at separate spots, and labels that sit
 * on their own arrow without covering anything.
 */
import type { Pt, Rect, Route } from './route'
import { visualLength } from '../i18n/lang'

const key = (s: string) => s.trim().toLowerCase()

/** The same label on several actors is shown once, on the first one. */
export function dedupeActorLabels<T extends { label: string }>(actors: T[]): T[] {
  const seen = new Set<string>()
  return actors.map((a) => {
    const k = key(a.label)
    if (!k) return a
    if (seen.has(k)) return { ...a, label: '' }
    seen.add(k)
    return a
  })
}

/** The same arrow label on several arrows is shown once, on the first one. */
export function dedupeArrowLabels<T extends { label: string }>(arrows: T[]): T[] {
  return dedupeActorLabels(arrows)
}

/**
 * Where each arrow leaves and lands. Arrows that meet at the same side of a sprite are spread out
 * along that side (ordered by where the other end is), so heads never pile up on one spot.
 */
export function attachPoints(
  placed: Record<string, Pt>,
  arrows: { from: string; to: string }[],
  px: number,
  /** Which edges of each picture are taken by text: a speech bubble above, a name below. */
  taken: Record<string, { top: boolean; bottom: boolean }> = {},
): { start: Pt; end: Pt; startOff: number; endOff: number }[] {
  interface End {
    arrow: number
    isEnd: boolean
    actor: string
    side: 'l' | 'r' | 't' | 'b'
    other: number
  }
  const ends: End[] = []
  arrows.forEach((r, i) => {
    const a = placed[r.from]
    const b = placed[r.to]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    // A mostly vertical arrow normally uses top and bottom edges. If text sits there, use the side facing the other picture.
    const blockedFrom = !horizontal && (dy >= 0 ? taken[r.from]?.bottom : taken[r.from]?.top)
    const blockedTo = !horizontal && (dy >= 0 ? taken[r.to]?.top : taken[r.to]?.bottom)
    ends.push(
      blockedFrom || horizontal
        ? { arrow: i, isEnd: false, actor: r.from, side: dx >= 0 ? 'r' : 'l', other: b.y }
        : { arrow: i, isEnd: false, actor: r.from, side: dy >= 0 ? 'b' : 't', other: b.x },
      blockedTo || horizontal
        ? { arrow: i, isEnd: true, actor: r.to, side: dx >= 0 ? 'l' : 'r', other: a.y }
        : { arrow: i, isEnd: true, actor: r.to, side: dy >= 0 ? 't' : 'b', other: a.x },
    )
  })
  const groups = new Map<string, End[]>()
  for (const e of ends) groups.set(`${e.actor}|${e.side}`, [...(groups.get(`${e.actor}|${e.side}`) ?? []), e])

  const out = arrows.map(() => ({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, startOff: 0, endOff: 0 }))
  for (const list of groups.values()) {
    list.sort((p, q) => p.other - q.other)
    const n = list.length
    const step = n > 1 ? Math.min(px * 0.4, (px * 0.84) / (n - 1)) : 0
    list.forEach((e, idx) => {
      const off = (idx - (n - 1) / 2) * step
      const p = placed[e.actor]
      const gap = px / 2 + (e.isEnd ? 12 : 6)
      const pt =
        e.side === 'r' ? { x: p.x + gap, y: p.y + off }
        : e.side === 'l' ? { x: p.x - gap, y: p.y + off }
        : e.side === 'b' ? { x: p.x + off, y: p.y + gap }
        : { x: p.x + off, y: p.y - gap }
      if (e.isEnd) {
        out[e.arrow].end = pt
        out[e.arrow].endOff = off
      } else {
        out[e.arrow].start = pt
        out[e.arrow].startOff = off
      }
    })
  }
  return out
}

export interface Pill extends Rect {
  cx: number
  cy: number
}

export const pillSize = (label: string) => ({ w: visualLength(label) * 8.8 + 18, h: 26 })

const hit = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
const within = (p: Pt, r: Rect) => p.x >= r.l && p.x <= r.r && p.y >= r.t && p.y <= r.b

/**
 * Finds a spot ON the arrow for its label where it covers no picture, no text and no other arrow.
 * Returns null when there is no clean spot; the label is then left out rather than put in a bad place.
 */
export function placeLabel(route: Route, label: string, blocked: Rect[], otherLines: Pt[][]): Pill | null {
  const { w, h } = pillSize(label)
  for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82]) {
    const p = route.at(t)
    const r: Pill = { l: p.x - w / 2 - 4, r: p.x + w / 2 + 4, t: p.y - h / 2 - 4, b: p.y + h / 2 + 4, cx: p.x, cy: p.y }
    if (blocked.some((o) => hit(o, r))) continue
    if (otherLines.some((line) => line.some((q) => within(q, r)))) continue
    return r
  }
  return null
}

/** Points along a route, for checking that labels stay off other arrows. */
export const sampleRoute = (route: Route, n = 48): Pt[] => Array.from({ length: n + 1 }, (_, i) => route.at(i / n))
