import { describe, expect, it } from 'vitest'
import { attachRuns } from './runs'
import { actorKey } from './reveal'
import { conceptPlan, cpuPlan, applesPlan } from './examples'
import { buildSteps } from './simulate'
import { prepareVerify } from './verify'
import type { Plan } from './plan'
import type { SceneActor, Step } from './types'

function stepsOf(plan: Plan): Step[] {
  const p = prepareVerify(plan.verify)
  if ('error' in p) throw new Error(p.error)
  const b = buildSteps(plan, { kind: plan.verify.kind, target: p.target, answer: p.answer, inputs: p.inputs, intermediates: p.intermediates })
  if (!('steps' in b)) throw new Error(JSON.stringify(b))
  return b.steps
}
const scene = (s: Step) => (s.visual?.kind === 'scene' ? s.visual : null)

describe('a run of scenes shares one layout', () => {
  const steps = stepsOf(cpuPlan)

  it('every scene step of the CPU lesson carries the same run, with every picture of the whole lesson', () => {
    const runs = steps.map((s) => scene(s)?.run).filter(Boolean)
    expect(runs.length).toBe(steps.length)
    expect(new Set(runs.map((r) => r!.id)).size).toBe(1)
    const ids = runs[0]!.actors.map((a) => a.id).sort()
    expect(ids).toEqual(['result', 'steps', 'worker'])
    // arrows from every step are in it
    expect(runs[0]!.arrows.length).toBeGreaterThanOrEqual(2)
  })

  it('the first appearance decides where a picture stands, so later steps cannot move it', () => {
    const run = scene(steps[0])!.run!
    const first = scene(steps[0])!.actors.find((a) => a.id === 'worker') as SceneActor
    const inRun = run.actors.find((a) => a.id === 'worker')!
    expect([inRun.x, inRun.y]).toEqual([first.x, first.y])
  })

  it('the room kept for text is the widest text used anywhere in the run', () => {
    const run = scene(steps[0])!.run!
    expect(run.actors.find((a) => a.id === 'worker')!.say).toBe('I follow steps')
  })

  it('a step with a lot of new things gets time to play them, and every scene step has reading time too', () => {
    for (const s of steps) {
      if (s.ask) continue
      expect(s.durationMs).toBeGreaterThanOrEqual(4000)
    }
    // the step that adds three pictures and two arrows is longer than the step that changes only a caption
    const lens = steps.filter((s) => !s.ask).map((s) => s.durationMs)
    expect(Math.max(...lens)).toBeGreaterThan(Math.min(...lens))
  })

  it('different runs (a counting scene in between) get different ids', () => {
    const mixed = [...stepsOf(conceptPlan).slice(0, 2), ...stepsOf(applesPlan).slice(0, 2), ...stepsOf(conceptPlan).slice(0, 2)]
    attachRuns(mixed)
    const ids = mixed.map((s) => scene(s)?.run?.id).filter(Boolean)
    expect(new Set(ids).size).toBe(2)
  })

  it('actor keys still tell a cook from a CPU (same id, new sprite)', () => {
    const a = scene(steps[0])!.actors.find((x) => x.id === 'worker')!
    const b = scene(steps[2])!.actors.find((x) => x.id === 'worker')!
    expect(actorKey(a)).not.toBe(actorKey(b))
  })
})
