import { useCallback, useSyncExternalStore } from 'react'
import { ingredientById } from '../domain/ingredients'
import { findTimers } from '../domain/parse'
import type { Instruction, Recipe, RecipeIngredient, UnitSystem } from '../domain/types'
import { convertTempsInText, displayIngredient } from '../domain/units'
import { Icon } from './Icon'
import { useTimers } from './timers'

/**
 * Per-recipe view state shared by the recipe page and baking mode during a
 * session: scale factor and ticked ingredients/steps. Kept in memory so it
 * survives switching between the two screens.
 */
interface ViewState {
  scale: number
  checked: Set<string>
  step: number
}
const views = new Map<string, ViewState>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function get(id: string): ViewState {
  let v = views.get(id)
  if (!v) views.set(id, (v = { scale: 1, checked: new Set(), step: 0 }))
  return v
}

export function useRecipeView(id: string) {
  const v = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => get(id),
  )
  const update = useCallback(
    (patch: Partial<ViewState>) => {
      views.set(id, { ...get(id), ...patch })
      emit()
    },
    [id],
  )
  const toggle = useCallback(
    (key: string) => {
      const c = new Set(get(id).checked)
      if (c.has(key)) c.delete(key)
      else c.add(key)
      update({ checked: c })
    },
    [id, update],
  )
  return { ...v, update, toggle }
}

export function IngredientRow({
  ing,
  scale,
  system,
  showOriginal,
  checked,
  onToggle,
  big,
}: {
  ing: RecipeIngredient
  scale: number
  system: UnitSystem
  showOriginal: boolean
  checked: boolean
  onToggle(): void
  big?: boolean
}) {
  const q = ing.quantity ? displayIngredient(ing.quantity, ing.altQuantity, ingredientById(ing.ingredientId), scale, system) : undefined
  return (
    <li className={`ing ${checked ? 'is-checked' : ''} ${big ? 'ing--big' : ''}`}>
      <label>
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="ing__box" aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
        <span className="ing__qty">
          {q ? (
            <>
              {q.approx && <span className="approx" title={q.rough ? 'Approximate — this ingredient varies a lot by packing or brand' : 'Approximate — converted using a typical density'}>≈</span>}
              {q.amount} <span className="ing__unit">{q.unit}</span>
            </>
          ) : null}
        </span>
        <span className="ing__name">
          {ing.name}
          {ing.note && <span className="ing__note">, {ing.note}</span>}
          {ing.optional && <span className="ing__opt"> (optional)</span>}
          {q?.secondary && showOriginal && <span className="ing__orig">({q.secondary})</span>}
        </span>
      </label>
    </li>
  )
}

export function IngredientList({
  recipe,
  scale,
  system,
  showOriginal,
  checked,
  toggle,
  big,
}: {
  recipe: Recipe
  scale: number
  system: UnitSystem
  showOriginal: boolean
  checked: Set<string>
  toggle(k: string): void
  big?: boolean
}) {
  const groups: { name?: string; items: RecipeIngredient[] }[] = []
  for (const i of recipe.ingredients) {
    const last = groups[groups.length - 1]
    if (last && last.name === i.group) last.items.push(i)
    else groups.push({ name: i.group, items: [i] })
  }
  return (
    <div className="ing-groups">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.name && <h3 className="group-title">{g.name}</h3>}
          <ul className="ing-list">
            {g.items.map((i) => (
              <IngredientRow key={i.id} ing={i} scale={scale} system={system} showOriginal={showOriginal} checked={checked.has(i.id)} onToggle={() => toggle(i.id)} big={big} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function StepText({ step, system }: { step: Instruction; system: UnitSystem }) {
  return <>{convertTempsInText(step.text, system)}</>
}

export function StepTimers({ step, recipeTitle, big }: { step: Instruction; recipeTitle: string; big?: boolean }) {
  const { start } = useTimers()
  const timers = findTimers(step.text)
  if (!timers.length) return null
  return (
    <div className="step-timers">
      {timers.map((t, i) => (
        <button key={i} className={`timer-btn ${big ? 'timer-btn--big' : ''}`} onClick={() => start(t.label, t.seconds, recipeTitle)}>
          <Icon name="timer" size={big ? 22 : 18} />
          Start {t.label} timer
        </button>
      ))}
    </div>
  )
}
