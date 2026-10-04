import { matchIngredient } from './ingredients'
import type { RecipeIngredient, UnitId } from './types'

export function uid(prefix = ''): string {
  const r = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '')
  return prefix + r.slice(0, 12)
}

// ---------- ingredient lines ----------

const UNIT_WORDS: [RegExp, UnitId][] = [
  [/^(g|gr|gram|grams|gramm)$/i, 'g'],
  [/^(kg|kilo|kilos|kilogram|kilograms)$/i, 'kg'],
  [/^(ml|milliliter|milliliters|millilitre|millilitres)$/i, 'ml'],
  [/^(l|liter|liters|litre|litres)$/i, 'l'],
  [/^(tsp|tsps|teaspoon|teaspoons|tl|t)$/i, 'tsp'],
  [/^(tbsp|tbsps|tablespoon|tablespoons|el|tbs|tb)$/i, 'tbsp'],
  [/^(cup|cups|c)$/i, 'cup'],
  [/^(fl\.?\s?oz|fluid ounces?)$/i, 'floz'],
  [/^(oz|ounce|ounces)$/i, 'oz'],
  [/^(lb|lbs|pound|pounds)$/i, 'lb'],
  [/^(pinch|pinches|prise)$/i, 'pinch'],
]

const UNICODE_FRAC: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }

function parseNumber(s: string): number | undefined {
  s = s.trim().replace(',', '.')
  // "1 1/2", "1½", "1/2", "1.5"
  let m = s.match(/^(\d+)\s*([½⅓⅔¼¾⅛⅜⅝⅞])$/)
  if (m) return Number(m[1]) + UNICODE_FRAC[m[2]]
  if (UNICODE_FRAC[s] != null) return UNICODE_FRAC[s]
  m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3])
  m = s.match(/^(\d+)\/(\d+)$/)
  if (m) return Number(m[1]) / Number(m[2])
  const n = Number(s)
  return isFinite(n) ? n : undefined
}

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[½⅓⅔¼¾⅛⅜⅝⅞]|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)`

/**
 * Parses one ingredient line, e.g.
 *   "500 g bread flour", "1 1/2 cups milk, warm", "2–3 apples", "pinch of salt".
 * Anything it can't parse becomes a name-only ingredient, so nothing is lost.
 */
export function parseIngredientLine(line: string): RecipeIngredient | null {
  let text = line.replace(/^[\s•*\-–]+/, '').trim()
  if (!text) return null

  const out: RecipeIngredient = { id: uid('ri_'), name: text }

  const re = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*(.*)$`)
  const m = text.match(re)
  let unit: UnitId | undefined
  let rest = text
  if (m) {
    const amount = parseNumber(m[1])
    const max = m[2] ? parseNumber(m[2]) : undefined
    rest = m[3]
    const w = rest.match(/^(fl\.?\s?oz|[a-zA-Z]+)\.?(?:\s+|$)(.*)$/)
    if (w) {
      unit = UNIT_WORDS.find(([r]) => r.test(w[1]))?.[1]
      if (unit) rest = w[2] // otherwise e.g. "2 large eggs" keeps "large eggs"
    }
    if (amount != null) out.quantity = { amount, max, unit: unit ?? 'piece' }
  } else {
    const pinch = text.match(/^(a\s+)?pinch(?:\s+of)?\s+(.*)$/i)
    if (pinch) {
      out.quantity = { amount: 1, unit: 'pinch' }
      rest = pinch[2]
    }
  }

  rest = rest.replace(/^of\s+/i, '')
  const comma = rest.indexOf(',')
  if (comma > 0) {
    out.note = rest.slice(comma + 1).trim()
    rest = rest.slice(0, comma).trim()
  }
  out.name = rest
  out.ingredientId = matchIngredient(rest)?.id
  return out
}

// ---------- timers inside steps ----------

export interface StepTimer {
  /** Seconds for the button. Uses the lower bound of a range. */
  seconds: number
  label: string
}

/**
 * Finds durations in instruction text so the step can offer a timer button:
 * "Bake for 25 minutes", "rest 1 hour", "bake 20–25 min", "1½ hours".
 */
export function findTimers(text: string): StepTimer[] {
  const out: StepTimer[] = []
  const re = new RegExp(String.raw`(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*(hours?|hrs?|h\b|minutes?|mins?\b)`, 'gi')
  for (const m of text.matchAll(re)) {
    const lo = parseNumber(m[1])
    if (lo == null) continue
    const hi = m[2] ? parseNumber(m[2]) : undefined
    const isHour = /^h/i.test(m[3])
    const mult = isHour ? 3600 : 60
    const unitLabel = isHour ? 'h' : 'min'
    const label = hi != null ? `${m[1]}–${m[2]} ${unitLabel}` : `${m[1]} ${unitLabel}`
    out.push({ seconds: Math.round(lo * mult), label })
  }
  return out
}

// ---------- times ----------

export function formatMinutes(min?: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m}` : `${h} h`
}

export function totalMinutes(r: { prepMinutes?: number; bakeMinutes?: number; totalMinutes?: number }) {
  return r.totalMinutes ?? ((r.prepMinutes ?? 0) + (r.bakeMinutes ?? 0) || undefined)
}
