import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const px = (re: RegExp) => {
  const m = css.match(re)
  if (!m) throw new Error(`not found in styles.css: ${re}`)
  return Number(m[1])
}

describe('the answer zone is tall enough that feedback is never cut off', () => {
  // one line of feedback text: 0.92rem at 16px, line-height 1.5; padding 6px top and bottom
  const LINE = 0.92 * 16 * 1.5
  const TWO_LINES = 2 * LINE + 12
  const slot = px(/\.feedback-slot \{[^}]*min-height: (\d+)px/)
  const gap = 6
  const pill = 52 // the answer input
  const optionsRow = 62 // one row of options, allowing two lines of text in each

  it('the feedback slot holds two lines of text', () => {
    expect(slot).toBeGreaterThanOrEqual(Math.ceil(TWO_LINES))
  })
  it('a typed answer: input + gap + two lines of feedback fit', () => {
    expect(px(/\.answer-zone\.input \{ height: (\d+)px/)).toBeGreaterThanOrEqual(pill + gap + slot)
  })
  it('three options in a row: the row + gap + two lines of feedback fit', () => {
    expect(px(/\.answer-zone\.choice-few \{ height: (\d+)px/)).toBeGreaterThanOrEqual(optionsRow + gap + slot)
  })
  it('four or five options (two rows): both rows + gap + two lines of feedback fit', () => {
    expect(px(/\.answer-zone\.choice-many \{ height: (\d+)px/)).toBeGreaterThanOrEqual(2 * optionsRow + 8 + gap + slot)
  })
  it('the zone never clips what spills out of it, and sits above the picture', () => {
    const zone = css.match(/\.answer-zone \{([^}]*)\}/)![1]
    expect(zone).toContain('overflow: visible')
    expect(zone).not.toContain('overflow: hidden')
    expect(zone).toMatch(/z-index: \d/)
  })
  it('the feedback slot does not clip either', () => {
    expect(css.match(/\.feedback-slot \{([^}]*)\}/)![1]).not.toContain('overflow: hidden')
  })
})
