import type { Item, Basket, Scene, Step, Visual } from './types'
import { slug } from '../sprites/names'
import { SPRITES } from '../sprites/library'
import { attachRuns } from './runs'
import { TECH_SPRITES } from './topic'
import { normalizeDigits, visualLength } from '../i18n/lang'
import { compileExpr, linearEquation } from './mathx'
import { COLORS, type Block, type Plan, type Verify } from './plan'
import { frac, fracEq, fracValue, type Frac } from './calc'

const HEX: Record<(typeof COLORS)[number], string> = {
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  orange: '#ea580c',
  purple: '#9333ea',
  yellow: '#ca8a04',
  pink: '#db2777',
  teal: '#0d9488',
}

export const STAGE = { width: 640, height: 320 }
const MAX_PER_GROUP = 20
const MAX_TOTAL = 30
const MAX_PARTS = 12
const MAX_PIECES = 48
const MAX_STEPS = 30
/** Arrow labels that tell a beginner nothing. */
const VAGUE = new Set(['use', 'uses', 'used', 'used now', 'support', 'supports', 'help', 'helps', 'helps work', 'work', 'works', 'working', 'related', 'relates', 'connected', 'connects', 'link', 'links', 'is', 'has', 'with', 'near', 'and',
  // Japanese and Burmese words that say as little
  '使う', '使います', 'つかう', '使用', 'サポート', '関係', 'つながる', 'つなぐ', 'いっしょ', 'သုံး', 'သုံးသည်', 'အသုံးပြု', 'ဆက်စပ်', 'ပံ့ပိုး', 'နှင့်', 'နဲ့'])
/**
 * Fixes small, certain inconsistencies in code instead of paying for another AI call:
 * - a label that names a sprite we have ("desk", "paper") gets that sprite;
 * - when the caption says "child" but the picture is labelled "worker", the caption's word wins.
 */
export function repairScene(b: Block): Block {
  if (b.type !== 'scene') return b
  const cap = words(b.caption)
  return {
    ...b,
    // Only one arrow between two pictures: the first one stays, a second one (even the other way round) is dropped.
    arrows: b.arrows.filter((r, i) => b.arrows.findIndex((q) => (q.from === r.from && q.to === r.to) || (q.from === r.to && q.to === r.from)) === i),
    actors: b.actors.map((a) => {
      const l = slug(a.label)
      if (a.label.trim() && l in SPRITES && l !== slug(a.sprite)) return { ...a, sprite: l }
      const sprite = slug(a.sprite)
      if (a.label.trim() && sprite !== l && cap.includes(sprite) && !words(a.label).every((w) => cap.includes(w))) return { ...a, label: sprite.replace(/_/g, ' ') }
      return a
    }),
  }
}

const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? []
/** One picture cannot be "many": a label like "many helpers" means the scene should show several actors. */
const MANY = /^\s*((many|several|lots? of|a lot of|multiple|all (the )?|every|some|few|a few|crowd|group of)\b|たくさん|多くの|いくつかの|みんな|すべての|全部|大勢|複数|များစွာ|အများ|အားလုံး|တချို့|အချို့)/i

interface GItem {
  id: string
  sprite: string
  color: string
  piece?: boolean
}
interface Group {
  id: string
  layout: 'row' | 'pile'
  items: GItem[]
  parts: number | null
  highlight: number | null
  /** Slices per original object (1 = not cut). */
  cut: number
}

function layoutScene(groups: Group[]): Scene {
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const parts = Math.max(0, ...groups.map((g) => g.parts ?? 0))
  const size = total > 30 ? 12 : total > 20 ? 14 : groups.length > 2 || parts > 4 ? (parts > 8 ? 12 : 16) : total > 14 ? 17 : total <= 8 && !parts ? 34 : 24
  const step = size * 2 + 8
  const bandH = STAGE.height / Math.max(groups.length, 1)
  const items: Item[] = []
  const baskets: Basket[] = []

  groups.forEach((g, gi) => {
    const cy = bandH * (gi + 0.5)
    const n = g.items.length
    const state = (i: number): Item['state'] =>
      g.highlight === null ? 'normal' : i < g.highlight ? 'glow' : 'dim'
    const push = (i: number, x: number, y: number) =>
      items.push({ ...g.items[i], x, y, state: state(i) })

    if (g.parts) {
      const bw = (STAGE.width - 40) / g.parts
      const bh = bandH - 24
      const perRow = Math.max(1, Math.floor((bw - 12) / step))
      for (let p = 0; p < g.parts; p++) {
        const bx = 20 + p * bw
        baskets.push({ id: `${g.id}-basket-${p}`, x: bx + 4, y: cy - bh / 2, w: bw - 8, h: bh })
      }
      g.items.forEach((_, i) => {
        const p = i % g.parts!
        const j = Math.floor(i / g.parts!)
        const col = j % perRow
        const row = Math.floor(j / perRow)
        const inRow = Math.min(perRow, Math.ceil((n - p) / g.parts!) - row * perRow)
        const cx = 20 + p * bw + bw / 2 + (col - (inRow - 1) / 2) * step
        push(i, cx, cy + bh / 2 - size - 8 - row * (step - 4))
      })
    } else if (g.layout === 'pile') {
      const perRow = n > 12 ? 5 : 4
      g.items.forEach((_, i) => {
        const row = Math.floor(i / perRow)
        const inRow = Math.min(perRow, n - row * perRow)
        const rows = Math.ceil(n / perRow)
        const col = i % perRow
        push(i, STAGE.width / 2 + (col - (inRow - 1) / 2) * step, cy + ((rows - 1) / 2 - row) * (step - 4))
      })
    } else {
      const perRow = Math.min(10, Math.floor((STAGE.width - 80) / step))
      const lines = Math.ceil(n / perRow)
      g.items.forEach((_, i) => {
        const line = Math.floor(i / perRow)
        push(i, 40 + size + (i % perRow) * step, cy + (line - (lines - 1) / 2) * step)
      })
    }
  })
  return { items, baskets, size }
}

/** Slow and calm: time to read the line and watch the picture. */
const duration = (caption: string) => Math.min(10000, 4200 + caption.length * 80)

/**
 * Plays the blocks forward into scenes, and checks the plan is internally
 * consistent: the final scene must read off `target`, groups must exist,
 * counts must make sense, and no caption may give away the answer.
 */
export function buildSteps(
  plan: Plan,
  opts: {
    /** False when the question is not about technology: then computer, chip and phone pictures are rejected. */
    allowTech?: boolean
    /** Last try only: skip the style rules (vague words, missing labels, loose pictures) instead of failing the lesson. */
    lenient?: boolean
    kind: Verify['kind']
    target: Frac | null
    answer: Frac | null
    inputs: number[]
    intermediates: number[]
  },
): { steps: Step[] } | { errors: string[] } {
  plan = { ...plan, chunks: plan.chunks.map((c) => ({ ...c, blocks: c.blocks.map(repairScene) })) }
  const strict = !opts.lenient
  const errors: string[] = []
  const groups = new Map<string, Group>()
  const steps: Step[] = []
  const all = () => [...groups.values()]
  const total = () => all().reduce((n, g) => n + g.items.length, 0)
  // Counts the animation may use: the question's own numbers and its in-between results,
  // never the final answer. This stops "tricks" that make the picture match without being faithful.
  const allowed = new Set([...opts.inputs, ...opts.intermediates])
  const text = (f: Frac) => (f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`)
  let balanceState: { boxes: number; right: number } | null = null
  /** A scene/graph/scale stays on screen until an objects block draws something new. */
  let lastVisual: Visual | undefined
  const fromQuestion = (n: number | null, where: string) => {
    if (n !== null && allowed.size > 0 && !allowed.has(n)) {
      errors.push(
        `${where}: ${n} is not one of the question's numbers (${[...allowed].join(', ')}). Use the real numbers from the question, e.g. one basket per friend or group.`,
      )
    }
  }

  if (plan.chunks.length < 1 || plan.chunks.length > 6) errors.push('use between 1 and 6 chunks')

  const blocks = plan.chunks.flatMap((c, ci) => c.blocks.map((b, bi) => ({ b, ci, bi })))
  const askCount = blocks.filter((x) => x.b.type === 'ask').length
  if (askCount !== 1 || blocks[blocks.length - 1]?.b.type !== 'ask') {
    errors.push('there must be exactly one "ask" block and it must be the very last block')
  }
  plan.chunks.forEach((c, ci) => {
    if (c.blocks.length === 0) errors.push(`chunk ${ci} has no blocks`)
    if (!c.title.trim()) errors.push(`chunk ${ci} needs a title`)
  })

  const need = (id: string | null, where: string): Group | null => {
    const g = id ? groups.get(id) : undefined
    if (!g) errors.push(`${where}: group "${id}" does not exist`)
    return g ?? null
  }

  for (const { b, ci, bi } of blocks) {
    const where = `chunk ${ci} block ${bi} (${b.type})`
    let accent: string | undefined
    let ask = false
    let visual: Visual | undefined
    let extra: Step[] | null = null
    const count = b.count

    switch (b.type) {
      case 'spawn': {
        if (!b.group || groups.has(b.group)) errors.push(`${where}: needs a new unique group id`)
        else if (count === null || !Number.isInteger(count) || count < 1 || count > MAX_PER_GROUP) {
          errors.push(`${where}: count must be a whole number from 1 to ${MAX_PER_GROUP}`)
        } else if (allowed.size > 0 && !allowed.has(count)) {
          fromQuestion(count, where)
        } else if (!slug(b.sprite ?? '') || !b.color) {
          errors.push(`${where}: needs a sprite name (like "apple") and a color`)
        } else {
          const color = HEX[b.color]
          groups.set(b.group, {
            id: b.group,
            layout: 'row',
            parts: null,
            highlight: null,
            cut: 1,
            items: Array.from({ length: count }, (_, k) => ({ id: `${b.group}-${k}`, sprite: slug(b.sprite!), color })),
          })
          accent = color
          if (total() > MAX_TOTAL) errors.push(`${where}: too many objects on stage (max ${MAX_TOTAL})`)
        }
        break
      }
      case 'merge': {
        const srcs = b.groups.map((id) => need(id, where))
        if (srcs.length < 2 || srcs.some((g) => !g)) {
          if (srcs.length < 2) errors.push(`${where}: merge needs at least 2 groups`)
          break
        }
        const id = b.group
        if (!id || (groups.has(id) && !b.groups.includes(id))) {
          errors.push(`${where}: merged group needs a new unique id`)
          break
        }
        if (new Set(srcs.map((g) => g!.cut)).size > 1) {
          errors.push(`${where}: cannot merge groups that are cut into different slices`)
          break
        }
        const items = srcs.flatMap((g) => g!.items)
        b.groups.forEach((s) => groups.delete(s))
        groups.set(id, { id, layout: 'pile', items, parts: null, highlight: null, cut: srcs[0]!.cut })
        break
      }
      case 'take_away': {
        const g = need(b.group, where)
        if (!g) break
        if (count === null || !Number.isInteger(count) || count < 1 || count > g.items.length) {
          errors.push(`${where}: cannot take away ${count} from ${g.items.length}`)
          break
        }
        fromQuestion(count, where)
        g.items.splice(g.items.length - count, count)
        g.highlight = null
        break
      }
      case 'split': {
        const g = need(b.group, where)
        if (!g) break
        if (count === null || !Number.isInteger(count) || count < 1 || count > MAX_PARTS) {
          errors.push(`${where}: split needs 1 to ${MAX_PARTS} parts`)
        } else if (g.items.length % count !== 0) {
          errors.push(`${where}: ${g.items.length} items do not split equally into ${count}`)
        } else {
          fromQuestion(count, where)
          g.parts = count
          g.highlight = null
        }
        break
      }
      case 'cut': {
        const g = need(b.group, where)
        if (!g) break
        if (count === null || !Number.isInteger(count) || count < 2 || count > MAX_PARTS) {
          errors.push(`${where}: cut needs 2 to ${MAX_PARTS} slices per object`)
        } else if (g.parts || g.cut > 1) {
          errors.push(`${where}: cut a group once, and before splitting it`)
        } else if (g.items.length * count > MAX_PIECES) {
          errors.push(`${where}: ${g.items.length} objects x ${count} slices is more than the stage can show (max ${MAX_PIECES})`)
        } else {
          fromQuestion(count, where)
          g.items = g.items.flatMap((it) =>
            Array.from({ length: count }, (_, k) => ({ ...it, id: `${it.id}-p${k}`, piece: true })),
          )
          g.cut = count
          g.highlight = null
        }
        break
      }
      case 'scene': {
        const ids = new Set<string>()
        const named = b.actors.every((a) => slug(a.sprite))
        if (b.actors.length < 1 || b.actors.length > 6) errors.push(`${where}: a scene needs 1 to 6 actors (more will not fit on the screen)`)
        else if (!named) errors.push(`${where}: every actor needs a sprite name`)
        else if (b.actors.some((a) => ids.size === ids.add(a.id).size || !a.id.trim())) errors.push(`${where}: actor ids must be unique`)
        else if (b.actors.some((a) => a.x < 0 || a.x > 100 || a.y < 0 || a.y > 100)) errors.push(`${where}: x and y must be between 0 and 100`)
        else if (b.arrows.length > 6 || b.arrows.some((r) => !ids.has(r.from) || !ids.has(r.to) || r.from === r.to)) {
          errors.push(`${where}: arrows must go between two different actors of this scene (max 6)`)
        } else {
          // Structure is fine. Now report EVERY remaining problem at once, so one retry can fix them all.
          const found: string[] = []
          const kinds = new Set(b.actors.map((a) => slug(a.sprite)))
          if (strict) {
            if (b.arrows.length === 0 && kinds.size >= 3) {
              found.push(`this scene shows ${kinds.size} different pictures but no arrows, so the learner cannot see how they are related. Join them with arrows that have verb labels (for example child "puts" photo, photo "goes in" box).`)
            }
            if (b.arrows.some((r) => !r.label.trim() || visualLength(r.label) > 14)) {
              found.push('every arrow needs a short verb label of 1 to 14 characters, like "sends", "reads", "makes" or "holds"')
            }
            const lone = b.actors.filter((a) => !b.arrows.some((r) => r.from === a.id || r.to === a.id))
            if (b.arrows.length > 0 && lone.length > 0) {
              found.push(`${lone.map((a) => `"${a.label || a.sprite}"`).join(', ')} has no arrow. When a scene has arrows, EVERY picture must be joined to the story by an arrow, so nothing floats alone. Connect it, or remove it from the scene.`)
            }
            const vague = [...new Set(b.arrows.filter((r) => VAGUE.has(r.label.trim().toLowerCase())).map((r) => `"${r.label}"`))]
            if (vague.length > 0) {
              found.push(`the arrow label ${vague.join(', ')} is too vague for a beginner. Use a clear verb that says what happens or travels: "sends", "tells", "reads", "makes", "holds", "gives", "carries", "sits at", "writes on".`)
            }
          }
          if (strict && opts.allowTech === false) {
            const tech = [...new Set(b.actors.map((a) => slug(a.sprite)).filter((n) => TECH_SPRITES.has(n)))]
            if (tech.length) found.push(`this question is not about computers or technology, so do not draw ${tech.map((t) => `a "${t}"`).join(' or ')}. Use pictures from the topic's own world (for example velocity: cars, roads, trees, balls; weather: sun, clouds, water; money: coins, shops).`)
          }
          const many = b.actors.find((a) => MANY.test(a.label))
          if (many) found.push(`an actor labelled "${many.label}" is one picture standing for many. Draw 3 separate actors with the same sprite and different ids instead, and label only one of them.`)
          if (b.actors.some((a) => visualLength(a.label) > 14 || visualLength(a.say) > 20) || b.actors.filter((a) => a.say).length > 2) {
            found.push('keep labels to 14 characters, speech to 20 characters, and at most 2 speech bubbles per scene')
          }
          if (found.length) errors.push(...found.map((f) => `${where}: ${f}`))
          else visual = { kind: 'scene', actors: b.actors.map((a) => ({ ...a, sprite: slug(a.sprite) })), arrows: b.arrows }
        }
        break
      }
      case 'graph': {
        const f = compileExpr(b.expr ?? '', ['x'])
        if (!f.ok) errors.push(`${where}: expr: ${f.error}`)
        else if (b.x_min === null || b.x_max === null || !(b.x_min < b.x_max)) errors.push(`${where}: needs x_min < x_max`)
        else {
          const samples: [number, number][] = []
          for (let i = 0; i <= 40; i++) {
            const x = b.x_min + ((b.x_max - b.x_min) * i) / 40
            try {
              const y = f.fn({ x })
              if (Number.isFinite(y)) samples.push([x, y])
            } catch { /* undefined here */ }
          }
          if (samples.length < 10) errors.push(`${where}: the function is undefined on most of that range`)
          else visual = { kind: 'graph', expr: f.text, xMin: b.x_min, xMax: b.x_max, samples }
        }
        break
      }
      case 'numberline': {
        if (b.x_min === null || b.x_max === null || !(b.x_min < b.x_max)) errors.push(`${where}: needs x_min < x_max`)
        else if (b.marks.length < 1 || b.marks.length > 12) errors.push(`${where}: use 1 to 12 marks`)
        else if (b.marks.some((m) => m.at < b.x_min! || m.at > b.x_max! || !m.label.trim())) {
          errors.push(`${where}: every mark needs a label and must be inside the line`)
        } else visual = { kind: 'numberline', min: b.x_min, max: b.x_max, marks: b.marks }
        break
      }
      case 'balance': {
        const lin = b.expr ? linearEquation(b.expr) : null
        if (balanceState) errors.push(`${where}: use only one balance block per lesson`)
        else if (!lin || lin.solution === null) {
          errors.push(`${where}: the balance scale needs a simple equation with whole numbers like "x + 3 = 10" or "3x = 12"`)
        } else if (lin.c > MAX_TOTAL) errors.push(`${where}: numbers too big for the scale (max ${MAX_TOTAL} blocks)`)
        else {
          const s0 = lin.solution
          const mk = (boxes: number, left: number, right: number): Visual => ({ kind: 'balance', boxes, leftBlocks: left, rightBlocks: right })
          const seq: { caption: string; visual: Visual }[] = [{ caption: b.caption, visual: mk(lin.a, lin.b, lin.c) }]
          if (lin.b > 0) seq.push({ caption: `Take away **${lin.b}** from both sides. The scale stays level.`, visual: mk(lin.a, 0, lin.c - lin.b) })
          if (lin.a > 1) seq.push({ caption: `Now share each side into **${lin.a}** equal parts.`, visual: mk(1, 0, s0) })
          balanceState = { boxes: lin.a > 1 ? 1 : lin.a, right: lin.a > 1 ? s0 : lin.c - lin.b }
          extra = seq.map((x, k) => ({
            id: `c${ci}-b${bi}-${k}`,
            chunk: ci,
            caption: x.caption,
            durationMs: duration(x.caption),
            scene: layoutScene(all()),
            visual: x.visual,
            think: k === 0 ? b.think?.trim() || undefined : undefined,
          }))
        }
        break
      }
      case 'highlight': {
        const g = need(b.group, where)
        if (!g) break
        if (count === null || !Number.isInteger(count) || count < 0 || count > g.items.length) {
          errors.push(`${where}: cannot highlight ${count} of ${g.items.length}`)
        } else g.highlight = count
        break
      }
      case 'ask': {
        ask = true
        const target = opts.target
        if (b.measure === 'balance_value') {
          if (!balanceState) errors.push(`${where}: balance_value needs a balance block earlier`)
          else if (target && !fracEq(frac(balanceState.right, balanceState.boxes), target)) {
            errors.push(`${where}: the scale reads ${text(frac(balanceState.right, balanceState.boxes))} but the correct answer is ${text(target)}.`)
          }
          break
        }
        if (b.group === null) {
          if (opts.kind === 'calc') errors.push(`${where}: this question needs an ask on a group with a measure`)
          break
        }
        const g = need(b.group, where)
        if (!g) break
        let read: Frac | null = null
        const n = g.items.length
        if (b.measure === 'group_total') read = frac(n, g.cut)
        else if (b.measure === 'per_basket') read = g.parts && n % g.parts === 0 ? frac(n / g.parts, g.cut) : null
        else if (b.measure === 'per_basket_fraction') read = g.parts && n % g.parts === 0 ? frac(n / g.parts, g.cut) : null
        else if (b.measure === 'highlighted') read = g.highlight === null ? null : frac(g.highlight, g.cut)
        if (read === null) errors.push(`${where}: measure "${b.measure}" does not apply to group "${b.group}" in its final state`)
        else if (target && !fracEq(read, target)) {
          errors.push(
            `${where}: the final scene reads ${text(read)} but the correct answer is ${text(target)}. Fix the counts so the animation matches the calculation. If the answer is large or in another unit (money, distance, weight), let ONE object stand for a unit (for example a coin = 25 baht), set faithful false, and give example_calc in those units.`,
          )
        }
        break
      }
    }

    if (['spawn', 'merge', 'take_away', 'split', 'cut', 'highlight'].includes(b.type)) lastVisual = undefined
    if (extra) {
      lastVisual = extra[extra.length - 1].visual
      steps.push(...extra)
      continue
    }
    if (visual) lastVisual = visual

    steps.push({
      id: `c${ci}-b${bi}`,
      chunk: ci,
      caption: b.caption,
      accent,
      durationMs: ask ? 0 : duration(b.caption),
      scene: layoutScene(all()),
      visual: visual ?? lastVisual,
      think: b.think?.trim() || undefined,
      ask: ask || undefined,
    })
  }

  // No caption may give away the answer (unless it is also one of the question's own numbers).
  const leaks = new Set<string>()
  for (const f of [opts.answer, opts.target]) {
    if (!f) continue
    if (f.d === 1) {
      if (!opts.inputs.includes(f.n)) leaks.add(`(?<![\\d./])${f.n}(?![\\d/]|\\.\\d)`)
    } else {
      leaks.add(`(?<!\\d)${f.n}\\s*/\\s*${f.d}(?!\\d)`)
      const dec = fracValue(f)
      leaks.add(`(?<!\\d)${String(Math.round(dec * 100) / 100).replace('.', '[.,]')}\\d*(?!\\d)`)
    }
  }
  // Check everything the learner reads, with digits in any script turned into plain ones (၇ and ７ are 7).
  const readable = steps.map((st) =>
    normalizeDigits(
      [st.caption, st.think ?? '', ...(st.visual?.kind === 'scene' ? st.visual.actors.flatMap((a) => [a.label, a.say]) : [])].join(' \n '),
    ),
  )
  for (const pattern of leaks) {
    const re = new RegExp(pattern)
    steps.forEach((st, i) => {
      if (re.test(readable[i])) errors.push(`caption "${st.caption}" gives away the answer. Never state the result.`)
    })
  }

  if (steps.length > MAX_STEPS) errors.push(`too many steps (${steps.length}); keep it under ${MAX_STEPS}`)
  if (errors.length === 0) attachRuns(steps)
  return errors.length ? { errors } : { steps }
}

export type { Block }

/** Every sprite name a lesson uses, so the server can make sure each one exists. */
export function spriteNames(steps: Step[]): string[] {
  const names = new Set<string>()
  for (const st of steps) {
    st.scene.items.forEach((i) => names.add(i.sprite))
    if (st.visual?.kind === 'scene') st.visual.actors.forEach((a) => names.add(a.sprite))
  }
  return [...names]
}
