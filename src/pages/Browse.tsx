import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { searchRecipes } from '../domain/search'
import type { RecipeKind } from '../domain/types'
import { Icon } from '../ui/Icon'
import { RecipeCard } from '../ui/components'

const KINDS: { value: '' | RecipeKind; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'mine', label: 'Ours' },
  { value: 'family', label: 'Family' },
  { value: 'creator', label: 'From creators' },
  { value: 'adapted', label: 'Adapted' },
]

export function BrowsePage() {
  const s = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const col = params.get('col') ?? ''
  const kind = (params.get('kind') ?? '') as '' | RecipeKind
  const fav = params.get('fav') === '1'
  const by = params.get('by') ?? ''
  const creatorId = params.get('creator') ?? ''

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const results = useMemo(() => {
    let list = s.recipes
    if (col) list = s.recipesIn(col)
    if (kind) list = list.filter((r) => r.kind === kind)
    if (fav) list = list.filter((r) => s.isFavorite(r.id))
    if (by) list = list.filter((r) => r.createdBy === by && r.kind !== 'creator')
    if (creatorId) list = list.filter((r) => r.creatorId === creatorId)
    list = searchRecipes(list, q, s)
    return [...list].sort((a, b) => (params.get('sort') === 'new' ? b.createdAt.localeCompare(a.createdAt) : a.title.localeCompare(b.title)))
  }, [s, q, col, kind, fav, by, creatorId, params])

  const colName = s.data.collections.find((c) => c.id === col)?.name
  const heading = fav ? 'Favourites' : colName ?? (by ? `${s.data.users.find((u) => u.id === by)?.name ?? ''}’s recipes` : 'Recipes')

  return (
    <div className="page">
      <h1 className="page-title">{heading}</h1>
      <div className="search search--page" role="search">
        <Icon name="search" />
        <input
          value={q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Try “apples” or “sourdough under 2 hours”"
          aria-label="Search recipes"
          enterKeyHint="search"
          autoFocus={!col && !fav && !by}
        />
        {q && (
          <button className="icon-btn icon-btn--sm" onClick={() => set('q', '')} aria-label="Clear search">
            <Icon name="close" />
          </button>
        )}
      </div>

      <div className="chips" aria-label="Recipe type">
        {KINDS.map((k) => (
          <button key={k.value} className={`chip ${kind === k.value ? 'is-on' : ''}`} aria-pressed={kind === k.value} onClick={() => set('kind', k.value)}>
            {k.label}
          </button>
        ))}
        <button className={`chip ${fav ? 'is-on' : ''}`} aria-pressed={fav} onClick={() => set('fav', fav ? '' : '1')}>
          <Icon name={fav ? 'heart-fill' : 'heart'} size={15} /> Favourites
        </button>
      </div>
      <div className="chips" aria-label="Collection">
        {s.data.collections
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((c) => (
            <button key={c.id} className={`chip chip--soft ${col === c.id ? 'is-on' : ''}`} aria-pressed={col === c.id} onClick={() => set('col', col === c.id ? '' : c.id)}>
              {c.name}
            </button>
          ))}
      </div>

      <p className="result-count">
        {results.length} {results.length === 1 ? 'recipe' : 'recipes'}
      </p>
      {results.length ? (
        <div className="grid">
          {results.map((r) => (
            <RecipeCard key={r.id} recipe={r} variant="grid" />
          ))}
        </div>
      ) : (
        <div className="empty">
          <p>Nothing matches yet.</p>
          <p className="muted">Try fewer words, or clear a filter.</p>
        </div>
      )}
    </div>
  )
}
