import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { uid } from '../domain/parse'
import type { Category, Recipe } from '../domain/types'
import { Icon } from '../ui/Icon'

/**
 * Entry point for adding recipes. v1 offers manual entry (with a paste box
 * for ingredients) and "save a link" bookmarks with attribution. Automatic
 * URL and photo import need a small server/AI step — see docs/ROADMAP.md.
 */
export function AddPage() {
  const [mode, setMode] = useState<'menu' | 'link'>('menu')
  if (mode === 'link') return <LinkForm onBack={() => setMode('menu')} />
  return (
    <div className="page">
      <h1 className="page-title">Add a recipe</h1>
      <div className="add-options">
        <Link to="/new" className="add-option">
          <span className="add-option__icon">
            <Icon name="edit" />
          </span>
          <span>
            <strong>Write it in</strong>
            <span className="muted">Type it or paste the ingredient list — we sort out amounts and units.</span>
          </span>
        </Link>
        <button className="add-option" onClick={() => setMode('link')}>
          <span className="add-option__icon">
            <Icon name="link" />
          </span>
          <span>
            <strong>Save a link</strong>
            <span className="muted">Keep a recipe from Farmhouse on Boone or any site, with credit and a link back.</span>
          </span>
        </button>
        <div className="add-option is-soon" aria-disabled="true">
          <span className="add-option__icon">
            <Icon name="camera" />
          </span>
          <span>
            <strong>From a photo or screenshot</strong>
            <span className="muted">Cookbook pages, Oma’s handwritten cards. Coming in a later version.</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function titleFromUrl(url: string) {
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
    if (!slug || /^\?|^\d+$/.test(slug)) return ''
    return slug
      .replace(/-recipe$/, '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  } catch {
    return ''
  }
}

const CATEGORIES: Category[] = ['bread', 'sourdough', 'cake', 'cookies', 'muffins', 'pastry', 'breakfast', 'dessert', 'savory']

function LinkForm({ onBack }: { onBack(): void }) {
  const s = useStore()
  const nav = useNavigate()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('bread')
  const externals = s.data.creators.filter((c) => c.kind === 'external')
  const host = hostOf(url)
  const matched = useMemo(() => externals.find((c) => c.website && hostOf(c.website) === host), [externals, host])
  const [creatorId, setCreatorId] = useState<string>('')
  const [newCreator, setNewCreator] = useState('')
  const effectiveCreator = creatorId || matched?.id || ''

  function save() {
    let cid = effectiveCreator
    let cname = externals.find((c) => c.id === cid)?.name
    if (cid === 'new' || !cid) {
      const name = newCreator.trim() || host || 'Other source'
      const c = s.addCreator({ name, kind: 'external', website: host ? `https://${new URL(url).host}` : undefined })
      cid = c.id
      cname = c.name
    }
    const now = new Date().toISOString()
    const r: Recipe = {
      id: uid('r_'),
      title: title.trim() || titleFromUrl(url) || 'Untitled recipe',
      kind: 'creator',
      contentMode: 'reference',
      creatorId: cid,
      source: { name: cname!, url: url.trim(), originalTitle: title.trim() || undefined },
      visibility: 'shared',
      ownerId: s.user.id,
      createdBy: s.user.id,
      category,
      tags: [],
      equipment: [],
      ingredients: [],
      steps: [],
      art: category === 'cake' ? 'cake' : category === 'cookies' ? 'cookie' : category === 'muffins' ? 'muffin' : category === 'pastry' ? 'roll' : 'loaf',
      createdAt: now,
      updatedAt: now,
    }
    s.saveRecipe(r, [])
    nav(`/recipe/${r.id}`, { replace: true })
  }

  return (
    <div className="page">
      <button className="link-btn" onClick={onBack}>
        <Icon name="back" size={18} /> Add a recipe
      </button>
      <h1 className="page-title">Save a link</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label className="field">
          <span>Recipe link</span>
          <input
            type="url"
            inputMode="url"
            required
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (!title) setTitle('')
            }}
            placeholder="https://www.farmhouseonboone.com/…"
          />
        </label>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titleFromUrl(url) || 'Sourdough Sandwich Bread'} />
        </label>
        <label className="field">
          <span>Creator</span>
          <select value={effectiveCreator || 'new'} onChange={(e) => setCreatorId(e.target.value)}>
            {externals.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="new">Someone new…</option>
          </select>
          {matched && !creatorId && <small className="muted">Recognised from the link.</small>}
        </label>
        {(effectiveCreator === 'new' || !effectiveCreator) && (
          <label className="field">
            <span>Creator name</span>
            <input value={newCreator} onChange={(e) => setNewCreator(e.target.value)} placeholder={host || 'e.g. The Perfect Loaf'} />
          </label>
        )}
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <p className="fineprint">
          We save the link and credit the creator. Pulling the ingredients and method in automatically needs the small import server planned for the next version — for now you can open the
          recipe and add your notes and bakes here.
        </p>
        <button className="btn btn--primary btn--block btn--big">Save recipe link</button>
      </form>
    </div>
  )
}
