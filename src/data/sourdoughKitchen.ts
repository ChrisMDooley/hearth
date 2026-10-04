import { parseIngredientLine } from '../domain/parse'
import type { ArtKind, Category, Recipe, RecipeIngredient } from '../domain/types'
import raw from './sourdoughKitchen.json'

/**
 * Chris's "Sourdough Kitchen" collection: 22 recipes adapted from Lisa Bass
 * (Farmhouse on Boone), converted to metric with her cup measures kept.
 * Source data: sourdoughKitchen.json, extracted from the Sourdough Kitchen page.
 * Every recipe is `kind: 'adapted'` and links back to Lisa's original post.
 */

interface RawRecipe {
  title: string
  part: 'discard' | 'loaves'
  tier: string | null
  starter: string
  meta: Record<string, string>
  hydration: string | null
  url: string
  ingredients: string[]
  steps: string[]
  asides: string[]
  timeline: [string, string][]
}

const DETAILS: Record<string, { cat: Category; art: ArtKind; cols?: string[]; unit?: string }> = {
  'Skillet pizza crust': { cat: 'savory', art: 'flat', cols: ['col_quick'] },
  'Herb & parmesan crackers': { cat: 'savory', art: 'stick', cols: ['col_quick'] },
  'Chocolate chip blondies': { cat: 'dessert', art: 'bar', cols: ['col_desserts', 'col_kids'], unit: 'bars' },
  'Fudgy brownies': { cat: 'dessert', art: 'bar', cols: ['col_desserts', 'col_kids'], unit: 'brownies' },
  'Banana crumb muffins': { cat: 'muffins', art: 'muffin', cols: ['col_muffins', 'col_breakfast'], unit: 'muffins' },
  'Skillet cornbread': { cat: 'bread', art: 'cake', cols: ['col_quick'] },
  'Sourdough granola': { cat: 'breakfast', art: 'cookie', cols: ['col_breakfast', 'col_quick'] },
  'Quick discard pancakes': { cat: 'breakfast', art: 'flat', cols: ['col_breakfast', 'col_kids', 'col_quick'], unit: 'pancakes' },
  'Discard bagels': { cat: 'bread', art: 'ring', cols: ['col_bread', 'col_breakfast'], unit: 'bagels' },
  'Discard sandwich loaf': { cat: 'bread', art: 'loaf', cols: ['col_bread'] },
  'Sourdough pasta': { cat: 'savory', art: 'stick' },
  'Skillet flatbread': { cat: 'bread', art: 'flat', unit: 'flatbreads' },
  Naan: { cat: 'bread', art: 'flat', unit: 'naan' },
  'Soft discard rolls': { cat: 'bread', art: 'roll', cols: ['col_bread'], unit: 'rolls' },
  Tortillas: { cat: 'savory', art: 'flat', unit: 'tortillas' },
  Crumpets: { cat: 'breakfast', art: 'ring', cols: ['col_breakfast'], unit: 'crumpets' },
  'Rosemary focaccia': { cat: 'bread', art: 'bar', cols: ['col_bread'] },
  'Soft sourdough buns': { cat: 'sourdough', art: 'roll', cols: ['col_bread'] },
  'Artisan boule': { cat: 'sourdough', art: 'boule', cols: ['col_bread'] },
  'Ciabatta rolls': { cat: 'sourdough', art: 'loaf', cols: ['col_bread'] },
  'Caraway rye': { cat: 'sourdough', art: 'boule', cols: ['col_bread'] },
  '100 % whole wheat': { cat: 'sourdough', art: 'boule', cols: ['col_bread'] },
}

/** "2 h 40", "5 min + 40 min bake", "12–24 h + 30 min", "1–2 days" → minutes (lower bound). */
export function parseDuration(text: string): { total?: number; bake?: number } {
  let total = 0
  let bake: number | undefined
  for (const part of text.split('+')) {
    const p = part.trim()
    let m = p.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*days?/)
    if (m) {
      total += Number(m[1]) * 1440
      continue
    }
    let mins = 0
    m = p.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*h(?:\s*(\d+))?/)
    if (m) mins += Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0)
    const mm = p.match(/(\d+)\s*min/)
    if (mm && !m) mins += Number(mm[1])
    if (/bake/.test(p)) bake = mins
    total += mins
  }
  return { total: total || undefined, bake }
}

function parseYield(text: string, fallbackUnit = 'pieces'): Recipe['yield'] {
  const t = text.replace(/^about\s+/, '').replace(/^one\s+/, '1 ')
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!m) return undefined
  let unit = m[2].replace(/^,\s*/, '').trim()
  if (!unit) unit = fallbackUnit
  else if (/^in a /.test(unit)) unit = `${fallbackUnit} (${unit.replace(/^in a /, '')})`
  return { amount: Number(m[1].replace(',', '.')), unit }
}

function parseOven(text?: string): Recipe['oven'] {
  if (!text) return undefined
  const m = text.match(/(\d{2,3})\s*°C/)
  if (!m) return undefined
  const rest = text.replace(m[0], '').replace(/^\s*[/,]\s*/, '').trim()
  return { value: Number(m[1]), unit: 'C', note: rest || undefined }
}

const DISCARD_DESC: Record<string, string> = {
  'Straight away': 'straight away',
  'Same day': 'same day',
  Overnight: 'overnight',
}

function build(r: RawRecipe, i: number): { recipe: Recipe; cols: string[] } {
  const d = DETAILS[r.title] ?? { cat: 'bread' as Category, art: 'loaf' as ArtKind }
  let group: string | undefined
  const ingredients: RecipeIngredient[] = []
  r.ingredients.forEach((line) => {
    if (line.startsWith('# ')) {
      group = line.slice(2)
      return
    }
    const p = parseIngredientLine(line)
    if (p) ingredients.push({ ...p, id: `sk${i}_i${ingredients.length}`, group })
  })
  // Name the first group so grouped sections read clearly.
  if (ingredients.some((x) => x.group)) for (const x of ingredients) x.group ??= r.part === 'discard' ? 'Batter / dough' : 'Dough'

  const time = parseDuration(r.meta.Time ?? '')
  const notes = [
    ...r.asides,
    r.hydration ? `${r.hydration.replace(/^Hydration/, 'Hydration:')} (assumes a 100 % starter).` : '',
    r.timeline.length ? `Timeline: ${r.timeline.map(([n, t]) => `${n} ${t}`).join(' → ')}` : '',
    r.meta.Heat ? `Heat: ${r.meta.Heat}.` : '',
    r.meta.Cook ? `Cook: ${r.meta.Cook}.` : '',
  ].filter(Boolean)

  const isDiscard = r.part === 'discard'
  const tags = isDiscard ? ['discard', DISCARD_DESC[r.tier ?? ''] ?? ''].filter(Boolean) : ['fed starter']
  const kit = r.meta.Kit && !/nothing else/.test(r.meta.Kit) ? r.meta.Kit.split(/,|\+/).map((x) => x.trim()).filter(Boolean) : []
  const cols = [isDiscard ? 'col_discard' : 'col_sourdough', ...(d.cols ?? [])]
  const created = new Date(Date.parse('2026-09-08T10:00:00Z') + i * 60000).toISOString()

  const recipe: Recipe = {
    id: `r_sk_${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
    title: r.title.charAt(0).toUpperCase() + r.title.slice(1),
    description: isDiscard ? `Uses ${r.starter.replace(' discard', '')} of cold, unfed discard.` : `Uses ${r.starter} — fed 4–12 h ahead, at its peak.`,
    kind: 'adapted',
    contentMode: 'full',
    creatorId: 'c_fob',
    source: { name: 'Farmhouse on Boone', url: r.url, originalCreator: 'Lisa Bass' },
    visibility: 'shared',
    ownerId: 'u_chris',
    createdBy: 'u_chris',
    category: d.cat,
    tags,
    totalMinutes: time.total,
    bakeMinutes: time.bake,
    yield: r.meta.Makes ? parseYield(r.meta.Makes, d.unit) : undefined,
    oven: parseOven(r.meta.Oven),
    equipment: kit,
    ingredients,
    steps: r.steps.map((text, k) => ({ id: `sk${i}_s${k}`, text })),
    recipeNotes: notes.join('\n\n') || undefined,
    art: d.art,
    createdAt: created,
    updatedAt: created,
  }
  return { recipe, cols }
}

export const SOURDOUGH_KITCHEN = (raw as unknown as RawRecipe[]).map(build)

/** Collection descriptions carried over from the Sourdough Kitchen page. */
export const DISCARD_DESCRIPTION =
  'Cold, unfed starter straight from the fridge — no feeding, no waiting for a peak. Weights used: discard 250 g per US cup, flour 140 g, milk 244 g, water 236 g, butter 227 g, sugar 200 g (Lisa’s own gram figures where she gave them). A jar in the fridge, topped up each feed, keeps a week or two; grey liquid on top is hooch. Bin it for fuzzy mould or pink/orange streaks.'

export const SOURDOUGH_DESCRIPTION =
  'Loaves want the starter fed 4–12 h ahead and used at its peak: doubled, bubbly, domed, and a spoonful floats in water. Flour swaps: bread flour → Type 550 (or 812 for chew), rye → Roggenmehl 1150, whole wheat → Weizenvollkornmehl. Hydration figures assume a 100 % starter.'
