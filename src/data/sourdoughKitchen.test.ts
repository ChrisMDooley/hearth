import { describe, expect, it } from 'vitest'
import { SOURDOUGH_KITCHEN, parseDuration } from './sourdoughKitchen'

describe('Sourdough Kitchen import', () => {
  it('has all 22 recipes, each credited to Farmhouse on Boone', () => {
    expect(SOURDOUGH_KITCHEN).toHaveLength(22)
    for (const { recipe } of SOURDOUGH_KITCHEN) {
      expect(recipe.kind).toBe('adapted')
      expect(recipe.source?.url).toMatch(/^https:\/\/www\.farmhouseonboone\.com\//)
      expect(recipe.ingredients.length).toBeGreaterThan(0)
      expect(recipe.steps.length).toBeGreaterThan(0)
    }
  })
  it('every recipe has a starter line with grams', () => {
    for (const { recipe } of SOURDOUGH_KITCHEN) {
      const s = recipe.ingredients.find((i) => i.ingredientId === 'starter')
      expect(s, recipe.title).toBeTruthy()
      expect(s!.quantity?.unit).toBe('g')
    }
  })
  it('parses times', () => {
    expect(parseDuration('2 h 40')).toEqual({ total: 160, bake: undefined })
    expect(parseDuration('10 min + 45 min bake')).toEqual({ total: 55, bake: 45 })
    expect(parseDuration('1–2 days').total).toBe(1440)
  })
  it('lists what could not be matched to the catalogue', () => {
    const unmatched = SOURDOUGH_KITCHEN.flatMap(({ recipe }) => recipe.ingredients.filter((i) => i.quantity && !i.ingredientId).map((i) => `${recipe.title}: ${i.name}`))
    console.log(unmatched.join('\n'))
  })
})
