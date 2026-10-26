import type { SpriteData } from '../sprites/library'

export interface Item {
  id: string
  /** Name of the pixel sprite. */
  sprite: string
  /** Group colour, shows where each item came from. */
  color: string
  x: number
  y: number
  state: 'normal' | 'glow' | 'dim'
  /** A slice of a cut object. */
  piece?: boolean
}

export interface Basket {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface Scene {
  items: Item[]
  baskets: Basket[]
  /** Item radius, shrinks as the scene fills up. */
  size: number
}

/** Pictures other than the objects stage. Built by code from the plan, never drawn by the AI. */
export type Motion = 'none' | 'walk_in' | 'pop_in' | 'glow' | 'shake'

export interface SceneActor {
  id: string
  sprite: string
  /** Position on the stage, 0 to 100. */
  x: number
  y: number
  motion: Motion
  flip: boolean
  label: string
  /** Speech bubble text. Empty for none. */
  say: string
}

export interface SceneArrow {
  from: string
  to: string
  label: string
}

/**
 * All the pictures and arrows of a run of consecutive scenes. The layout is made once for the whole run,
 * so a picture never moves when the next one appears.
 */
export interface SceneRun {
  id: string
  actors: SceneActor[]
  arrows: SceneArrow[]
}

export type Visual =
  | { kind: 'scene'; actors: SceneActor[]; arrows: SceneArrow[]; run?: SceneRun }
  | { kind: 'graph'; expr: string; xMin: number; xMax: number; samples: [number, number][] }
  | { kind: 'numberline'; min: number; max: number; marks: { at: number; label: string }[] }
  | { kind: 'balance'; boxes: number; leftBlocks: number; rightBlocks: number }

export interface Step {
  id: string
  /** Index into Lesson.chunks. */
  chunk: number
  /** Written to the learner. `**bold**` marks the key phrase. */
  caption: string
  /** Colour of the bold phrase, matching the group it talks about. */
  accent?: string
  durationMs: number
  scene: Scene
  /** A question to think about before moving on. */
  think?: string
  /** When set, show this picture instead of the objects stage. */
  visual?: Visual
  /** True when the player should stop and wait for the learner's answer. */
  ask?: boolean
}

/** What the learner is asked to type or pick. Options are public; which one is right is not. */
export type AnswerMode =
  | { type: 'number' }
  | { type: 'expression' }
  | { type: 'choice'; options: string[] }
  | { type: 'text' }
  | { type: 'none' }

/** What the browser receives. It never contains the answer. */
export interface Lesson {
  lessonId: string
  asked: string
  category: 'general' | 'word_problem' | 'math' | 'advanced_math'
  mode: 'objects' | 'example' | 'concept'
  answerMode: AnswerMode
  /** "code" and "choice" are exact. "ai" means an AI grades the answer. */
  checkedBy: 'code' | 'choice' | 'ai' | 'none'
  chunks: { title: string }[]
  steps: Step[]
  /** Sprites made for this lesson because the library did not have them. */
  sprites: Record<string, SpriteData>
}

export interface Feedback {
  kind: 'correct' | 'hint' | 'invalid'
  message: string
  /** Set when an AI graded a written answer, so the learner knows it is not an exact check. */
  by?: 'ai'
}

/** Real progress while a lesson is being made, so the loading screen never has to guess. */
export interface LessonStage {
  stage: 'planning' | 'checking' | 'fixing' | 'drawing'
  /** drawing: the name of the thing being drawn. */
  detail?: string
}

export type LessonResponse =
  | { ok: true; lesson: Lesson }
  | { ok: false; status: string; message: string; missing: string[]; choices: string[] }
