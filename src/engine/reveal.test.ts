import { describe, expect, it } from 'vitest'
import { T_ACTOR, T_ARROW, actorKey, arrowKey, orderChain, planReveal } from './reveal'
import type { SceneActor, SceneArrow } from './types'

const a = (id: string, sprite = 'child'): SceneActor => ({ id, sprite, x: 50, y: 50, motion: 'none', flip: false, label: id, say: '' })
const r = (from: string, to: string, label = 'sends'): SceneArrow => ({ from, to, label })

describe('story order: picture, arrow, next picture', () => {
  it('three pictures in a chain appear one after the other, with each arrow between them', () => {
    const p = planReveal(null, { actors: [a('A'), a('B'), a('C')], arrows: [r('A', 'B'), r('B', 'C')] })
    const tA = p.actors[actorKey(a('A'))]
    const tAB = p.arrows[arrowKey(r('A', 'B'))]
    const tB = p.actors[actorKey(a('B'))]
    const tBC = p.arrows[arrowKey(r('B', 'C'))]
    const tC = p.actors[actorKey(a('C'))]
    expect(tA).toBeLessThan(tAB)
    expect(tAB).toBeLessThan(tB) // the picture appears as the arrow arrives
    expect(tB).toBeLessThan(tBC)
    expect(tBC).toBeLessThan(tC)
    // and each step takes the time it needs, not overlapping
    expect(tB - tAB).toBeCloseTo(T_ARROW, 5)
    expect(tBC - tB).toBeCloseTo(T_ACTOR, 5)
  })

  it('arrows listed out of order are still played in story order', () => {
    const p = planReveal(null, { actors: [a('A'), a('B'), a('C')], arrows: [r('B', 'C'), r('A', 'B')] })
    expect(p.arrows[arrowKey(r('A', 'B'))]).toBeLessThan(p.arrows[arrowKey(r('B', 'C'))])
    expect(orderChain([r('B', 'C'), r('A', 'B')]).map((x) => x.from)).toEqual(['A', 'B'])
  })

  it('pictures already on screen do not appear again; only the new part plays', () => {
    const prev = { actors: [a('A'), a('B')], arrows: [r('A', 'B')] }
    const p = planReveal(prev, { actors: [a('A'), a('B'), a('C')], arrows: [r('A', 'B'), r('B', 'C')] })
    expect(Object.keys(p.actors)).toEqual([actorKey(a('C'))])
    expect(Object.keys(p.arrows)).toEqual([arrowKey(r('B', 'C'))])
    // the new arrow starts straight away (B is already there) and C appears after it
    expect(p.arrows[arrowKey(r('B', 'C'))]).toBeLessThan(p.actors[actorKey(a('C'))])
  })

  it('a picture that turns into something else (same place, new sprite) appears again, in place', () => {
    const prev = { actors: [a('worker', 'child')], arrows: [] }
    const p = planReveal(prev, { actors: [a('worker', 'chip')], arrows: [] })
    expect(Object.keys(p.actors)).toEqual(['worker:chip'])
  })

  it('pictures with no arrow come first, then the chain', () => {
    const p = planReveal(null, { actors: [a('A'), a('B'), a('X')], arrows: [r('A', 'B')] })
    expect(p.actors[actorKey(a('X'))]).toBeLessThan(p.actors[actorKey(a('A'))])
  })

  it('a step with nothing new is nearly instant', () => {
    const s = { actors: [a('A'), a('B')], arrows: [r('A', 'B')] }
    const p = planReveal(s, s)
    expect(p.total).toBeLessThan(0.5)
    expect(Object.keys(p.actors)).toHaveLength(0)
  })

  it('total is when the last thing has appeared', () => {
    const p = planReveal(null, { actors: [a('A'), a('B')], arrows: [r('A', 'B')] })
    expect(p.total).toBeCloseTo(0.15 + T_ACTOR + T_ARROW + T_ACTOR, 5)
  })
})
