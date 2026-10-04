import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { IMPORT_PROXY, OCR_AVAILABLE } from '../config'
import { recipeFromHtml, recipeFromText, type ImportDraft } from '../domain/importers'
import { uid } from '../domain/parse'
import type { Category, Recipe } from '../domain/types'
import { Icon } from '../ui/Icon'

/**
 * Entry point for adding recipes:
 *  - Write it in            → editor
 *  - Import from a link     → fetch page via import proxy → schema.org Recipe → review
 *  - Photo or screenshot    → on-device OCR → text parser → review
 *  - Paste recipe text      → text parser → review
 *  - Save a link only       → bookmark with credit, nothing copied
 * Every import lands in the editor as a draft; nothing is saved unreviewed.
 */
type Mode = 'menu' | 'link' | 'url' | 'photo' | 'text'

export function AddPage() {
  const [mode, setMode] = useState<Mode>('menu')
  const back = () => setMode('menu')
  if (mode === 'link') return <LinkForm onBack={back} />
  if (mode === 'url') return <UrlImport onBack={back} />
  if (mode === 'photo') return <PhotoImport onBack={back} />
  if (mode === 'text') return <TextImport onBack={back} />
  const option = (m: Mode, icon: Parameters<typeof Icon>[0]['name'], title: string, text: string) => (
    <button className="add-option" onClick={() => setMode(m)}>
      <span className="add-option__icon">
        <Icon name={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <span className="muted">{text}</span>
      </span>
    </button>
  )
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
        {option('url', 'globe', 'Import from a link', 'Paste a recipe page address. We read the recipe, keep the credit, and you check it before saving.')}
        {option('photo', 'camera', 'From a photo or screenshot', 'Cookbook pages, printed cards, screenshots. Read on your phone, nothing uploaded.')}
        {option('text', 'note', 'Paste recipe text', 'Copied from a message, an email or a PDF.')}
        {option('link', 'link', 'Save a link only', 'Keep a recipe as a bookmark with credit — handy when you just want notes and bakes.')}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- shared

const GUESS: [RegExp, Category][] = [
  [/sourdough|sauerteig|levain|discard/i, 'sourdough'],
  [/muffin/i, 'muffins'],
  [/cookie|keks|plätzchen|biscotti|kipferl/i, 'cookies'],
  [/cake|kuchen|torte|brownie|blondie|cheesecake/i, 'cake'],
  [/roll|bun|brötchen|croissant|danish|pastry|gebäck|schnecke/i, 'pastry'],
  [/pancake|waffle|granola|pfannkuchen/i, 'breakfast'],
  [/bread|brot|loaf|baguette|focaccia|ciabatta|bagel|zopf/i, 'bread'],
  [/pie|tart|crumble|pudding|dessert/i, 'dessert'],
  [/pizza|cracker|quiche|savory|herzhaft/i, 'savory'],
]
const ART: Record<Category, Recipe['art']> = { bread: 'loaf', sourdough: 'boule', cake: 'cake', cookies: 'cookie', muffins: 'muffin', pastry: 'roll', breakfast: 'flat', dessert: 'cake', savory: 'flat' }

/** Turns an import into an editor draft, attaching (or creating) the creator. */
function useDraftFromImport() {
  const s = useStore()
  const nav = useNavigate()
  return (d: ImportDraft, how: string, sourceName?: string) => {
    const now = new Date().toISOString()
    const category = GUESS.find(([re]) => re.test(d.title))?.[1] ?? 'bread'
    const url = d.source?.url
    const host = url ? hostOf(url) : ''
    const name = d.source?.name || sourceName?.trim() || ''
    let creatorId = s.data.creators.find((c) => c.userId === s.user.id)?.id ?? s.data.creators[0].id
    let kind: Recipe['kind'] = 'mine'
    if (name || host) {
      const existing = s.data.creators.find((c) => c.kind === 'external' && ((host && c.website && hostOf(c.website) === host) || c.name.toLowerCase() === name.toLowerCase()))
      const c = existing ?? s.addCreator({ name: name || host, kind: 'external', website: url ? new URL(url).origin : undefined })
      creatorId = c.id
      kind = 'creator'
    }
    const draft: Recipe = {
      id: uid('r_'),
      title: d.title,
      description: d.description,
      kind,
      contentMode: 'full',
      creatorId,
      source: kind === 'creator' ? { name: name || host, url, originalTitle: d.source?.originalTitle, originalCreator: d.source?.originalCreator } : undefined,
      visibility: 'shared',
      ownerId: s.user.id,
      createdBy: s.user.id,
      category,
      tags: d.tags,
      prepMinutes: d.prepMinutes,
      bakeMinutes: d.bakeMinutes,
      totalMinutes: d.totalMinutes,
      yield: d.yield,
      oven: d.oven,
      equipment: [],
      ingredients: d.ingredients,
      steps: d.steps,
      art: ART[category],
      sourceImageUrl: d.imageUrl,
      createdAt: now,
      updatedAt: now,
    }
    nav('/new', { state: { draft, collections: [], imported: { how, warnings: d.warnings } } })
  }
}

function Back({ onBack }: { onBack(): void }) {
  return (
    <button className="link-btn" onClick={onBack}>
      <Icon name="back" size={18} /> Add a recipe
    </button>
  )
}

function UrlImport({ onBack }: { onBack(): void }) {
  const toDraft = useDraftFromImport()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [text, setText] = useState('')
  const needsText = !IMPORT_PROXY || !!problem

  async function go() {
    setProblem('')
    if (!IMPORT_PROXY) return
    setBusy(true)
    try {
      const res = await fetch(`${IMPORT_PROXY}?url=${encodeURIComponent(url.trim())}`)
      if (!res.ok) throw new Error(await res.text())
      const html = await res.text()
      const d = recipeFromHtml(html, res.headers.get('X-Final-Url') || url.trim())
      if (!d) throw new Error('That page has no recipe data we can read.')
      toDraft(d, 'link')
    } catch (e) {
      setProblem(`${e instanceof Error ? e.message : 'The page could not be loaded.'} Paste the recipe text from the page below instead — the link is kept for credit.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Back onBack={onBack} />
      <h1 className="page-title">Import from a link</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (needsText && text.trim()) {
            const d = recipeFromText(text)
            d.source = { name: '', url: url.trim() || undefined }
            toDraft(d, 'link + pasted text')
          } else void go()
        }}
      >
        <label className="field">
          <span>Recipe link</span>
          <input id="import-url" type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.farmhouseonboone.com/…" />
        </label>
        {problem && <p className="error" role="alert">{problem}</p>}
        {!IMPORT_PROXY && (
          <p className="fineprint">
            Reading pages directly needs the small import service (see the roadmap). Until it’s switched on: open the recipe, copy the ingredients and method, and paste them here.
          </p>
        )}
        {needsText && (
          <label className="field">
            <span>Recipe text from the page</span>
            <textarea id="import-url-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ingredients\n1 cup sourdough discard\n…\n\nInstructions\n1. Preheat the oven…'} />
          </label>
        )}
        <button className="btn btn--primary btn--block btn--big" disabled={busy || (needsText && !text.trim())}>
          {busy ? 'Reading the page…' : needsText ? 'Read recipe' : 'Import recipe'}
        </button>
      </form>
    </div>
  )
}

function PhotoImport({ onBack }: { onBack(): void }) {
  const toDraft = useDraftFromImport()
  const [preview, setPreview] = useState<string>()
  const [progress, setProgress] = useState<{ f: number; status: string }>()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sourceName, setSourceName] = useState('')

  async function read(file?: File) {
    if (!file) return
    setError('')
    setText('')
    setPreview(URL.createObjectURL(file))
    setProgress({ f: 0, status: 'Starting the reader' })
    try {
      const { readRecipeImage } = await import('../ui/ocr')
      const t = await readRecipeImage(file, (f, status) => setProgress({ f, status }))
      setText(t.trim())
      if (!t.trim()) setError('No text found. Try a sharper, well-lit photo taken straight on.')
    } catch (e) {
      console.error(e)
      setError('The reader couldn’t start in this browser. Type the recipe in, or try the installed app.')
    } finally {
      setProgress(undefined)
    }
  }

  return (
    <div className="page">
      <Back onBack={onBack} />
      <h1 className="page-title">From a photo</h1>
      <p className="lede">Printed pages and screenshots read best. Handwriting works sometimes — you can fix anything before saving.</p>
      {!OCR_AVAILABLE && (
        <p className="review">This preview can’t carry the photo reader. It works in the installed app; for now, use “Paste recipe text”.</p>
      )}
      <label className={`btn btn--primary btn--block btn--big ${OCR_AVAILABLE ? '' : 'is-disabled'}`} aria-disabled={!OCR_AVAILABLE}>
        <Icon name="camera" /> {preview ? 'Choose another photo' : 'Take or choose a photo'}
        <input type="file" accept="image/*" hidden disabled={!OCR_AVAILABLE} onChange={(e) => read(e.target.files?.[0])} />
      </label>
      {preview && <img src={preview} alt="The photo being read" className="ocr-preview" />}
      {progress && (
        <div className="ocr-progress" role="status">
          <span>{progress.status}…</span>
          <progress max={1} value={progress.f} />
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {text && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            toDraft(recipeFromText(text), 'photo', sourceName)
          }}
        >
          <label className="field">
            <span>What we read — fix obvious slips, then continue</span>
            <textarea id="ocr-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label className="field">
            <span>From a cookbook or someone else? (optional)</span>
            <input id="ocr-source" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. Dr. Oetker Backbuch, or leave empty for our own" />
          </label>
          <button className="btn btn--primary btn--block btn--big">Turn into a recipe</button>
        </form>
      )}
    </div>
  )
}

function TextImport({ onBack }: { onBack(): void }) {
  const toDraft = useDraftFromImport()
  const [text, setText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [url, setUrl] = useState('')
  return (
    <div className="page">
      <Back onBack={onBack} />
      <h1 className="page-title">Paste recipe text</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const d = recipeFromText(text)
          if (url.trim()) d.source = { name: sourceName.trim(), url: url.trim() }
          toDraft(d, 'pasted text', sourceName)
        }}
      >
        <label className="field">
          <span>Recipe</span>
          <textarea id="paste-text" rows={12} required value={text} onChange={(e) => setText(e.target.value)} placeholder={'Title\n\nIngredients\n500 g flour\n…\n\nMethod\n1. …'} />
        </label>
        <label className="field">
          <span>Where it’s from (optional)</span>
          <input id="paste-source" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Creator, book or person" />
        </label>
        <label className="field">
          <span>Link to the original (optional)</span>
          <input id="paste-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <button className="btn btn--primary btn--block btn--big" disabled={!text.trim()}>
          Read recipe
        </button>
      </form>
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
      <h1 className="page-title">Save a link only</h1>
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
