import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { answerZoneClass } from '../answerZone'
import { buildSteps } from '../engine/simulate'
import { prepareVerify } from '../engine/verify'
import { applesPlan, conceptPlan, derivativePlan } from '../engine/examples'
import type { Plan } from '../engine/plan'
import type { Lesson } from '../engine/types'
import { Board } from './Board'

function lessonOf(plan: Plan): Lesson {
  const p = prepareVerify(plan.verify)
  if ('error' in p) throw new Error(p.error)
  const b = buildSteps(plan, { kind: plan.verify.kind, target: p.target, answer: p.answer, inputs: p.inputs, intermediates: p.intermediates })
  if (!('steps' in b)) throw new Error(JSON.stringify(b))
  return {
    lessonId: 'x', asked: plan.asked, category: 'general', mode: 'concept', answerMode: p.mode,
    checkedBy: p.checkedBy, chunks: plan.chunks.map((c) => ({ title: c.title })), steps: b.steps, sprites: {},
  }
}

describe('the board has four zones with fixed sizes', () => {
  const html = (plan: Plan) => renderToString(<Board lesson={lessonOf(plan)} onNew={() => {}} />)

  it('words, answer, picture and controls are always there, in that order', () => {
    const h = html(conceptPlan)
    const order = ['caption-zone', 'answer-zone', 'stagewrap', 'dock'].map((c) => h.indexOf(`class="${c}`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('the answer zone is reserved from the very first step, but the answer box is not shown yet', () => {
    const h = html(conceptPlan) // first step is an animation, not the question
    expect(h).toContain('answer-zone choice-few')
    expect(h).not.toContain('class="answer"')
    expect(h).not.toContain('class="options"')
  })

  it('each kind of answer gets its own reserved height class', () => {
    expect(html(conceptPlan)).toContain('answer-zone choice-few')
    expect(html(applesPlan)).toContain('answer-zone input')
    expect(html(derivativePlan)).toContain('answer-zone input')
  })

  it('the words are stacked in one box (no layout change while lines swap)', () => {
    const h = html(conceptPlan)
    expect(h).toContain('caption-slot')
    expect(h).not.toContain('class="speak"')
  })
})

describe('answer zone sizes', () => {
  it('chosen once from the kind of answer', () => {
    expect(answerZoneClass({ type: 'none' })).toBe('none')
    expect(answerZoneClass({ type: 'number' })).toBe('input')
    expect(answerZoneClass({ type: 'text' })).toBe('input')
    expect(answerZoneClass({ type: 'expression' })).toBe('input')
    expect(answerZoneClass({ type: 'choice', options: ['a', 'b', 'c'] })).toBe('choice-few')
    expect(answerZoneClass({ type: 'choice', options: ['a', 'b', 'c', 'd'] })).toBe('choice-many')
  })
})
