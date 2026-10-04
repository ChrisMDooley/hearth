import { openDB, type IDBPDatabase } from 'idb'
import type {
  BakeEntry,
  Collection,
  Creator,
  Favorite,
  Photo,
  Recipe,
  RecipeCollection,
  User,
  UserRecipeNote,
} from '../domain/types'

/**
 * Data access boundary. The UI only talks to `Repository`; swapping the
 * on-device IndexedDB implementation for a server (Supabase, PocketBase, a
 * small API) means writing another class with the same interface.
 */
export interface Snapshot {
  users: User[]
  creators: Creator[]
  recipes: Recipe[]
  collections: Collection[]
  recipeCollections: RecipeCollection[]
  favorites: Favorite[]
  notes: UserRecipeNote[]
  bakes: BakeEntry[]
}

export type StoreName = keyof Snapshot

export interface Repository {
  /** False when data only lives in memory (e.g. private browsing). */
  readonly persistent: boolean
  loadAll(): Promise<Snapshot>
  replaceAll(s: Snapshot): Promise<void>
  put<K extends StoreName>(store: K, value: Snapshot[K][number]): Promise<void>
  remove(store: StoreName, key: IDBValidKey): Promise<void>
  putPhoto(p: Photo): Promise<void>
  getPhoto(id: string): Promise<Photo | undefined>
  removePhoto(id: string): Promise<void>
}

const KEYS: Record<StoreName, string | string[]> = {
  users: 'id',
  creators: 'id',
  recipes: 'id',
  collections: 'id',
  recipeCollections: ['recipeId', 'collectionId'],
  favorites: ['userId', 'recipeId'],
  notes: 'id',
  bakes: 'id',
}

const STORES = Object.keys(KEYS) as StoreName[]

export function emptySnapshot(): Snapshot {
  return { users: [], creators: [], recipes: [], collections: [], recipeCollections: [], favorites: [], notes: [], bakes: [] }
}

class IndexedDbRepository implements Repository {
  readonly persistent = true
  private db: IDBPDatabase

  constructor(db: IDBPDatabase) {
    this.db = db
  }

  async loadAll(): Promise<Snapshot> {
    const s = emptySnapshot()
    for (const name of STORES) (s[name] as unknown[]) = await this.db.getAll(name)
    return s
  }

  async replaceAll(s: Snapshot) {
    const tx = this.db.transaction([...STORES, 'photos'], 'readwrite')
    for (const name of STORES) {
      await tx.objectStore(name).clear()
      for (const v of s[name]) await tx.objectStore(name).put(v)
    }
    await tx.objectStore('photos').clear()
    await tx.done
  }

  async put<K extends StoreName>(store: K, value: Snapshot[K][number]) {
    await this.db.put(store, value)
  }

  async remove(store: StoreName, key: IDBValidKey) {
    await this.db.delete(store, key)
  }

  async putPhoto(p: Photo) {
    await this.db.put('photos', p)
  }

  async getPhoto(id: string) {
    return (await this.db.get('photos', id)) as Photo | undefined
  }

  async removePhoto(id: string) {
    await this.db.delete('photos', id)
  }
}

/** Used when IndexedDB is unavailable — the app still works for the session. */
class MemoryRepository implements Repository {
  readonly persistent = false
  private s = emptySnapshot()
  private photos = new Map<string, Photo>()

  async loadAll() {
    return structuredClone(this.s)
  }
  async replaceAll(s: Snapshot) {
    this.s = structuredClone(s)
    this.photos.clear()
  }
  async put<K extends StoreName>(store: K, value: Snapshot[K][number]) {
    type Row = Record<string, unknown>
    const list = this.s[store] as unknown as Row[]
    const v = value as unknown as Row
    const fields: string[] = ([] as string[]).concat(KEYS[store])
    const i = list.findIndex((x) => fields.every((f) => x[f] === v[f]))
    if (i >= 0) list[i] = v
    else list.push(v)
  }
  async remove(store: StoreName, key: IDBValidKey) {
    const k = KEYS[store]
    const list = this.s[store] as unknown as Record<string, unknown>[]
    const keyArr = Array.isArray(key) ? key : [key]
    const fields = Array.isArray(k) ? k : [k]
    const i = list.findIndex((v) => fields.every((f, j) => v[f] === keyArr[j]))
    if (i >= 0) list.splice(i, 1)
  }
  async putPhoto(p: Photo) {
    this.photos.set(p.id, p)
  }
  async getPhoto(id: string) {
    return this.photos.get(id)
  }
  async removePhoto(id: string) {
    this.photos.delete(id)
  }
}

export async function openRepository(): Promise<Repository> {
  try {
    const open = openDB('hearth', 1, {
      upgrade(db) {
        for (const name of STORES) db.createObjectStore(name, { keyPath: KEYS[name] })
        db.createObjectStore('photos', { keyPath: 'id' })
      },
    })
    // Some embedded/private contexts never resolve the open request.
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('IndexedDB open timed out')), 4000))
    const db = await Promise.race([open, timeout])
    return new IndexedDbRepository(db)
  } catch (e) {
    console.warn('IndexedDB unavailable, using memory storage', e)
    return new MemoryRepository()
  }
}
