import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { arrange, overlaps } from '../engine/arrange'
import { FitStage, STAGE_HEIGHT, stageWidth } from './FitStage'

describe('stage width follows the window', () => {
  it('a wide, short window gets a wide stage, so pictures use the whole screen', () => {
    // the screenshot: about 2000 x 600 of free space
    expect(stageWidth(2000, 600)).toBe(Math.round((STAGE_HEIGHT * 2000) / 600))
    expect(stageWidth(2000, 600)).toBeGreaterThan(1000)
  })
  it('never narrower than the minimum, never wider than the maximum', () => {
    expect(stageWidth(500, 900)).toBe(640)
    expect(stageWidth(500, 900, 560)).toBe(560)
    expect(stageWidth(6000, 400)).toBe(1400)
  })
  it('falls back to the minimum before the size is known', () => {
    expect(stageWidth(0, 0)).toBe(640)
    expect(stageWidth(NaN, 300, 560)).toBe(560)
  })
  it('the SVG uses exactly that shape, so it fills the box', () => {
    const html = renderToString(<FitStage label="x" minW={560}>{(W) => <text>{W}</text>}</FitStage>)
    expect(html).toContain('viewBox="0 0 560 320"')
  })
})

describe('on a wide stage, actors spread out and arrows get room', () => {
  const a = (id: string, x: number, label = ''): { id: string; x: number; y: number; label: string; say: string } => ({ id, x, y: 55, label, say: '' })
  it('the same three actors sit further apart on a wide stage than on a narrow one', () => {
    const actors = [a('l', 15, 'CPU'), a('m', 50, 'program'), a('r', 85, 'result')]
    const arrows = [{ from: 'm', to: 'l', label: 'instructions' }, { from: 'l', to: 'r', label: 'work' }]
    const narrow = arrange(actors, 112, 560, 320, arrows)
    const wide = arrange(actors, 112, 1067, 320, arrows)
    expect(wide.r.x - wide.l.x).toBeGreaterThan(narrow.r.x - narrow.l.x + 200)
    expect(overlaps(actors, wide, 112)).toEqual([])
    // the arrow label has a big gap to sit in
    expect(Math.abs(wide.m.x - wide.l.x) - 112).toBeGreaterThan('instructions'.length * 9 + 60)
  })
})
