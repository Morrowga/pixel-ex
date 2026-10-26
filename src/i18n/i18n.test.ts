import { describe, expect, it } from 'vitest'
import { LANGS, detectLang, normalizeDigits, normalizeLang, visualLength } from './lang'
import { ALL_KEYS, t } from './messages'

describe('language codes', () => {
  it('accepts the codes people use, including mm for Myanmar', () => {
    expect(normalizeLang('mm')).toBe('my')
    expect(normalizeLang('my-MM')).toBe('my')
    expect(normalizeLang('MY')).toBe('my')
    expect(normalizeLang('ja-JP')).toBe('ja')
    expect(normalizeLang('en-US')).toBe('en')
    expect(normalizeLang('fr')).toBe('en')
    expect(normalizeLang(undefined)).toBe('en')
    expect(normalizeLang(42)).toBe('en')
    expect(detectLang('ja')).toBe('ja')
  })
})

describe('translations', () => {
  it('every sentence exists in every language and is not empty', () => {
    for (const lang of LANGS) for (const key of ALL_KEYS) expect(t(lang, key).trim().length, `${lang} ${key}`).toBeGreaterThan(0)
  })
  it('every translation keeps the same {placeholders} as English', () => {
    const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const lang of LANGS) for (const key of ALL_KEYS) expect(slots(t(lang, key)), `${lang} ${key}`).toBe(slots(t('en', key)))
  })
  it('the other languages are really translated, not copies of English', () => {
    for (const lang of ['ja', 'my'] as const) {
      const same = ALL_KEYS.filter((k) => t(lang, k) === t('en', k))
      expect(same, `${lang} left in English`).toEqual([])
    }
  })
  it('Japanese uses Japanese script and Burmese uses Burmese script', () => {
    const jaText = ALL_KEYS.map((k) => t('ja', k)).join('')
    const myText = ALL_KEYS.map((k) => t('my', k)).join('')
    expect(/[぀-ヿ]/.test(jaText)).toBe(true)
    expect(/[က-႟]/.test(myText)).toBe(true)
    expect(/[က-႟]/.test(jaText)).toBe(false)
  })
  it('fills in placeholders, and never leaves a literal one behind', () => {
    expect(t('en', 'loading.drawing', { thing: 'tractor' })).toBe('Drawing a picture of tractor')
    expect(t('ja', 'loading.drawing', { thing: 'トラクター' })).toBe('トラクターの絵をかいています')
    expect(t('my', 'controls.step', { n: 2, total: 5 })).toBe('အဆင့် 2 / 5')
    expect(t('en', 'fb.solve', { v: 'x' })).not.toMatch(/\{/)
  })
})

describe('digits typed in other scripts', () => {
  it('Japanese full-width and Burmese digits become plain digits', () => {
    expect(normalizeDigits('１２')).toBe('12')
    expect(normalizeDigits('၁၂၃')).toBe('123')
    expect(normalizeDigits('３．５')).toBe('3.5')
    expect(normalizeDigits('５／６')).toBe('5/6')
    expect(normalizeDigits('－３')).toBe('-3')
    expect(normalizeDigits('x＋３＝１０')).toBe('x+3=10')
    expect(normalizeDigits('３ｘ＾２')).toBe('3ｘ^2')
    expect(normalizeDigits('plain 42')).toBe('plain 42')
  })
})

describe('how wide text looks', () => {
  it('Japanese is about twice as wide as English per character', () => {
    expect(visualLength('abcd')).toBe(4)
    expect(visualLength('こんにちは')).toBeCloseTo(9.5, 5)
  })
  it('Burmese marks add little width', () => {
    const word = 'မြန်မာ'
    expect(visualLength(word)).toBeGreaterThan(3)
    expect(visualLength(word)).toBeLessThan(word.length * 1.2 + 0.01)
  })
  it('empty is zero', () => expect(visualLength('')).toBe(0))
})
