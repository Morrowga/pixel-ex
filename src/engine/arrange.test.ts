import { describe, expect, it } from 'vitest'
import { arrange, overlaps, spritePx, STAGE_H, STAGE_W, type ArrangeInput } from './arrange'

const a = (id: string, x: number, y: number, label = '', say = ''): ArrangeInput => ({ id, x, y, label, say })

describe('actor spacing', () => {
  it('actors the AI put on the same spot are pulled apart', () => {
    const actors = [a('a', 50, 50), a('b', 50, 50), a('c', 50, 50)]
    expect(overlaps(actors, arrange(actors))).toEqual([])
  })

  it('labels and speech bubbles never cover each other', () => {
    const actors = [
      a('child', 20, 60, 'child', 'Dog!'),
      a('dog1', 30, 60, 'dog', 'woof woof'),
      a('pc', 40, 58, 'AI computer', 'I learn from examples'),
      a('dog2', 45, 62, 'another dog'),
    ]
    expect(overlaps(actors, arrange(actors))).toEqual([])
  })

  it('stays inside the stage, even for actors at the very edge', () => {
    const actors = [a('l', 0, 0, 'far left top', 'hello there'), a('r', 100, 100, 'far right bottom')]
    const p = arrange(actors)
    for (const k of Object.keys(p)) {
      expect(p[k].x).toBeGreaterThan(0)
      expect(p[k].x).toBeLessThan(STAGE_W)
      expect(p[k].y).toBeGreaterThan(0)
      expect(p[k].y).toBeLessThan(STAGE_H)
    }
    expect(overlaps(actors, p)).toEqual([])
  })

  it('a crowded scene of 6 actors still has no overlaps', () => {
    const actors = Array.from({ length: 6 }, (_, i) => a(`n${i}`, 40 + (i % 3) * 8, 40 + (i % 2) * 8, `thing ${i}`))
    expect(overlaps(actors, arrange(actors))).toEqual([])
  })

  it('keeps well-spaced actors where the AI put them, and keeps left on the left', () => {
    const actors = [a('l', 15, 50), a('r', 85, 50)]
    const p = arrange(actors)
    expect(p.l.x).toBeLessThan(p.r.x)
    expect(Math.abs(p.l.y - p.r.y)).toBeLessThan(1)
  })

  it('the AI put everything low: the group is moved to the middle of the stage', () => {
    // the screenshot: three actors all near the bottom
    const actors = [a('teacher', 15, 78, 'teacher'), a('picture', 50, 68, 'picture'), a('helpers', 88, 82, 'many helpers', 'Together!')]
    const px = 112
    const p = arrange(actors, px, 640, 320, [])
    const top = Math.min(...actors.map((x) => p[x.id].y - px / 2 - (x.say ? 44 : 0)))
    const bottom = Math.max(...actors.map((x) => p[x.id].y + px / 2 + (x.label ? 26 : 0)))
    // the space above the group and below it is about the same
    expect(Math.abs(top - (320 - bottom))).toBeLessThan(14)
    expect(overlaps(actors, p, px)).toEqual([])
  })

  it('a small group is spread out to use the stage, but never past the edges', () => {
    const actors = [a('l', 45, 50), a('r', 55, 50)]
    const p = arrange(actors, 96, 640, 320, [])
    expect(p.r.x - p.l.x).toBeGreaterThan(150)
    expect(p.l.x - 48).toBeGreaterThanOrEqual(6)
    expect(p.r.x + 48).toBeLessThanOrEqual(634)
  })

  it('is deterministic, so a step never jitters', () => {
    const actors = [a('a', 50, 50, 'x'), a('b', 52, 50, 'y')]
    expect(arrange(actors)).toEqual(arrange(actors))
  })

  it('makes sprites bigger when there are few actors', () => {
    expect(spritePx(1)).toBeGreaterThan(spritePx(4))
    expect(spritePx(4)).toBeGreaterThan(spritePx(8))
  })

  it('stress test: 500 random crowded scenes within the allowed limits never overlap and never leave the stage', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
    for (let t = 0; t < 500; t++) {
      const n = 1 + Math.floor(rnd() * 6)
      const actors = Array.from({ length: n }, (_, i) =>
        a(`k${i}`, rnd() * 100, rnd() * 100, rnd() < 0.7 ? 'x'.repeat(1 + Math.floor(rnd() * 14)) : '', ''),
      )
      // at most 2 speech bubbles per scene, up to 20 characters
      for (let k = 0; k < Math.min(2, n); k++) if (rnd() < 0.8) actors[k].say = 'y'.repeat(1 + Math.floor(rnd() * 20))
      const p = arrange(actors)
      expect(overlaps(actors, p), JSON.stringify(actors)).toEqual([])
      for (const k of Object.keys(p)) {
        expect(p[k].x).toBeGreaterThanOrEqual(0)
        expect(p[k].x).toBeLessThanOrEqual(STAGE_W)
        expect(p[k].y).toBeGreaterThanOrEqual(0)
        expect(p[k].y).toBeLessThanOrEqual(STAGE_H)
      }
    }
  })
})
