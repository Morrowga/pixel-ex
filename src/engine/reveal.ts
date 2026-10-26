import type { SceneActor, SceneArrow } from './types'

/** Seconds a picture takes to appear, and an arrow to draw. */
export const T_ACTOR = 0.7
export const T_ARROW = 1.1

export const actorKey = (a: { id: string; sprite: string }) => `${a.id}:${a.sprite}`
export const arrowKey = (r: { from: string; to: string }) => `${r.from}>${r.to}`

interface SceneLike {
  actors: SceneActor[]
  arrows: SceneArrow[]
}

export interface Reveal {
  /** When each NEW picture appears, in seconds from the start of the step. Pictures already on screen are absent. */
  actors: Record<string, number>
  /** When each NEW arrow starts to draw. */
  arrows: Record<string, number>
  /** Seconds until everything new is on screen. */
  total: number
}

/** Arrows in story order: an arrow comes after the arrow that leads into its starting picture. */
export function orderChain<T extends { from: string; to: string }>(arrows: T[]): T[] {
  const left = [...arrows]
  const out: T[] = []
  while (left.length) {
    const i = left.findIndex((r) => !left.some((q) => q !== r && q.to === r.from))
    out.push(...left.splice(i === -1 ? 0 : i, 1)) // a cycle: keep the listed order
  }
  return out
}

/**
 * The story of one step: the first picture appears, an arrow draws to the next picture, that picture
 * appears, and so on. Pictures and arrows that were already on screen in the previous step do not move
 * or play again.
 */
export function planReveal(prev: SceneLike | null, cur: SceneLike): Reveal {
  const seen = new Set((prev?.actors ?? []).map(actorKey))
  const seenArrows = new Set((prev?.arrows ?? []).map(arrowKey))
  const newActors = cur.actors.filter((a) => !seen.has(actorKey(a)))
  const newArrows = cur.arrows.filter((r) => !seenArrows.has(arrowKey(r)))
  const byId = new Map(cur.actors.map((a) => [a.id, a]))
  const out: Reveal = { actors: {}, arrows: {}, total: 0 }
  let t = 0.15
  const on = new Set(seen)
  const show = (a: SceneActor | undefined) => {
    if (!a || on.has(actorKey(a))) return
    on.add(actorKey(a))
    out.actors[actorKey(a)] = t
    t += T_ACTOR
  }

  const linked = new Set(newArrows.flatMap((r) => [r.from, r.to]))
  for (const a of newActors) if (!linked.has(a.id)) show(a) // pictures with no new arrow come first
  for (const r of orderChain(newArrows)) {
    show(byId.get(r.from)) // the arrow starts at a picture that is already there
    out.arrows[arrowKey(r)] = t
    t += T_ARROW
    show(byId.get(r.to)) // and ends at a picture that appears as the arrow arrives
  }
  for (const a of newActors) show(a)
  out.total = t
  return out
}
