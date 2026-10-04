import { useState } from 'react'
import { useStore } from '../data/store'
import { Avatar } from '../ui/components'
import { Icon } from '../ui/Icon'

/**
 * First visit with a new email: link it to a profile (Chris, Janina…) or
 * start a new one. Happens once per person; every device then knows them.
 */
export function ClaimProfile() {
  const s = useStore()
  const sync = s.sync!
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const open = s.data.users.filter((u) => !sync.claimed.includes(u.id))

  async function claim(id: string) {
    setBusy(true)
    setError('')
    const err = await sync.claim(id)
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <div className="page claim">
      <span className="brand">Hearth</span>
      <h1 className="display">Welcome! Who’s this?</h1>
      <p className="lede">
        You’re signed in as <strong>{sync.email}</strong>. Pick your profile once — your notes, favourites and bakes follow you to every device.
      </p>
      {open.length > 0 && (
        <div className="people">
          {open.map((u) => (
            <button key={u.id} className="person" disabled={busy} onClick={() => claim(u.id)}>
              <Avatar name={u.name} color={u.avatarColor} size={56} />
              <span>I’m {u.name}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          const u = s.addUser(name.trim())
          void claim(u.id)
        }}
      >
        <input id="claim-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Someone new? Your name" aria-label="Your name" />
        <button className="btn btn--primary" disabled={!name.trim() || busy}>
          <Icon name="plus" /> Start
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
