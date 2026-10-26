import type { CalcStep } from './plan'

/** An exact non-negative fraction, so 5 ÷ 6 stays 5/6 and never becomes 0.8333. */
export interface Frac {
  n: number
  d: number
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
export const frac = (n: number, d = 1): Frac => {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1
  return { n: n / g, d: d / g }
}
export const fracEq = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d
export const fracValue = (f: Frac) => f.n / f.d

/** Literals come in as numbers; turn up to 4 decimals into an exact fraction. */
const fromNumber = (x: number): Frac | null => {
  if (!Number.isFinite(x) || x < 0) return null
  const scaled = Math.round(x * 10000)
  return Math.abs(scaled / 10000 - x) < 1e-9 ? frac(scaled, 10000) : null
}

export type CalcResult =
  | {
      ok: true
      answer: Frac
      /** answer as a plain number, for hints. */
      value: number
      inputs: number[]
      /** Values of the steps before the last one. */
      intermediates: number[]
      last: { op: CalcStep['op']; a: number; b: number }
    }
  | { ok: false; error: string }

/** Computes the real answer in code. The LLM only says how, never the result. */
export function evaluate(calc: CalcStep[]): CalcResult {
  if (calc.length === 0) return { ok: false, error: 'calc is empty' }
  const values = new Map<string, Frac>()
  const inputs: number[] = []
  const intermediates: number[] = []
  let last = { op: calc[0].op, a: 0, b: 0 }
  let answer = frac(0)

  const operand = (o: CalcStep['a']): Frac | string => {
    if (o.num !== null && o.ref === null) {
      const f = fromNumber(o.num)
      if (!f) return `${o.num} is not a usable number`
      inputs.push(o.num)
      return f
    }
    if (o.ref !== null && o.num === null) return values.get(o.ref) ?? `unknown ref "${o.ref}"`
    return 'an operand needs exactly one of num or ref'
  }

  for (const [i, step] of calc.entries()) {
    if (values.has(step.id)) return { ok: false, error: `duplicate calc id "${step.id}"` }
    const a = operand(step.a)
    const b = operand(step.b)
    if (typeof a === 'string') return { ok: false, error: a }
    if (typeof b === 'string') return { ok: false, error: b }

    let v: Frac
    switch (step.op) {
      case 'add': v = frac(a.n * b.d + b.n * a.d, a.d * b.d); break
      case 'sub': v = frac(a.n * b.d - b.n * a.d, a.d * b.d); break
      case 'mul': v = frac(a.n * b.n, a.d * b.d); break
      case 'div':
        if (b.n === 0) return { ok: false, error: 'you cannot divide by zero' }
        v = frac(a.n * b.d, a.d * b.n)
        break
      case 'percent': v = frac(a.n * b.n, a.d * b.d * 100); break
    }
    if (v.n < 0) return { ok: false, error: `${step.id} is negative` }
    values.set(step.id, v)
    if (i < calc.length - 1) intermediates.push(fracValue(v))
    last = { op: step.op, a: fracValue(a), b: fracValue(b) }
    answer = v
  }
  return { ok: true, answer, value: fracValue(answer), inputs, intermediates, last }
}
