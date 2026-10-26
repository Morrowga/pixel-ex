import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { detectLang, normalizeLang, type Lang } from './lang'
import { t as translate, type MessageKey } from './messages'

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
}

const fallback: I18n = { lang: 'en', setLang: () => {}, t: (k, p) => translate('en', k, p) }
const Ctx = createContext<I18n>(fallback)

/** The language the browser prefers, unless the person chose one before. */
function firstLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved) return normalizeLang(saved)
  } catch {
    /* private window or blocked storage: just use the browser language */
  }
  return detectLang(typeof navigator === 'undefined' ? undefined : navigator.language)
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? firstLang())
  // The page language drives the right font and line breaking for each script.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem('lang', l)
    } catch {
      /* not saved, still works */
    }
  }, [])
  const value = useMemo<I18n>(() => ({ lang, setLang, t: (k, p) => translate(lang, k, p) }), [lang, setLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
