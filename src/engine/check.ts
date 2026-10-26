import type { CalcResult } from './calc'
import type { Feedback } from './types'
import { normalizeDigits, type Lang } from '../i18n/lang'
import { t } from '../i18n/messages'

type Calc = Extract<CalcResult, { ok: true }>

/** Reads "5", "3.5", "3,5" or "5/6". Returns null when it is not a number. */
export function parseAnswer(raw: string | number, allowNegative = false): number | null {
  // "１２" (Japanese full-width) and "၁၂" (Burmese digits) are the same answer as "12"
  let s = normalizeDigits(String(raw)).trim().replace(',', '.')
  let sign = 1
  if (allowNegative && s.startsWith('-')) {
    sign = -1
    s = s.slice(1).trim()
  }
  const f = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (f) return Number(f[2]) === 0 ? null : (sign * Number(f[1])) / Number(f[2])
  return /^\d*\.?\d+$/.test(s) ? sign * Number(s) : null
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

/** Builds the learner-answer checker from the code-computed result. Hints never state the answer. */
export function makeChecker(calc: Calc, lang: Lang = 'en'): (raw: string | number) => Feedback {
  const { value: answer, last } = calc
  const { op, a, b } = last
  const whole = Number.isInteger(answer)

  const wrong: [number, string][] = []
  const add = (v: number, msg: string) => {
    if (!near(v, answer) && !wrong.some(([x]) => near(x, v))) wrong.push([v, msg])
  }
  switch (op) {
    case 'add':
      add(a, t(lang, 'fb.addOneGroup'))
      add(b, t(lang, 'fb.addOneGroup'))
      add(Math.abs(a - b), t(lang, 'fb.addTookAway'))
      break
    case 'sub':
      add(a + b, t(lang, 'fb.subTogether'))
      add(a, t(lang, 'fb.subStarted'))
      add(b, t(lang, 'fb.subTaken'))
      break
    case 'mul':
      add(a + b, t(lang, 'fb.mulAdded'))
      add(a, t(lang, 'fb.mulOneGroup'))
      add(b, t(lang, 'fb.mulGroups'))
      break
    case 'div':
      add(a * b, t(lang, 'fb.divMultiplied'))
      if (b !== 0) add(b / a, t(lang, 'fb.divFlipped'))
      add(a, t(lang, 'fb.divWhole'))
      add(b, t(lang, 'fb.divGroups'))
      break
    case 'percent':
      add(a, t(lang, 'fb.pctItself'))
      add(b, t(lang, 'fb.pctTotal'))
      add(a * b, t(lang, 'fb.pctHundred'))
      break
  }

  return (raw) => {
    const n = parseAnswer(raw)
    if (n === null) return { kind: 'invalid', message: t(lang, 'fb.invalidNumber') }
    // Whole answers must match exactly; for fractions a typed decimal like 0.83 is fine.
    if (near(n, answer) || (!whole && Math.abs(n - answer) <= 0.005 && /[.,]/.test(normalizeDigits(String(raw))))) {
      return { kind: 'correct', message: t(lang, 'fb.correct') }
    }
    const known = wrong.find(([v]) => near(v, n))
    if (known) return { kind: 'hint', message: known[1] }
    if (whole && Math.abs(n - answer) === 1) return { kind: 'hint', message: t(lang, 'fb.close') }
    return {
      kind: 'hint',
      message: n < answer ? t(lang, 'fb.lowStory') : t(lang, 'fb.highStory'),
    }
  }
}
