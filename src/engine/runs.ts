import { planReveal } from './reveal'
import type { SceneActor, SceneArrow, Step } from './types'

const longer = (a: string, b: string) => (b.length > a.length ? b : a)

/**
 * Groups consecutive scene steps into runs and gives every step of a run the same payload: all the pictures
 * and arrows that appear anywhere in the run. The browser lays the run out ONCE, so a picture never moves
 * when the next one appears. Also gives each step enough time to play its reveal.
 */
export function attachRuns(steps: Step[]): void {
  interface Run {
    actors: Map<string, SceneActor>
    arrows: Map<string, SceneArrow>
    members: Step[]
  }
  const runs: Run[] = []
  let run: Run | null = null

  for (const st of steps) {
    const v = st.visual
    if (v?.kind !== 'scene') {
      run = null
      continue
    }
    if (!run) {
      run = { actors: new Map(), arrows: new Map(), members: [] }
      runs.push(run)
    }
    run.members.push(st)
    for (const a of v.actors) {
      const have = run.actors.get(a.id)
      // First appearance decides the place. Later steps only widen the room kept for its text.
      if (!have) run.actors.set(a.id, { ...a })
      else run.actors.set(a.id, { ...have, label: longer(have.label, a.label), say: longer(have.say, a.say) })
    }
    for (const r of v.arrows) {
      const k = `${r.from}>${r.to}`
      const have = run.arrows.get(k)
      run.arrows.set(k, have ? { ...have, label: longer(have.label, r.label) } : { ...r })
    }
  }

  runs.forEach((r, i) => {
    const payload = { id: `run-${i}`, actors: [...r.actors.values()], arrows: [...r.arrows.values()] }
    for (const st of r.members) if (st.visual?.kind === 'scene') st.visual.run = payload
  })

  // Time: long enough to read the line AND to play the picture, arrow, picture story.
  steps.forEach((st, i) => {
    const v = st.visual
    if (v?.kind !== 'scene' || st.ask) return
    const before = steps[i - 1]?.visual
    const reveal = planReveal(before?.kind === 'scene' ? before : null, v)
    st.durationMs = Math.max(st.durationMs, Math.round((reveal.total + 1.8) * 1000))
  })
}
