import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SPRITES } from '../src/sprites/library'
import { resolveSprites } from './sprites'

const GOOD = SPRITES.cookie.frames[0]
let dir = ''
const logs: string[] = []
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sprites-'))
  logs.length = 0
})
const deps = (generate: (s: string) => Promise<string[] | null>) => ({ dir, generate, log: (m: string) => logs.push(m) })

describe('resolveSprites (library -> saved folder -> AI -> placeholder)', () => {
  it('library sprites need nothing', async () => {
    const generate = vi.fn()
    const r = await resolveSprites(['apple', 'Child', 'dog'], deps(generate))
    expect(r).toEqual({ custom: {}, missing: [] })
    expect(generate).not.toHaveBeenCalled()
  })

  it('asks the AI once for an unknown subject, checks it, and saves it', async () => {
    const generate = vi.fn().mockResolvedValue(GOOD)
    const r = await resolveSprites(['tractor'], deps(generate))
    expect(generate).toHaveBeenCalledWith('tractor')
    expect(r.custom.tractor.frames[0]).toEqual(GOOD)
    expect(JSON.parse(await readFile(join(dir, 'tractor.json'), 'utf8')).frames[0]).toEqual(GOOD)
  })

  it('uses the saved copy next time, with no AI call', async () => {
    await resolveSprites(['tractor'], deps(vi.fn().mockResolvedValue(GOOD)))
    const generate = vi.fn()
    const r = await resolveSprites(['tractor'], deps(generate))
    expect(generate).not.toHaveBeenCalled()
    expect(r.custom.tractor).toBeDefined()
    expect(logs.join('\n')).toMatch(/from saved folder/)
  })

  it('a bad AI drawing is never shown: placeholder, and it is logged as missing', async () => {
    const r = await resolveSprites(['tractor'], deps(vi.fn().mockResolvedValue(['too', 'short'])))
    expect(r.custom).toEqual({})
    expect(r.missing).toEqual(['tractor'])
    expect(logs.join('\n')).toMatch(/MISSING/)
  })

  it('an AI failure gives a placeholder, not an error', async () => {
    const r = await resolveSprites(['bank'], deps(vi.fn().mockResolvedValue(null)))
    expect(r.missing).toEqual(['bank'])
  })

  it('ignores a corrupt saved file and draws again', async () => {
    await writeFile(join(dir, 'tractor.json'), '{"frames":[["x"]]}')
    const generate = vi.fn().mockResolvedValue(GOOD)
    const r = await resolveSprites(['tractor'], deps(generate))
    expect(generate).toHaveBeenCalledTimes(1)
    expect(r.custom.tractor).toBeDefined()
  })

  it('cannot be tricked into writing outside the folder', async () => {
    const generate = vi.fn().mockResolvedValue(GOOD)
    const r = await resolveSprites(['../../evil'], deps(generate))
    expect(Object.keys(r.custom)).toEqual(['evil'])
    expect(await readFile(join(dir, 'evil.json'), 'utf8')).toBeTruthy()
  })
})
