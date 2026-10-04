import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { Avatar, ConfirmButton, Segmented } from '../ui/components'
import { Icon } from '../ui/Icon'

export function ProfilePage() {
  const s = useStore()
  const { user, data } = s
  const [newName, setNewName] = useState('')
  const myBakes = data.bakes.filter((b) => b.userId === user.id).length
  const myFavs = data.favorites.filter((f) => f.userId === user.id).length
  const myRecipes = data.recipes.filter((r) => r.createdBy === user.id).length

  return (
    <div className="page">
      <header className="profile-head">
        <Avatar name={user.name} color={user.avatarColor} size={72} />
        <div>
          <h1 className="display">{user.name}</h1>
          <p className="muted">
            {myRecipes} recipes added · {myFavs} favourites · {myBakes} bakes
          </p>
        </div>
      </header>

      <section className="block">
        <h2>Who’s baking?</h2>
        <p className="muted small">No passwords yet — just pick your name on this device.</p>
        <div className="people">
          {data.users.map((u) => (
            <button key={u.id} className={`person ${u.id === user.id ? 'is-on' : ''}`} onClick={() => s.setUser(u.id)} aria-pressed={u.id === user.id}>
              <Avatar name={u.name} color={u.avatarColor} size={48} />
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            const u = s.addUser(newName.trim())
            s.setUser(u.id)
            setNewName('')
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add someone (e.g. Lukas)" aria-label="New person’s name" />
          <button className="btn btn--ghost" disabled={!newName.trim()}>
            <Icon name="plus" /> Add
          </button>
        </form>
      </section>

      <section className="block">
        <h2>Measurements</h2>
        <Segmented
          label="Measurement system"
          value={user.unitSystem}
          onChange={(v) => s.updateUser({ unitSystem: v })}
          options={[
            { value: 'metric', label: 'Metric (g, ml, °C)' },
            { value: 'us', label: 'US (cups, oz, °F)' },
          ]}
        />
        <label className="switch">
          <input type="checkbox" checked={user.showOriginal} onChange={(e) => s.updateUser({ showOriginal: e.target.checked })} />
          <span className="switch__track" aria-hidden="true" />
          <span>Show the recipe’s original measure in brackets when converting</span>
        </label>
        <p className="fineprint">Cups ↔ grams use typical densities per ingredient and are marked ≈. The recipe’s own amounts are never changed.</p>
      </section>

      <section className="block">
        <h2>Your data</h2>
        <p className="muted small">
          {s.persistent
            ? 'Everything is saved on this device. Sharing between phones comes with the sync step (see the roadmap).'
            : 'This browser isn’t saving data right now — try opening the app outside private browsing.'}
        </p>
        <div className="row-gap wrap">
          <Link to="/browse?fav=1" className="btn btn--ghost">
            <Icon name="heart" /> My favourites
          </Link>
          <ConfirmButton
            className="btn btn--danger-text"
            label="Reset sample data"
            confirmLabel="Tap again — removes your own recipes and photos"
            onConfirm={() => void s.resetSampleData()}
          />
        </div>
      </section>
    </div>
  )
}
