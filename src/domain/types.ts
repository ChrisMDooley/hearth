/**
 * Core data model.
 *
 * Two halves, deliberately kept apart:
 *  1. CANONICAL recipe data (Recipe, Creator, Collection, Ingredient catalogue).
 *     This is "the recipe as written" and is never modified by baking activity.
 *  2. USER data (Favorite, UserRecipeNote, BakeEntry, Photo, preferences).
 *     Always keyed by userId + recipeId and stored separately.
 *
 * Each interface maps 1:1 to a future SQL table (see docs/schema.sql).
 * Ingredients and steps are embedded in Recipe in the local store because they
 * are owned by exactly one recipe; in SQL they become recipe_ingredient and
 * recipe_step tables with a recipe_id foreign key.
 */

export type ID = string
export type ISODate = string // e.g. "2026-10-04T13:11:00.000Z"

export type UnitSystem = 'metric' | 'us'

export interface User {
  id: ID
  name: string
  avatarColor: string
  unitSystem: UnitSystem
  /** Show the recipe's original measure in brackets after a converted one. */
  showOriginal: boolean
  createdAt: ISODate
}

/** Who a recipe comes from. External creators get an attribution page. */
export type CreatorKind = 'external' | 'family' | 'person'

export interface Creator {
  id: ID
  name: string
  kind: CreatorKind
  /** Home page for external creators; always linked on their page. */
  website?: string
  /** One line in our own words — never copied from the creator's site. */
  blurb?: string
  /** If this creator is one of our users (Chris, Janina), link it. */
  userId?: ID
}

/**
 * How a recipe relates to its origin. Drives the attribution UI.
 *  - mine:    written by one of us
 *  - family:  family recipe (Oma's, handed down)
 *  - creator: someone else's recipe, saved as-is
 *  - adapted: someone else's recipe that we changed
 */
export type RecipeKind = 'mine' | 'family' | 'creator' | 'adapted'

/**
 * - full:      ingredients + method stored in the app
 * - reference: a bookmark — metadata, our notes and bakes, and a link to the
 *              original. Used when we don't want to copy a creator's method.
 */
export type ContentMode = 'full' | 'reference'

export interface RecipeSource {
  /** Site or book name, e.g. "Farmhouse on Boone". */
  name: string
  url?: string
  originalTitle?: string
  /** Person behind it, e.g. "Lisa Bass". */
  originalCreator?: string
}

export type Category =
  | 'bread'
  | 'sourdough'
  | 'cake'
  | 'cookies'
  | 'muffins'
  | 'pastry'
  | 'breakfast'
  | 'dessert'
  | 'savory'

export interface Quantity {
  /** Amount in `unit`. Ranges use `max`. */
  amount: number
  max?: number
  unit: UnitId
}

export interface RecipeIngredient {
  id: ID
  /** Link into the ingredient catalogue (densities); optional for free text. */
  ingredientId?: ID
  /** Display name exactly as the recipe calls it: "bread flour", "eggs, large". */
  name: string
  /** Absent for "salt to taste" style lines. */
  quantity?: Quantity
  /** "softened", "packed", "room temperature" */
  note?: string
  /** Section heading: "Dough", "Filling", "Glaze". */
  group?: string
  optional?: boolean
}

export interface Instruction {
  id: ID
  text: string
  group?: string
}

export interface OvenTemp {
  value: number
  unit: 'C' | 'F'
  /** "fan", "top/bottom heat", "with Dutch oven" */
  note?: string
}

export interface Yield {
  amount: number
  /** "loaf", "muffins", "cookies", "26 cm cake" */
  unit: string
}

export interface Recipe {
  id: ID
  title: string
  description?: string
  kind: RecipeKind
  contentMode: ContentMode
  creatorId: ID
  source?: RecipeSource

  /** Shared recipes are visible to everyone; private ones only to the owner. */
  visibility: 'shared' | 'private'
  ownerId: ID

  category: Category
  tags: string[]

  prepMinutes?: number
  bakeMinutes?: number
  /** Includes rising/resting. If absent, prep + bake is shown. */
  totalMinutes?: number
  yield?: Yield
  oven?: OvenTemp
  equipment: string[]

  ingredients: RecipeIngredient[]
  steps: Instruction[]
  /** Canonical tips that belong to the recipe itself (not personal notes). */
  recipeNotes?: string

  /** Photo uploaded as the recipe's main image. Falls back to illustration. */
  heroPhotoId?: ID
  /** Illustration used when there is no photo. */
  art: ArtKind

  createdAt: ISODate
  updatedAt: ISODate
  createdBy: ID
}

export type ArtKind =
  | 'boule'
  | 'loaf'
  | 'cake'
  | 'cookie'
  | 'muffin'
  | 'roll'
  | 'crescent'
  | 'braid'
  | 'stick'

export interface Collection {
  id: ID
  name: string
  /** null = built-in collection everyone sees. */
  ownerId: ID | null
  description?: string
  sort: number
}

export interface RecipeCollection {
  recipeId: ID
  collectionId: ID
}

// ---------- user data ----------

export interface Favorite {
  userId: ID
  recipeId: ID
  createdAt: ISODate
}

export interface UserRecipeNote {
  id: ID
  userId: ID
  recipeId: ID
  text: string
  createdAt: ISODate
  updatedAt: ISODate
}

export type BakeResult = 'great' | 'good' | 'okay' | 'flop'

export interface BakeEntry {
  id: ID
  userId: ID
  recipeId: ID
  /** Day it was baked, YYYY-MM-DD. */
  date: string
  notes: string
  modifications?: string
  rating?: 1 | 2 | 3 | 4 | 5
  result?: BakeResult
  /** Scale used, e.g. 2 for a double batch. */
  scale?: number
  photoIds: ID[]
  createdAt: ISODate
}

export type PhotoKind = 'recipe' | 'bake'

/** Photos are stored separately from the records that reference them. */
export interface Photo {
  id: ID
  ownerId: ID
  kind: PhotoKind
  blob: Blob
  width: number
  height: number
  createdAt: ISODate
}

// ---------- reference data ----------

export type UnitId =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'floz'
  | 'oz'
  | 'lb'
  | 'pinch'
  | 'piece'

export type Dimension = 'mass' | 'volume' | 'count'

export interface IngredientInfo {
  id: ID
  name: string
  aliases: string[]
  /** Grams per US cup (236.6 ml). Absent = no reliable density. */
  gramsPerCup?: number
  /** 'good' = well-established; 'rough' = varies a lot (packing, brand). */
  densityConfidence?: 'good' | 'rough'
  /** Grams per piece, for eggs etc. */
  gramsPerPiece?: number
  /** Liquids are shown in ml/cups rather than converted to grams. */
  liquid?: boolean
}
