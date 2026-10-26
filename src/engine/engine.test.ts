import { describe, expect, it } from 'vitest'
import { evaluate, frac } from './calc'
import { buildSteps, spriteNames } from './simulate'
import { isTechTopic } from './topic'
import { prepareVerify } from './verify'
import { compileExpr, derivativeFn, linearEquation, sameFunction } from './mathx'
import { PlanSchema, type Plan } from './plan'
import { SPRITES } from '../sprites/library'
import {
  EXAMPLES, algebraPlan, applesPlan, block, calc, conceptPlan, cpuPlan, derivativePlan, dividePlan,
  changePlan, fractionPlan, halvesPlan, oneBasketPlan, percentPlan, squaresPlan, velocityPlan, verify,
} from './examples'

/** The same path the server takes: prepare the check, then build and validate the steps. */
function run(plan: Plan) {
  const prepared = prepareVerify(plan.verify)
  if ('error' in prepared) throw new Error(prepared.error)
  const built = buildSteps(plan, {
    kind: plan.verify.kind, target: prepared.target, answer: prepared.answer,
    inputs: prepared.inputs, intermediates: prepared.intermediates,
  })
  return { prepared, built }
}
const steps = (plan: Plan) => {
  const { built } = run(plan)
  if (!('steps' in built)) throw new Error(JSON.stringify(built))
  return built.steps
}
const errorsOf = (plan: Plan) => JSON.stringify(run(plan).built)
const check = (plan: Plan) => run(plan).prepared.check!

describe('examples (also the prompt few-shots)', () => {
  it('all fit the schema', () => {
    for (const [, p] of EXAMPLES) expect(() => PlanSchema.parse(p)).not.toThrow()
  })
  it.each(EXAMPLES.filter(([, p]) => p.status === 'complete').map(([q, p]) => [q, p] as const))(
    'builds a lesson for %s and ends on the ask step', (_q, plan) => {
      const s = steps(plan)
      expect(s.at(-1)?.ask).toBe(true)
      expect(s.at(-1)?.durationMs).toBe(0)
      expect(s.length).toBeLessThanOrEqual(30)
    })
})

describe('a bare thing ("7 squares")', () => {
  it('becomes a lesson, and its own number may appear in captions', () => {
    const s = steps(squaresPlan)
    expect(s[0].caption).toMatch(/7 squares/)
    expect(s[0].scene.items).toHaveLength(7)
    expect(s[0].think).toBeTruthy()
    expect(check(squaresPlan)('7').kind).toBe('correct')
    expect(check(squaresPlan)('6').kind).toBe('hint')
  })
  it('unclear input carries clickable choices', () => {
    const unclear = EXAMPLES.find(([q]) => q === '3 and 4')![1]
    expect(unclear.status).toBe('unclear')
    expect(unclear.clarify).toEqual(['3 + 4', '4 - 3', 'Which is bigger, 3 or 4?'])
  })
})

describe('evaluate (arithmetic, exact)', () => {
  it('computes in code', () => {
    expect(evaluate([calc('x', 'percent', 15, 200)])).toMatchObject({ ok: true, answer: frac(30) })
    expect(evaluate([calc('x', 'div', 7, 2)])).toMatchObject({ ok: true, answer: frac(7, 2), value: 3.5 })
    expect(evaluate([calc('x', 'div', 5, 6)])).toMatchObject({ ok: true, answer: frac(5, 6) })
  })
  it('chains steps by ref', () => {
    const r = evaluate([calc('s', 'add', 3, 4), { id: 't', op: 'mul', a: { num: null, ref: 's' }, b: { num: 2, ref: null } }])
    expect(r).toMatchObject({ ok: true, answer: frac(14) })
  })
  it('rejects what cannot work', () => {
    expect(evaluate([calc('x', 'div', 10, 0)])).toMatchObject({ ok: false })
    expect(evaluate([calc('x', 'sub', 5, 8)])).toMatchObject({ ok: false })
  })
})

describe('object animations', () => {
  it('keeps item ids when groups merge, so they can move', () => {
    const s = steps(applesPlan)
    const ids = (i: number) => s[i].scene.items.map((x) => x.id).sort()
    expect(ids(2)).toEqual(ids(1))
    expect(new Set(s[2].scene.items.map((x) => x.color)).size).toBe(2)
  })
  it('puts split items in baskets, including a single basket', () => {
    expect(steps(dividePlan).at(-1)!.scene.baskets).toHaveLength(3)
    expect(steps(oneBasketPlan).at(-1)!.scene.baskets).toHaveLength(1)
  })
  it('cut: slices, dealt one of every object to each plate', () => {
    const s = steps(fractionPlan)
    expect(s[1].scene.items).toHaveLength(30)
    expect(s[1].scene.items.every((i) => i.piece)).toBe(true)
    expect(s.at(-1)!.scene.baskets).toHaveLength(6)
    expect(steps(halvesPlan)[1].scene.items).toHaveLength(14)
  })
  it('scaled analogy is checked against the scaled calculation', () => {
    expect(() => steps(percentPlan)).not.toThrow()
  })
})

describe('every step moves', () => {
  it('there is no text-only step type any more', () => {
    expect(() => PlanSchema.parse({ ...conceptPlan, chunks: [{ title: 'x', blocks: [{ ...conceptPlan.chunks[0].blocks[0], type: 'card' }] }] })).toThrow()
  })
  it('in every example, each step before the ask has a moving picture (scene, objects, graph, number line or scale)', () => {
    for (const [, p] of EXAMPLES.filter(([, x]) => x.status === 'complete')) {
      for (const st of steps(p).filter((x) => !x.ask)) {
        const moving = st.visual ? ['scene', 'graph', 'numberline', 'balance'].includes(st.visual.kind) : st.scene.items.length > 0
        expect(moving, `${p.asked}: ${st.caption}`).toBe(true)
      }
    }
  })
})

describe('"what is X": everyday example first, then the real thing', () => {
  it('the CPU lesson has two parts: a cook in a kitchen, then the same actors turned into the real thing', () => {
    const s = steps(cpuPlan)
    const parts = [...new Set(s.map((x) => x.chunk))]
    expect(parts).toEqual([0, 1])
    const ids = (i: number) => (s[i].visual as { actors: { id: string; sprite: string }[] }).actors
    const part1 = s.filter((x) => x.chunk === 0)
    const part2 = s.filter((x) => x.chunk === 1)
    // part 1 never mentions the real thing
    for (const st of part1) expect(st.caption.toLowerCase()).not.toMatch(/cpu|computer|program/)
    // the same actor ids reappear in part 2 with new sprites, so the example visibly turns into the real thing
    const idx = (st: typeof s[number]) => s.indexOf(st)
    const before = ids(idx(part1[0])).find((a) => a.id === 'worker')!
    const after = ids(idx(part2[0])).find((a) => a.id === 'worker')!
    expect([before.sprite, after.sprite]).toEqual(['child', 'chip'])
    expect(part2.at(-1)!.ask).toBe(true)
  })
  it('the new chip sprite exists and the lesson needs nothing drawn', () => {
    const names = spriteNames(steps(cpuPlan))
    expect(names).toContain('chip')
    expect(names.every((n) => n in SPRITES)).toBe(true)
  })
  it('the AI lesson is also two parts now', () => {
    expect([...new Set(steps(conceptPlan).map((x) => x.chunk))]).toEqual([0, 1])
  })
})

describe('arrows tell a complete, clear story', () => {
  const scene = (blocks: ReturnType<typeof block>[]) => ({ ...conceptPlan, chunks: [{ title: 'x', blocks: [...blocks, block({ type: 'ask', caption: '**Which?**' })] }] })
  const a = (id: string, o: Record<string, unknown> = {}) => ({ id, sprite: 'child', x: 20, y: 50, motion: 'none' as const, flip: false, label: id, say: '', ...o })
  const bad = (actors: ReturnType<typeof a>[], arrows: { from: string; to: string; label: string }[]) =>
    errorsOf(scene([block({ type: 'scene', caption: 'x', actors, arrows })]))

  it('a picture left floating with no arrow is rejected (the screenshots: "open data", "notes", "desk")', () => {
    const msg = bad([a('memory'), a('computer'), a('data')], [{ from: 'memory', to: 'computer', label: 'helps' }])
    expect(msg).toMatch(/data.{0,3} has no arrow/)
    expect(msg).toMatch(/EVERY picture/)
  })
  it('a scene with no arrows at all is still fine when it shows only one or two kinds of picture', () => {
    expect(bad([a('child'), a('dog')], [])).not.toMatch(/has no arrow|no arrows/)
    expect(bad([a('c1'), a('c2'), a('c3')], [])).not.toMatch(/no arrows/) // three of the same kind (a crowd)
  })
  it('three or more DIFFERENT pictures with no arrows is rejected (the hard drive lesson had none)', () => {
    const msg = bad([a('keeper'), a('photo', { sprite: 'photo' }), a('box', { sprite: 'box' })], [])
    expect(msg).toMatch(/3 different pictures but no arrows/)
  })
  it('every arrow needs a short verb label', () => {
    expect(bad([a('x'), a('y')], [{ from: 'x', to: 'y', label: '' }])).toMatch(/short verb label/)
    expect(bad([a('x'), a('y')], [{ from: 'x', to: 'y', label: 'a very long label here' }])).toMatch(/short verb label/)
  })
  it('two arrows between the same two pictures are not an error: the second one is dropped, no AI call needed', () => {
    const plan = scene([block({ type: 'scene', caption: 'x', actors: [a('m'), a('c')], arrows: [{ from: 'c', to: 'm', label: 'sends' }, { from: 'm', to: 'c', label: 'gives' }, { from: 'c', to: 'm', label: 'sends' }] })])
    const v = steps(plan)[0].visual as { arrows: { from: string; to: string; label: string }[] }
    expect(v.arrows).toEqual([{ from: 'c', to: 'm', label: 'sends' }])
  })
  it('a connected story passes', () => {
    expect(bad([a('cook'), a('recipe'), a('food')], [{ from: 'recipe', to: 'cook', label: 'tells' }, { from: 'cook', to: 'food', label: 'makes' }])).not.toMatch(/has no arrow|short verb|ONE arrow/)
  })
  it('caption says "child" but the label says "worker": the caption wins, no AI retry needed', () => {
    const plan = scene([block({ type: 'scene', caption: 'A **child** works at a desk.', actors: [a('w', { label: 'worker' }), a('d', { sprite: 'desk', label: 'desk' })], arrows: [{ from: 'w', to: 'd', label: 'sits at' }] })])
    const st = steps(plan)[0].visual as { actors: { id: string; label: string }[] }
    expect(st.actors.find((x) => x.id === 'w')!.label).toBe('child')
    // a label the caption already uses is left alone
    const cook = steps(scene([block({ type: 'scene', caption: 'A **cook** reads a recipe.', actors: [a('w', { label: 'cook' }), a('r', { sprite: 'book', label: 'recipe' })], arrows: [{ from: 'r', to: 'w', label: 'tells' }] })]))[0].visual as { actors: { id: string; label: string }[] }
    expect(cook.actors.map((x) => x.label)).toEqual(['cook', 'recipe'])
    // "photo" in the caption, "file" on the photo sprite (the hard drive lesson)
    const photo = steps(scene([block({ type: 'scene', caption: 'The drive keeps your **photo**.', actors: [a('d', { sprite: 'folder', label: 'drive' }), a('p', { sprite: 'photo', label: 'file' })], arrows: [{ from: 'd', to: 'p', label: 'holds' }] })]))[0].visual as { actors: { id: string; label: string }[] }
    expect(photo.actors.find((x) => x.id === 'p')!.label).toBe('photo')
  })
  it('a label that names a sprite we have gets that sprite (a desk is not a box, paper is not a photo)', () => {
    const v = steps(scene([block({ type: 'scene', caption: 'x', actors: [a('d', { sprite: 'box', label: 'desk' }), a('p', { sprite: 'photo', label: 'paper' })], arrows: [{ from: 'd', to: 'p', label: 'holds' }] })]))[0].visual as { actors: { id: string; sprite: string }[] }
    expect(v.actors.map((x) => x.sprite)).toEqual(['desk', 'paper'])
  })
  it('vague arrow labels are rejected, clear verbs are not', () => {
    for (const v of ['uses', 'supports', 'used now', 'helps work', 'working']) {
      expect(errorsOf(scene([block({ type: 'scene', caption: 'x', actors: [a('x'), a('y')], arrows: [{ from: 'x', to: 'y', label: v }] })])), v).toMatch(/too vague/)
    }
    expect(errorsOf(scene([block({ type: 'scene', caption: 'x', actors: [a('x'), a('y')], arrows: [{ from: 'x', to: 'y', label: 'sends' }] })]))).not.toMatch(/too vague/)
  })
  it('there is a desk sprite, so a desk is not drawn as a box', () => {
    expect(SPRITES.desk).toBeDefined()
    expect(SPRITES.envelope).toBeDefined()
  })
})

describe('the last try is relaxed, real mistakes are not', () => {
  const sc = (blocks: ReturnType<typeof block>[]) => ({ ...conceptPlan, chunks: [{ title: 'x', blocks: [...blocks, block({ type: 'ask', caption: '**Which?**' })] }] })
  const a = (id: string, o: Record<string, unknown> = {}) => ({ id, sprite: 'child', x: 20, y: 50, motion: 'none' as const, flip: false, label: id, say: '', ...o })
  const build = (plan: Plan, lenient: boolean) => {
    const p = prepareVerify(plan.verify)
    if ('error' in p) throw new Error(p.error)
    return buildSteps(plan, { lenient, kind: plan.verify.kind, target: p.target, answer: p.answer, inputs: p.inputs, intermediates: p.intermediates })
  }
  // the RAM lesson that failed: the vague word "uses", plus a picture with no arrow
  const messy = sc([block({ type: 'scene', caption: 'RAM is a desk.', actors: [a('cpu', { sprite: 'chip', label: 'CPU' }), a('ram', { sprite: 'chip', label: 'RAM' }), a('data', { sprite: 'folder', label: 'data' })], arrows: [{ from: 'cpu', to: 'ram', label: 'uses' }] })])

  it('strict: ALL the style problems are reported together, so one retry can fix them all', () => {
    const msgs = (build(messy, false) as { errors: string[] }).errors
    expect(msgs.length).toBeGreaterThanOrEqual(2)
  })
  it('strict: rejected for the vague word and the loose picture', () => {
    const r = build(messy, false)
    expect(JSON.stringify(r)).toMatch(/too vague/)
    expect(JSON.stringify(r)).toMatch(/has no arrow/)
  })
  it('relaxed (last try): shown anyway', () => {
    const r = build(messy, true)
    expect('steps' in r).toBe(true)
  })
  it('relaxed still rejects real mistakes: an unknown arrow target, a leaked answer, a wrong picture reading', () => {
    const broken = sc([block({ type: 'scene', caption: 'x', actors: [a('p'), a('q')], arrows: [{ from: 'p', to: 'zzz', label: 'sends' }] })])
    expect(JSON.stringify(build(broken, true))).toMatch(/arrows must go between/)
    const leaky = { ...applesPlan, chunks: [{ title: 'x', blocks: [...applesPlan.chunks[0].blocks.slice(0, 3), block({ type: 'ask', caption: 'You have **7** apples, right?', group: 'all', measure: 'group_total' })] }] }
    expect(JSON.stringify(build(leaky, true))).toMatch(/gives away the answer/)
  })
})

describe('not everything is a child and a computer', () => {
  const sc = (question: string | undefined, sprites: string[]) => {
    const plan: Plan = { ...conceptPlan, chunks: [{ title: 'x', blocks: [
      block({ type: 'scene', caption: 'x', actors: sprites.map((s, i) => ({ id: `a${i}`, sprite: s, x: 20 + i * 30, y: 50, motion: 'none' as const, flip: false, label: s, say: '' })), arrows: sprites.slice(1).map((_, i) => ({ from: `a${i}`, to: `a${i + 1}`, label: 'sends' })) }),
      block({ type: 'ask', caption: '**Which?**' }),
    ] }] }
    const p = prepareVerify(plan.verify)
    if ('error' in p) throw new Error(p.error)
    return buildSteps(plan, { allowTech: question === undefined ? undefined : isTechTopic(question), kind: plan.verify.kind, target: p.target, answer: p.answer, inputs: p.inputs, intermediates: p.intermediates })
  }
  it('a lesson about velocity may not draw a computer, a chip or a phone', () => {
    const r = JSON.stringify(sc('what is velocity', ['car', 'computer']))
    expect(r).toMatch(/not about computers or technology/)
    expect(r).toMatch(/computer/)
    expect(JSON.stringify(sc('what is velocity', ['chip', 'phone']))).toMatch(/"chip" or a .{0,2}"phone"|not about computers/)
  })
  it('a lesson about computers or technology may', () => {
    for (const q of ['what is a CPU', 'what is RAM in a computer', 'how does wifi work', 'what is an AI', 'what is a hard drive', 'what is the internet']) {
      expect(JSON.stringify(sc(q, ['car', 'computer'])), q).not.toMatch(/not about computers/)
    }
  })
  it('without a question nothing is checked, and the velocity example itself has no computer and no person', () => {
    expect(JSON.stringify(sc(undefined, ['car', 'computer']))).not.toMatch(/not about computers/)
    const used = new Set(steps(velocityPlan).flatMap((s) => (s.visual?.kind === 'scene' ? s.visual.actors.map((a) => a.sprite) : [])))
    expect([...used].sort()).toEqual(['car', 'house', 'tree'])
  })
  it('the prompt examples are no longer all children and computers', () => {
    const scenes = EXAMPLES.flatMap(([, p]) => p.chunks.flatMap((c) => c.blocks.filter((b) => b.type === 'scene')))
    const sprites = scenes.flatMap((b) => b.actors.map((a) => a.sprite))
    const share = (names: string[]) => sprites.filter((s) => names.includes(s)).length / sprites.length
    expect(share(['child', 'computer', 'chip', 'phone'])).toBeLessThan(0.6)
    expect(new Set(sprites).size).toBeGreaterThanOrEqual(9)
  })
  it('new characters and nature pictures exist', () => {
    for (const n of ['adult', 'cat', 'cloud', 'water']) expect(SPRITES[n], n).toBeDefined()
  })
})

describe('animated scenes', () => {
  const scene = (blocks: ReturnType<typeof block>[]) => ({ ...conceptPlan, chunks: [{ title: 'x', blocks: [...blocks, block({ type: 'ask', caption: '**Which?**' })] }] })
  const a = (id: string, o: Record<string, unknown> = {}) => ({ id, sprite: 'dog', x: 20, y: 50, motion: 'none' as const, flip: false, label: '', say: '', ...o })

  it('the "what is AI" example: child, many dogs, then a computer with arrows', () => {
    const s = steps(conceptPlan)
    const scenes = s.filter((x) => x.visual?.kind === 'scene')
    expect(scenes).toHaveLength(4) // three scenes + the ask keeps the last one on screen
    const first = scenes[0].visual as Extract<NonNullable<typeof scenes[0]['visual']>, { kind: 'scene' }>
    expect(first.actors.map((x) => x.sprite)).toEqual(['child', 'dog'])
    const last = scenes[2].visual as Extract<NonNullable<typeof scenes[0]['visual']>, { kind: 'scene' }>
    expect(last.arrows).toHaveLength(3)
    // the child keeps its id across steps, so it moves instead of reappearing
    const ids = (i: number) => (scenes[i].visual as { actors: { id: string }[] }).actors.map((x) => x.id)
    expect(ids(0)).toContain('child')
    expect(ids(1)).toContain('child')
  })
  it('collects every sprite name a lesson needs', () => {
    expect(spriteNames(steps(conceptPlan)).sort()).toEqual(['child', 'computer', 'dog'])
    expect(spriteNames(steps(applesPlan))).toEqual(['apple'])
  })
  it('cleans sprite names, so "Ice Cream!" becomes ice_cream', () => {
    const v = steps(scene([block({ type: 'scene', caption: 'x', actors: [a('p', { sprite: 'Ice Cream!' })] })]))[0].visual as { actors: { sprite: string }[] }
    expect(v.actors[0].sprite).toBe('ice_cream')
  })
  it('rejects broken scenes', () => {
    const bad = (blocks: Parameters<typeof scene>[0]) => errorsOf(scene(blocks))
    expect(bad([block({ type: 'scene', caption: 'x', actors: [] })])).toMatch(/1 to 6 actors/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p'), a('p')] })])).toMatch(/unique/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p', { x: 140 })] })])).toMatch(/between 0 and 100/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p'), a('q')], arrows: [{ from: 'p', to: 'zzz', label: '' }] })])).toMatch(/arrows must go between/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p', { sprite: '   ' })] })])).toMatch(/sprite name/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p', { label: 'many helpers' })] })])).toMatch(/Draw 3 separate actors/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p', { label: 'Several pieces' })] })])).toMatch(/Draw 3 separate actors/)
    // a normal label that merely contains the word is fine
    expect(errorsOf(scene([block({ type: 'scene', caption: 'x', actors: [a('p', { label: 'manyfold' }), a('q', { label: 'helper' })] })]))).not.toMatch(/Draw 3 separate/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p', { say: 'x'.repeat(30) })] })])).toMatch(/14 characters/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: [a('p', { say: 'hi' }), a('q', { say: 'hi' }), a('r', { say: 'hi' })] })])).toMatch(/at most 2 speech bubbles/)
    expect(bad([block({ type: 'scene', caption: 'x', actors: Array.from({ length: 7 }, (_, i) => a(`z${i}`)) })])).toMatch(/1 to 6 actors/)
  })
})

describe('units (money): one object stands for a unit', () => {
  it('the picture reads 4 coins, but the learner answers 100 baht', () => {
    const s = steps(changePlan)
    expect(s.at(-1)!.scene.items.filter((i) => i.id.startsWith('money'))).toHaveLength(4)
    const c = check(changePlan)
    expect(c('100').kind).toBe('correct')
    expect(c('4').kind).toBe('hint') // reading the coins without the unit
    expect(c('4').message).not.toMatch(/\b100\b/)
  })
  it('the old failure: drawing 4 notebooks for a 100 baht answer is still rejected, with advice', () => {
    const bad: Plan = { ...changePlan, verify: { ...changePlan.verify, faithful: true, example_calc: [] }, chunks: [{ title: 'x', blocks: [
      block({ type: 'spawn', caption: 'You buy **4 notebooks**.', group: 'b', count: 4, sprite: 'book', color: 'red' }),
      block({ type: 'ask', caption: '**How much change?**', group: 'b', measure: 'group_total' }),
    ] }] }
    expect(errorsOf(bad)).toMatch(/reads 4 but the correct answer is 100.*ONE object stand for a unit/)
  })
})

describe('plan validation (rejects bad plans)', () => {
  const withBlocks = (base: Plan, blocks: ReturnType<typeof block>[]): Plan => ({ ...base, chunks: [{ title: 'x', blocks }] })

  it('animation that does not match the answer', () => {
    const bad = withBlocks(applesPlan, [
      block({ type: 'spawn', caption: 'You have **3 apples**.', group: 'a', count: 3, sprite: 'apple', color: 'red' }),
      block({ type: 'spawn', caption: 'You get **4 more**.', group: 'b', count: 4, sprite: 'apple', color: 'green' }),
      block({ type: 'ask', caption: 'How many?', group: 'a', measure: 'group_total' }),
    ])
    expect(errorsOf(bad)).toMatch(/reads 3 but the correct answer is 7/)
  })
  it('captions that state the answer', () => {
    const leaky = withBlocks(applesPlan, [
      ...applesPlan.chunks[0].blocks.slice(0, 3),
      block({ type: 'ask', caption: 'You have **7** apples, right?', group: 'all', measure: 'group_total' }),
    ])
    expect(errorsOf(leaky)).toMatch(/gives away the answer/)
    const leakyFraction = withBlocks(fractionPlan, [
      ...fractionPlan.chunks[0].blocks.slice(0, 3),
      block({ type: 'ask', caption: 'Each plate gets 5/6. **How much?**', group: 'cakes', measure: 'per_basket_fraction' }),
    ])
    expect(errorsOf(leakyFraction)).toMatch(/gives away the answer/)
  })
  it('unequal splits, unknown groups, missing ask', () => {
    const uneven = withBlocks(applesPlan, [
      block({ type: 'spawn', caption: 'a', group: 'c', count: 3, sprite: 'cookie', color: 'orange' }),
      block({ type: 'split', caption: 'b', group: 'c', count: 4 }),
      block({ type: 'take_away', caption: 'c', group: 'nope', count: 1 }),
    ])
    const msg = errorsOf(uneven)
    expect(msg).toMatch(/do not split equally/)
    expect(msg).toMatch(/does not exist/)
    expect(msg).toMatch(/exactly one/)
  })
  it('counts that are not from the question (the 6-plates-for-7-friends trick)', () => {
    const sneaky = withBlocks(dividePlan, [
      block({ type: 'spawn', caption: 'Imagine **12 cookies**.', group: 'c', count: 12, sprite: 'cookie', color: 'orange' }),
      block({ type: 'take_away', caption: 'Set some aside.', group: 'c', count: 6 }),
      block({ type: 'split', caption: 'Share.', group: 'c', count: 2 }),
      block({ type: 'ask', caption: '**How many each?**', group: 'c', measure: 'per_basket' }),
    ])
    expect(errorsOf(sneaky)).toMatch(/not one of the question's numbers/)
  })
  it('a calc question must end on an objects ask', () => {
    const noGroup = withBlocks(applesPlan, [
      ...applesPlan.chunks[0].blocks.slice(0, 3),
      block({ type: 'ask', caption: '**How many?**' }),
    ])
    expect(errorsOf(noGroup)).toMatch(/needs an ask on a group/)
  })
  it('bad graphs, number lines and balance', () => {
    const concept = (blocks: ReturnType<typeof block>[]) => withBlocks(conceptPlan, [...blocks, block({ type: 'ask', caption: '**Which?**' })])
    expect(errorsOf(concept([block({ type: 'graph', caption: 'x', expr: 'foo(x)', x_min: 0, x_max: 1 })]))).toMatch(/not allowed|unknown/)
    expect(errorsOf(concept([block({ type: 'graph', caption: 'x', expr: 'x', x_min: 2, x_max: 1 })]))).toMatch(/x_min < x_max/)
    expect(errorsOf(concept([block({ type: 'numberline', caption: 'x', x_min: 0, x_max: 5, marks: [{ at: 9, label: 'out' }] })]))).toMatch(/inside the line/)
    expect(errorsOf(concept([block({ type: 'balance', caption: 'x', expr: 'x^2 = 4' })]))).toMatch(/simple equation/)
  })
})

describe('algebra with the balance scale', () => {
  it('code writes the scale steps, ending with the box next to the answer blocks', () => {
    const s = steps(algebraPlan)
    const scale = s.filter((x) => x.visual?.kind === 'balance').map((x) => x.visual)
    expect(scale[0]).toMatchObject({ boxes: 1, leftBlocks: 3, rightBlocks: 10 })
    expect(scale[1]).toMatchObject({ boxes: 1, leftBlocks: 0, rightBlocks: 7 })
    expect(s[0].think).toMatch(/level/)
    expect(s.at(-1)!.ask).toBe(true)
  })
  it('keeps the scale (or scene) on screen for the ask step', () => {
    expect(steps(algebraPlan).at(-1)!.visual).toMatchObject({ kind: 'balance', rightBlocks: 7 })
    expect(steps(conceptPlan).at(-1)!.visual?.kind).toBe('scene')
    expect(steps(applesPlan).at(-1)!.visual).toBeUndefined()
  })
  it('3x = 12 also shares each side', () => {
    const p: Plan = { ...algebraPlan, verify: verify({ kind: 'solve', expr: '3x = 12', variable: 'x' }),
      chunks: [{ title: 'x', blocks: [block({ type: 'balance', caption: 'Three boxes balance **12 blocks**.', expr: '3x = 12' }), block({ type: 'ask', caption: '**One box?**', measure: 'balance_value' })] }] }
    const kinds = steps(p).filter((x) => x.visual).map((x) => x.visual)
    expect(kinds.at(-1)).toMatchObject({ boxes: 1, rightBlocks: 4 })
  })
  it('rejects a scale that disagrees with the equation to solve', () => {
    const p: Plan = { ...algebraPlan, verify: verify({ kind: 'solve', expr: 'x + 3 = 11', variable: 'x' }) }
    expect(errorsOf(p)).toMatch(/the scale reads 7 but the correct answer is 8/)
  })
})

describe('checking answers', () => {
  it('arithmetic: right, wrong-operation hints, fractions, never states the answer', () => {
    const c = check(applesPlan)
    expect(c('7').kind).toBe('correct')
    for (const n of ['0', '1', '3', '4', '6', '8', '12']) {
      const f = c(n)
      expect(f.kind).toBe('hint')
      expect(f.message).not.toMatch(/\b7\b/)
    }
    expect(c('3').message).toMatch(/one group/)
    expect(c('banana').kind).toBe('invalid')
    const d = check(fractionPlan)
    expect(d('5/6').kind).toBe('correct')
    expect(d('10/12').kind).toBe('correct')
    expect(d('0.83').kind).toBe('correct')
    expect(d('0.8').kind).toBe('hint')
    expect(d('6/5').message).toMatch(/flipped/)
    expect(check(dividePlan)('36').message).toMatch(/multiplying/)
  })
  it('solve: accepts any value that makes the equation true', () => {
    const c = check(algebraPlan)
    expect(c('7').kind).toBe('correct')
    expect(c('x = 7').kind).toBe('correct')
    expect(c('6').kind).toBe('hint')
    const quad: Plan = { ...algebraPlan, verify: verify({ kind: 'solve', expr: 'x^2 = 9', variable: 'x' }) }
    expect(prepareVerify(quad.verify)).toMatchObject({ answer: null })
    const q = (prepareVerify(quad.verify) as { check: (r: string) => { kind: string } }).check
    expect(q('3').kind).toBe('correct')
    expect(q('-3').kind).toBe('correct')
    expect(q('4').kind).toBe('hint')
  })
  it('derivative: any equivalent form is accepted', () => {
    const c = check(derivativePlan)
    expect(c('3x^2').kind).toBe('correct')
    expect(c('3*x^2').kind).toBe('correct')
    expect(c("y' = 3x^2").kind).toBe('correct')
    expect(c('x^3').kind).toBe('hint')
    expect(c('3x').kind).toBe('hint')
    expect(c('import(1)').kind).toBe('invalid')
  })
  it('integral: checked by differentiating the learner answer', () => {
    const v = prepareVerify(verify({ kind: 'integral', expr: '2x', variable: 'x' })) as { check: (r: string) => { kind: string } }
    expect(v.check('x^2').kind).toBe('correct')
    expect(v.check('x^2 + C').kind).toBe('correct')
    expect(v.check('x^2 + 5').kind).toBe('correct')
    expect(v.check('x').kind).toBe('hint')
  })
  it('evaluate handles negatives, powers and roots', () => {
    const v = (e: string) => (prepareVerify(verify({ kind: 'evaluate', expr: e })) as { check: (r: string) => { kind: string; message: string } }).check
    expect(v('-3 * 4')('-12').kind).toBe('correct')
    expect(v('-3 * 4')('12').message).toMatch(/sign/)
    expect(v('2^10')('1024').kind).toBe('correct')
    expect(v('sqrt(144)')('12').kind).toBe('correct')
  })
  it('choice: exact, with a reason for each wrong option and no hint about the right one', () => {
    const c = check(conceptPlan)
    expect(c('B').kind).toBe('correct')
    expect(c('1').kind).toBe('correct')
    expect(c('A').message).toMatch(/fixed steps/)
    expect(c('A').message).not.toMatch(/junk email/i)
    expect(c('Z').kind).toBe('invalid')
    expect(run(conceptPlan).prepared.mode).toEqual({ type: 'choice', options: expect.any(Array) })
  })
  it('bad verify specs are caught before a lesson is made', () => {
    const bad = (v: Partial<ReturnType<typeof verify>>) => prepareVerify(verify(v))
    expect(bad({ kind: 'choice', options: ['a', 'b'], correct: 5, why_wrong: ['', ''] })).toHaveProperty('error')
    expect(bad({ kind: 'choice', options: ['a', 'b'], correct: 0, why_wrong: [''] })).toHaveProperty('error')
    expect(bad({ kind: 'solve', expr: 'x + 3' })).toHaveProperty('error')
    expect(bad({ kind: 'derivative', expr: 'import(1)' })).toHaveProperty('error')
    expect(bad({ kind: 'ai', reference: null })).toHaveProperty('error')
    expect(bad({ kind: 'calc', calc: [calc('x', 'div', 1, 0)] })).toHaveProperty('error')
  })
})

describe('math engine', () => {
  it('evaluates, differentiates and blocks code injection', () => {
    const c = compileExpr('2^10')
    expect(c.ok && c.fn()).toBe(1024)
    expect(compileExpr('import("x")').ok).toBe(false)
    expect(compileExpr('evaluate("1+1")').ok).toBe(false)
    expect(compileExpr('a + 1').ok).toBe(false)
    const d = derivativeFn('x^3 + 2x')
    const g = compileExpr('3x^2 + 2')
    if (!d.ok || !g.ok) throw new Error('x')
    expect(sameFunction(d.fn, g.fn)).toBe(true)
  })
  it('reads simple linear equations only', () => {
    expect(linearEquation('x + 3 = 10')).toMatchObject({ a: 1, b: 3, c: 10, solution: 7 })
    expect(linearEquation('3x = 12')).toMatchObject({ solution: 4 })
    expect(linearEquation('x^2 = 4')).toBe(null)
    expect(linearEquation('x - 4 = 5')).toBe(null) // negative constant on the left: not a balance picture yet
  })
})
