import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { uid } from '../domain/parse'
import type { BakeEntry, Collection, Creator, Photo, Recipe, User } from '../domain/types'
import { STORES, emptySnapshot, idbKey, keyOf, openRepository, type Repository, type Snapshot } from './repository'
import { RETIRED_SEED_IDS, SEED_VERSION, buildSeed } from './seed'
import { SyncEngine, SyncedRepository, claimProfile, detectServer, type Me, type SyncStatus } from './sync'

/**
 * App-wide state. Loads everything once (a family library is small), keeps it
 * in memory, and writes each change through the Repository.
 *
 * Two modes, chosen at start-up:
 *  - On the family server (Cloudflare, behind Access login): the signed-in
 *    email decides the profile, and changes sync between devices (sync.ts).
 *  - Anywhere else (preview, local dev): everything stays on this device and
 *    "Who's baking?" is a simple profile switch.
 */

const USER_KEY = 'hearth.currentUser'
const SEED_KEY = 'hearth.seedVersion'

/**
 * Brings an existing library up to the current sample data without touching
 * anything the family changed: adds missing records, fills in built-in
 * collection descriptions, and drops retired sample recipes nobody used.
 */
async function mergeSeed(r: Repository, snap: Snapshot): Promise<Snapshot> {
  const seed = buildSeed()
  const out = { ...snap }
  for (const store of STORES) {
    const have = new Set((snap[store] as object[]).map((v) => keyOf(store, v)))
    const add = (seed[store] as object[]).filter((v) => !have.has(keyOf(store, v)))
    for (const v of add) await r.put(store, v as never)
    ;(out[store] as object[]) = [...(snap[store] as object[]), ...add]
  }
  out.collections = await Promise.all(
    out.collections.map(async (c) => {
      const s = seed.collections.find((x) => x.id === c.id)
      if (s?.description && !c.description) {
        const next = { ...c, description: s.description }
        await r.put('collections', next)
        return next
      }
      return c
    }),
  )
  for (const id of RETIRED_SEED_IDS) {
    const used = out.bakes.some((b) => b.recipeId === id) || out.notes.some((n) => n.recipeId === id)
    if (used || !out.recipes.some((x) => x.id === id)) continue
    await r.remove('recipes', id)
    for (const rc of out.recipeCollections.filter((x) => x.recipeId === id)) await r.remove('recipeCollections', idbKey('recipeCollections', rc))
    for (const f of out.favorites.filter((x) => x.recipeId === id)) await r.remove('favorites', idbKey('favorites', f))
    out.recipes = out.recipes.filter((x) => x.id !== id)
    out.recipeCollections = out.recipeCollections.filter((x) => x.recipeId !== id)
    out.favorites = out.favorites.filter((x) => x.recipeId !== id)
  }
  return out
}

function readLocal(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLocal(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* storage unavailable — fine, it's only a convenience */
  }
}

interface Store {
  ready: boolean
  persistent: boolean
  data: Snapshot
  user: User
  setUser(id: string): void
  updateUser(patch: Partial<User>): void
  addUser(name: string): User

  /** Recipes this user may see: shared ones plus their own private ones. */
  recipes: Recipe[]
  recipe(id: string): Recipe | undefined
  creator(id: string): Creator | undefined
  /** Built-in collections plus the current user's own. */
  collections: Collection[]
  collectionsOf(recipeId: string): Collection[]
  recipesIn(collectionId: string): Recipe[]
  addCollection(name: string): Collection
  renameCollection(id: string, name: string, description?: string): void
  deleteCollection(id: string): void
  toggleInCollection(recipeId: string, collectionId: string): void

  isFavorite(recipeId: string): boolean
  toggleFavorite(recipeId: string): void

  noteFor(recipeId: string): string
  saveNote(recipeId: string, text: string): void

  bakesFor(recipeId: string): BakeEntry[]
  saveBake(b: BakeEntry): void
  deleteBake(id: string): void

  saveRecipe(r: Recipe, collectionIds: string[]): void
  deleteRecipe(id: string): void
  addCreator(c: Omit<Creator, 'id'>): Creator

  /** Present when running on the family server. */
  sync?: {
    email: string
    status: SyncStatus
    lastSynced?: Date
    pending: number
    /** Profiles already linked to someone's email. */
    claimed: string[]
    /** This email isn't linked to a profile yet. */
    needsProfile: boolean
    claim(userId: string): Promise<string | null>
    syncNow(): void
  }

  addPhoto(file: File, kind: Photo['kind']): Promise<string>
  photoUrl(id?: string): string | undefined
  resetSampleData(): Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

const GUEST: User = { id: 'u_guest', name: 'Guest', avatarColor: '#8A4B22', unitSystem: 'metric', showOriginal: true, createdAt: new Date(0).toISOString() }

export function StoreProvider({ children }: { children: ReactNode }) {
  const repo = useRef<Repository | null>(null)
  const [data, setData] = useState<Snapshot>(emptySnapshot)
  const [ready, setReady] = useState(false)
  const [persistent, setPersistent] = useState(true)
  const [userId, setUserId] = useState<string>(() => readLocal(USER_KEY) ?? 'u_chris')
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const loadingPhotos = useRef(new Set<string>())

  const engine = useRef<SyncEngine | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [syncTick, setSyncTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const local = await openRepository()
      const server = local.persistent ? await detectServer() : null
      let snap = await local.loadAll()
      const localEmpty = snap.recipes.length === 0 && snap.users.length === 0

      if (server) {
        const e = new SyncEngine(local)
        await e.load()
        const synced = new SyncedRepository(local, e)
        repo.current = synced
        engine.current = e
        if (server.empty) {
          // First device on a fresh server: this device's library becomes the family's.
          if (localEmpty) {
            snap = buildSeed()
            await local.replaceAll(snap)
          } else if (Number(readLocal(SEED_KEY) ?? 1) < SEED_VERSION) {
            snap = await mergeSeed(local, snap)
          }
          e.queueAllAsSeed(snap)
          e.setSeedVersion(SEED_VERSION)
        } else if (!e.hasCursor) {
          // New device: offer what's here (never overwriting), then fetch the family library.
          if (!localEmpty) e.queueAllAsSeed(snap)
          await e.run()
          snap = await local.loadAll()
        }
        if (!server.empty && server.seedVersion < SEED_VERSION) {
          synced.seeding = true
          snap = await mergeSeed(synced, snap)
          synced.seeding = false
          e.setSeedVersion(SEED_VERSION)
        }
        writeLocal(SEED_KEY, String(SEED_VERSION))
        e.onRemote = async () => {
          const next = await local.loadAll()
          if (!cancelled) setData(next)
        }
        e.subscribe(() => setSyncTick((x) => x + 1))
        e.start()
        e.schedule(100)
        if (server.userId) setUserId(server.userId)
        setMe(server)
      } else {
        repo.current = local
        if (localEmpty) {
          snap = buildSeed()
          await local.replaceAll(snap)
          writeLocal(SEED_KEY, String(SEED_VERSION))
        } else if (Number(readLocal(SEED_KEY) ?? 1) < SEED_VERSION) {
          snap = await mergeSeed(local, snap)
          writeLocal(SEED_KEY, String(SEED_VERSION))
        }
      }
      if (cancelled) return
      setPersistent(local.persistent)
      setData(snap)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const user = data.users.find((u) => u.id === userId) ?? data.users[0] ?? GUEST

  /** Apply a change to memory immediately; persist in the background. */
  const mutate = useCallback((fn: (s: Snapshot) => Snapshot, persist: (r: Repository) => Promise<void>) => {
    setData((s) => fn(s))
    const r = repo.current
    if (r) persist(r).catch((e) => console.error('save failed', e))
  }, [])

  const store = useMemo<Store>(() => {
    const visible = data.recipes.filter((r) => r.visibility === 'shared' || r.ownerId === user.id)
    const myCollections = data.collections.filter((c) => c.ownerId === null || c.ownerId === user.id).sort((a, b) => a.sort - b.sort)
    const now = () => new Date().toISOString()

    return {
      ready,
      persistent,
      data,
      user,
      setUser(id) {
        if (me) return // on the server, the login decides who you are
        setUserId(id)
        writeLocal(USER_KEY, id)
      },
      sync: me
        ? {
            email: me.email,
            status: engine.current?.status ?? 'syncing',
            lastSynced: engine.current?.lastSynced,
            pending: engine.current?.pending ?? 0,
            claimed: me.claimed,
            needsProfile: !me.userId,
            async claim(id) {
              const err = await claimProfile(id)
              if (!err) {
                setMe({ ...me, userId: id, claimed: [...me.claimed, id] })
                setUserId(id)
              }
              return err
            },
            syncNow: () => void engine.current?.run(),
          }
        : undefined,
      updateUser(patch) {
        const u = { ...user, ...patch }
        mutate((s) => ({ ...s, users: s.users.map((x) => (x.id === u.id ? u : x)) }), (r) => r.put('users', u))
      },
      addUser(name) {
        const palette = ['#C8643B', '#7A8B6F', '#B0853A', '#6D7FA3', '#A15C7A']
        const u: User = { id: uid('u_'), name, avatarColor: palette[data.users.length % palette.length], unitSystem: 'metric', showOriginal: true, createdAt: now() }
        const c: Creator = { id: uid('c_'), name, kind: 'person', userId: u.id }
        mutate(
          (s) => ({ ...s, users: [...s.users, u], creators: [...s.creators, c] }),
          async (r) => {
            await r.put('users', u)
            await r.put('creators', c)
          },
        )
        return u
      },

      recipes: visible,
      recipe: (id) => visible.find((r) => r.id === id),
      creator: (id) => data.creators.find((c) => c.id === id),
      collections: myCollections,
      collectionsOf(recipeId) {
        const ids = new Set(data.recipeCollections.filter((rc) => rc.recipeId === recipeId).map((rc) => rc.collectionId))
        return myCollections.filter((c) => ids.has(c.id))
      },
      addCollection(name) {
        const c: Collection = { id: uid('col_'), name: name.trim(), ownerId: user.id, sort: 100 + data.collections.length }
        mutate((s) => ({ ...s, collections: [...s.collections, c] }), (r) => r.put('collections', c))
        return c
      },
      renameCollection(id, name, description) {
        const c = data.collections.find((x) => x.id === id)
        if (!c || c.ownerId !== user.id) return
        const next = { ...c, name: name.trim() || c.name, description: description?.trim() || undefined }
        mutate((s) => ({ ...s, collections: s.collections.map((x) => (x.id === id ? next : x)) }), (r) => r.put('collections', next))
      },
      deleteCollection(id) {
        const c = data.collections.find((x) => x.id === id)
        if (!c || c.ownerId !== user.id) return
        const links = data.recipeCollections.filter((x) => x.collectionId === id)
        mutate(
          (s) => ({ ...s, collections: s.collections.filter((x) => x.id !== id), recipeCollections: s.recipeCollections.filter((x) => x.collectionId !== id) }),
          async (r) => {
            await r.remove('collections', id)
            for (const l of links) await r.remove('recipeCollections', [l.recipeId, l.collectionId])
          },
        )
      },
      toggleInCollection(recipeId, collectionId) {
        const has = data.recipeCollections.some((x) => x.recipeId === recipeId && x.collectionId === collectionId)
        const rc = { recipeId, collectionId }
        if (has) mutate((s) => ({ ...s, recipeCollections: s.recipeCollections.filter((x) => !(x.recipeId === recipeId && x.collectionId === collectionId)) }), (r) => r.remove('recipeCollections', [recipeId, collectionId]))
        else mutate((s) => ({ ...s, recipeCollections: [...s.recipeCollections, rc] }), (r) => r.put('recipeCollections', rc))
      },
      recipesIn(collectionId) {
        const ids = new Set(data.recipeCollections.filter((rc) => rc.collectionId === collectionId).map((rc) => rc.recipeId))
        return visible.filter((r) => ids.has(r.id))
      },

      isFavorite: (rid) => data.favorites.some((f) => f.userId === user.id && f.recipeId === rid),
      toggleFavorite(rid) {
        const exists = data.favorites.some((f) => f.userId === user.id && f.recipeId === rid)
        if (exists) {
          mutate((s) => ({ ...s, favorites: s.favorites.filter((f) => !(f.userId === user.id && f.recipeId === rid)) }), (r) => r.remove('favorites', [user.id, rid]))
        } else {
          const f = { userId: user.id, recipeId: rid, createdAt: now() }
          mutate((s) => ({ ...s, favorites: [...s.favorites, f] }), (r) => r.put('favorites', f))
        }
      },

      noteFor: (rid) => data.notes.find((n) => n.userId === user.id && n.recipeId === rid)?.text ?? '',
      saveNote(rid, text) {
        const existing = data.notes.find((n) => n.userId === user.id && n.recipeId === rid)
        if (!text.trim()) {
          if (existing) mutate((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== existing.id) }), (r) => r.remove('notes', existing.id))
          return
        }
        const note = existing ? { ...existing, text, updatedAt: now() } : { id: uid('n_'), userId: user.id, recipeId: rid, text, createdAt: now(), updatedAt: now() }
        mutate((s) => ({ ...s, notes: [...s.notes.filter((n) => n.id !== note.id), note] }), (r) => r.put('notes', note))
      },

      bakesFor: (rid) => data.bakes.filter((b) => b.recipeId === rid).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      saveBake(b) {
        mutate((s) => ({ ...s, bakes: [...s.bakes.filter((x) => x.id !== b.id), b] }), (r) => r.put('bakes', b))
      },
      deleteBake(id) {
        const b = data.bakes.find((x) => x.id === id)
        mutate(
          (s) => ({ ...s, bakes: s.bakes.filter((x) => x.id !== id) }),
          async (r) => {
            await r.remove('bakes', id)
            for (const p of b?.photoIds ?? []) await r.removePhoto(p)
          },
        )
      },

      saveRecipe(recipe, collectionIds) {
        const rcs = collectionIds.map((c) => ({ recipeId: recipe.id, collectionId: c }))
        const old = data.recipeCollections.filter((rc) => rc.recipeId === recipe.id)
        mutate(
          (s) => ({
            ...s,
            recipes: [...s.recipes.filter((r) => r.id !== recipe.id), recipe],
            recipeCollections: [...s.recipeCollections.filter((rc) => rc.recipeId !== recipe.id), ...rcs],
          }),
          async (r) => {
            await r.put('recipes', recipe)
            for (const rc of old) await r.remove('recipeCollections', [rc.recipeId, rc.collectionId])
            for (const rc of rcs) await r.put('recipeCollections', rc)
          },
        )
      },
      deleteRecipe(id) {
        mutate(
          (s) => ({
            ...s,
            recipes: s.recipes.filter((r) => r.id !== id),
            recipeCollections: s.recipeCollections.filter((x) => x.recipeId !== id),
            favorites: s.favorites.filter((x) => x.recipeId !== id),
            notes: s.notes.filter((x) => x.recipeId !== id),
            bakes: s.bakes.filter((x) => x.recipeId !== id),
          }),
          async (r) => {
            await r.remove('recipes', id)
            for (const x of data.recipeCollections.filter((x) => x.recipeId === id)) await r.remove('recipeCollections', [x.recipeId, x.collectionId])
            for (const x of data.favorites.filter((x) => x.recipeId === id)) await r.remove('favorites', [x.userId, x.recipeId])
            for (const x of data.notes.filter((x) => x.recipeId === id)) await r.remove('notes', x.id)
            for (const x of data.bakes.filter((x) => x.recipeId === id)) await r.remove('bakes', x.id)
          },
        )
      },
      addCreator(c) {
        const full = { ...c, id: uid('c_') }
        mutate((s) => ({ ...s, creators: [...s.creators, full] }), (r) => r.put('creators', full))
        return full
      },

      async addPhoto(file, kind) {
        const { blob, width, height } = await compressImage(file)
        const p: Photo = { id: uid('p_'), ownerId: user.id, kind, blob, width, height, createdAt: now() }
        await repo.current?.putPhoto(p)
        setPhotoUrls((m) => ({ ...m, [p.id]: URL.createObjectURL(blob) }))
        return p.id
      },
      photoUrl(id) {
        if (!id) return undefined
        if (photoUrls[id]) return photoUrls[id]
        if (!loadingPhotos.current.has(id) && repo.current) {
          loadingPhotos.current.add(id)
          repo.current.getPhoto(id).then((p) => {
            // Not on this phone yet? Load it from the family server.
            const url = p ? URL.createObjectURL(p.blob) : me ? `api/photos/${id}` : undefined
            if (url) setPhotoUrls((m) => ({ ...m, [id]: url }))
          })
        }
        return undefined
      },
      async resetSampleData() {
        const snap = buildSeed()
        await repo.current?.replaceAll(snap)
        writeLocal(SEED_KEY, String(SEED_VERSION))
        setData(snap)
      },
    }
  }, [data, ready, persistent, user, mutate, photoUrls, me, syncTick])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

/** Resize to max 1600 px and re-encode as JPEG so photos stay small on-device. */
async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return { blob: file, width: 0, height: 0 }
  const max = 1600
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * k)
  const h = Math.round(bmp.height * k)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  return { blob: blob ?? file, width: w, height: h }
}
