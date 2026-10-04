import { parseIngredientLine, uid } from './parse'
import type { Instruction, OvenTemp, RecipeIngredient, RecipeSource, Yield } from './types'

/**
 * Turning outside recipes into drafts the family reviews before saving.
 *
 *  - recipeFromHtml: a recipe web page. Uses the schema.org "Recipe" JSON-LD
 *    that nearly every recipe site publishes (it's what Google and Bring! read).
 *  - recipeFromText: pasted text or OCR output from a photo/screenshot.
 *
 * Both return an ImportDraft; nothing is saved until the person confirms it in
 * the editor. Pure functions, no DOM — so they also run on a server later.
 */

export interface ImportDraft {
  title: string
  description?: string
  ingredients: RecipeIngredient[]
  steps: Instruction[]
  prepMinutes?: number
  bakeMinutes?: number
  totalMinutes?: number
  yield?: Yield
  oven?: OvenTemp
  tags: string[]
  source?: RecipeSource
  imageUrl?: string
  /** Things the reviewer should double-check. */
  warnings: string[]
}

// ---------------------------------------------------------------- web pages

export function recipeFromHtml(html: string, url: string): ImportDraft | null {
  const recipe = findRecipeNode(extractJsonLd(html))
  if (!recipe) return null
  const siteName = metaContent(html, 'og:site_name') ?? str(get(recipe, 'publisher', 'name')) ?? hostName(url)
  const author = authorName(recipe.author)
  const title = clean(str(recipe.name) ?? metaContent(html, 'og:title') ?? '')
  const ingredients = asArray(recipe.recipeIngredient ?? recipe.ingredients)
    .map((x) => parseIngredientLine(clean(String(x))))
    .filter((x): x is RecipeIngredient => !!x)
  const steps = instructions(recipe.recipeInstructions)
  const draft: ImportDraft = {
    title,
    description: recipe.description ? clean(String(recipe.description)) : undefined,
    ingredients,
    steps,
    prepMinutes: isoMinutes(recipe.prepTime),
    bakeMinutes: isoMinutes(recipe.cookTime),
    totalMinutes: isoMinutes(recipe.totalTime),
    yield: parseYield(asArray(recipe.recipeYield).map(String)),
    oven: findOven(steps.map((s) => s.text).join('\n')),
    tags: asArray(recipe.keywords)
      .flatMap((k) => String(k).split(','))
      .map((k) => clean(k).toLowerCase())
      .filter((k) => k && k.length < 30)
      .slice(0, 6),
    source: { name: clean(siteName), url, originalTitle: title || undefined, originalCreator: author },
    imageUrl: imageUrl(recipe.image),
    warnings: [],
  }
  if (!ingredients.length) draft.warnings.push('No ingredients were found on the page.')
  if (!steps.length) draft.warnings.push('No method steps were found on the page.')
  return draft
}

export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1].trim()))
    } catch {
      /* some sites ship broken JSON-LD; skip it */
    }
  }
  return out
}

type Node = Record<string, unknown>

function findRecipeNode(items: unknown[]): Node | undefined {
  const stack = [...items]
  while (stack.length) {
    const x = stack.shift()
    if (Array.isArray(x)) {
      stack.push(...x)
      continue
    }
    if (!x || typeof x !== 'object') continue
    const n = x as Node
    const type = asArray(n['@type']).map(String)
    if (type.includes('Recipe')) return n
    if (n['@graph']) stack.push(n['@graph'])
    if (n.mainEntity) stack.push(n.mainEntity)
  }
  return undefined
}

function instructions(v: unknown, group?: string): Instruction[] {
  const out: Instruction[] = []
  for (const item of asArray(v)) {
    if (typeof item === 'string') {
      for (const line of clean(item, true).split(/\n+/)) {
        const t = stripStepNumber(line)
        if (t) out.push({ id: uid('st_'), text: t, group })
      }
    } else if (item && typeof item === 'object') {
      const n = item as Node
      const type = asArray(n['@type']).map(String)
      if (type.includes('HowToSection')) {
        out.push(...instructions(n.itemListElement, clean(str(n.name) ?? '') || undefined))
      } else {
        const t = stripStepNumber(clean(str(n.text) ?? str(n.name) ?? ''))
        if (t) out.push({ id: uid('st_'), text: t, group })
      }
    }
  }
  return out
}

function authorName(a: unknown): string | undefined {
  const first = asArray(a)[0]
  if (!first) return undefined
  if (typeof first === 'string') return clean(first)
  return str((first as Node).name) ? clean(str((first as Node).name)!) : undefined
}

function imageUrl(img: unknown): string | undefined {
  const first = asArray(img)[0]
  if (!first) return undefined
  if (typeof first === 'string') return first
  return str((first as Node).url)
}

/** ISO 8601 duration ("PT1H30M", "P0DT0H45M") → minutes. */
export function isoMinutes(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined
  const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i)
  if (!m) return undefined
  const min = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  return min || undefined
}

function metaContent(html: string, prop: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
  const m = html.match(re) ?? html.match(re2)
  return m ? decodeEntities(m[1]) : undefined
}

// ---------------------------------------------------------------- plain text

const ING_HEAD = /^(ingredients?|zutaten|you(?:'|’)ll need|you will need|weigh out|für den teig|for the \w+)\s*:?$/i
const STEP_HEAD = /^(instructions?|method|directions?|preparation|steps|how to make it|zubereitung|anleitung)\s*:?$/i
const NOTE_HEAD = /^(notes?|tips?|hinweise?|tipps?)\s*:?$/i

/**
 * Best-effort structure for pasted or OCR'd text. Uses headings ("Ingredients",
 * "Method", "Zutaten", "Zubereitung") when present; otherwise lines that start
 * with an amount are ingredients and the rest are steps.
 */
export function recipeFromText(text: string): ImportDraft {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const draft: ImportDraft = { title: '', ingredients: [], steps: [], tags: [], warnings: [] }
  let section: 'head' | 'ing' | 'step' | 'note' = 'head'
  const hasHeadings = lines.some((l) => ING_HEAD.test(l) || STEP_HEAD.test(l))
  const notes: string[] = []
  let group: string | undefined
  const stepLines: string[] = []

  for (const line of lines) {
    if (ING_HEAD.test(line)) {
      section = 'ing'
      group = /^for the|für den/i.test(line) ? line.replace(/:$/, '') : undefined
      continue
    }
    if (STEP_HEAD.test(line)) {
      section = 'step'
      continue
    }
    if (NOTE_HEAD.test(line)) {
      section = 'note'
      continue
    }
    if (readMeta(line, draft)) continue

    if (!draft.title && section === 'head' && !looksLikeIngredient(line) && line.length < 80) {
      draft.title = line.replace(/[.:]$/, '')
      continue
    }

    const kind = hasHeadings ? section : looksLikeIngredient(line) ? 'ing' : 'step'
    if (kind === 'ing') {
      if (/:$/.test(line) && line.length < 40) {
        group = line.replace(/:$/, '')
        continue
      }
      const p = parseIngredientLine(line)
      if (p) draft.ingredients.push({ ...p, group })
    } else if (kind === 'note') {
      notes.push(line)
    } else if (kind === 'step') {
      stepLines.push(line)
    } else if (!draft.description && line.length > 30) {
      draft.description = line
    }
  }

  draft.steps = joinWrappedSteps(stepLines).map((t) => ({ id: uid('st_'), text: t }))
  draft.oven ??= findOven(draft.steps.map((s) => s.text).join('\n'))
  if (notes.length) draft.description = [draft.description, ...notes].filter(Boolean).join(' ')
  if (!draft.title) draft.warnings.push('Add a title — none was recognised.')
  if (!draft.ingredients.length) draft.warnings.push('No ingredient lines were recognised.')
  if (!draft.steps.length) draft.warnings.push('No method steps were recognised.')
  return draft
}

function looksLikeIngredient(line: string): boolean {
  if (line.length > 90) return false
  if (/^[•*·▢□☐-]\s*/.test(line)) return true
  if (/^(a\s+)?(pinch|prise|handful|salt|pepper)\b/i.test(line)) return true
  // starts with an amount, but isn't a numbered step like "1. Preheat…" or "2) Mix"
  return /^(\d+([.,/]\d+)?|[½⅓⅔¼¾⅛])/.test(line) && !/^\d+\s*[.)]\s+[A-ZÄÖÜ]/.test(line) && line.split(' ').length <= 10
}

/** OCR and copy-paste break sentences across lines; glue them back together. */
function joinWrappedSteps(lines: string[]): string[] {
  const out: string[] = []
  for (const raw of lines) {
    const numbered = /^(step\s*)?\d+\s*[.):]\s+/i.test(raw)
    const line = stripStepNumber(raw)
    if (!line) continue
    const prev = out[out.length - 1]
    if (prev && !numbered && !/[.!?)]$/.test(prev) && /^[a-zäöüß(]/.test(line)) out[out.length - 1] = `${prev} ${line}`
    else out.push(line)
  }
  return out
}

function stripStepNumber(s: string) {
  return s.replace(/^(step\s*)?\d+\s*[.):]\s+/i, '').trim()
}

function readMeta(line: string, d: ImportDraft): boolean {
  let m = line.match(/^(prep(?:aration)? time|vorbereitung(?:szeit)?)\s*:?\s*(.+)$/i)
  if (m) return ((d.prepMinutes = textMinutes(m[2])), true)
  m = line.match(/^(cook(?:ing)? time|bake time|baking time|backzeit)\s*:?\s*(.+)$/i)
  if (m) return ((d.bakeMinutes = textMinutes(m[2])), true)
  m = line.match(/^(total time|gesamtzeit)\s*:?\s*(.+)$/i)
  if (m) return ((d.totalMinutes = textMinutes(m[2])), true)
  m = line.match(/^(serves|servings|yield|makes|ergibt|für)\s*:?\s*(.+)$/i)
  if (m && /\d/.test(m[2]) && line.length < 50) return ((d.yield = parseYield([m[2]])), true)
  return false
}

function textMinutes(s: string): number | undefined {
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|std|stunden?)\b/i)
  const m = s.match(/(\d+)\s*(m|min|mins|minutes?|minuten)\b/i)
  const total = (h ? Number(h[1].replace(',', '.')) * 60 : 0) + (m ? Number(m[1]) : 0)
  return total || undefined
}

// ---------------------------------------------------------------- shared

function parseYield(values: string[]): Yield | undefined {
  // Prefer the most descriptive value: "12 muffins" over "12".
  const sorted = [...values].sort((a, b) => b.length - a.length)
  for (const v of sorted) {
    const m = clean(v).match(/(\d+(?:[.,]\d+)?)\s*(.*)$/)
    if (m) {
      const unit = m[2].replace(/^(servings?|portions?|people)$/i, 'servings').trim()
      return { amount: Number(m[1].replace(',', '.')), unit: unit || 'servings' }
    }
  }
  return undefined
}

/** First oven temperature mentioned, e.g. "Preheat to 350°F" or "180 °C". */
export function findOven(text: string): OvenTemp | undefined {
  const m = text.match(/(\d{3})\s*(?:°|º|degrees?)\s*(F|C|fahrenheit|celsius)\b/i)
  if (!m) return undefined
  return { value: Number(m[1]), unit: m[2][0].toUpperCase() === 'F' ? 'F' : 'C' }
}

function asArray(v: unknown): unknown[] {
  return v == null ? [] : Array.isArray(v) ? v : [v]
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function get(o: Node, ...path: string[]): unknown {
  let cur: unknown = o
  for (const p of path) cur = cur && typeof cur === 'object' ? (asArray(cur)[0] as Node)?.[p] : undefined
  return cur
}
function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Website'
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' }
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Strip tags and entities; keep line breaks only when asked. */
function clean(s: string, keepLines = false): string {
  let t = decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]+>/g, ''))
  t = keepLines ? t.replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n') : t.replace(/\s+/g, ' ')
  return t.trim()
}
