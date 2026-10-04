import { useState } from 'react'
import { useStore } from '../data/store'
import { Icon } from './Icon'

/** Tick the collections a recipe belongs to, or start a new one. */
export function CollectionPicker({ recipeId }: { recipeId: string }) {
  const s = useStore()
  const [name, setName] = useState('')
  const inIds = new Set(s.collectionsOf(recipeId).map((c) => c.id))
  const own = s.collections.filter((c) => c.ownerId)
  const builtIn = s.collections.filter((c) => !c.ownerId)
  const row = (c: (typeof s.collections)[number]) => (
    <li key={c.id}>
      <label className="pick-row">
        <input type="checkbox" checked={inIds.has(c.id)} onChange={() => s.toggleInCollection(recipeId, c.id)} />
        <span className="ing__box" aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
        <span>{c.name}</span>
      </label>
    </li>
  )
  return (
    <div className="picker">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          const c = s.addCollection(name)
          s.toggleInCollection(recipeId, c.id)
          setName('')
        }}
      >
        <input id="new-collection" value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection, e.g. Sunday baking" aria-label="New collection name" />
        <button className="btn btn--primary" disabled={!name.trim()}>
          <Icon name="plus" /> Add
        </button>
      </form>
      {own.length > 0 && (
        <>
          <h3 className="group-title">Your collections</h3>
          <ul className="pick-list">{own.map(row)}</ul>
        </>
      )}
      <h3 className="group-title">Shared collections</h3>
      <ul className="pick-list">{builtIn.map(row)}</ul>
    </div>
  )
}
