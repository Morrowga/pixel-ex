import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Lesson, LessonStage } from './engine/types'
import { requestLesson } from './api'
import { AskScreen } from './screens/AskScreen'
import { LoadingScreen } from './screens/LoadingScreen'
import { Board } from './screens/Board'
import { useI18n } from './i18n/I18n'

type Phase = { name: 'ask' } | { name: 'loading'; stage: LessonStage } | { name: 'play'; lesson: Lesson }

export default function App() {
  const { t, lang } = useI18n()
  const [phase, setPhase] = useState<Phase>({ name: 'ask' })
  const [notice, setNotice] = useState<string | null>(null)
  const [choices, setChoices] = useState<string[]>([])

  const ask = async (question: string) => {
    setNotice(null)
    setChoices([])
    setPhase({ name: 'loading', stage: { stage: 'planning' } })
    try {
      const r = await requestLesson(question, lang, (stage) => setPhase({ name: 'loading', stage }))
      if ('error' in r) {
        setNotice(r.error)
        setPhase({ name: 'ask' })
      } else if (r.ok) {
        setPhase({ name: 'play', lesson: r.lesson })
      } else {
        setNotice(r.message.replace(/\*\*/g, ''))
        setChoices(r.choices ?? [])
        setPhase({ name: 'ask' })
      }
    } catch {
      setNotice(t('net.unreachable'))
      setPhase({ name: 'ask' })
    }
  }

  return (
    <AnimatePresence mode="wait">
      {phase.name === 'ask' && <AskScreen key="ask" notice={notice} choices={choices} onAsk={ask} />}
      {phase.name === 'loading' && <LoadingScreen key="loading" stage={phase.stage} />}
      {phase.name === 'play' && <Board key={phase.lesson.lessonId} lesson={phase.lesson} onNew={() => setPhase({ name: 'ask' })} />}
    </AnimatePresence>
  )
}
