import { evaluate, frac, fracEq, type CalcResult, type Frac } from './calc'
import { makeChecker, parseAnswer } from './check'
import { compileExpr, derivativeFn, linearEquation, sameFunction, satisfies } from './mathx'
import type { Verify } from './plan'
import type { AnswerMode, Feedback } from './types'
import { normalizeDigits, type Lang } from '../i18n/lang'
import { t } from '../i18n/messages'


export interface Prepared {
  mode: AnswerMode
  checkedBy: 'code' | 'choice' | 'ai' | 'none'
  /** Exact answer when it is a whole number or fraction (used to check pictures and captions). */
  answer: Frac | null
  /** What the picture must read. Differs from `answer` only for scaled-down analogies. */
  target: Frac | null
  inputs: number[]
  intermediates: number[]
  /** Exact check. Null for the "ai" tier, which is graded by the server. */
  check: ((raw: string) => Feedback) | null
  /** Plan problems found while preparing (empty when fine). */
  error?: string
}

const fail = (error: string): { error: string } => ({ error })

function numberOrNull(v: number): Frac | null {
  if (!Number.isFinite(v) || v < 0) return null
  if (Number.isInteger(v)) return frac(v)
  return null
}

/** Turns the AI's verify spec into something that can check answers. Code computes; the AI only says how. */
export function prepareVerify(v: Verify, lang: Lang = 'en'): Prepared | { error: string } {
  const correct = (): Feedback => ({ kind: 'correct', message: t(lang, 'fb.correct') })
  const base = { answer: null, target: null, inputs: [] as number[], intermediates: [] as number[] }

  switch (v.kind) {
    case 'calc': {
      const real = evaluate(v.calc)
      if (!real.ok) return fail(`calc: ${real.error}`)
      const scene: CalcResult = v.faithful ? real : evaluate(v.example_calc)
      if (!scene.ok) return fail(`example_calc: ${scene.error}`)
      return {
        mode: { type: 'number' },
        checkedBy: 'code',
        answer: real.answer,
        target: scene.answer,
        inputs: scene.inputs,
        intermediates: scene.intermediates,
        check: makeChecker(real, lang),
      }
    }

    case 'evaluate': {
      const c = compileExpr(v.expr ?? '', [])
      if (!c.ok) return fail(`expr: ${c.error}`)
      let value: number
      try { value = c.fn() } catch { return fail('expr could not be evaluated') }
      if (!Number.isFinite(value)) return fail('expr is not a finite number')
      const answer = numberOrNull(value)
      return {
        ...base,
        // the numbers written in the question's expression may appear in captions and pictures
        inputs: (c.text.match(/\d+(\.\d+)?/g) ?? []).map(Number),
        mode: { type: 'number' },
        checkedBy: 'code',
        answer,
        target: answer,
        check: (raw: string) => {
          raw = normalizeDigits(raw)
          const n = parseAnswer(raw, true)
          if (n === null) return { kind: 'invalid', message: t(lang, 'fb.invalidSigned') }
          const hit = Math.abs(n - value) <= 1e-9 * Math.max(1, Math.abs(value)) ||
            (!Number.isInteger(value) && Math.abs(n - value) <= 0.005 && /[.,]/.test(normalizeDigits(raw)))
          if (hit) return correct()
          if (Math.abs(n + value) < 1e-9) return { kind: 'hint', message: t(lang, 'fb.sign') }
          return { kind: 'hint', message: n < value ? t(lang, 'fb.lowSteps') : t(lang, 'fb.highSteps') }
        },
      }
    }

    case 'solve': {
      const eq = v.expr ?? ''
      const variable = v.variable ?? 'x'
      const parts = eq.split('=')
      if (parts.length !== 2 || !compileExpr(parts[0], [variable]).ok || !compileExpr(parts[1], [variable]).ok) {
        return fail('expr must be an equation in one variable, like "x + 3 = 10"')
      }
      const lin = linearEquation(eq, variable)
      const answer = lin?.solution != null ? frac(lin.solution) : null
      return {
        ...base,
        mode: { type: 'number' },
        checkedBy: 'code',
        answer,
        target: answer,
        inputs: lin ? [lin.a, lin.b, lin.c] : [],
        check: (raw: string) => {
          raw = normalizeDigits(raw)
          const n = parseAnswer(raw.replace(new RegExp(`^\\s*${variable}\\s*=\\s*`), ''), true)
          if (n === null) return { kind: 'invalid', message: t(lang, 'fb.invalidSolve', { v: variable }) }
          if (satisfies(eq, variable, n)) return correct()
          return { kind: 'hint', message: t(lang, 'fb.solve', { v: variable }) }
        },
      }
    }

    case 'derivative':
    case 'integral': {
      const variable = v.variable ?? 'x'
      const f = compileExpr(v.expr ?? '', [variable])
      if (!f.ok) return fail(`expr: ${f.error}`)
      const target = v.kind === 'derivative' ? derivativeFn(f.text, variable) : null
      if (target && !target.ok) return fail(`expr: ${target.error}`)
      return {
        ...base,
        mode: { type: 'expression' },
        checkedBy: 'code',
        check: (raw) => {
          const g = compileExpr(normalizeDigits(raw).replace(/^\s*[a-zA-Z]'?\(?[a-z]?\)?\s*=\s*/, '').replace(/\s*\+\s*C\s*$/i, ''), [variable])
          if (!g.ok) return { kind: 'invalid', message: t(lang, 'fb.invalidExpr', { v: variable }) }
          let ok: boolean
          if (v.kind === 'derivative') ok = sameFunction(g.fn, (target as { fn: (s?: Record<string, number>) => number }).fn, variable)
          else {
            const d = derivativeFn(g.text, variable)
            ok = d.ok && sameFunction(d.fn, f.fn, variable)
          }
          if (ok) return correct()
          return {
            kind: 'hint',
            message: v.kind === 'derivative' ? t(lang, 'fb.derivative', { v: variable }) : t(lang, 'fb.integral'),
          }
        },
      }
    }

    case 'choice': {
      const n = v.options.length
      if (n < 2 || n > 5) return fail('choice needs 2 to 5 options')
      if (v.correct === null || !Number.isInteger(v.correct) || v.correct < 0 || v.correct >= n) return fail('correct must be a valid option index')
      if (v.why_wrong.length !== n) return fail('why_wrong needs one entry per option')
      const right = v.correct
      return {
        ...base,
        mode: { type: 'choice', options: v.options },
        checkedBy: 'choice',
        check: (raw) => {
          const pick = normalizeDigits(raw).trim()
          const i = /^[a-eA-E]$/.test(pick) ? pick.toUpperCase().charCodeAt(0) - 65 : Number(pick)
          if (!Number.isInteger(i) || i < 0 || i >= n) return { kind: 'invalid', message: t(lang, 'fb.pickOne') }
          return i === right ? correct() : { kind: 'hint', message: v.why_wrong[i] || t(lang, 'fb.notQuite') }
        },
      }
    }

    case 'ai':
      if (!v.reference?.trim()) return fail('ai needs a reference answer')
      return { ...base, mode: { type: 'text' }, checkedBy: 'ai', check: null }

    case 'none':
      return { ...base, mode: { type: 'none' }, checkedBy: 'none', check: () => ({ kind: 'correct', message: 'Thanks for reading!' }) }
  }
}

export { fracEq }
