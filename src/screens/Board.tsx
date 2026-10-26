import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Lesson } from '../engine/types'
import { usePlayer } from '../usePlayer'
import { CustomSprites } from '../sprites/SpriteContext'
import { Stage } from '../components/Stage'
import { VisualPanel } from '../components/VisualPanel'
import { Caption } from '../components/Caption'
import { Controls } from '../components/Controls'
import { AnswerBox } from '../components/AnswerBox'
import { IconBack } from '../components/icons'
import { answerZoneClass } from '../answerZone'
import { useI18n } from '../i18n/I18n'

/** The whole screen is the board: words on top, the picture below, small controls at the bottom. */
export function Board({ lesson, onNew }: { lesson: Lesson; onNew: () => void }) {
  const { t } = useI18n()
  const player = usePlayer(lesson.steps)
  const { step } = player

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (e.key === ' ') { e.preventDefault(); player.toggle() }
      else if (e.key === 'ArrowRight') player.next()
      else if (e.key === 'ArrowLeft') player.back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player.toggle, player.next, player.back])

  return (
    <CustomSprites.Provider value={lesson.sprites}>
      <motion.div className="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
        <button className="newq" onClick={onNew}>
          <IconBack /> {t('board.newQuestion')}
        </button>

        {/* Zone 1: the words. Fixed size; old and new lines cross-fade in the same spot. */}
        <header className="caption-zone">
          <AnimatePresence>
            <motion.div key={step.id} className="caption-slot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              <Caption text={step.caption} accent={step.accent} />
              {step.think && <p className="think">{step.think}</p>}
            </motion.div>
          </AnimatePresence>
        </header>

        {/* Zone 2: the answer. Reserved for the whole lesson, so nothing moves when the question appears. */}
        <section className={`answer-zone ${answerZoneClass(lesson.answerMode)}${step.ask ? '' : ' idle'}`}>
          {step.ask && lesson.answerMode.type !== 'none' && (
            <AnswerBox lessonId={lesson.lessonId} mode={lesson.answerMode} checkedBy={lesson.checkedBy} />
          )}
        </section>

        <main className="stagewrap">
          <div key={player.run} className="stagebox">
            {step.visual ? <VisualPanel visual={step.visual} previous={lesson.steps[player.index - 1]?.visual ?? null} /> : <Stage scene={step.scene} />}
          </div>
        </main>

        <footer className="dock">
          <Controls
            index={player.index}
            total={player.total}
            playing={player.playing}
            atStart={player.atStart}
            atEnd={player.atEnd}
            onBack={player.back}
            onNext={player.next}
            onToggle={player.toggle}
          />
        </footer>
      </motion.div>
    </CustomSprites.Provider>
  )
}
