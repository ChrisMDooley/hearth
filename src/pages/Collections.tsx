import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { Icon } from '../ui/Icon'

export function CollectionsPage() {
  const s = useStore()
  const [name, setName] = useState('')
  const count = (id: string) => s.recipesIn(id).length
  const own = s.collections.filter((c) => c.ownerId)
  const builtIn = s.collections.filter((c) => !c.ownerId)
  const list = (cols: typeof own) => (
    <ul className="creator-list">
      {cols.map((c) => (
        <li key={c.id}>
          <Link to={`/browse?col=${c.id}`} className="creator-row">
            <span className="creator-row__icon">
              <Icon name="grid" />
            </span>
            <span className="creator-row__text">
              <strong>{c.name}</strong>
              <span className="muted small">
                {count(c.id)} {count(c.id) === 1 ? 'recipe' : 'recipes'}
              </span>
            </span>
            <Icon name="next" />
          </Link>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="page">
      <h1 className="page-title">Collections</h1>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          s.addCollection(name)
          setName('')
        }}
      >
        <input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection, e.g. Birthday cakes" aria-label="New collection name" />
        <button className="btn btn--primary" disabled={!name.trim()}>
          <Icon name="plus" /> Create
        </button>
      </form>
      <section className="block">
        <h2>Yours</h2>
        {own.length ? list(own) : <p className="empty-line">Create one above, or use “Save to collection” on any recipe.</p>}
      </section>
      <section className="block">
        <h2>Shared with everyone</h2>
        {list(builtIn)}
      </section>
    </div>
  )
}
