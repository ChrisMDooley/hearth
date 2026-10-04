import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { searchRecipes } from '../domain/search'
import type { Recipe, RecipeKind } from '../domain/types'
import { Icon } from '../ui/Icon'
import { ConfirmButton, RecipeCard } from '../ui/components'

const KINDS: { value: '' | RecipeKind; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'mine', label: 'Ours' },
  { value: 'family', label: 'Family' },
  { value: 'creator', label: 'From creators' },
  { value: 'adapted', label: 'Adapted' },
]

const JAR_MAX = 400

/** Grams of starter/discard a recipe needs at 1×, if it uses any. */
function starterGrams(r: Recipe): number | undefined {
  const line = r.ingredients.find((i) => i.ingredientId === 'starter' && i.quantity?.unit === 'g')
  return line?.quantity?.amount
}

function CollectionHeader({ id }: { id: string }) {
  const s = useStore()
  const nav = useNavigate()
  const c = s.collections.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(c?.name ?? '')
  const [desc, setDesc] = useState(c?.description ?? '')
  if (!c) return null
  const own = c.ownerId === s.user.id
  if (editing) {
    return (
      <form
        className="form collection-edit"
        onSubmit={(e) => {
          e.preventDefault()
          s.renameCollection(id, name, desc)
          setEditing(false)
        }}
      >
        <label className="field">
          <span>Name</span>
          <input id="col-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea id="col-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <div className="row-gap wrap">
          <button className="btn btn--primary">Save</button>
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <ConfirmButton
            className="btn btn--danger-text"
            label="Delete collection"
            confirmLabel="Tap again — recipes stay, only the collection goes"
            onConfirm={() => {
              s.deleteCollection(id)
              nav('/collections', { replace: true })
            }}
          />
        </div>
      </form>
    )
  }
  return (
    <div className="collection-head">
      {c.description && <p className="lede">{c.description}</p>}
      {own && (
        <button className="link-btn" onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} /> Edit collection
        </button>
      )}
    </div>
  )
}

export function BrowsePage() {
  const s = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const col = params.get('col') ?? ''
  const kind = (params.get('kind') ?? '') as '' | RecipeKind
  const fav = params.get('fav') === '1'
  const by = params.get('by') ?? ''
  const creatorId = params.get('creator') ?? ''

  const showJar = col === 'col_discard' || (params.get('q') ?? '').toLowerCase().includes('discard')
  const jar = showJar ? Number(params.get('jar') ?? JAR_MAX) : JAR_MAX

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
    if (jar < JAR_MAX) list = list.filter((r) => (starterGrams(r) ?? 0) <= jar)
    list = searchRecipes(list, q, s)
    return [...list].sort((a, b) => (params.get('sort') === 'new' ? b.createdAt.localeCompare(a.createdAt) : a.title.localeCompare(b.title)))
  }, [s, q, col, kind, fav, by, creatorId, params, jar])

  const collection = s.collections.find((c) => c.id === col)
  const colName = collection?.name
  const heading = fav ? 'Favourites' : colName ?? (by ? `${s.data.users.find((u) => u.id === by)?.name ?? ''}’s recipes` : 'Recipes')

  return (
    <div className="page">
      <h1 className="page-title">{heading}</h1>
      {collection && <CollectionHeader key={collection.id} id={collection.id} />}
      {showJar && (
        <div className="jar">
          <label htmlFor="jar">Discard in the jar</label>
          <input id="jar" type="range" min={50} max={JAR_MAX} step={25} value={jar} onChange={(e) => set('jar', e.target.value === String(JAR_MAX) ? '' : e.target.value)} />
          <output htmlFor="jar">{jar >= JAR_MAX ? `${JAR_MAX} g +` : `${jar} g`}</output>
        </div>
      )}
      <div className="search search--page" role="search">
        <Icon name="search" />
        <input
          value={q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Try “apples” or “sourdough under 2 hours”"
          aria-label="Search recipes"
          enterKeyHint="search"
          autoFocus={!col && !fav && !by && !q}
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
        {s.collections.map((c) => (
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
