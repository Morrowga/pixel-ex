import { z } from 'zod'

/**
 * What the LLM writes: a lesson plan made of fixed building blocks.
 * Every field is required (nullable when unused) so it works with
 * OpenAI structured outputs.
 */
const Operand = z.object({
  /** A literal number, or null when `ref` is used. */
  num: z.number().nullable(),
  /** The id of an earlier calc step, or null when `num` is used. */
  ref: z.string().nullable(),
})

export const CalcStepSchema = z.object({
  id: z.string(),
  /** percent: a percent of b. sub: a - b. div: a / b. */
  op: z.enum(['add', 'sub', 'mul', 'div', 'percent']),
  a: Operand,
  b: Operand,
})
export type CalcStep = z.infer<typeof CalcStepSchema>

export const COLORS = ['blue', 'red', 'green', 'orange', 'purple', 'yellow', 'pink', 'teal'] as const

export const MOTIONS = ['none', 'walk_in', 'pop_in', 'glow', 'shake'] as const

export const ActorSchema = z.object({
  id: z.string(),
  /** Sprite name, like "child" or "computer". */
  sprite: z.string(),
  /** Where it stands: x and y from 0 (left/top) to 100 (right/bottom). */
  x: z.number(),
  y: z.number(),
  motion: z.enum(MOTIONS),
  /** Face left instead of right. */
  flip: z.boolean(),
  /** Small text under it, "" for none. */
  label: z.string(),
  /** Speech bubble above it, "" for none. */
  say: z.string(),
})
export type Actor = z.infer<typeof ActorSchema>

export const ArrowSchema = z.object({ from: z.string(), to: z.string(), label: z.string() })

export const BlockSchema = z.object({
  type: z.enum([
    'spawn', 'merge', 'take_away', 'split', 'cut', 'highlight', // objects
    'scene', 'graph', 'numberline', 'balance', // other pictures. Every step must show something that moves.
    'ask',
  ]),
  /** Short line written to the learner. */
  caption: z.string(),
  /** Optional question for the learner to think about before moving on. */
  think: z.string().nullable(),

  // objects
  /** spawn: new group id. merge: id of the merged group. Others: the group acted on. */
  group: z.string().nullable(),
  /** merge only: ids of the groups to put together. */
  groups: z.array(z.string()),
  /** spawn: how many. take_away: how many removed. split: number of baskets. cut: slices per object. highlight: how many glow. */
  count: z.number().nullable(),
  /** spawn only: the name of the sprite (a small pixel picture) for the object, like "apple". */
  sprite: z.string().nullable(),
  color: z.enum(COLORS).nullable(),

  // scene: a little animated picture made of sprites
  actors: z.array(ActorSchema),
  arrows: z.array(ArrowSchema),

  // graph / balance
  /** graph: a function of x like "x^2 - 4". balance: an equation like "x + 3 = 10". */
  expr: z.string().nullable(),
  x_min: z.number().nullable(),
  x_max: z.number().nullable(),
  /** numberline: marked points. */
  marks: z.array(z.object({ at: z.number(), label: z.string() })),

  /** ask only: what the learner reads off the final picture (objects and balance). */
  measure: z.enum(['group_total', 'per_basket', 'per_basket_fraction', 'highlighted', 'balance_value']).nullable(),
})
export type Block = z.infer<typeof BlockSchema>

/** How the learner's answer is checked. Everything the learner must not see stays on the server. */
export const VerifySchema = z.object({
  kind: z.enum(['calc', 'solve', 'derivative', 'integral', 'evaluate', 'choice', 'ai', 'none']),

  // calc: arithmetic, computed by code
  calc: z.array(CalcStepSchema),
  /** Only when faithful is false: the same calculation with the scaled-down scene numbers. */
  example_calc: z.array(CalcStepSchema),
  /** True when the picture uses the real numbers of the question. */
  faithful: z.boolean(),

  // solve / derivative / integral / evaluate: checked by the math engine
  /** solve: an equation like "x^2 = 9". derivative/integral: the function. evaluate: a numeric expression. */
  expr: z.string().nullable(),
  variable: z.string().nullable(),

  // choice: one multiple-choice question
  options: z.array(z.string()),
  /** Index of the correct option. */
  correct: z.number().nullable(),
  /** For each option: why it is wrong ("" for the correct one). Must not reveal the correct option. */
  why_wrong: z.array(z.string()),

  // ai: the answer is graded by an AI against this reference
  reference: z.string().nullable(),
  rubric: z.string().nullable(),

  /** Progressive hints for wrong answers, gentle to stronger. Never the answer itself. */
  hints: z.array(z.string()),
})
export type Verify = z.infer<typeof VerifySchema>

export const PlanSchema = z.object({
  status: z.enum(['complete', 'missing', 'unclear', 'invalid', 'unsupported']),
  /** One short friendly sentence when status is not "complete", else "". */
  message: z.string(),
  missing: z.array(z.string()),
  /** When status is "unclear": 2 to 4 readings of the question, each a full question the learner can click. */
  clarify: z.array(z.string()),
  category: z.enum(['general', 'word_problem', 'math', 'advanced_math', 'none']),
  /** True only when the question is about computers or technology, so computer, chip and phone pictures are allowed. */
  about_technology: z.boolean(),
  /** One sentence: what the question is asking. */
  asked: z.string(),
  /** "objects": the question's own objects. "example": an invented example. "concept": ideas, not objects. */
  mode: z.enum(['objects', 'example', 'concept', 'none']),
  verify: VerifySchema,
  chunks: z.array(z.object({ title: z.string(), blocks: z.array(BlockSchema) })),
})
export type Plan = z.infer<typeof PlanSchema>
