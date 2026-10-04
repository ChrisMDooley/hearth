import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { matchIngredient } from '../domain/ingredients'
import { parseIngredientLine, uid } from '../domain/parse'
import type { ArtKind, Category, Recipe, RecipeIngredient, RecipeKind, UnitId } from '../domain/types'
import { UNITS, UNIT_OPTIONS } from '../domain/units'
import { ConfirmButton, RecipeImage, TopBar } from '../ui/components'
import { Icon } from '../ui/Icon'

const CATEGORIES: Category[] = ['bread', 'sourdough', 'cake', 'cookies', 'muffins', 'pastry', 'breakfast', 'dessert', 'savory']
const ART_FOR: Record<Category, ArtKind> = {
  bread: 'loaf',
  sourdough: 'boule',
  cake: 'cake',
  cookies: 'cookie',
  muffins: 'muffin',
  pastry: 'roll',
  breakfast: 'braid',
  dessert: 'cake',
  savory: 'stick',
}
const KINDS: { v: RecipeKind; label: string }[] = [
  { v: 'mine', label: 'Ours' },
  { v: 'family', label: 'Family' },
  { v: 'adapted', label: 'Adapted' },
  { v: 'creator', label: 'From a creator' },
]

function blank(userId: string, creatorId: string): Recipe {
  const now = new Date().toISOString()
  return {
    id: uid('r_'),
    title: '',
    kind: 'mine',
    contentMode: 'full',
    creatorId,
    visibility: 'shared',
    ownerId: userId,
    createdBy: userId,
    category: 'bread',
    tags: [],
    equipment: [],
    ingredients: [],
    steps: [],
    art: 'loaf',
    createdAt: now,
    updatedAt: now,
  }
}

export function EditorPage() {
  const { id } = useParams()
  const s = useStore()
  const loc = useLocation()
  const state = loc.state as { draft?: Recipe; collections?: string[] } | null
  const existing = id ? s.recipe(id) : undefined
  const me = s.data.creators.find((c) => c.userId === s.user.id)
  const initial = existing ?? state?.draft ?? blank(s.user.id, me?.id ?? s.data.creators[0]?.id)
  if (id && !existing) return <p className="page">Recipe not found.</p>
  return <Editor key={initial.id} initial={initial} isNew={!existing} initialCollections={existing ? s.collectionsOf(existing.id).map((c) => c.id) : state?.collections ?? []} />
}

function Editor({ initial, isNew, initialCollections }: { initial: Recipe; isNew: boolean; initialCollections: string[] }) {
  const s = useStore()
  const nav = useNavigate()
  const [r, setR] = useState<Recipe>(initial)
  const [cols, setCols] = useState<string[]>(initialCollections)
  const [paste, setPaste] = useState('')
  const [stepsText, setStepsText] = useState(initial.steps.map((x) => x.text).join('\n'))
  const [error, setError] = useState('')
  const set = <K extends keyof Recipe>(k: K, v: Recipe[K]) => setR((x) => ({ ...x, [k]: v }))

  const external = r.kind === 'creator' || r.kind === 'adapted'
  const creatorOptions = s.data.creators.filter((c) => (external ? c.kind === 'external' : r.kind === 'family' ? c.kind === 'family' : c.kind === 'person'))

  function setKind(k: RecipeKind) {
    const ext = k === 'creator' || k === 'adapted'
    const pool = s.data.creators.filter((c) => (ext ? c.kind === 'external' : k === 'family' ? c.kind === 'family' : c.kind === 'person'))
    const keep = pool.some((c) => c.id === r.creatorId)
    const mine = pool.find((c) => c.userId === s.user.id)
    const creatorId = keep ? r.creatorId : (mine ?? pool[0])?.id ?? r.creatorId
    const c = s.creator(creatorId)
    setR((x) => ({
      ...x,
      kind: k,
      creatorId,
      source: ext ? { ...x.source, name: x.source?.name ?? c?.name ?? '' } : x.source,
    }))
  }

  function setCreator(id: string) {
    const c = s.creator(id)
    setR((x) => ({ ...x, creatorId: id, source: external ? { ...x.source, name: c?.name ?? '' } : x.source }))
  }

  function updateIng(i: number, patch: Partial<RecipeIngredient>) {
    setR((x) => ({ ...x, ingredients: x.ingredients.map((g, j) => (j === i ? { ...g, ...patch } : g)) }))
  }

  function addPasted() {
    let group: string | undefined
    const rows: RecipeIngredient[] = []
    for (const raw of paste.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      if (/^#|:$/.test(line)) {
        group = line.replace(/^#+\s*|:$/g, '').trim()
        continue
      }
      const p = parseIngredientLine(line)
      if (p) rows.push({ ...p, group })
    }
    setR((x) => ({ ...x, ingredients: [...x.ingredients, ...rows] }))
    setPaste('')
  }

  async function setPhoto(files: FileList | null) {
    if (!files?.[0]) return
    const pid = await s.addPhoto(files[0], 'recipe')
    set('heroPhotoId', pid)
  }

  function save() {
    if (!r.title.trim()) {
      setError('Give the recipe a title.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (external && !r.source?.name) {
      setError('Name the creator this recipe comes from.')
      return
    }
    const steps = stepsText
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ id: r.steps[i]?.text === text ? r.steps[i].id : uid('st_'), text }))
    const ingredients = r.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ ...i, name: i.name.trim(), ingredientId: matchIngredient(i.name)?.id }))
    const hasContent = ingredients.length > 0 || steps.length > 0
    const out: Recipe = {
      ...r,
      title: r.title.trim(),
      steps,
      ingredients,
      contentMode: r.kind === 'creator' && !hasContent ? 'reference' : 'full',
      updatedAt: new Date().toISOString(),
    }
    s.saveRecipe(out, cols)
    nav(`/recipe/${out.id}`, { replace: true })
  }

  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v.replace(',', '.'))) || undefined)

  return (
    <div className="page editor">
      <TopBar
        back
        title={isNew ? 'New recipe' : 'Edit recipe'}
        right={
          <button className="btn btn--primary btn--sm" onClick={save}>
            Save
          </button>
        }
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="editor__photo">
        <RecipeImage recipe={r} className="editor__img" />
        <label className="btn btn--glass">
          <Icon name="camera" /> {r.heroPhotoId ? 'Change photo' : 'Add photo'}
          <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files)} />
        </label>
      </div>

      <div className="form">
        <label className="field">
          <span>Title</span>
          <input value={r.title} onChange={(e) => set('title', e.target.value)} placeholder="Oma’s Apfelkuchen" required />
        </label>
        <label className="field">
          <span>Short description</span>
          <textarea rows={2} value={r.description ?? ''} onChange={(e) => set('description', e.target.value || undefined)} />
        </label>

        <fieldset className="field">
          <legend>Whose recipe is it?</legend>
          <div className="chips chips--wrap">
            {KINDS.map((k) => (
              <button type="button" key={k.v} className={`chip ${r.kind === k.v ? 'is-on' : ''}`} aria-pressed={r.kind === k.v} onClick={() => setKind(k.v)}>
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>{external ? 'Creator' : r.kind === 'family' ? 'Collection' : 'Written by'}</span>
          <select value={r.creatorId} onChange={(e) => setCreator(e.target.value)}>
            {creatorOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {external && (
          <div className="subform">
            <p className="fineprint">Credit stays with the creator: this is shown on the recipe with a link back to the original.</p>
            <label className="field">
              <span>Link to the original</span>
              <input type="url" inputMode="url" value={r.source?.url ?? ''} onChange={(e) => set('source', { ...r.source!, url: e.target.value || undefined })} placeholder="https://…" />
            </label>
            <label className="field">
              <span>Original title</span>
              <input value={r.source?.originalTitle ?? ''} onChange={(e) => set('source', { ...r.source!, originalTitle: e.target.value || undefined })} />
            </label>
            <label className="field">
              <span>Original author</span>
              <input value={r.source?.originalCreator ?? ''} onChange={(e) => set('source', { ...r.source!, originalCreator: e.target.value || undefined })} placeholder="e.g. Lisa Bass" />
            </label>
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>Category</span>
            <select
              value={r.category}
              onChange={(e) => {
                const c = e.target.value as Category
                setR((x) => ({ ...x, category: c, art: ART_FOR[c] }))
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Who can see it</span>
            <select value={r.visibility} onChange={(e) => set('visibility', e.target.value as Recipe['visibility'])}>
              <option value="shared">Everyone</option>
              <option value="private">Only me</option>
            </select>
          </label>
        </div>

        <fieldset className="field">
          <legend>Collections</legend>
          <div className="chips chips--wrap">
            {s.data.collections.map((c) => {
              const on = cols.includes(c.id)
              return (
                <button type="button" key={c.id} className={`chip chip--soft ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setCols(on ? cols.filter((x) => x !== c.id) : [...cols, c.id])}>
                  {c.name}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="field-row field-row--3">
          <label className="field">
            <span>Prep (min)</span>
            <input inputMode="numeric" value={r.prepMinutes ?? ''} onChange={(e) => set('prepMinutes', num(e.target.value))} />
          </label>
          <label className="field">
            <span>Bake (min)</span>
            <input inputMode="numeric" value={r.bakeMinutes ?? ''} onChange={(e) => set('bakeMinutes', num(e.target.value))} />
          </label>
          <label className="field">
            <span>Total (min)</span>
            <input inputMode="numeric" value={r.totalMinutes ?? ''} onChange={(e) => set('totalMinutes', num(e.target.value))} placeholder="incl. rising" />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Makes</span>
            <input inputMode="decimal" value={r.yield?.amount ?? ''} onChange={(e) => set('yield', num(e.target.value) ? { amount: num(e.target.value)!, unit: r.yield?.unit ?? '' } : undefined)} placeholder="12" />
          </label>
          <label className="field">
            <span>&nbsp;</span>
            <input value={r.yield?.unit ?? ''} onChange={(e) => set('yield', { amount: r.yield?.amount ?? 1, unit: e.target.value })} placeholder="muffins" />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Oven</span>
            <input inputMode="numeric" value={r.oven?.value ?? ''} onChange={(e) => set('oven', num(e.target.value) ? { ...r.oven, value: num(e.target.value)!, unit: r.oven?.unit ?? 'C' } : undefined)} placeholder="180" />
          </label>
          <label className="field">
            <span>&nbsp;</span>
            <select value={r.oven?.unit ?? 'C'} onChange={(e) => r.oven && set('oven', { ...r.oven, unit: e.target.value as 'C' | 'F' })}>
              <option value="C">°C</option>
              <option value="F">°F</option>
            </select>
          </label>
        </div>
        {r.oven && (
          <label className="field">
            <span>Oven note</span>
            <input value={r.oven.note ?? ''} onChange={(e) => set('oven', { ...r.oven!, note: e.target.value || undefined })} placeholder="fan 160 °C / in a Dutch oven" />
          </label>
        )}

        <section className="field">
          <h2 className="form-h">Ingredients</h2>
          <p className="fineprint">Amounts are stored exactly as you enter them; conversions are only for display.</p>
          <ul className="ing-edit">
            {r.ingredients.map((g, i) => (
              <li key={g.id} className="ing-edit__row">
                {g.group && (i === 0 || r.ingredients[i - 1].group !== g.group) && <span className="ing-edit__group">{g.group}</span>}
                <input
                  className="ing-edit__amt"
                  inputMode="decimal"
                  aria-label="Amount"
                  value={g.quantity?.amount ?? ''}
                  onChange={(e) => {
                    const a = num(e.target.value)
                    updateIng(i, { quantity: a ? { amount: a, unit: g.quantity?.unit ?? 'g' } : undefined })
                  }}
                />
                <select
                  className="ing-edit__unit"
                  aria-label="Unit"
                  value={g.quantity?.unit ?? 'g'}
                  onChange={(e) => g.quantity && updateIng(i, { quantity: { ...g.quantity, unit: e.target.value as UnitId } })}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u === 'piece' ? '–' : UNITS[u].one}
                    </option>
                  ))}
                </select>
                <input className="ing-edit__name" aria-label="Ingredient" value={g.name} onChange={(e) => updateIng(i, { name: e.target.value })} placeholder="ingredient" />
                <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove ${g.name}`} onClick={() => set('ingredients', r.ingredients.filter((_, j) => j !== i))}>
                  <Icon name="close" size={18} />
                </button>
                <input className="ing-edit__note" aria-label="Note" value={g.note ?? ''} onChange={(e) => updateIng(i, { note: e.target.value || undefined })} placeholder="note (softened, packed…)" />
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => set('ingredients', [...r.ingredients, { id: uid('ri_'), name: '' }])}>
            <Icon name="plus" /> Add one ingredient
          </button>
          <label className="field paste">
            <span>…or paste a whole list</span>
            <textarea
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'500 g bread flour\n1 1/2 cups milk, warm\n2 eggs\nFilling:\n1/2 tsp cinnamon'}
            />
          </label>
          {paste.trim() && (
            <button type="button" className="btn btn--primary btn--block" onClick={addPasted}>
              Add {paste.split('\n').filter((l) => l.trim() && !/^#|:$/.test(l.trim())).length} ingredients
            </button>
          )}
        </section>

        <label className="field">
          <h2 className="form-h">Method</h2>
          <span className="fineprint">One step per line. Times like “bake 25 minutes” become timer buttons.</span>
          <textarea rows={8} value={stepsText} onChange={(e) => setStepsText(e.target.value)} placeholder={'Preheat the oven to 180 °C.\nCream butter and sugar…'} />
        </label>

        <label className="field">
          <span>Tips (part of the recipe)</span>
          <textarea rows={2} value={r.recipeNotes ?? ''} onChange={(e) => set('recipeNotes', e.target.value || undefined)} />
        </label>
        <label className="field">
          <span>Equipment</span>
          <input value={r.equipment.join(', ')} onChange={(e) => set('equipment', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="Dutch oven, banneton" />
        </label>
        <label className="field">
          <span>Tags</span>
          <input value={r.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="overnight, apples" />
        </label>

        <button className="btn btn--primary btn--block btn--big" onClick={save}>
          Save recipe
        </button>
        {!isNew && (
          <ConfirmButton
            className="btn btn--danger-text btn--block"
            label={<><Icon name="trash" size={18} /> Delete recipe</>}
            confirmLabel="Tap again to delete it with its notes and bakes"
            onConfirm={() => {
              s.deleteRecipe(r.id)
              nav('/', { replace: true })
            }}
          />
        )}
      </div>
    </div>
  )
}
