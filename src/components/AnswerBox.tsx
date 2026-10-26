import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AnswerMode, Feedback } from '../engine/types'
import { IconSend } from './icons'
import { useI18n } from '../i18n/I18n'

interface Props {
  lessonId: string
  mode: AnswerMode
  checkedBy: 'code' | 'choice' | 'ai' | 'none'
}

/** The correct answer lives on the server; the browser only sends the guess. */
export function AnswerBox({ lessonId, mode, checkedBy }: Props) {
  const { t, lang } = useI18n()
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  // Which try this is. The server keeps no memory, so it is told, and each wrong try can show one more hint.
  const tries = useRef(0)

  const send = async (answer: string) => {
    if (answer.trim() === '') {
      setFeedback({ kind: 'invalid', message: t('answer.empty') })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, answer, lang, attempt: ++tries.current }),
      })
      const data = await res.json()
      setFeedback('error' in data ? { kind: 'invalid', message: data.error } : data)
    } catch {
      setFeedback({ kind: 'invalid', message: t('net.unreachable') })
    } finally {
      setBusy(false)
    }
  }

  // The feedback line has its own reserved slot, so showing it never moves anything else.
  const note = (
    <div className="feedback-slot">
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.p key={feedback.message} className={`feedback ${feedback.kind}`} role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {(feedback.by === 'ai' || checkedBy === 'ai') && <span className="tag">{t('answer.aiCheck')}</span>}
            {feedback.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )

  if (mode.type === 'choice') {
    return (
      <motion.div className="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
        <div className="options">
          {mode.options.map((o, i) => (
            <button key={i} disabled={busy} onClick={() => send(String(i))}>
              <b>{String.fromCharCode(65 + i)}</b>
              {o}
            </button>
          ))}
        </div>
        {note}
      </motion.div>
    )
  }

  const placeholder = mode.type === 'expression' ? 'e.g. 3x^2 + 2' : mode.type === 'text' ? t('answer.writeAnswer') : t('answer.yourAnswer')
  return (
    <motion.form
      className="answer"
      onSubmit={(e) => {
        e.preventDefault()
        send(value)
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="pill">
        <input
          aria-label={t('answer.yourAnswer')}
          inputMode="text"
          autoComplete="off"
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value)
            setFeedback(null)
          }}
        />
        <button type="submit" disabled={busy} aria-label={t('answer.check')}>
          <IconSend />
        </button>
      </div>
      {note}
    </motion.form>
  )
}
