import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { BakeForm } from '../ui/BakeSheet'
import { Sheet } from '../ui/components'
import { Icon } from '../ui/Icon'
import { IngredientList, StepText, StepTimers, useRecipeView } from '../ui/recipeParts'
import { TimerTray } from '../ui/timers'

/**
 * Baking mode: one step at a time, huge text, screen kept awake.
 * Swipe or use the big buttons to move between steps.
 */
export function CookMode() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const r = s.recipe(id)
  const view = useRecipeView(id)
  const [showIng, setShowIng] = useState(false)
  const [logging, setLogging] = useState(false)
  const awake = useWakeLock()
  const touch = useRef<number | null>(null)

  if (!r) return <p className="page">Recipe not found.</p>
  const steps = r.steps
  const i = Math.min(view.step, Math.max(0, steps.length - 1))
  const step = steps[i]
  const last = i === steps.length - 1
  const go = (n: number) => view.update({ step: Math.max(0, Math.min(steps.length - 1, n)) })

  return (
    <div
      className="cook"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1))
        touch.current = null
      }}
    >
      <header className="cook__top">
        <Link to={`/recipe/${r.id}`} className="icon-btn" aria-label="Leave baking mode">
          <Icon name="close" />
        </Link>
        <div className="cook__title">
          <strong>{r.title}</strong>
          <span>
            Step {i + 1} of {steps.length}
            {awake && ' · screen stays on'}
          </span>
        </div>
        <button className="btn btn--pill" onClick={() => setShowIng(true)}>
          Ingredients
        </button>
      </header>

      <div className="cook__progress" aria-hidden="true">
        {steps.map((st, k) => (
          <span key={st.id} className={k <= i ? 'is-on' : ''} />
        ))}
      </div>

      <main className="cook__stage" aria-live="polite">
        {step ? (
          <>
            <p className="cook__num">{i + 1}</p>
            <p className="cook__text">
              <StepText step={step} system={s.user.unitSystem} />
            </p>
            <StepTimers step={step} recipeTitle={r.title} big />
          </>
        ) : (
          <p className="cook__text">This recipe has no steps yet.</p>
        )}
      </main>

      <TimerTray />

      <footer className="cook__nav">
        <button className="btn btn--big btn--ghost" onClick={() => go(i - 1)} disabled={i === 0}>
          <Icon name="back" /> Back
        </button>
        {last ? (
          <button className="btn btn--big btn--primary" onClick={() => setLogging(true)}>
            <Icon name="check" /> Done
          </button>
        ) : (
          <button className="btn btn--big btn--primary" onClick={() => go(i + 1)}>
            Next <Icon name="next" />
          </button>
        )}
      </footer>

      <Sheet open={showIng} onClose={() => setShowIng(false)} title="Ingredients">
        <IngredientList recipe={r} scale={view.scale} system={s.user.unitSystem} showOriginal={s.user.showOriginal} checked={view.checked} toggle={view.toggle} big />
        {view.scale !== 1 && <p className="fineprint">Scaled ×{view.scale}</p>}
      </Sheet>
      <Sheet open={logging} onClose={() => setLogging(false)} title="How did it go?">
        <BakeForm
          recipeId={r.id}
          scale={view.scale}
          onDone={() => {
            setLogging(false)
            view.update({ step: 0, checked: new Set() })
            nav(`/recipe/${r.id}#bakes`)
          }}
        />
      </Sheet>
    </div>
  )
}

/** Screen Wake Lock API (Chrome/Android, Safari 16.4+). Silently no-ops elsewhere. */
function useWakeLock() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let alive = true
    const req = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null
        if (alive) setOn(!!lock)
        lock?.addEventListener('release', () => alive && setOn(false))
      } catch {
        if (alive) setOn(false)
      }
    }
    const onVis = () => document.visibilityState === 'visible' && req()
    req()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => {})
    }
  }, [])
  return on
}
