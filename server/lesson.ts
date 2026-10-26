import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSteps, spriteNames } from '../src/engine/simulate'
import { prepareVerify } from '../src/engine/verify'
import { seal, unseal } from './seal'
import type { Plan, Verify } from '../src/engine/plan'
import type { Feedback, LessonResponse, LessonStage } from '../src/engine/types'
import { generateSprite, gradeAnswer, planLesson } from './llm'
import { resolveSprites } from './sprites'
import { log } from './log'
import { tracked } from './usage'
import type { Lang } from '../src/i18n/lang'
import { t } from '../src/i18n/messages'
import { isTechTopic } from '../src/engine/topic'
import { quizProblems } from '../src/engine/quiz'

// Sprites the AI drew are kept in files so the next question gets them free. On Vercel the shipped files are
// read-only, so new ones go to a temporary folder (they only last a while there, and are simply redrawn).
const here = (() => {
  try {
    return dirname(fileURLToPath(import.meta.url))
  } catch {
    return process.cwd()
  }
})()
const SEED_DIR = join(here, 'sprite-cache')
const SHIPPED_DIR = join(process.cwd(), 'server', 'sprite-cache')
const WRITE_DIR = process.env.SPRITE_CACHE_DIR ?? (process.env.VERCEL ? join(tmpdir(), 'sprite-cache') : SEED_DIR)
const READ_DIRS = [...new Set([WRITE_DIR, SEED_DIR, SHIPPED_DIR])]

const TTL_MS = 12 * 60 * 60 * 1000
const MAX_TRIES = 3

/** What the sealed token carries: everything needed to check an answer later, so nothing is stored here. */
interface Sealed {
  v: 1
  lang: Lang
  asked: string
  verify: Verify
}

export function readToken(token: string): Sealed | null {
  const s = unseal<Sealed>(token)
  return s && s.v === 1 ? s : null
}

/**
 * Checks a guess. Exact tiers use code; the "ai" tier asks a grader, and says so.
 * `attempt` is which try this is (1, 2, 3...), so each wrong try can show one more hint.
 * Returns null when the token is not valid (changed, or too old).
 */
export async function checkAnswer(token: string, raw: string, attempt = 1): Promise<Feedback | null> {
  const sealed = readToken(token)
  if (!sealed) return null
  const { lang, asked, verify } = sealed
  const prepared = prepareVerify(verify, lang)
  if ('error' in prepared) return null

  let fb: Feedback
  if (prepared.check) {
    fb = prepared.check(raw)
  } else {
    const g = await tracked('answer grading', () =>
      gradeAnswer({ lang, asked, reference: verify.reference ?? '', rubric: verify.rubric ?? '', learner: raw }),
    )
    fb = { kind: g.verdict === 'correct' ? 'correct' : 'hint', message: g.feedback, by: 'ai' }
  }

  // Progressive hints from the plan: one more on each wrong try (not for multiple choice, which has its own).
  const extra = verify.hints[Math.max(0, attempt - 1)]
  if (fb.kind === 'hint' && extra && prepared.checkedBy !== 'choice') fb = { ...fb, message: `${fb.message} ${t(lang, 'answer.hint')} ${extra}` }
  return fb
}

/** Random option order, so the right answer is not always first. Keeps each reason with its option. */
function shuffleChoice(plan: Plan): Plan {
  const v = plan.verify
  const n = v.options.length
  if (v.kind !== 'choice' || n < 2 || v.correct === null || v.why_wrong.length !== n) return plan
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return {
    ...plan,
    verify: {
      ...v,
      options: order.map((i) => v.options[i]),
      why_wrong: order.map((i) => v.why_wrong[i]),
      correct: order.indexOf(v.correct),
    },
  }
}

/** Plan with the LLM, verify with code, retry once with the checker's complaints. */
export function makeLesson(question: string, lang: Lang = 'en', onStage: (s: LessonStage) => void = () => {}): Promise<LessonResponse> {
  return tracked('TOTAL for this question', () => buildLesson(question, lang, onStage), { countAsQuestion: true })
}

async function buildLesson(question: string, lang: Lang, onStage: (s: LessonStage) => void): Promise<LessonResponse> {
  let problems: string[] = []
  log(`▶ question [${lang}]: "${question}"`)
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    onStage({ stage: attempt === 0 ? 'planning' : 'fixing' })
    const plan = shuffleChoice(await planLesson(question, lang, problems))
    onStage({ stage: 'checking' })

    if (plan.status !== 'complete') {
      log(`  ✖ status "${plan.status}": ${plan.message}`)
      return { ok: false, status: plan.status, message: plan.message, missing: plan.missing, choices: plan.status === 'unclear' ? plan.clarify.slice(0, 4) : [] }
    }

    const prepared = prepareVerify(plan.verify, lang)
    if ('error' in prepared) {
      problems = [`verify: ${prepared.error}`]
      log(`  ✖ rejected (attempt ${attempt + 1}): ${problems[0]}`)
      continue
    }

    const rules = {
      // English questions are checked by keywords; in other languages the AI says whether the topic is technology.
      allowTech: lang === 'en' ? isTechTopic(question) : plan.about_technology,
      kind: plan.verify.kind,
      target: prepared.target,
      answer: prepared.answer,
      inputs: prepared.inputs,
      intermediates: prepared.intermediates,
    }
    let built = buildSteps(plan, rules)
    // Last try: a lesson with a vague word or a loose picture beats no lesson. Real mistakes still fail.
    if ('errors' in built && attempt === MAX_TRIES - 1) {
      const relaxed = buildSteps(plan, { ...rules, lenient: true })
      if ('steps' in relaxed) {
        log(`  ⚠ last try: showing the lesson with style problems left in:\n${built.errors.map((e) => `      - ${e}`).join('\n')}`)
        built = relaxed
      }
    }
    if ('errors' in built) {
      log(`  ✖ rejected (attempt ${attempt + 1}):\n${built.errors.map((e) => `      - ${e}`).join('\n')}`)
      problems = built.errors
      continue
    }

    log(
      `  ✔ lesson ready: ${plan.category} / ${plan.mode}, ${plan.chunks.length} part(s), ${built.steps.length} steps | ` +
        `checked by ${prepared.checkedBy} (${plan.verify.kind}), answer kept on server`,
    )
    const { custom } = await resolveSprites(spriteNames(built.steps), {
      dir: WRITE_DIR,
      readDirs: READ_DIRS,
      generate: generateSprite,
      log,
      onDraw: (name) => onStage({ stage: 'drawing', detail: name }),
    })
    // The quiz must not contain its own answer. A style problem: fixed by a retry, accepted on the last try.
    const askCaption = [...built.steps].reverse().find((s) => s.ask)?.caption ?? plan.asked
    const quiz = quizProblems(plan.verify, askCaption.replace(/\*\*/g, ''))
    if (quiz.length && attempt < MAX_TRIES - 1) {
      problems = quiz
      log(`  ✖ rejected (attempt ${attempt + 1}):\n      - ${quiz[0]}`)
      continue
    }
    if (quiz.length) log(`  ⚠ last try: showing the lesson although ${quiz[0]}`)

    return {
      ok: true,
      lesson: {
        lessonId: seal({ v: 1, lang, asked: plan.asked, verify: plan.verify } satisfies Sealed, TTL_MS),
        asked: plan.asked,
        category: plan.category as 'general' | 'word_problem' | 'math' | 'advanced_math',
        mode: plan.mode as 'objects' | 'example' | 'concept',
        answerMode: prepared.mode,
        checkedBy: prepared.checkedBy,
        chunks: plan.chunks.map((c) => ({ title: c.title })),
        steps: built.steps,
        sprites: custom,
      },
    }
  }

  log(`  ✖ gave up after ${MAX_TRIES} attempts`)
  return {
    ok: false,
    status: 'failed',
    message: t(lang, 'err.cantBuild'),
    missing: [],
    choices: [],
  }
}
