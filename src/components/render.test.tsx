import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { applesPlan, conceptPlan, cpuPlan } from '../engine/examples'
import { buildSteps } from '../engine/simulate'
import { prepareVerify } from '../engine/verify'
import type { Plan } from '../engine/plan'
import { CustomSprites } from '../sprites/SpriteContext'
import { SPRITES } from '../sprites/library'
import { SceneView } from './SceneView'
import { Stage } from './Stage'

function stepsOf(plan: Plan) {
  const p = prepareVerify(plan.verify)
  if ('error' in p) throw new Error(p.error)
  const b = buildSteps(plan, { kind: plan.verify.kind, target: p.target, answer: p.answer, inputs: p.inputs, intermediates: p.intermediates })
  if (!('steps' in b)) throw new Error(JSON.stringify(b))
  return b.steps
}

describe('rendering (server-side, no browser)', () => {
  it('draws every step of the "what is AI" scene with sprites, labels and arrows', () => {
    for (const st of stepsOf(conceptPlan)) {
      if (st.visual?.kind !== 'scene') continue
      const html = renderToString(<SceneView visual={st.visual} />)
      expect(html).toContain('shape-rendering')
      expect((html.match(/<rect/g) ?? []).length).toBeGreaterThan(20 * st.visual.actors.length) // many pixels per sprite
    }
    const last = stepsOf(conceptPlan).find((s) => s.visual?.kind === 'scene' && s.visual.arrows.length)!
    const html = renderToString(<SceneView visual={last.visual as never} />)
    expect(html).toContain('shows')
    expect(html).toContain('Dog!')
  })

  it('draws counting objects as sprites, not emoji', () => {
    const st = stepsOf(applesPlan)[1]
    const html = renderToString(<Stage scene={st.scene} />)
    expect(html).toContain('shape-rendering')
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })

  it('a sprite made for the lesson is drawn; an unknown one gets a labelled placeholder', () => {
    const actors = [
      { id: 't', sprite: 'tractor', x: 30, y: 50, motion: 'none' as const, flip: false, label: '', say: '' },
      { id: 'u', sprite: 'mystery', x: 70, y: 50, motion: 'none' as const, flip: false, label: '', say: '' },
    ]
    const html = renderToString(
      <CustomSprites.Provider value={{ tractor: SPRITES.cookie }}>
        <SceneView visual={{ kind: 'scene', actors, arrows: [] }} />
      </CustomSprites.Provider>,
    )
    expect(html).toContain('mystery') // placeholder shows the name
    expect(html).not.toContain('>tractor<') // the drawn one needs no name tag
  })

  it('pictures already on screen are drawn in place with no entry animation; new ones start hidden', () => {
    const steps = stepsOf(cpuPlan).filter((s) => s.visual?.kind === 'scene')
    const first = steps[0].visual as never
    const second = steps[1].visual as never
    // the very first scene: everything is new, so it starts hidden and plays in
    const fresh = renderToString(<SceneView visual={first} previous={null} />)
    expect((fresh.match(/opacity:0/g) ?? []).length).toBeGreaterThan(0)
    // the same scene again, when the pictures are already there: nothing starts hidden
    const again = renderToString(<SceneView visual={first} previous={first} />)
    expect((again.match(/opacity:0/g) ?? []).length).toBe(0)
    // the next scene adds a picture: only the new one starts hidden, the old ones are already visible
    const next = renderToString(<SceneView visual={second} previous={first} />)
    const hidden = (next.match(/opacity:0/g) ?? []).length
    expect(hidden).toBeGreaterThan(0)
    expect(hidden).toBeLessThan((fresh.match(/opacity:0/g) ?? []).length)
  })
})
