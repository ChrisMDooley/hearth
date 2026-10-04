import type { Dimension, IngredientInfo, OvenTemp, Quantity, UnitId, UnitSystem } from './types'

/**
 * Measurement engine.
 *
 * Rules (also documented in docs/ARCHITECTURE.md):
 *  - The stored Quantity is never changed. Everything here is display-only.
 *  - Mass↔mass and volume↔volume conversions are exact.
 *  - Volume↔mass needs the ingredient's density and is always marked approx.
 *  - Teaspoons/tablespoons stay spoons in both systems (that is how people
 *    measure small amounts on both sides of the Atlantic).
 *  - Counts (eggs, apples) and pinches are never converted.
 */

interface UnitDef {
  id: UnitId
  dim: Dimension
  /** Size in grams (mass), millilitres (volume) or 1 (count). */
  base: number
  one: string
  many: string
}

const ML_PER_CUP = 236.588

export const UNITS: Record<UnitId, UnitDef> = {
  g: { id: 'g', dim: 'mass', base: 1, one: 'g', many: 'g' },
  kg: { id: 'kg', dim: 'mass', base: 1000, one: 'kg', many: 'kg' },
  oz: { id: 'oz', dim: 'mass', base: 28.3495, one: 'oz', many: 'oz' },
  lb: { id: 'lb', dim: 'mass', base: 453.592, one: 'lb', many: 'lb' },
  ml: { id: 'ml', dim: 'volume', base: 1, one: 'ml', many: 'ml' },
  l: { id: 'l', dim: 'volume', base: 1000, one: 'l', many: 'l' },
  tsp: { id: 'tsp', dim: 'volume', base: 4.92892, one: 'tsp', many: 'tsp' },
  tbsp: { id: 'tbsp', dim: 'volume', base: 14.7868, one: 'tbsp', many: 'tbsp' },
  cup: { id: 'cup', dim: 'volume', base: ML_PER_CUP, one: 'cup', many: 'cups' },
  floz: { id: 'floz', dim: 'volume', base: 29.5735, one: 'fl oz', many: 'fl oz' },
  pinch: { id: 'pinch', dim: 'count', base: 1, one: 'pinch', many: 'pinches' },
  piece: { id: 'piece', dim: 'count', base: 1, one: '', many: '' },
}

export const UNIT_OPTIONS: UnitId[] = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'floz', 'pinch', 'piece']

export interface DisplayQuantity {
  /** "250", "1½", "2–3" */
  amount: string
  unit: string
  /** True when a density was needed — shown with "≈". */
  approx: boolean
  /** True when the unit differs from the recipe's own. */
  converted: boolean
  /** The recipe's own measure (scaled), e.g. "2 cups". */
  original: string
  /** Extra caution: density varies a lot for this ingredient. */
  rough: boolean
}

export function displayQuantity(
  q: Quantity,
  ing: IngredientInfo | undefined,
  scale: number,
  system: UnitSystem,
): DisplayQuantity {
  const src = UNITS[q.unit]
  const amount = q.amount * scale
  const max = q.max != null ? q.max * scale : undefined
  // The recipe's own measure, with finer fractions so it stays faithful when scaled.
  const original = formatIn(q.unit, amount, max, false, true)
  const same = (): DisplayQuantity => ({ ...splitFormatted(formatIn(q.unit, amount, max, false)), approx: false, converted: false, original, rough: false })

  if (src.dim === 'count') return same()

  // Spoons: keep unless the scaled amount is big enough to be measured as cups.
  if ((q.unit === 'tsp' || q.unit === 'tbsp') && amount * src.base < 59) return same()

  const conv = convert(amount, src, ing, system)
  if (!conv) return same()
  const convMax = max != null ? convert(max, src, ing, system, conv.unit) : undefined
  if (conv.unit === q.unit) {
    return { ...splitFormatted(formatIn(q.unit, amount, max, false)), approx: false, converted: false, original, rough: false }
  }
  const text = formatIn(conv.unit, conv.value, convMax?.value, conv.approx)
  return {
    ...splitFormatted(text),
    approx: conv.approx,
    converted: true,
    original,
    rough: conv.approx && ing?.densityConfidence === 'rough',
  }
}

interface Converted {
  value: number
  unit: UnitId
  approx: boolean
}

function convert(
  amount: number,
  src: UnitDef,
  ing: IngredientInfo | undefined,
  system: UnitSystem,
  forceUnit?: UnitId,
): Converted | undefined {
  const density = ing?.gramsPerCup ? ing.gramsPerCup / ML_PER_CUP : undefined // g per ml

  if (system === 'metric') {
    if (src.dim === 'mass') {
      const g = amount * src.base
      return { value: g, unit: forceUnit ?? (g >= 2000 ? 'kg' : 'g'), approx: false }
    }
    // volume → grams for weighable ingredients, ml for liquids / unknowns
    const ml = amount * src.base
    if (density && !ing?.liquid) {
      const g = ml * density
      return pick(forceUnit, { value: g, unit: g >= 2000 ? 'kg' : 'g', approx: true })
    }
    return pick(forceUnit, { value: ml, unit: ml >= 2000 ? 'l' : 'ml', approx: false })
  }

  // system === 'us'
  if (src.dim === 'volume') {
    const ml = amount * src.base
    return pick(forceUnit, usVolume(ml, false))
  }
  // mass
  const g = amount * src.base
  if (density) {
    return pick(forceUnit, usVolume(g / density, true))
  }
  const oz = g / UNITS.oz.base
  return pick(forceUnit, oz >= 16 ? { value: g / UNITS.lb.base, unit: 'lb', approx: false } : { value: oz, unit: 'oz', approx: false })
}

function usVolume(ml: number, approx: boolean): Converted {
  if (ml >= 59) {
    const cups = ml / UNITS.cup.base
    const tbsp = ml / UNITS.tbsp.base
    // Prefer tablespoons when cups would round badly (6 tbsp ≠ ⅓ cup).
    const err = Math.abs(nearest(cups, ALLOWED.cup!) - cups) / cups
    if (err > 0.06 && tbsp <= 16) return { value: tbsp, unit: 'tbsp', approx }
    return { value: cups, unit: 'cup', approx }
  }
  if (ml >= 14) return { value: ml / UNITS.tbsp.base, unit: 'tbsp', approx }
  return { value: ml / UNITS.tsp.base, unit: 'tsp', approx }
}

/** For ranges: make the upper bound use the same unit as the lower one. */
function pick(force: UnitId | undefined, c: Converted): Converted {
  if (!force || force === c.unit) return c
  const from = UNITS[c.unit]
  const to = UNITS[force]
  return { value: (c.value * from.base) / to.base, unit: force, approx: c.approx }
}

// ---------------- formatting ----------------

const FRACTIONS: [number, string][] = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''],
]

/** Which fractions make sense for a unit (cups are not measured in eighths). */
const ALLOWED: Partial<Record<UnitId, number[]>> = {
  cup: [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1],
  tbsp: [0, 1 / 2, 1],
  tsp: [0, 1 / 8, 1 / 4, 1 / 2, 3 / 4, 1],
  piece: [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1],
  pinch: [0, 1 / 2, 1],
  lb: [0, 1 / 4, 1 / 2, 3 / 4, 1],
}

export function formatNumber(unit: UnitId, value: number, approx: boolean, fine = false): string {
  if (!isFinite(value)) return ''
  const allowed = fine && unit === 'cup' ? ALLOWED.tsp : ALLOWED[unit]
  if (allowed) return fraction(value, allowed)
  if (unit === 'kg' || unit === 'l') return trimNum(round(value, value < 10 ? 0.05 : 0.1))
  if (unit === 'oz' || unit === 'floz') return trimNum(round(value, value < 4 ? 0.25 : 0.5))
  // g / ml
  let step = value < 10 ? 0.5 : 1
  if (approx) step = value < 10 ? 0.5 : value < 50 ? 1 : value < 500 ? 5 : 10
  return trimNum(round(value, step))
}

function nearest(value: number, allowed: number[]): number {
  const whole = Math.floor(value)
  const rest = value - whole
  let best = allowed[0]
  for (const f of allowed) if (Math.abs(f - rest) < Math.abs(best - rest)) best = f
  return whole + best
}

function fraction(value: number, allowed: number[]): string {
  if (value > 0 && value < allowed[1] / 2) {
    // too small to express — show the smallest allowed fraction rather than 0
    return glyph(allowed[1])
  }
  const whole = Math.floor(value)
  const rest = value - whole
  let best = allowed[0]
  for (const f of allowed) if (Math.abs(f - rest) < Math.abs(best - rest)) best = f
  if (best === 1) return String(whole + 1)
  const g = glyph(best)
  if (whole === 0) return g || '0'
  return `${whole}${g}`
}

function glyph(f: number) {
  return FRACTIONS.find(([v]) => Math.abs(v - f) < 1e-9)?.[1] ?? ''
}

function round(v: number, step: number) {
  return Math.round(v / step) * step
}

function trimNum(v: number) {
  return Number(v.toFixed(2)).toString()
}

/** Decided on the text the user sees, so "1 cup" never reads "1 cups". */
function isPlural(amountText: string) {
  const last = amountText.split('–').pop()!.trim()
  if (last === '1' || /^[½⅓¼⅔¾⅛⅜⅝⅞]$/.test(last)) return false
  return Number(last.replace(/[½⅓¼⅔¾⅛⅜⅝⅞]/, '')) !== 0 || /\d/.test(last)
}

/** "2 cups", "1½ tsp", "250–300 g", "3" (pieces). */
export function formatIn(unit: UnitId, value: number, max: number | undefined, approx: boolean, fine = false): string {
  const u = UNITS[unit]
  let n = formatNumber(unit, value, approx, fine)
  if (max != null) {
    const m = formatNumber(unit, max, approx, fine)
    if (m !== n) n = `${n}–${m}`
  }
  const label = isPlural(n) ? u.many : u.one
  return label ? `${n} ${label}` : n
}

function splitFormatted(text: string): { amount: string; unit: string } {
  const i = text.indexOf(' ')
  return i < 0 ? { amount: text, unit: '' } : { amount: text.slice(0, i), unit: text.slice(i + 1) }
}

// ---------------- temperature ----------------

/** Oven temperatures, rounded the way ovens are labelled (5 °F / 5 °C steps). */
export function convertTemp(value: number, from: 'C' | 'F', to: 'C' | 'F'): number {
  if (from === to) return value
  if (from === 'C') return Math.round(((value * 9) / 5 + 32) / 5) * 5
  return Math.round((((value - 32) * 5) / 9) / 5) * 5
}

export function formatOven(oven: OvenTemp, system: UnitSystem): { text: string; original?: string } {
  const to = system === 'metric' ? 'C' : 'F'
  const v = convertTemp(oven.value, oven.unit, to)
  const text = `${v} °${to}`
  return oven.unit === to ? { text } : { text, original: `${oven.value} °${oven.unit}` }
}

/**
 * Rewrites temperatures inside instruction text ("Bake at 375°F") into the
 * user's system, keeping the original in brackets.
 */
export function convertTempsInText(text: string, system: UnitSystem): string {
  const to = system === 'metric' ? 'C' : 'F'
  return text.replace(/(\d{2,3})\s*°\s*([CF])\b/g, (m, num: string, unit: 'C' | 'F') => {
    if (unit === to) return m
    return `${convertTemp(Number(num), unit, to)} °${to} (${num} °${unit})`
  })
}
