import { describe, expect, it } from 'vitest'
import { buildSteps } from '../engine/simulate'
import { prepareVerify } from '../engine/verify'
import { PlanSchema, type Plan } from '../engine/plan'
import { algebraPlan, applesPlan, block, conceptPlan, derivativePlan, dividePlan, fractionPlan, verify } from '../engine/examples'
import { t } from './messages'
import type { Lang } from './lang'

const checker = (plan: Plan, lang: Lang) => {
  const p = prepareVerify(plan.verify, lang)
  if ('error' in p) throw new Error(p.error)
  return p.check!
}

describe('answers typed with Japanese or Burmese digits are the same answers', () => {
  it('a number: ７ (full-width) and ၇ (Burmese) are 7', () => {
    for (const lang of ['en', 'ja', 'my'] as const) {
      const c = checker(applesPlan, lang)
      expect(c('7').kind).toBe('correct')
      expect(c('７').kind, `${lang} full-width`).toBe('correct')
      expect(c('၇').kind, `${lang} Burmese`).toBe('correct')
      expect(c('３').kind).toBe('hint')
    }
  })
  it('a fraction: ５／６ and ၅/၆', () => {
    const c = checker(fractionPlan, 'ja')
    expect(c('５／６').kind).toBe('correct')
    expect(c('၅/၆').kind).toBe('correct')
    expect(c('０．８３').kind).toBe('correct')
  })
  it('an equation answer: x ＝ ７ and x = ၇', () => {
    const c = checker(algebraPlan, 'ja')
    expect(c('x ＝ ７').kind).toBe('correct')
    expect(c('x = ၇').kind).toBe('correct')
  })
  it('a formula: ３ｘ would need real letters, but full-width digits and signs work', () => {
    const c = checker(derivativePlan, 'my')
    expect(c('၃x^၂').kind).toBe('correct')
    expect(c('３x＾２').kind).toBe('correct')
  })
  it('a multiple-choice pick typed as a Burmese or full-width digit', () => {
    const c = checker(conceptPlan, 'my')
    const correct = (prepareVerify(conceptPlan.verify, 'my') as { mode: { options: string[] } }).mode.options.length
    expect(correct).toBeGreaterThanOrEqual(3)
    expect(c('၁').kind).toBe('correct') // option 1 is the right one in this example
    expect(c('１').kind).toBe('correct')
  })
})

describe('hints come back in the learner’s language and never contain the answer', () => {
  it.each(['en', 'ja', 'my'] as const)('%s: correct, wrong and unreadable answers', (lang) => {
    const c = checker(applesPlan, lang)
    expect(c('7').message).toBe(t(lang, 'fb.correct'))
    expect(c('3').message).toBe(t(lang, 'fb.addOneGroup'))
    expect(c('banana').message).toBe(t(lang, 'fb.invalidNumber'))
    for (const n of ['0', '1', '3', '4', '6', '8', '12']) expect(c(n).message).not.toMatch(/\b7\b|７|၇/)
  })
  it('division flipped, in Japanese and Burmese', () => {
    expect(checker(dividePlan, 'ja')('36').message).toBe(t('ja', 'fb.divMultiplied'))
    expect(checker(fractionPlan, 'my')('6/5').message).toBe(t('my', 'fb.divFlipped'))
  })
  it('the equation hint names the unknown in each language', () => {
    expect(checker(algebraPlan, 'ja')('6').message).toBe(t('ja', 'fb.solve', { v: 'x' }))
    expect(checker(algebraPlan, 'my')('6').message).toContain('x')
  })
})

const plan = (blocks: ReturnType<typeof block>[]): Plan =>
  PlanSchema.parse({ ...conceptPlan, about_technology: false, chunks: [{ title: 'x', blocks: [...blocks, block({ type: 'ask', caption: '**Q?**' })] }] })
const build = (p: Plan, extra: Record<string, unknown> = {}) => {
  const v = prepareVerify(p.verify)
  if ('error' in v) throw new Error(v.error)
  return buildSteps(p, { kind: p.verify.kind, target: v.target, answer: v.answer, inputs: v.inputs, intermediates: v.intermediates, ...extra })
}
const actor = (id: string, o: Record<string, unknown> = {}) => ({ id, sprite: 'child', x: 30, y: 50, motion: 'none' as const, flip: false, label: '', say: '', ...o })

describe('lesson rules work in every language', () => {
  const calcPlan = (blocks: ReturnType<typeof block>[]): Plan => ({
    ...applesPlan,
    chunks: [{ title: 'x', blocks: [...blocks, block({ type: 'ask', caption: '**いくつ？**', group: 'a', measure: 'group_total' })] }],
  })

  it('a leaked answer written with Burmese digits is caught (၇ is 7)', () => {
    const p = calcPlan([block({ type: 'spawn', caption: 'သင့်မှာ **၃ ခု** ရှိတယ်', group: 'a', count: 3, sprite: 'apple', color: 'red' }), block({ type: 'spawn', caption: 'နောက်ထပ် **၄ ခု**', group: 'b', count: 4, sprite: 'apple', color: 'green' }), block({ type: 'merge', caption: 'စုစုပေါင်း **၇** ခု', group: 'a2', groups: ['a', 'b'] })])
    // ask reads group "a", which no longer exists after the merge, so use the merged group
    p.chunks[0].blocks[3] = block({ type: 'ask', caption: '**いくつ？**', group: 'a2', measure: 'group_total' })
    expect(JSON.stringify(build(p))).toMatch(/gives away the answer/)
  })
  it('and with Japanese full-width digits (７)', () => {
    const p = calcPlan([block({ type: 'spawn', caption: '**３こ** あります', group: 'a', count: 3, sprite: 'apple', color: 'red' }), block({ type: 'spawn', caption: 'あと **４こ**', group: 'b', count: 4, sprite: 'apple', color: 'green' }), block({ type: 'merge', caption: 'ぜんぶで **７こ**', group: 'a2', groups: ['a', 'b'] })])
    p.chunks[0].blocks[3] = block({ type: 'ask', caption: '**いくつ？**', group: 'a2', measure: 'group_total' })
    expect(JSON.stringify(build(p))).toMatch(/gives away the answer/)
  })
  it('the same lesson without a leak passes in Japanese and Burmese', () => {
    const p = calcPlan([block({ type: 'spawn', caption: '**３こ** あります', group: 'a', count: 3, sprite: 'apple', color: 'red' }), block({ type: 'spawn', caption: 'あと **４こ**', group: 'b', count: 4, sprite: 'apple', color: 'green' }), block({ type: 'merge', caption: 'ぜんぶ **あわせます**', group: 'a2', groups: ['a', 'b'] })])
    p.chunks[0].blocks[3] = block({ type: 'ask', caption: '**いくつ？**', group: 'a2', measure: 'group_total' })
    expect('steps' in build(p)).toBe(true)
  })

  it('label length limits count how wide the text looks: 7 Japanese characters fit, 12 do not', () => {
    const ok = plan([block({ type: 'scene', caption: 'x', actors: [actor('a', { label: 'おおきなくるま' }), actor('b', { label: 'ちいさい' })], arrows: [{ from: 'a', to: 'b', label: '作る' }] })])
    expect(JSON.stringify(build(ok))).not.toMatch(/keep labels/)
    const long = plan([block({ type: 'scene', caption: 'x', actors: [actor('a', { label: 'とてもおおきなあかいくるま' }), actor('b', { label: 'b' })], arrows: [{ from: 'a', to: 'b', label: 'x' }] })])
    expect(JSON.stringify(build(long))).toMatch(/keep labels/)
  })
  it('arrow labels are measured the same way', () => {
    const p = plan([block({ type: 'scene', caption: 'x', actors: [actor('a', { label: 'a' }), actor('b', { label: 'b' })], arrows: [{ from: 'a', to: 'b', label: 'とてもながいやじるしのなまえ' }] })])
    expect(JSON.stringify(build(p))).toMatch(/short verb label/)
  })
  it('"many" in Japanese and Burmese is rejected like in English', () => {
    for (const label of ['たくさんの子ども', 'みんな', 'များစွာ']) {
      const p = plan([block({ type: 'scene', caption: 'x', actors: [actor('a', { label }), actor('b', { label: 'b' })], arrows: [{ from: 'a', to: 'b', label: 'x' }] })])
      expect(JSON.stringify(build(p)), label).toMatch(/one picture standing for many/)
    }
  })
  it('a vague Japanese or Burmese arrow word is rejected', () => {
    for (const word of ['使う', 'サポート', 'သုံး', 'ပံ့ပိုး']) {
      const p = plan([block({ type: 'scene', caption: 'x', actors: [actor('a', { label: 'a' }), actor('b', { label: 'b' })], arrows: [{ from: 'a', to: 'b', label: word }] })])
      expect(JSON.stringify(build(p)), word).toMatch(/too vague/)
    }
  })

  it('computers in a lesson that is not about technology are rejected by the flag the AI sets, in any language', () => {
    const p = plan([block({ type: 'scene', caption: 'x', actors: [actor('a', { sprite: 'computer', label: 'a' }), actor('b', { label: 'b' })], arrows: [{ from: 'a', to: 'b', label: 'x' }] })])
    expect(JSON.stringify(build(p, { allowTech: false }))).toMatch(/not about computers/)
    expect(JSON.stringify(build(p, { allowTech: true }))).not.toMatch(/not about computers/)
  })
  it('the plan carries the flag, and the technology examples set it', () => {
    expect(conceptPlan.about_technology).toBe(true)
    expect(verify({}).kind).toBe('none')
    expect(PlanSchema.shape.about_technology).toBeDefined()
  })
})
