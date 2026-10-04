import { Link, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import type { Creator } from '../domain/types'
import { Avatar, RecipeCard, TopBar } from '../ui/components'
import { Icon } from '../ui/Icon'

const GROUPS: { kind: Creator['kind']; title: string }[] = [
  { kind: 'external', title: 'Creators we bake from' },
  { kind: 'family', title: 'Family' },
  { kind: 'person', title: 'Us' },
]

export function CreatorsPage() {
  const s = useStore()
  const count = (id: string) => s.recipes.filter((r) => r.creatorId === id).length
  return (
    <div className="page">
      <h1 className="page-title">Creators</h1>
      <p className="lede">Where our recipes come from. Every outside recipe links back to its creator.</p>
      {GROUPS.map((g) => {
        const list = s.data.creators.filter((c) => c.kind === g.kind)
        if (!list.length) return null
        return (
          <section key={g.kind} className="block">
            <h2>{g.title}</h2>
            <ul className="creator-list">
              {list.map((c) => {
                const u = c.userId ? s.data.users.find((x) => x.id === c.userId) : undefined
                return (
                  <li key={c.id}>
                    <Link to={`/creators/${c.id}`} className="creator-row">
                      {u ? (
                        <Avatar name={u.name} color={u.avatarColor} size={44} />
                      ) : (
                        <span className="creator-row__icon">
                          <Icon name={c.kind === 'family' ? 'people' : 'globe'} />
                        </span>
                      )}
                      <span className="creator-row__text">
                        <strong>{c.name}</strong>
                        <span className="muted small">
                          {count(c.id)} {count(c.id) === 1 ? 'recipe' : 'recipes'}
                          {c.website ? ` · ${c.website.replace(/^https?:\/\/(www\.)?/, '')}` : ''}
                        </span>
                      </span>
                      <Icon name="next" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function CreatorPage() {
  const { id = '' } = useParams()
  const s = useStore()
  const c = s.creator(id)
  if (!c) return <p className="page">Creator not found.</p>
  const recipes = s.recipes.filter((r) => r.creatorId === c.id)
  const host = c.website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  return (
    <div className="page">
      <TopBar back />
      <header className={`creator-hero creator-hero--${c.kind}`}>
        <p className="eyebrow">{c.kind === 'external' ? 'Recipe creator' : c.kind === 'family' ? 'Family' : 'One of us'}</p>
        <h1 className="display">{c.name}</h1>
        {c.blurb && <p className="lede">{c.blurb}</p>}
        {c.website && (
          <a href={c.website} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
            Visit {host} <Icon name="external" size={18} />
          </a>
        )}
        {c.kind === 'external' && (
          <p className="fineprint">
            Recipes on this page belong to {c.name}. We keep links, our notes and our bakes — open the original for the full recipe, and support the creator.
          </p>
        )}
      </header>
      <p className="result-count">
        {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} in our library
      </p>
      <div className="grid">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} variant="grid" />
        ))}
      </div>
    </div>
  )
}
