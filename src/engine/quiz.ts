import { normalizeDigits } from '../i18n/lang'
import type { Verify } from './plan'

/** Letters only, lowercase, no spaces or punctuation, so it works the same in English, Japanese and Burmese. */
const letters = (s: string) => [...normalizeDigits(s).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')]

/** What share of `a`'s letter pairs also appear in `b`. 1 means `a` is built entirely from `b`'s words. */
export function overlap(a: string, b: string): number {
  const x = letters(a)
  const y = letters(b)
  if (x.length < 2 || y.length < 2) return 0
  const pairs = (c: string[]) => new Set(c.slice(1).map((ch, i) => c[i] + ch))
  const px = pairs(x)
  const py = pairs(y)
  let hit = 0
  for (const p of px) if (py.has(p)) hit++
  return hit / px.size
}

/** Options shorter than this (Yes / No / 12) are too short to judge. */
const MIN_LETTERS = 10
const TOO_SIMILAR = 0.6

/**
 * A quiz must not contain its own answer. If the right option is mostly the question's own words, the
 * learner can pick it without understanding anything ("What are the tiny pieces inside an apple?" with the
 * answer "Tiny pieces inside the apple").
 */
export function quizProblems(verify: Verify, question: string): string[] {
  if (verify.kind !== 'choice' || verify.correct === null) return []
  const right = verify.options[verify.correct]
  if (!right || letters(right).length < MIN_LETTERS) return []
  if (overlap(right, question) < TOO_SIMILAR) return []
  return [
    `the quiz gives away its own answer: the right option "${right}" mostly repeats the question "${question}". Ask the learner to APPLY the idea to a NEW situation, and make the right option say something the question does not already say. The wrong options must be believable mistakes, not unrelated things.`,
  ]
}
