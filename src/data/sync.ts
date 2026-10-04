import type { Photo } from '../domain/types'
import { keyFromString, keyOf, STORES, type Repository, type Snapshot, type StoreName } from './repository'

/**
 * Offline-first sync with the family server (functions/api).
 *
 * The phone's own database stays the source the app reads from, so recipes
 * open instantly and work without signal. Every local change also goes into an
 * outbox; the engine sends the outbox and pulls everyone else's changes:
 * on start, shortly after each edit, when the app comes back into view or
 * online, and once a minute while open. Conflicts: last write wins per record,
 * and a record with an unsent local change is never overwritten by the server.
 */

export interface Change {
  store: StoreName
  key: string
  data: object | null
  seed?: boolean
}

export interface Me {
  email: string
  userId: string | null
  claimed: string[]
  empty: boolean
  seedVersion: number
}

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'error'

/** Is the family server here (and am I signed in)? null = run on this device only. */
export async function detectServer(): Promise<Me | null> {
  try {
    const res = await fetch('api/me', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
    const me = (await res.json()) as Me
    return me.email ? me : null
  } catch {
    return null
  }
}

export async function claimProfile(userId: string): Promise<string | null> {
  const res = await fetch('api/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
  if (res.ok) return null
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'That didn’t work — try again.'
}

export class SyncEngine {
  status: SyncStatus = 'syncing'
  lastSynced?: Date
  private outbox: Change[] = []
  private photoQueue: string[] = []
  private cursor = 0
  private seedVersion?: number
  private timer?: ReturnType<typeof setTimeout>
  private running?: Promise<void>
  private again = false
  private listeners = new Set<() => void>()
  /** Called with the records that arrived from other devices. */
  onRemote: (changes: Change[]) => void = () => {}

  private local: Repository
  constructor(local: Repository) {
    this.local = local
  }

  async load() {
    this.outbox = (await this.local.getMeta<Change[]>('outbox')) ?? []
    this.photoQueue = (await this.local.getMeta<string[]>('photoQueue')) ?? []
    this.cursor = (await this.local.getMeta<number>('cursor')) ?? 0
  }

  get hasCursor() {
    return this.cursor > 0
  }
  get pending() {
    return this.outbox.length + this.photoQueue.length
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit() {
    this.listeners.forEach((l) => l())
  }

  queue(c: Change, delay = 1200) {
    this.outbox = [...this.outbox.filter((x) => !(x.store === c.store && x.key === c.key)), c]
    void this.local.setMeta('outbox', this.outbox)
    this.schedule(delay)
  }

  /** Offer everything on this device to the server without overwriting anything there. */
  queueAllAsSeed(s: Snapshot) {
    for (const store of STORES) for (const v of s[store] as object[]) this.outbox.push({ store, key: keyOf(store, v), data: v, seed: true })
    void this.local.setMeta('outbox', this.outbox)
  }

  queuePhoto(id: string) {
    if (!this.photoQueue.includes(id)) this.photoQueue.push(id)
    void this.local.setMeta('photoQueue', this.photoQueue)
    this.schedule(500)
  }

  setSeedVersion(v: number) {
    this.seedVersion = v
  }

  schedule(delay: number) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), delay)
  }

  /** Runs one sync; concurrent calls fold into one more pass afterwards. */
  run(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.loop().finally(() => {
      this.running = undefined
      if (this.again) {
        this.again = false
        void this.run()
      }
    })
    return this.running
  }

  private async loop() {
    this.status = 'syncing'
    this.emit()
    try {
      let more = true
      while (more) {
        const batch = this.outbox.slice(0, 200)
        const res = await fetch('api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor: this.cursor, changes: batch, seedVersion: this.seedVersion }),
        })
        if (!res.ok) throw new Error(`sync ${res.status}`)
        const body = (await res.json()) as { cursor: number; changes: Change[]; more: boolean; rejected: string[] }
        if (body.rejected.length) console.warn('Server rejected', body.rejected)
        // Drop what was sent, unless it changed again meanwhile.
        this.outbox = this.outbox.filter((c) => !batch.includes(c))
        await this.local.setMeta('outbox', this.outbox)
        this.seedVersion = undefined

        const applied = await this.applyRemote(body.changes)
        this.cursor = body.cursor
        await this.local.setMeta('cursor', this.cursor)
        if (applied.length) this.onRemote(applied)
        more = body.more || this.outbox.length > 0
      }
      await this.uploadPhotos()
      this.status = 'synced'
      this.lastSynced = new Date()
    } catch (e) {
      console.warn('sync failed', e)
      this.status = navigator.onLine === false ? 'offline' : 'error'
      this.schedule(30_000)
    }
    this.emit()
  }

  private async applyRemote(changes: Change[]): Promise<Change[]> {
    const pending = new Set(this.outbox.map((c) => `${c.store}:${c.key}`))
    const applied: Change[] = []
    for (const c of changes) {
      if (pending.has(`${c.store}:${c.key}`)) continue
      if (c.data) await this.local.put(c.store, c.data as never)
      else await this.local.remove(c.store, keyFromString(c.store, c.key))
      applied.push(c)
    }
    return applied
  }

  private async uploadPhotos() {
    for (const id of [...this.photoQueue]) {
      const p = await this.local.getPhoto(id)
      if (p) {
        const res = await fetch(`api/photos/${id}`, { method: 'PUT', headers: { 'Content-Type': p.blob.type || 'image/jpeg' }, body: p.blob })
        if (!res.ok) throw new Error(`photo upload ${res.status}`)
      }
      this.photoQueue = this.photoQueue.filter((x) => x !== id)
      await this.local.setMeta('photoQueue', this.photoQueue)
    }
  }

  /** Keep syncing while the app is open. */
  start() {
    const kick = () => document.visibilityState === 'visible' && this.schedule(200)
    document.addEventListener('visibilitychange', kick)
    window.addEventListener('online', kick)
    setInterval(() => document.visibilityState === 'visible' && void this.run(), 60_000)
  }
}

/** Local database + outbox: every write is also queued for the server. */
export class SyncedRepository implements Repository {
  readonly persistent = true
  private local: Repository
  private engine: SyncEngine
  /** While true, writes are sample data (insert-if-absent on the server). */
  seeding = false

  constructor(local: Repository, engine: SyncEngine) {
    this.local = local
    this.engine = engine
  }

  loadAll() {
    return this.local.loadAll()
  }
  replaceAll(s: Snapshot) {
    return this.local.replaceAll(s)
  }
  async put<K extends StoreName>(store: K, value: Snapshot[K][number]) {
    await this.local.put(store, value)
    this.engine.queue({ store, key: keyOf(store, value as object), data: value as object, seed: this.seeding || undefined })
  }
  async remove(store: StoreName, key: IDBValidKey) {
    await this.local.remove(store, key)
    this.engine.queue({ store, key: Array.isArray(key) ? key.join('|') : String(key), data: null })
  }
  async putPhoto(p: Photo) {
    await this.local.putPhoto(p)
    this.engine.queuePhoto(p.id)
  }
  getPhoto(id: string) {
    return this.local.getPhoto(id)
  }
  removePhoto(id: string) {
    return this.local.removePhoto(id)
  }
  getMeta<T>(k: string) {
    return this.local.getMeta<T>(k)
  }
  setMeta(k: string, v: unknown) {
    return this.local.setMeta(k, v)
  }
}
