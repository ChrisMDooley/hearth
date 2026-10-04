import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { uid } from '../domain/parse'
import { Icon } from './Icon'

/**
 * Kitchen timers. Several can run at once; they survive navigation (they live
 * above the router) and are shown in a tray above the bottom bar.
 * Timers are based on wall-clock end times, so a locked phone doesn't drift.
 */

export interface Timer {
  id: string
  label: string
  recipeTitle?: string
  seconds: number
  endsAt: number
  done: boolean
}

interface TimerApi {
  timers: Timer[]
  start(label: string, seconds: number, recipeTitle?: string): void
  stop(id: string): void
  addMinute(id: string): void
}

const Ctx = createContext<TimerApi | null>(null)
export const useTimers = () => useContext(Ctx)!

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([])
  const [, tick] = useState(0)

  useEffect(() => {
    if (!timers.some((t) => !t.done)) return
    const h = setInterval(() => {
      const now = Date.now()
      setTimers((ts) => {
        let changed = false
        const next = ts.map((t) => {
          if (!t.done && t.endsAt <= now) {
            changed = true
            alarm()
            return { ...t, done: true }
          }
          return t
        })
        return changed ? next : ts
      })
      tick((x) => x + 1)
    }, 250)
    return () => clearInterval(h)
  }, [timers])

  const start = useCallback((label: string, seconds: number, recipeTitle?: string) => {
    unlockAudio()
    setTimers((ts) => [...ts, { id: uid('t_'), label, recipeTitle, seconds, endsAt: Date.now() + seconds * 1000, done: false }])
  }, [])
  const stop = useCallback((id: string) => setTimers((ts) => ts.filter((t) => t.id !== id)), [])
  const addMinute = useCallback(
    (id: string) =>
      setTimers((ts) => ts.map((t) => (t.id === id ? { ...t, done: false, endsAt: Math.max(t.endsAt, Date.now()) + 60000 } : t))),
    [],
  )

  const api = useMemo(() => ({ timers, start, stop, addMinute }), [timers, start, stop, addMinute])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function remaining(t: Timer) {
  return Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000))
}

export function clock(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function TimerTray() {
  const { timers, stop, addMinute } = useTimers()
  if (!timers.length) return null
  return (
    <div className="timer-tray" role="region" aria-label="Timers">
      {timers.map((t) => (
        <div key={t.id} className={`timer-chip ${t.done ? 'is-done' : ''}`} role={t.done ? 'alert' : undefined}>
          <Icon name="timer" />
          <div className="timer-chip__text">
            <span className="timer-chip__time">{t.done ? 'Done!' : clock(remaining(t))}</span>
            <span className="timer-chip__label">{t.recipeTitle ? `${t.recipeTitle} · ` : ''}{t.label}</span>
          </div>
          <button className="icon-btn icon-btn--sm" onClick={() => addMinute(t.id)} aria-label="Add one minute">+1</button>
          <button className="icon-btn icon-btn--sm" onClick={() => stop(t.id)} aria-label={t.done ? 'Dismiss timer' : 'Cancel timer'}>
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ---- sound + vibration ----
let ctx: AudioContext | null = null
function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio */
  }
}
function alarm() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 600])
  } catch {
    /* ignore */
  }
  if (!ctx) return
  const t0 = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, t0 + i * 0.5)
    g.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.5 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.35)
    o.connect(g).connect(ctx.destination)
    o.start(t0 + i * 0.5)
    o.stop(t0 + i * 0.5 + 0.4)
  }
}
