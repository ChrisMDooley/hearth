import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreProvider, useStore } from './data/store'
import { Icon } from './ui/Icon'
import { TimerProvider, TimerTray } from './ui/timers'
import { HomePage } from './pages/Home'
import { BrowsePage } from './pages/Browse'
import { RecipePage } from './pages/Recipe'
import { CookMode } from './pages/CookMode'
import { CreatorsPage, CreatorPage } from './pages/Creators'
import { AddPage } from './pages/Add'
import { EditorPage } from './pages/Editor'
import { ProfilePage } from './pages/Profile'
import { CollectionsPage } from './pages/Collections'

/**
 * Hash routing keeps the app hostable on any static host (and inside a
 * single-file preview) without server rewrite rules.
 */
export default function App() {
  return (
    <StoreProvider>
      <TimerProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </TimerProvider>
    </StoreProvider>
  )
}

function Shell() {
  const { ready, persistent } = useStore()
  const loc = useLocation()
  const cooking = loc.pathname.endsWith('/cook')
  useEffect(() => {
    if (!cooking) window.scrollTo(0, 0)
  }, [loc.pathname, cooking])

  if (!ready) {
    return (
      <div className="splash">
        <span className="brand">Hearth</span>
      </div>
    )
  }
  return (
    <div className={`shell ${cooking ? 'shell--cooking' : ''}`}>
      {!cooking && <NavBar />}
      <main className="main">
        {!persistent && <p className="banner">This browser isn’t saving data — changes last until you close the page.</p>}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/recipe/:id" element={<RecipePage />} />
          <Route path="/recipe/:id/cook" element={<CookMode />} />
          <Route path="/recipe/:id/edit" element={<EditorPage />} />
          <Route path="/new" element={<EditorPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/creators" element={<CreatorsPage />} />
          <Route path="/creators/:id" element={<CreatorPage />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      {!cooking && <TimerTray />}
    </div>
  )
}

function NavBar() {
  const item = (to: string, icon: Parameters<typeof Icon>[0]['name'], label: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}>
      <Icon name={icon} />
      <span>{label}</span>
    </NavLink>
  )
  return (
    <nav className="nav" aria-label="Main">
      <span className="nav__brand brand">Hearth</span>
      {item('/', 'home', 'Home', true)}
      {item('/browse', 'search', 'Recipes')}
      <NavLink to="/add" className={({ isActive }) => `nav__add ${isActive ? 'is-active' : ''}`} aria-label="Add recipe">
        <Icon name="plus" size={26} />
        <span>Add</span>
      </NavLink>
      {item('/creators', 'book', 'Creators')}
      {item('/me', 'user', 'Me')}
    </nav>
  )
}
