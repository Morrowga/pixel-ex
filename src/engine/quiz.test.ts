import { describe, expect, it } from 'vitest'
import { overlap, quizProblems } from './quiz'
import { EXAMPLES, verify } from './examples'

const choice = (options: string[], correct = 0) => verify({ kind: 'choice', options, correct, why_wrong: options.map((_, i) => (i === correct ? '' : 'no')) })

describe('a quiz must not contain its own answer', () => {
  const question = 'What are the tiny building pieces inside an apple?'

  it('the screenshot: the right option just repeats the question', () => {
    const bad = choice(['Tiny building pieces inside the apple', 'Seeds growing outside the apple', 'Light shining on the apple'])
    expect(overlap('Tiny building pieces inside the apple', question)).toBeGreaterThan(0.8)
    const p = quizProblems(bad, question)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/gives away its own answer/)
    expect(p[0]).toMatch(/APPLY the idea to a NEW situation/)
  })

  it('a real answer that says something new passes', () => {
    const good = choice(['Atoms, which are far too small to see', 'Seeds growing outside the apple', 'Light shining on the apple'])
    expect(quizProblems(good, question)).toEqual([])
  })

  it('it is the RIGHT option that matters, not the wrong ones', () => {
    const wrongRepeats = choice(['Atoms, which are far too small to see', 'Tiny building pieces inside the apple', 'Light shining on the apple'])
    expect(quizProblems(wrongRepeats, question)).toEqual([])
  })

  it('works on whichever option is the right one', () => {
    const bad = choice(['Light shining on the apple', 'Seeds growing outside the apple', 'Tiny building pieces inside the apple'], 2)
    expect(quizProblems(bad, question)).toHaveLength(1)
  })

  it('works in Japanese and Burmese too', () => {
    const ja = choice(['りんごの中にある小さな部品', '木の外にある種', 'りんごに当たる光'])
    expect(quizProblems(ja, 'りんごの中にある小さな部品は何ですか？')).toHaveLength(1)
    expect(quizProblems(choice(['原子という、目に見えないほど小さなつぶ', '木の外にある種', 'りんごに当たる光']), 'りんごの中にある小さな部品は何ですか？')).toEqual([])
    const my = choice(['ပန်းသီးထဲက သေးငယ်တဲ့ တည်ဆောက်ပုံအပိုင်းအစ', 'အပင်အပြင်က အစေ့', 'ပန်းသီးပေါ် ကျတဲ့ အလင်း'])
    expect(quizProblems(my, 'ပန်းသီးထဲက သေးငယ်တဲ့ တည်ဆောက်ပုံအပိုင်းအစ ဘာလဲ')).toHaveLength(1)
  })

  it('very short options (Yes, 12) are not judged, and other kinds of questions are ignored', () => {
    expect(quizProblems(choice(['Yes', 'No', 'Maybe']), 'Is the sky blue?')).toEqual([])
    expect(quizProblems(verify({ kind: 'none' }), question)).toEqual([])
    expect(quizProblems(verify({ kind: 'solve', expr: 'x+1=2', variable: 'x' }), question)).toEqual([])
  })

  it('none of my own worked examples trips the rule (so the AI is never taught a bad quiz)', () => {
    for (const [q, p] of EXAMPLES) {
      if (p.verify.kind !== 'choice') continue
      const ask = p.chunks.flatMap((c) => c.blocks).find((b) => b.type === 'ask')!.caption.replace(/\*\*/g, '')
      expect(quizProblems(p.verify, ask), q).toEqual([])
    }
  })
})
