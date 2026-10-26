import { useState } from 'react'
import { motion } from 'framer-motion'
import { IconSend } from '../components/icons'
import { LANGS, LANG_NAMES } from '../i18n/lang'
import { useI18n } from '../i18n/I18n'
import { RunnerGreeting } from '../components/RunnerGreeting'

interface Props {
  notice: string | null
  choices: string[]
  onAsk: (question: string) => void
}

/** Just one input, in the middle of the page. A small language switch sits in the corner. */
export function AskScreen({ notice, choices, onAsk }: Props) {
  const [text, setText] = useState('')
  const { t, lang, setLang } = useI18n()
  return (
    <motion.main className="center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
      <div className="langs" role="group" aria-label={t('ask.language')}>
        {LANGS.map((l) => (
          <button key={l} type="button" lang={l} className={l === lang ? 'on' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
            {LANG_NAMES[l]}
          </button>
        ))}
      </div>
      <RunnerGreeting />
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) onAsk(text.trim())
        }}
      >
        <div className="pill big">
          <input aria-label={t('ask.yourQuestion')} autoFocus autoComplete="off" maxLength={500} value={text} placeholder={t('ask.placeholder')} onChange={(e) => setText(e.target.value)} />
          <button type="submit" aria-label={t('ask.explain')} disabled={!text.trim()}>
            <IconSend />
          </button>
        </div>
        {notice && (
          <motion.p className="notice" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {notice}
          </motion.p>
        )}
        {choices.length > 0 && (
          <div className="choices">
            {choices.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setText(c)
                  onAsk(c)
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </form>
    </motion.main>
  )
}
