import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatMinutes, totalMinutes } from '../domain/parse'
import type { Recipe, RecipeKind } from '../domain/types'
import { useStore } from '../data/store'
import { Icon } from './Icon'
import { RecipeArt } from './RecipeArt'

export function RecipeImage({ recipe, className }: { recipe: Recipe; className?: string }) {
  const { photoUrl } = useStore()
  const url = photoUrl(recipe.heroPhotoId)
  if (url) return <img src={url} alt="" className={`${className ?? ''} cover`} />
  return <RecipeArt kind={recipe.art} seed={recipe.id} className={className} />
}

export function HeartButton({ recipeId, size = 'md', onImage }: { recipeId: string; size?: 'md' | 'lg'; onImage?: boolean }) {
  const { isFavorite, toggleFavorite } = useStore()
  const fav = isFavorite(recipeId)
  return (
    <button
      className={`heart heart--${size} ${fav ? 'is-on' : ''} ${onImage ? 'heart--on-image' : ''}`}
      aria-pressed={fav}
      aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(recipeId)
      }}
    >
      <Icon name={fav ? 'heart-fill' : 'heart'} size={size === 'lg' ? 26 : 20} />
    </button>
  )
}

const KIND_LABEL: Record<RecipeKind, string> = {
  mine: 'Our recipe',
  family: 'Family recipe',
  creator: 'From',
  adapted: 'Adapted from',
}

/** One-line provenance shown on cards: "From Farmhouse on Boone". */
export function SourceLine({ recipe, link = false }: { recipe: Recipe; link?: boolean }) {
  const { creator } = useStore()
  const c = creator(recipe.creatorId)
  const name = recipe.kind === 'creator' || recipe.kind === 'adapted' ? recipe.source?.name ?? c?.name : c?.name
  const prefix = recipe.kind === 'mine' ? 'By' : KIND_LABEL[recipe.kind]
  const text = recipe.kind === 'family' ? 'Family recipe' : `${prefix} ${name ?? ''}`
  if (link && c) {
    return (
      <Link to={`/creators/${c.id}`} className={`source-line source-line--${recipe.kind}`}>
        {text}
      </Link>
    )
  }
  return <span className={`source-line source-line--${recipe.kind}`}>{text}</span>
}

export function RecipeCard({ recipe, variant = 'rail' }: { recipe: Recipe; variant?: 'rail' | 'row' | 'grid' }) {
  const total = totalMinutes(recipe)
  return (
    <Link to={`/recipe/${recipe.id}`} className={`card card--${variant}`}>
      <div className="card__media">
        <RecipeImage recipe={recipe} className="card__img" />
        <HeartButton recipeId={recipe.id} onImage />
        {recipe.contentMode === 'reference' && <span className="card__badge"><Icon name="link" size={14} /> Link</span>}
      </div>
      <div className="card__body">
        <h3 className="card__title">{recipe.title}</h3>
        <div className="card__meta">
          <SourceLine recipe={recipe} />
          {total ? <span className="card__time"><Icon name="clock" size={14} /> {formatMinutes(total)}</span> : null}
        </div>
      </div>
    </Link>
  )
}

export function Rail({ title, to, children, empty }: { title: string; to?: string; children: ReactNode; empty?: ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <section className="rail">
      <header className="rail__head">
        <h2>{title}</h2>
        {to && has && (
          <Link to={to} className="rail__more">
            See all
          </Link>
        )}
      </header>
      {has ? <div className="rail__track">{children}</div> : empty}
    </section>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange(v: T): void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <span className="avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Bottom sheet on phones, centred dialog on wide screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      <div className="sheet__inner">
        <header className="sheet__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        {open && children}
      </div>
    </dialog>
  )
}

export function TopBar({ title, back, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  return (
    <header className="topbar">
      {back ? (
        <button className="icon-btn" onClick={() => history.back()} aria-label="Back">
          <Icon name="back" />
        </button>
      ) : (
        <span />
      )}
      {title && <h1 className="topbar__title">{title}</h1>}
      <div className="topbar__right">{right}</div>
    </header>
  )
}

export function Stars({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= value ? 'star-fill' : 'star'} size={15} />
      ))}
    </span>
  )
}

export function formatDay(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Two-tap confirmation for destructive actions ("Delete" → "Tap again to delete").
 * Used instead of window.confirm(), which some embedded browsers block.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, className }: { label: ReactNode; confirmLabel: string; onConfirm(): void; className?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`${className ?? ''} ${armed ? 'is-armed' : ''}`}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      aria-live="polite"
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
