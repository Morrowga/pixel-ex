import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { SceneActor, SceneArrow, Visual } from '../engine/types'
import { useSprite } from '../sprites/SpriteContext'
import { SpriteSvg } from '../sprites/SpriteSvg'
import type { Placed } from '../engine/arrange'
import type { Route } from '../engine/route'
import { layoutScene } from '../engine/sceneLayout'
import { pillSize, type Pill } from '../engine/declutter'
import { T_ARROW, actorKey, arrowKey, planReveal } from '../engine/reveal'
import { FitStage, STAGE_HEIGHT } from './FitStage'
import { visualLength } from '../i18n/lang'

type SceneVisual = Extract<Visual, { kind: 'scene' }>

/** Cycles through a sprite's frames while `active` (a walking child). */
function useFrame(count: number, active: boolean) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!active || count < 2) return setI(0)
    const t = setInterval(() => setI((n) => (n + 1) % count), 260)
    return () => clearInterval(t)
  }, [count, active])
  return i
}

/**
 * One picture. It appears exactly where it will stay: no sliding in from somewhere else.
 * `appear` is when it shows up, in seconds from the start of the step. Undefined means it is already
 * on screen from an earlier step, so it just stays.
 */
function Actor({ a, at, px, appear }: { a: SceneActor; at: Placed; px: number; appear?: number }) {
  const { data, known } = useSprite(a.sprite)
  const isNew = appear !== undefined
  const delay = appear ?? 0
  const [walking, setWalking] = useState(isNew && a.motion === 'walk_in')
  useEffect(() => {
    if (!walking) return
    const t = setTimeout(() => setWalking(false), (delay + 1.6) * 1000)
    return () => clearTimeout(t)
  }, [walking, delay])
  const frame = useFrame(data.frames.length, walking)
  const pop = a.motion === 'pop_in'

  return (
    <motion.g
      initial={isNew ? { x: at.x, y: at.y, opacity: 0, scale: pop ? 0.3 : 0.92 } : false}
      animate={{ x: at.x, y: at.y, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      // Appearing takes its time; moving because the window changed size is quick.
      transition={{ x: { duration: 0.3 }, y: { duration: 0.3 }, default: pop ? { type: 'spring', stiffness: 160, damping: 14, delay } : { duration: 0.6, delay } }}
    >
      {a.motion === 'shake' ? (
        <motion.g animate={{ x: [0, -5, 5, -4, 0] }} transition={{ duration: 0.6, delay: delay + 0.9 }}>
          <SpriteSvg rows={data.frames[frame % data.frames.length]} px={px} flip={a.flip} />
        </motion.g>
      ) : (
        <motion.g
          initial={{ filter: 'drop-shadow(0 0 0px #facc15)' }}
          animate={{ filter: a.motion === 'glow' ? 'drop-shadow(0 0 6px #facc15) drop-shadow(0 0 14px #facc15)' : 'drop-shadow(0 0 0px #facc15)' }}
          transition={{ duration: 1.4, delay: delay + 0.8 }}
        >
          <SpriteSvg rows={data.frames[frame % data.frames.length]} px={px} flip={a.flip} />
        </motion.g>
      )}
      {!known && <text className="halo" y={px / 2 + 18} textAnchor="middle" fontSize={14} fill="currentColor">{a.sprite.replace(/_/g, ' ')}</text>}
      {known && a.label && (
        <text className="halo" y={px / 2 + 20} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">{a.label}</text>
      )}
      {a.say && (
        <motion.g initial={isNew ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: delay + 0.6, duration: 0.5 }}>
          <rect x={-12 - visualLength(a.say) * 4.2} y={-px / 2 - 46} width={24 + visualLength(a.say) * 8.4} height={32} rx={8} fill="#fff" stroke="#1f2233" strokeWidth={2} />
          <path d={`M -6 ${-px / 2 - 14} l 6 10 l 6 -10`} fill="#fff" stroke="#1f2233" strokeWidth={2} />
          <text y={-px / 2 - 24} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1f2233">{a.say}</text>
        </motion.g>
      )}
    </motion.g>
  )
}

/** A line that draws from one picture to the next at its turn in the story. Already-drawn lines stay drawn. */
function ArrowLine({ route, start }: { route: Route; start?: number }) {
  if (start === undefined) {
    return (
      <g fill="none" stroke="var(--brand)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <path d={route.d} />
        <path d={route.head} />
      </g>
    )
  }
  return (
    <g>
      <motion.path d={route.d} fill="none" stroke="var(--brand)" strokeWidth={4} strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: T_ARROW - 0.1, delay: start, ease: 'easeInOut' }} />
      <motion.path d={route.head} fill="none" stroke="var(--brand)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: start + T_ARROW - 0.15, duration: 0.2 }} />
    </g>
  )
}

/** A label sitting on its own arrow. Drawn after every line, so it is always on top. */
function ArrowLabel({ pill, text, start }: { pill: Pill; text: string; start?: number }) {
  const { w, h } = pillSize(text)
  return (
    <motion.g initial={start === undefined ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: (start ?? 0) + 0.4, duration: 0.5 }}>
      <rect x={pill.cx - w / 2} y={pill.cy - h / 2} width={w} height={h} rx={h / 2} fill="#1a1e3a" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} />
      <text x={pill.cx} y={pill.cy + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">{text}</text>
    </motion.g>
  )
}

function Scene({ visual, previous, W }: { visual: SceneVisual; previous: SceneVisual | null; W: number }) {
  // ONE layout for the whole run of scenes, so a picture never moves when the next one appears.
  const run = visual.run ?? { id: 'solo', actors: visual.actors, arrows: visual.arrows }
  const layout = useMemo(
    () => layoutScene(run.actors, run.arrows, W, STAGE_HEIGHT, {}, { dedupeArrowLabels: false }),
    // the run id identifies the content: every step of a run carries the same pictures and arrows
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run.id, W],
  )
  // The story of this step: what is new, and in which order it appears.
  const reveal = useMemo(() => planReveal(previous, visual), [previous, visual])

  const byKey = useMemo(() => new Map(layout.arrows.map((r, i) => [arrowKey(r), { route: layout.routes[i], pill: layout.pills[i] }])), [layout])
  const shown = visual.arrows.filter((r) => byKey.has(arrowKey(r)))
  // A repeated label is written once, on the first arrow that has it.
  const seen = new Set<string>()
  const labelled = shown.map((r) => {
    const k = r.label.trim().toLowerCase()
    const first = !!k && !seen.has(k)
    if (first) seen.add(k)
    return first && byKey.get(arrowKey(r))!.pill ? r : null
  })

  return (
    <>
      <AnimatePresence>
        {visual.actors.map((a) => (
          <Actor key={actorKey(a)} a={a} at={layout.placed[a.id]} px={layout.px} appear={reveal.actors[actorKey(a)]} />
        ))}
      </AnimatePresence>
      {shown.map((r) => (
        <ArrowLine key={arrowKey(r)} route={byKey.get(arrowKey(r))!.route} start={reveal.arrows[arrowKey(r)]} />
      ))}
      {labelled.map((r) => r && <ArrowLabel key={`label-${arrowKey(r)}`} pill={byKey.get(arrowKey(r))!.pill!} text={r.label} start={reveal.arrows[arrowKey(r)]} />)}
    </>
  )
}

/**
 * An animated scene made of sprites, as wide as the window. `previous` is the scene before this step, so only
 * what is new plays: the first picture appears, an arrow draws to the next one, that one appears, and so on.
 */
export function SceneView({ visual, previous = null }: { visual: SceneVisual; previous?: SceneVisual | null }) {
  return (
    <FitStage label={visual.actors.map((a) => a.label || a.sprite).join(', ')} minW={560}>
      {(W) => <Scene visual={visual} previous={previous} W={W} />}
    </FitStage>
  )
}

export type { SceneArrow }
