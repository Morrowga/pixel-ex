import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SPRITES } from '../sprites/library'
import { SpriteSvg } from '../sprites/SpriteSvg'
import { useI18n } from '../i18n/I18n'

const FRAME_MS = 110
/**
 * The frames are [stride, mid-air, stride, mid-air], each 110 ms. The body should be lowest in the middle of a
 * stride frame (feet down) and highest in the middle of a mid-air frame. Over one 220 ms bounce that is: lowest
 * at 25% (55 ms), highest at 75% (165 ms), starting half way between.
 */
const TOUCH_DOWN_TIMES = [0, 0.25, 0.75, 1]

/** A pixel runner on a scrolling ground, with the greeting beside him. Stands still for people who prefer less motion. */
export function RunnerGreeting() {
  const { t } = useI18n()
  const calm = useReducedMotion()
  const frames = SPRITES.runner.frames
  const [frame, setFrame] = useState(1) // the mid-air frame is the nicest still picture
  useEffect(() => {
    if (calm) return setFrame(1)
    const id = setInterval(() => setFrame((n) => (n + 1) % frames.length), FRAME_MS)
    return () => clearInterval(id)
  }, [calm, frames.length])

  return (
    <div className="greeting">
      <svg className="runner" viewBox="-76 -70 152 150" aria-hidden="true">
        {/* ground that slides backwards under his feet */}
        <motion.line
          x1={-70} x2={70} y1={64} y2={64}
          stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeDasharray="14 14" opacity={0.4}
          animate={calm ? undefined : { strokeDashoffset: [0, -28] }}
          transition={{ duration: 0.45, repeat: Infinity, ease: 'linear' }}
        />
        {/* speed lines streaming behind him */}
        {!calm &&
          [-12, 8, 28].map((y, i) => (
            <motion.line
              key={y}
              y1={y} y2={y} x1={-46} x2={-30}
              stroke="currentColor" strokeWidth={3} strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0], x: [6, -16] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.16, ease: 'easeOut' }}
            />
          ))}
        {/* soft shadow that shrinks as he leaves the ground */}
        <motion.ellipse
          cx={6} cy={62} rx={28} ry={5} fill="#000"
          animate={calm ? { opacity: 0.25 } : { opacity: [0.2, 0.3, 0.12, 0.2], rx: [25, 28, 22, 25] }}
          transition={{ duration: FRAME_MS * 2 / 1000, times: TOUCH_DOWN_TIMES, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* the runner: his body bounces twice for every full step */}
        <motion.g
          animate={calm ? undefined : { y: [-3.5, 0, -7, -3.5] }}
          transition={{ duration: FRAME_MS * 2 / 1000, times: TOUCH_DOWN_TIMES, repeat: Infinity, ease: 'easeInOut' }}
        >
          <g transform="translate(6 2)">
            <SpriteSvg rows={frames[frame % frames.length]} px={112} />
          </g>
        </motion.g>
      </svg>
      <motion.p className="greeting-text" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
        {t('ask.greeting')}
      </motion.p>
    </div>
  )
}
