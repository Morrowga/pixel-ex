import { all, create } from 'mathjs'
import { normalizeDigits } from '../i18n/lang'

/**
 * Safe expression engine for checking answers in code: algebra, calculus, evaluation.
 * Built on mathjs with its code-injection hooks switched off (see the mathjs security notes).
 */
const math = create(all)
const parse = math.parse
const derivativeOf = math.derivative

math.import(
  {
    import: () => { throw new Error('disabled') },
    createUnit: () => { throw new Error('disabled') },
    reviver: () => { throw new Error('disabled') },
    evaluate: () => { throw new Error('disabled') },
    parse: () => { throw new Error('disabled') },
    simplify: () => { throw new Error('disabled') },
    derivative: () => { throw new Error('disabled') },
  },
  { override: true },
)

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'cbrt', 'abs', 'log', 'log10', 'exp', 'pow', 'min', 'max', 'floor', 'ceil', 'round',
])
const CONSTANTS = new Set(['pi', 'e'])
const MAX_LEN = 200

export type Fn = (scope?: Record<string, number>) => number

/** Compile a learner- or AI-written expression. Only numbers, the given variables and a few functions are allowed. */
export function compileExpr(expr: string, variables: string[] = ['x']): { ok: true; fn: Fn; text: string } | { ok: false; error: string } {
  const text = normalizeDigits(expr).trim().replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3')
  if (!text || text.length > MAX_LEN) return { ok: false, error: 'expression is empty or too long' }
  try {
    const node = parse(text)
    let bad: string | null = null
    node.traverse((n) => {
      const t = n.type
      if (t === 'FunctionNode') {
        const name = (n as unknown as { fn: { name?: string } }).fn.name ?? ''
        if (!FUNCTIONS.has(name)) bad = `function "${name}" is not allowed`
      } else if (t === 'SymbolNode') {
        const name = (n as unknown as { name: string }).name
        const isFnName = FUNCTIONS.has(name)
        if (!isFnName && !CONSTANTS.has(name) && !variables.includes(name)) bad = `unknown name "${name}"`
      } else if (!['ConstantNode', 'OperatorNode', 'ParenthesisNode', 'FunctionNode', 'SymbolNode'].includes(t)) {
        bad = `"${t}" is not allowed`
      }
    })
    if (bad) return { ok: false, error: bad }
    const code = node.compile()
    return {
      ok: true,
      text,
      fn: (scope = {}) => {
        const v = code.evaluate({ ...scope }) as unknown
        if (typeof v !== 'number') throw new Error('not a number')
        return v
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'cannot read expression' }
  }
}

/** d/dvar of expr, as a compiled function. */
export function derivativeFn(expr: string, variable = 'x') {
  const c = compileExpr(expr, [variable])
  if (!c.ok) return c
  try {
    const d = derivativeOf(c.text, variable).toString()
    return compileExpr(d, [variable])
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'cannot differentiate' }
  }
}

const SAMPLES = [-3.1, -2.3, -1.7, -0.9, -0.4, 0.3, 0.8, 1.4, 2.2, 2.9, 3.7]

/** True when f and g agree wherever both are defined, at several points (and at least a few are defined). */
export function sameFunction(f: Fn, g: Fn, variable = 'x', offset = 0) {
  let compared = 0
  for (const x of SAMPLES) {
    let a: number, b: number
    try {
      a = f({ [variable]: x })
      b = g({ [variable]: x })
    } catch {
      continue
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    compared++
    if (Math.abs(a - b - offset) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) return false
  }
  return compared >= 4
}

export interface Linear {
  /** a·x + b = c */
  a: number
  b: number
  c: number
  /** Whole, non-negative solution (c - b) / a, when it exists. */
  solution: number | null
}

/** Reads "x + 3 = 10", "3x = 12", "2x - 1 = 9". Returns null when it is not linear with whole numbers. */
export function linearEquation(eq: string, variable = 'x'): Linear | null {
  const parts = eq.split('=')
  if (parts.length !== 2) return null
  const l = compileExpr(parts[0], [variable])
  const r = compileExpr(parts[1], [variable])
  if (!l.ok || !r.ok) return null
  try {
    const f = (x: number) => l.fn({ [variable]: x }) - r.fn({ [variable]: x })
    const slope = f(1) - f(0)
    if (Math.abs(f(5) - f(0) - 5 * slope) > 1e-9 || slope === 0) return null
    const c0 = r.fn({ [variable]: 0 })
    const l0 = l.fn({ [variable]: 0 })
    const lslope = l.fn({ [variable]: 1 }) - l0
    const rslope = r.fn({ [variable]: 1 }) - c0
    if (rslope !== 0) return null // keep x on the left for the balance picture
    const whole = [lslope, l0, c0].every(Number.isInteger)
    if (!whole || lslope <= 0 || l0 < 0 || c0 < 0) return null
    const s = (c0 - l0) / lslope
    return { a: lslope, b: l0, c: c0, solution: Number.isInteger(s) && s >= 0 ? s : null }
  } catch {
    return null
  }
}

/** Does `value` satisfy the equation? Works for any equation in one variable. */
export function satisfies(eq: string, variable: string, value: number) {
  const parts = eq.split('=')
  if (parts.length !== 2) return false
  const l = compileExpr(parts[0], [variable])
  const r = compileExpr(parts[1], [variable])
  if (!l.ok || !r.ok) return false
  try {
    const lv = l.fn({ [variable]: value })
    const rv = r.fn({ [variable]: value })
    return Math.abs(lv - rv) < 1e-6 * Math.max(1, Math.abs(lv), Math.abs(rv))
  } catch {
    return false
  }
}
