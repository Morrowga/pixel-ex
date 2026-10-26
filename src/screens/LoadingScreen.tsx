import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LessonStage } from '../engine/types'
import { SPRITES } from '../sprites/library'
import { SpriteSvg } from '../sprites/SpriteSvg'
import { useI18n } from '../i18n/I18n'

const KEY = { planning: 'loading.reading', checking: 'loading.checking', fixing: 'loading.fixing' } as const

/** Shown until everything, including any new pictures, is ready, so playback never waits. */
export function LoadingScreen({ stage }: { stage: LessonStage }) {
  const { t } = useI18n()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame((n) => n + 1), 220)
    return () => clearInterval(t)
  }, [])
  const child = SPRITES.child.frames
  const text =
    stage.stage === 'drawing'
      ? stage.detail
        ? t('loading.drawing', { thing: stage.detail })
        : t('loading.drawingNew')
      : t(KEY[stage.stage])
  return (
    <motion.main className="center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} role="status" aria-live="polite">
      <svg width={120} height={120} viewBox="-60 -60 120 120" aria-hidden="true">
        <SpriteSvg rows={child[frame % child.length]} px={96} />
      </svg>
      <AnimatePresence mode="wait">
        <motion.p key={text} className="loading-text" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          {text}
        </motion.p>
      </AnimatePresence>
      <div className="bar" aria-hidden="true">
        <motion.span animate={{ x: ['-100%', '260%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
    </motion.main>
  )
}
