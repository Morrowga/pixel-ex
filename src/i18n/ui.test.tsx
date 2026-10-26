import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Controls } from '../components/Controls'
import { LoadingScreen } from '../screens/LoadingScreen'
import { AskScreen } from '../screens/AskScreen'
import { I18nProvider } from './I18n'
import { t } from './messages'
import type { Lang } from './lang'

const withLang = (lang: Lang, node: React.ReactNode) => renderToString(<I18nProvider initial={lang}>{node}</I18nProvider>)
const ask = (lang: Lang) => withLang(lang, <AskScreen notice={null} choices={[]} onAsk={() => {}} />)
// React escapes some characters in attributes; compare against the same escaping.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

describe('the interface speaks the chosen language', () => {
  it.each(['en', 'ja', 'my'] as const)('ask screen in %s: placeholder and labels are translated', (lang) => {
    const html = ask(lang)
    expect(html).toContain(esc(t(lang, 'ask.placeholder')))
    expect(html).toContain(esc(t(lang, 'ask.yourQuestion')))
    expect(html).toContain(esc(t(lang, 'ask.explain')))
  })

  it('the three language buttons are always shown in their own language, and the current one is marked', () => {
    for (const lang of ['en', 'ja', 'my'] as const) {
      const html = ask(lang)
      expect(html).toContain('English')
      expect(html).toContain('日本語')
      expect(html).toContain('မြန်မာ')
      expect(html).toMatch(new RegExp(`lang="${lang}"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*lang="${lang}"`))
    }
  })

  /** Only what a person reads: the visible text, and the labels read out by screen readers. */
  const readable = (html: string) => {
    const withoutSwitch = html.replace(/<div class="langs".*?<\/div>/s, '')
    const attrs = [...withoutSwitch.matchAll(/(?:aria-label|placeholder|title)="([^"]*)"/g)].map((m) => m[1])
    const text = withoutSwitch.replace(/<[^>]*>/g, ' ')
    return [text, ...attrs].join(' ')
  }
  it('a page in one language has no text from another (outside the language buttons)', () => {
    expect(readable(ask('en'))).not.toMatch(/[\u3040-\u30ff\u1000-\u109f]/)
    expect(readable(ask('ja'))).not.toMatch(/[A-Za-z]{3,}/)
    expect(readable(ask('my'))).not.toMatch(/[A-Za-z]{3,}/)
    expect(readable(ask('ja'))).toMatch(/[\u3040-\u30ff]/)
    expect(readable(ask('my'))).toMatch(/[\u1000-\u109f]/)
  })

  it.each(['en', 'ja', 'my'] as const)('loading screen in %s shows the translated stage and the translated thing being drawn', (lang) => {
    const html = withLang(lang, <LoadingScreen stage={{ stage: 'drawing', detail: 'tractor' }} />)
    expect(html).toContain(esc(t(lang, 'loading.drawing', { thing: 'tractor' })))
  })

  it.each(['en', 'ja', 'my'] as const)('playback controls in %s have translated labels', (lang) => {
    const html = withLang(lang, <Controls index={1} total={5} playing={false} atStart={false} atEnd={false} onBack={() => {}} onNext={() => {}} onToggle={() => {}} />)
    expect(html).toContain(esc(t(lang, 'controls.back')))
    expect(html).toContain(esc(t(lang, 'controls.next')))
    expect(html).toContain(esc(t(lang, 'controls.play')))
    expect(html).toContain(esc(t(lang, 'controls.step', { n: 2, total: 5 })))
  })
})

describe('the runner greeting above the question box', () => {
  it.each(['en', 'ja', 'my'] as const)('shows the greeting in %s, next to a drawn runner', (lang) => {
    const html = ask(lang)
    expect(html).toContain(esc(t(lang, 'ask.greeting')))
    expect(html).toContain('class="runner"')
    // he is drawn from many small squares (a sprite), not an image or an emoji
    const runner = html.slice(html.indexOf('class="runner"'), html.indexOf('</svg>', html.indexOf('class="runner"')))
    expect((runner.match(/<rect/g) ?? []).length).toBeGreaterThan(30)
  })
  it('the greeting sits above the question box', () => {
    const html = ask('en')
    expect(html.indexOf('class="greeting"')).toBeGreaterThan(-1)
    expect(html.indexOf('class="greeting"')).toBeLessThan(html.indexOf('class="ask"'))
  })
  it('the runner is decoration: hidden from screen readers', () => {
    expect(ask('en')).toMatch(/<svg class="runner"[^>]*aria-hidden="true"/)
  })
  it('the greeting says what the app asks for, in each language', () => {
    expect(t('en', 'ask.greeting')).toMatch(/question/i)
    expect(t('ja', 'ask.greeting')).toContain('質問')
    expect(t('my', 'ask.greeting')).toMatch(/[က-႟]/)
  })
})
