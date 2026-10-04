import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useStore } from '../data/store'
import { Icon } from '../ui/Icon'
import { Avatar, RecipeCard, RecipeImage, Rail, Stars, formatDay } from '../ui/components'

function greeting() {
  const h = new Date().getHours()
  return h < 11 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function HomePage() {
  const s = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const { user, recipes, data } = s

  const favorites = data.favorites
    .filter((f) => f.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((f) => s.recipe(f.recipeId))
    .filter((r) => !!r)

  const seen = new Set<string>()
  const recentBakes = [...data.bakes]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((b) => (seen.has(b.recipeId) ? false : (seen.add(b.recipeId), true)))
    .slice(0, 4)

  const recentlyAdded = [...recipes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
  const mine = recipes.filter((r) => r.createdBy === user.id && r.kind !== 'creator')
  const family = s.recipesIn('col_family')

  // The external creator we have the most recipes from gets its own shelf.
  const externals = data.creators.filter((c) => c.kind === 'external')
  const counts = externals.map((c) => ({ c, n: recipes.filter((r) => r.creatorId === c.id).length })).sort((a, b) => b.n - a.n)
  const featured = counts[0]?.n ? counts[0].c : undefined

  const shelves = s.collections.filter((c) => c.ownerId === user.id || ['col_bread', 'col_sourdough', 'col_discard', 'col_cakes', 'col_cookies', 'col_muffins', 'col_christmas', 'col_quick', 'col_kids'].includes(c.id))

  return (
    <div className="page home">
      <header className="home__head">
        <div>
          <p className="eyebrow">
            {greeting()}, {user.name}
          </p>
          <h1 className="display">What are we baking?</h1>
        </div>
        <Link to="/me" aria-label="Profile">
          <Avatar name={user.name} color={user.avatarColor} size={44} />
        </Link>
      </header>

      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          nav(`/browse?q=${encodeURIComponent(q)}`)
        }}
      >
        <Icon name="search" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes, ingredients, notes…" aria-label="Search" enterKeyHint="search" />
      </form>

      <div className="chips" role="list">
        {shelves.map((c) => (
          <Link role="listitem" key={c.id} to={`/browse?col=${c.id}`} className="chip">
            {c.name}
          </Link>
        ))}
        <Link role="listitem" to="/collections" className="chip chip--soft">
          <Icon name="grid" size={15} /> All collections
        </Link>
      </div>

      <Rail title="Favourites" to="/browse?fav=1" empty={<p className="empty-line">Tap the ♥ on any recipe to keep it here.</p>}>
        {favorites.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </Rail>

      {recentBakes.length > 0 && (
        <section className="rail">
          <header className="rail__head">
            <h2>Recently baked</h2>
          </header>
          <ul className="bake-list">
            {recentBakes.map((b) => {
              const r = s.recipe(b.recipeId)
              const who = data.users.find((u) => u.id === b.userId)
              if (!r) return null
              return (
                <li key={b.id}>
                  <Link to={`/recipe/${r.id}#bakes`} className="bake-row">
                    {b.photoIds[0] && s.photoUrl(b.photoIds[0]) ? (
                      <img src={s.photoUrl(b.photoIds[0])} alt="" className="bake-row__img cover" />
                    ) : (
                      <RecipeImage recipe={r} className="bake-row__img" />
                    )}
                    <div className="bake-row__text">
                      <strong>{r.title}</strong>
                      <span>
                        {who?.name} · {formatDay(b.date)}
                      </span>
                      <Stars value={b.rating} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {featured && (
        <Rail title={featured.name} to={`/creators/${featured.id}`}>
          {recipes
            .filter((r) => r.creatorId === featured.id)
            .map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
        </Rail>
      )}

      <Rail title="Family recipes" to="/browse?col=col_family">
        {family.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </Rail>

      <section className="rail">
        <header className="rail__head">
          <h2>Creators</h2>
          <Link to="/creators" className="rail__more">
            See all
          </Link>
        </header>
        <div className="chips chips--creators">
          {data.creators.map((c) => (
            <Link key={c.id} to={`/creators/${c.id}`} className="chip chip--creator">
              {c.kind === 'external' ? <Icon name="globe" size={16} /> : c.kind === 'family' ? <Icon name="people" size={16} /> : <Icon name="user" size={16} />}
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <Rail title="Recently added" to="/browse?sort=new">
        {recentlyAdded.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </Rail>

      {mine.length > 0 && (
        <Rail title={`${user.name}’s recipes`} to={`/browse?by=${user.id}`}>
          {mine.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </Rail>
      )}
    </div>
  )
}
