import { useState } from 'react'
import { useStore } from '../data/store'
import { uid } from '../domain/parse'
import type { BakeEntry, BakeResult } from '../domain/types'
import { Icon } from './Icon'

const RESULTS: { v: BakeResult; label: string }[] = [
  { v: 'great', label: 'Great' },
  { v: 'good', label: 'Good' },
  { v: 'okay', label: 'Okay' },
  { v: 'flop', label: 'Flop' },
]

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Log (or edit) one bake. Never touches the recipe itself. */
export function BakeForm({ recipeId, scale, existing, onDone }: { recipeId: string; scale: number; existing?: BakeEntry; onDone(): void }) {
  const s = useStore()
  const [date, setDate] = useState(existing?.date ?? today())
  const [rating, setRating] = useState<number>(existing?.rating ?? 0)
  const [result, setResult] = useState<BakeResult | undefined>(existing?.result)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [mods, setMods] = useState(existing?.modifications ?? '')
  const [photoIds, setPhotoIds] = useState<string[]>(existing?.photoIds ?? [])
  const [busy, setBusy] = useState(false)

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const ids: string[] = []
      for (const f of Array.from(files)) ids.push(await s.addPhoto(f, 'bake'))
      setPhotoIds((p) => [...p, ...ids])
    } finally {
      setBusy(false)
    }
  }

  function save() {
    const b: BakeEntry = {
      id: existing?.id ?? uid('b_'),
      userId: existing?.userId ?? s.user.id,
      recipeId,
      date,
      notes: notes.trim(),
      modifications: mods.trim() || undefined,
      rating: rating ? (rating as BakeEntry['rating']) : undefined,
      result,
      scale: existing?.scale ?? (scale !== 1 ? scale : undefined),
      photoIds,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    s.saveBake(b)
    onDone()
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className="field">
        <span>Baked on</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>

      <div className="field">
        <span>Photos</span>
        <div className="photo-strip">
          {photoIds.map((id) => (
            <div key={id} className="photo-thumb">
              {s.photoUrl(id) && <img src={s.photoUrl(id)} alt="" className="cover" />}
              <button type="button" className="photo-thumb__x" onClick={() => setPhotoIds((p) => p.filter((x) => x !== id))} aria-label="Remove photo">
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          <label className="photo-add">
            <Icon name="camera" />
            <span>{busy ? 'Adding…' : 'Add'}</span>
            <input type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} hidden />
          </label>
        </div>
      </div>

      <div className="field">
        <span>How did it turn out?</span>
        <div className="chips chips--wrap">
          {RESULTS.map((r) => (
            <button type="button" key={r.v} className={`chip ${result === r.v ? 'is-on' : ''}`} aria-pressed={result === r.v} onClick={() => setResult(result === r.v ? undefined : r.v)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="star-input" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button type="button" key={i} role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setRating(rating === i ? 0 : i)}>
              <Icon name={i <= rating ? 'star-fill' : 'star'} size={30} />
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>What did you change?</span>
        <input value={mods} onChange={(e) => setMods(e.target.value)} placeholder="e.g. 20 g less water, fermented overnight" />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Best crust so far…" />
      </label>

      <div className="form__actions">
        <button className="btn btn--primary btn--block" disabled={busy}>
          {existing ? 'Save changes' : 'Save bake'}
        </button>
      </div>
    </form>
  )
}
