import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_MODEL, WANTED_MODEL, resetModelBlock, withModel } from './llm'

const accessError = (model: string) => Object.assign(new Error(`403 Project \`proj_x\` does not have access to model \`${model}\``), { status: 403 })

describe('model with a safe fallback', () => {
  let logs: string[]
  let spy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    delete process.env.LLM_MODEL
    delete process.env.LLM_FALLBACK_MODEL
    resetModelBlock()
    logs = []
    spy = vi.spyOn(console, 'log').mockImplementation((m: string) => void logs.push(String(m)))
  })
  afterEach(() => spy.mockRestore())

  it('wants gpt-6-luna and falls back to gpt-5.6-luna', () => {
    expect(WANTED_MODEL).toBe('gpt-6-luna')
    expect(FALLBACK_MODEL).toBe('gpt-5.6-luna')
  })

  it('uses the wanted model when the project is allowed to', async () => {
    const run = vi.fn(async (m: string) => m)
    expect(await withModel(run)).toBe('gpt-6-luna')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('when the project has no access, says so and uses the fallback', async () => {
    const run = vi.fn(async (m: string) => {
      if (m === 'gpt-6-luna') throw accessError(m)
      return m
    })
    expect(await withModel(run)).toBe('gpt-5.6-luna')
    expect(run.mock.calls.map((c) => c[0])).toEqual(['gpt-6-luna', 'gpt-5.6-luna'])
    expect(logs.join('\n')).toMatch(/"gpt-6-luna" is not available to this API project \(403\)\. Using "gpt-5\.6-luna"/)
  })

  it('then stops trying the wanted model for a while, so later questions are not slowed down', async () => {
    const run = vi.fn(async (m: string) => {
      if (m === 'gpt-6-luna') throw accessError(m)
      return m
    })
    await withModel(run)
    run.mockClear()
    expect(await withModel(run)).toBe('gpt-5.6-luna')
    expect(run.mock.calls.map((c) => c[0])).toEqual(['gpt-5.6-luna'])
    expect(logs.filter((l) => l.includes('not available'))).toHaveLength(1)
  })

  it('other errors are NOT hidden by the fallback', async () => {
    const boom = Object.assign(new Error('500 server error'), { status: 500 })
    await expect(withModel(async () => { throw boom })).rejects.toBe(boom)
    const rate = Object.assign(new Error('429 rate limit'), { status: 429 })
    await expect(withModel(async () => { throw rate })).rejects.toBe(rate)
    // a 403 that is not about the model (for example a bad key) is also passed on
    const key = Object.assign(new Error('403 Incorrect API key'), { status: 403 })
    await expect(withModel(async () => { throw key })).rejects.toBe(key)
  })

  it('LLM_MODEL in .env still overrides the model', async () => {
    process.env.LLM_MODEL = 'gpt-5.6-sol'
    const run = vi.fn(async (m: string) => m)
    expect(await withModel(run)).toBe('gpt-5.6-sol')
  })

  it('if even the fallback fails, the error is shown', async () => {
    const err = accessError('gpt-5.6-luna')
    await expect(withModel(async () => { throw err })).rejects.toBe(err)
  })
})
