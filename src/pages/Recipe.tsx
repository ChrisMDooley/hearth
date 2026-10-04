import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { formatMinutes, totalMinutes, uid } from '../domain/parse'
import type { BakeEntry, Recipe } from '../domain/types'
import { formatOven } from '../domain/units'
import { BakeForm } from '../ui/BakeSheet'
import { Avatar, ConfirmButton, HeartButton, RecipeImage, Segmented, Sheet, Stars, formatDay } from '../ui/components'
import { Icon } from '../ui/Icon'
import { IngredientList, StepText, StepTimers, useRecipeView } from '../ui/recipeParts'

const SCALES = [0.5, 1, 1.5, 2, 3]
const scaleLabel = (n: number) => (n === 0.5 ? '½×' : n === 1.5 ? '1½×' : `${n}×`)

export function RecipePage() {
  const { id = '' } = useParams()
  const s = useStore()
  const r = s.recipe(id)
  if (!r) {
    return (
      <div className="page empty">
        <p>We couldn’t find that recipe.</p>
        <Link to="/" className="btn">
          Back home
        </Link>
      </div>
    )
  }
  return <RecipeView r={r} />
}

function RecipeView({ r }: { r: Recipe }) {
  const s = useStore()
  const nav = useNavigate()
  const view = useRecipeView(r.id)
  const { user } = s
  const system = user.unitSystem
  const total = totalMinutes(r)
  const creator = s.creator(r.creatorId)
  const isExternal = r.kind === 'creator' || r.kind === 'adapted'
  const oven = r.oven ? formatOven(r.oven, system) : undefined
  const canEdit = r.createdBy === user.id || r.ownerId === user.id || r.visibility === 'shared'

  useEffect(() => {
    if (location.hash.endsWith('#bakes')) document.getElementById('bakes')?.scrollIntoView()
  }, [])

  return (
    <article className="recipe">
      <div className="recipe__hero">
        <RecipeImage recipe={r} className="recipe__img" />
        <div className="recipe__hero-bar">
          <button className="icon-btn icon-btn--glass" onClick={() => (history.length > 1 ? history.back() : nav('/'))} aria-label="Back">
            <Icon name="back" />
          </button>
          <div className="row-gap">
            {canEdit && (
              <Link to={`/recipe/${r.id}/edit`} className="icon-btn icon-btn--glass" aria-label="Edit recipe">
                <Icon name="edit" />
              </Link>
            )}
            <HeartButton recipeId={r.id} size="lg" onImage />
          </div>
        </div>
      </div>

      <div className="recipe__body">
        <header className="recipe__head">
          <Attribution r={r} />
          <h1 className="recipe__title">{r.title}</h1>
          {r.description && <p className="recipe__desc">{r.description}</p>}
        </header>

        {(r.prepMinutes || r.bakeMinutes || total || oven) && (
          <dl className="facts">
            {r.prepMinutes ? <Fact label="Prep" value={formatMinutes(r.prepMinutes)} /> : null}
            {r.bakeMinutes ? <Fact label="Bake" value={formatMinutes(r.bakeMinutes)} /> : null}
            {total ? <Fact label="Total" value={formatMinutes(total)} /> : null}
            {oven ? <Fact label="Oven" value={oven.text} sub={r.oven?.note ?? oven.original} /> : null}
          </dl>
        )}

        {r.contentMode === 'reference' ? (
          <ReferenceCard r={r} />
        ) : (
          <div className="recipe__cols">
            <aside className="recipe__side">
            <section className="controls" aria-label="Amounts">
              <YieldControl r={r} scale={view.scale} setScale={(x) => view.update({ scale: x })} />
              <div className="controls__row">
                <Segmented label="Scale" value={view.scale} onChange={(v) => view.update({ scale: v })} options={SCALES.map((x) => ({ value: x, label: scaleLabel(x) }))} />
              </div>
              <div className="controls__row">
                <Segmented
                  label="Measurements"
                  value={system}
                  onChange={(v) => s.updateUser({ unitSystem: v })}
                  options={[
                    { value: 'metric', label: 'Metric' },
                    { value: 'us', label: 'US cups' },
                  ]}
                />
              </div>
            </section>

            <section className="block">
              <div className="block__head">
                <h2>Ingredients</h2>
                {view.checked.size > 0 && (
                  <button className="link-btn" onClick={() => view.update({ checked: new Set() })}>
                    Clear ticks
                  </button>
                )}
              </div>
              <IngredientList recipe={r} scale={view.scale} system={system} showOriginal={user.showOriginal} checked={view.checked} toggle={view.toggle} />
              <p className="fineprint">≈ means converted with a typical ingredient density — weigh if it matters.</p>
            </section>
            </aside>
            <div className="recipe__main">

            <Link to={`/recipe/${r.id}/cook`} className="btn btn--primary btn--block btn--big">
              <Icon name="play" /> Start baking mode
            </Link>

            <section className="block">
              <h2>Method</h2>
              <ol className="steps">
                {r.steps.map((st, i) => (
                  <li key={st.id} className={`step ${view.checked.has(st.id) ? 'is-done' : ''}`}>
                    <button className="step__num" onClick={() => view.toggle(st.id)} aria-label={`Mark step ${i + 1} done`} aria-pressed={view.checked.has(st.id)}>
                      {view.checked.has(st.id) ? <Icon name="check" size={18} /> : i + 1}
                    </button>
                    <div>
                      <p className="step__text">
                        <StepText step={st} system={system} />
                      </p>
                      <StepTimers step={st} recipeTitle={r.title} />
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {(r.recipeNotes || r.equipment.length > 0) && (
              <section className="block">
                {r.recipeNotes && (
                  <>
                    <h2>Tips</h2>
                    <p className="prose">{r.recipeNotes}</p>
                  </>
                )}
                {r.equipment.length > 0 && (
                  <>
                    <h3 className="group-title">Equipment</h3>
                    <ul className="tags">
                      {r.equipment.map((e) => (
                        <li key={e} className="tag">
                          {e}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
              <UserSections r={r} scale={view.scale} creatorName={creator?.name} isExternal={isExternal} />
            </div>
          </div>
        )}
        {r.contentMode === 'reference' && <UserSections r={r} scale={view.scale} creatorName={creator?.name} isExternal={isExternal} />}
      </div>
    </article>
  )
}

function UserSections({ r, scale, creatorName, isExternal }: { r: Recipe; scale: number; creatorName?: string; isExternal: boolean }) {
  return (
    <>
      <PersonalNote recipeId={r.id} />
      <Bakes r={r} scale={scale} />
      <SourceBlock r={r} creatorName={creatorName} isExternal={isExternal} />
    </>
  )
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        {value}
        {sub && <small>{sub}</small>}
      </dd>
    </div>
  )
}

function Attribution({ r }: { r: Recipe }) {
  const s = useStore()
  const c = s.creator(r.creatorId)
  if (r.kind === 'creator' || r.kind === 'adapted') {
    return (
      <div className="attribution">
        <span className="attribution__label">{r.kind === 'adapted' ? 'Adapted from' : 'Recipe from'}</span>
        <Link to={`/creators/${r.creatorId}`} className="attribution__name">
          {r.source?.name ?? c?.name}
        </Link>
        {r.source?.url && (
          <a href={r.source.url} target="_blank" rel="noopener noreferrer" className="attribution__out" aria-label="Open the original recipe">
            Original <Icon name="external" size={14} />
          </a>
        )}
      </div>
    )
  }
  return (
    <div className="attribution attribution--ours">
      <span className="attribution__label">{r.kind === 'family' ? 'Family recipe' : 'Our recipe'}</span>
      {c && (
        <Link to={`/creators/${c.id}`} className="attribution__name">
          {r.kind === 'family' ? c.name : `by ${c.name}`}
        </Link>
      )}
    </div>
  )
}

function YieldControl({ r, scale, setScale }: { r: Recipe; scale: number; setScale(n: number): void }) {
  if (!r.yield) return null
  const base = r.yield.amount
  const current = Math.round(base * scale * 100) / 100
  const step = base >= 6 ? 1 : 0.5
  const change = (n: number) => n > 0 && setScale(n / base)
  return (
    <div className="yield">
      <span className="yield__label">Makes</span>
      <div className="stepper">
        <button onClick={() => change(current - step)} aria-label="Fewer" disabled={current - step <= 0}>
          <Icon name="minus" />
        </button>
        <input
          inputMode="decimal"
          aria-label={`Number of ${r.yield.unit}`}
          value={String(current)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(',', '.'))
            if (n > 0) change(n)
          }}
        />
        <button onClick={() => change(current + step)} aria-label="More">
          <Icon name="plus" />
        </button>
      </div>
      <span className="yield__unit">{r.yield.unit}</span>
      {scale !== 1 && <span className="yield__base">recipe makes {base}</span>}
    </div>
  )
}

function ReferenceCard({ r }: { r: Recipe }) {
  const nav = useNavigate()
  const s = useStore()
  const name = r.source?.name ?? s.creator(r.creatorId)?.name
  function startAdapted() {
    const copy: Recipe = {
      ...r,
      id: uid('r_'),
      title: `${r.title} (our version)`,
      kind: 'adapted',
      contentMode: 'full',
      ownerId: s.user.id,
      createdBy: s.user.id,
      heroPhotoId: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    nav('/new', { state: { draft: copy, collections: s.collectionsOf(r.id).map((c) => c.id) } })
  }
  return (
    <section className="ref-card">
      <Icon name="link" size={28} />
      <h2>Saved from {name}</h2>
      <p>The full ingredients and method live on {name}’s site. We keep the link, our notes and our bakes here.</p>
      {r.source?.url && (
        <a href={r.source.url} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--block btn--big">
          Open recipe at {name} <Icon name="external" size={18} />
        </a>
      )}
      <button className="btn btn--ghost btn--block" onClick={startAdapted}>
        Write down our adapted version
      </button>
    </section>
  )
}

function PersonalNote({ recipeId }: { recipeId: string }) {
  const s = useStore()
  const saved = s.noteFor(recipeId)
  const [text, setText] = useState(saved)
  const [editing, setEditing] = useState(false)
  useEffect(() => setText(saved), [saved, s.user.id])
  return (
    <section className="block note-block">
      <div className="block__head">
        <h2>My notes</h2>
        <span className="muted small">Only {s.user.name} sees these</span>
      </div>
      {editing ? (
        <>
          <textarea className="note-input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Kids prefer less cinnamon. Use the Staub pot…" />
          <div className="row-gap">
            <button
              className="btn btn--primary"
              onClick={() => {
                s.saveNote(recipeId, text)
                setEditing(false)
              }}
            >
              Save note
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setText(saved)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : saved ? (
        <button className="note" onClick={() => setEditing(true)}>
          <Icon name="note" />
          <span>{saved}</span>
        </button>
      ) : (
        <button className="btn btn--dashed btn--block" onClick={() => setEditing(true)}>
          <Icon name="plus" /> Add a note
        </button>
      )}
    </section>
  )
}

function Bakes({ r, scale }: { r: Recipe; scale: number }) {
  const s = useStore()
  const bakes = s.bakesFor(r.id)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BakeEntry | undefined>()
  return (
    <section className="block" id="bakes">
      <div className="block__head">
        <h2>Our bakes</h2>
        <span className="muted small">{bakes.length ? `${bakes.length} logged` : ''}</span>
      </div>
      <button
        className="btn btn--dashed btn--block"
        onClick={() => {
          setEditing(undefined)
          setOpen(true)
        }}
      >
        <Icon name="camera" /> Log a bake
      </button>
      <ol className="journal">
        {bakes.map((b) => {
          const who = s.data.users.find((u) => u.id === b.userId)
          return (
            <li key={b.id} className="journal__entry">
              <div className="journal__head">
                {who && <Avatar name={who.name} color={who.avatarColor} size={28} />}
                <div>
                  <strong>{formatDay(b.date)}</strong>
                  <span className="muted small">
                    {' '}
                    · {who?.name}
                    {b.scale && b.scale !== 1 ? ` · ${scaleLabel(b.scale)} batch` : ''}
                  </span>
                </div>
                <Stars value={b.rating} />
                {b.userId === s.user.id && (
                  <button
                    className="icon-btn icon-btn--sm journal__edit"
                    aria-label="Edit bake"
                    onClick={() => {
                      setEditing(b)
                      setOpen(true)
                    }}
                  >
                    <Icon name="edit" size={18} />
                  </button>
                )}
              </div>
              {b.photoIds.length > 0 && (
                <div className="journal__photos">
                  {b.photoIds.map((p) => (s.photoUrl(p) ? <img key={p} src={s.photoUrl(p)} alt={`Bake on ${formatDay(b.date)}`} className="cover" /> : null))}
                </div>
              )}
              {b.modifications && (
                <p className="journal__mods">
                  <strong>Changed:</strong> {b.modifications}
                </p>
              )}
              {b.notes && <p>{b.notes}</p>}
              {b.result && <span className={`result result--${b.result}`}>{b.result}</span>}
            </li>
          )
        })}
      </ol>
      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit bake' : 'Log a bake'}>
        <BakeForm recipeId={r.id} scale={scale} existing={editing} onDone={() => setOpen(false)} />
        {editing && (
          <ConfirmButton
            className="btn btn--danger-text btn--block"
            label={<><Icon name="trash" size={18} /> Delete this bake</>}
            confirmLabel="Tap again to delete this bake"
            onConfirm={() => {
              s.deleteBake(editing.id)
              setOpen(false)
            }}
          />
        )}
      </Sheet>
    </section>
  )
}

function SourceBlock({ r, creatorName, isExternal }: { r: Recipe; creatorName?: string; isExternal: boolean }) {
  const s = useStore()
  const addedBy = s.data.users.find((u) => u.id === r.createdBy)?.name
  const cols = s.collectionsOf(r.id)
  return (
    <section className="block source-block">
      <h2>Source</h2>
      {isExternal ? (
        <dl className="source-dl">
          <dt>Creator</dt>
          <dd>
            <Link to={`/creators/${r.creatorId}`}>{r.source?.name ?? creatorName}</Link>
            {r.source?.originalCreator && r.source.originalCreator !== r.source.name ? ` · ${r.source.originalCreator}` : ''}
          </dd>
          {r.source?.originalTitle && (
            <>
              <dt>Original title</dt>
              <dd>{r.source.originalTitle}</dd>
            </>
          )}
          {r.source?.url && (
            <>
              <dt>Link</dt>
              <dd>
                <a href={r.source.url} target="_blank" rel="noopener noreferrer" className="break">
                  {r.source.url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </dd>
            </>
          )}
          {r.kind === 'adapted' && (
            <>
              <dt>Note</dt>
              <dd>Our changes to the original. All credit for the original recipe goes to {r.source?.name ?? creatorName}.</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="prose">{r.kind === 'family' ? 'A family recipe' : `Written by ${creatorName}`}.</p>
      )}
      <p className="muted small">
        Added by {addedBy} on {formatDay(r.createdAt.slice(0, 10))}
        {r.updatedAt !== r.createdAt ? ` · edited ${formatDay(r.updatedAt.slice(0, 10))}` : ''}
      </p>
      {cols.length > 0 && (
        <ul className="tags">
          {cols.map((c) => (
            <li key={c.id}>
              <Link className="tag" to={`/browse?col=${c.id}`}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
