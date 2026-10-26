import type { AnswerMode } from './engine/types'

/**
 * How much room to keep for the answer under the explanation, for the WHOLE lesson.
 * It never changes while the lesson plays, so the picture below never jumps when the question appears.
 */
export function answerZoneClass(mode: AnswerMode): 'none' | 'input' | 'choice-few' | 'choice-many' {
  if (mode.type === 'none') return 'none'
  if (mode.type === 'choice') return mode.options.length <= 3 ? 'choice-few' : 'choice-many'
  return 'input'
}
