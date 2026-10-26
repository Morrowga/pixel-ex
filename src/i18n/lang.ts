export const LANGS = ['en', 'ja', 'my'] as const
export type Lang = (typeof LANGS)[number]

/** Each language's name in itself, for the switch. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', ja: '日本語', my: 'မြန်မာ' }

/** How the AI is told which language to write. */
export const LANG_FOR_PROMPT: Record<Lang, string> = {
  en: 'English',
  ja: 'Japanese',
  my: 'Burmese (Myanmar language)',
}

/** Accepts "ja", "ja-JP", "my", "my-MM", and the country-style code "mm". Anything else is English. */
export function normalizeLang(input: unknown): Lang {
  const s = typeof input === 'string' ? input.trim().toLowerCase() : ''
  if (s === 'mm' || s.startsWith('my') || s.startsWith('bur')) return 'my'
  if (s.startsWith('ja')) return 'ja'
  return 'en'
}

export const detectLang = (browser?: string): Lang => normalizeLang(browser)

const FULL_WIDTH: Record<string, string> = { '．': '.', '，': ',', '／': '/', '－': '-', '−': '-', '＋': '+', '＝': '=', '＊': '*', '＾': '^', '（': '(', '）': ')', '　': ' ', '、': ',', 'ー': '-' }

/**
 * Turns the digits and signs people type in other scripts into plain ones, so "１２", "၁၂" and "12" are the
 * same answer. Japanese full-width digits and Burmese digits are both handled.
 */
export function normalizeDigits(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c >= 0xff10 && c <= 0xff19) out += String(c - 0xff10) // full-width 0-9
    else if (c >= 0x1040 && c <= 0x1049) out += String(c - 0x1040) // Burmese 0-9
    else out += FULL_WIDTH[ch] ?? ch
  }
  return out
}

/**
 * How wide a piece of text looks, in "English letters". Japanese characters are about twice as wide as
 * English letters. Burmese letters are a little wider, and the marks that sit above or below them add little.
 * Used for layout and for the length limits, so they work in every language.
 */
export function visualLength(s: string): number {
  let n = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c >= 0x1000 && c <= 0x109f) {
      // Burmese: base letters are wide, vowel signs and marks are narrow
      const mark = (c >= 0x102b && c <= 0x103e) || (c >= 0x1056 && c <= 0x1059) || c === 0x1031
      n += mark ? 0.45 : 1.2
    } else if (
      (c >= 0x3040 && c <= 0x30ff) || // hiragana, katakana
      (c >= 0x3400 && c <= 0x9fff) || // kanji
      (c >= 0xff00 && c <= 0xffef) || // full-width forms
      (c >= 0x3000 && c <= 0x303f) // Japanese punctuation
    ) n += 1.9
    else n += 1
  }
  return n
}
