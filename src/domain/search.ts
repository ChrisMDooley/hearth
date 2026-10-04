import { totalMinutes } from './parse'
import type { Collection, Creator, Recipe } from './types'

export interface SearchContext {
  creator(id: string): Creator | undefined
  collectionsOf(id: string): Collection[]
  /** The current user's own note on the recipe. */
  noteFor(id: string): string
}

/**
 * Plain-language-ish search. Every word must match somewhere (title,
 * ingredients, tags, creator, category, collections, source, own notes).
 * Understands "under 2 hours" / "under 45 min" as a time limit and ignores
 * filler like "recipes with".
 */
export function parseQuery(q: string): { words: string[]; maxMinutes?: number } {
  let text = q.toLowerCase()
  let maxMinutes: number | undefined
  const m = text.match(/(?:under|less than|<)\s*(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b/)
  if (m) {
    const n = Number(m[1].replace(',', '.'))
    maxMinutes = /^h/.test(m[2]) ? n * 60 : n
    text = text.replace(m[0], ' ')
  }
  const stop = new Set(['recipe', 'recipes', 'with', 'and', 'a', 'an', 'the', 'for', 'of', 'some', 'mit', 'rezept', 'rezepte'])
  const words = text
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !stop.has(w))
    .map(stem)
  return { words, maxMinutes }
}

function stem(w: string) {
  // Substring matching does the rest: "apple" finds "apples", "cookie" finds "cookies".
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function haystack(r: Recipe, ctx: SearchContext): string {
  return [
    r.title,
    r.description,
    r.category,
    r.tags.join(' '),
    r.ingredients.map((i) => i.name).join(' '),
    ctx.creator(r.creatorId)?.name,
    r.source?.name,
    r.source?.originalCreator,
    ctx.collectionsOf(r.id).map((c) => c.name).join(' '),
    ctx.noteFor(r.id),
    r.recipeNotes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function searchRecipes(recipes: Recipe[], q: string, ctx: SearchContext): Recipe[] {
  const { words, maxMinutes } = parseQuery(q)
  return recipes.filter((r) => {
    if (maxMinutes != null) {
      const t = totalMinutes(r)
      if (t == null || t > maxMinutes) return false
    }
    if (!words.length) return true
    const h = haystack(r, ctx)
    return words.every((w) => h.includes(w))
  })
}
