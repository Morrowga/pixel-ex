import { useCallback, useEffect, useReducer } from 'react'
import type { Step } from './engine/types'

interface State {
  index: number
  playing: boolean
  /** Bumps on replay and on jumping back, so the stage restarts from a clean slate. */
  run: number
}

type Action =
  | { type: 'advance' }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'toggle' }
  | { type: 'goto'; index: number }

export function makeReducer(steps: Step[]) {
  const last = steps.length - 1
  return (s: State, a: Action): State => {
    switch (a.type) {
      case 'advance': {
        const index = Math.min(s.index + 1, last)
        // Plays straight through every step. It stops only on the question (the last step).
        return { ...s, index, playing: index < last }
      }
      case 'next':
        return { ...s, index: Math.min(s.index + 1, last), playing: false }
      case 'back':
        return { ...s, index: Math.max(s.index - 1, 0), playing: false }
      case 'goto':
        return { index: a.index, playing: a.index < last, run: a.index < s.index ? s.run + 1 : s.run }
      case 'toggle':
        if (s.index === last) return { index: 0, playing: true, run: s.run + 1 } // replay
        return { ...s, playing: !s.playing }
    }
  }
}

export function usePlayer(steps: Step[]) {
  const [state, dispatch] = useReducer(makeReducer(steps), { index: 0, playing: true, run: 0 })
  const step = steps[state.index]

  useEffect(() => {
    if (!state.playing || step.ask) return
    const t = setTimeout(() => dispatch({ type: 'advance' }), step.durationMs)
    return () => clearTimeout(t)
  }, [state.index, state.playing, step])

  return {
    step,
    index: state.index,
    run: state.run,
    total: steps.length,
    playing: state.playing,
    atStart: state.index === 0,
    atEnd: state.index === steps.length - 1,
    next: useCallback(() => dispatch({ type: 'next' }), []),
    back: useCallback(() => dispatch({ type: 'back' }), []),
    toggle: useCallback(() => dispatch({ type: 'toggle' }), []),
    goto: useCallback((index: number) => dispatch({ type: 'goto', index }), []),
  }
}
