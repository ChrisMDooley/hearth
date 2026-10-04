import { describe, expect, it } from 'vitest'
import { ingredientById, matchIngredient } from './ingredients'
import { findTimers, parseIngredientLine } from './parse'
import { convertTemp, convertTempsInText, displayQuantity } from './units'

const show = (line: string, scale: number, sys: 'metric' | 'us') => {
  const r = parseIngredientLine(line)!
  const d = displayQuantity(r.quantity!, ingredientById(r.ingredientId), scale, sys)
  return `${d.approx ? '≈' : ''}${d.amount} ${d.unit}`.trim()
}

describe('parsing', () => {
  it('parses common lines', () => {
    expect(parseIngredientLine('500 g bread flour')).toMatchObject({ name: 'bread flour', quantity: { amount: 500, unit: 'g' }, ingredientId: 'flour-bread' })
    expect(parseIngredientLine('1 1/2 cups milk, warm')).toMatchObject({ name: 'milk', note: 'warm', quantity: { amount: 1.5, unit: 'cup' } })
    expect(parseIngredientLine('2 large eggs')).toMatchObject({ name: 'large eggs', quantity: { amount: 2, unit: 'piece' }, ingredientId: 'egg' })
    expect(parseIngredientLine('3 eggs')).toMatchObject({ quantity: { amount: 3, unit: 'piece' } })
    expect(parseIngredientLine('2–3 apples')).toMatchObject({ quantity: { amount: 2, max: 3 } })
    expect(parseIngredientLine('pinch of salt')).toMatchObject({ name: 'salt', quantity: { unit: 'pinch' } })
    expect(parseIngredientLine('½ tsp cinnamon')).toMatchObject({ quantity: { amount: 0.5, unit: 'tsp' } })
    expect(parseIngredientLine('250g Mehl')).toMatchObject({ quantity: { amount: 250, unit: 'g' }, ingredientId: 'flour-ap' })
  })
  it('matches longest alias', () => {
    expect(matchIngredient('packed light brown sugar')?.id).toBe('sugar-brown')
    expect(matchIngredient('Olivenöl')?.id).toBe('olive-oil')
  })
})

describe('conversion', () => {
  it('flour and sugar cups weigh differently', () => {
    expect(show('1 cup all-purpose flour', 1, 'metric')).toBe('≈120 g')
    expect(show('1 cup sugar', 1, 'metric')).toBe('≈200 g')
  })
  it('liquids stay volumes', () => {
    expect(show('1/2 cup milk', 1, 'metric')).toBe('118 ml')
    expect(show('250 ml milk', 1, 'us')).toBe('1 cup')
  })
  it('grams to cups uses density', () => {
    expect(show('500 g bread flour', 1, 'us')).toBe('≈4¼ cups')
  })
  it('spoons stay spoons, scale nicely', () => {
    expect(show('1 tsp salt', 1.5, 'metric')).toBe('1½ tsp')
    expect(show('2 tbsp sugar', 3, 'us')).toBe('6 tbsp')
    expect(show('2 tbsp sugar', 3, 'metric')).toBe('≈75 g')
    expect(show('1/2 cup butter', 1, 'us')).toBe('½ cup')
    expect(show('100 g butter', 1, 'us')).toBe('≈7 tbsp')
  })
  it('scales muffins 12 → 18', () => {
    expect(show('3/4 cup granulated sugar', 18 / 12, 'us')).toBe('1 cup')
    expect(show('1 large egg', 1.5, 'us')).toBe('1½')
  })
  it('unknown density falls back to oz', () => {
    expect(show('200 g dried apricots', 1, 'us')).toBe('7 oz')
  })
  it('temperatures', () => {
    expect(convertTemp(180, 'C', 'F')).toBe(355)
    expect(convertTemp(375, 'F', 'C')).toBe(190)
    expect(convertTempsInText('Preheat to 375 °F.', 'metric')).toBe('Preheat to 190 °C (375 °F).')
  })
})

describe('timers', () => {
  it('finds durations', () => {
    expect(findTimers('Bake 40–45 minutes, until done')).toEqual([{ seconds: 2400, label: '40–45 min' }])
    expect(findTimers('rise for 1 hour')).toEqual([{ seconds: 3600, label: '1 h' }])
    expect(findTimers('Bake for 25 min')[0].seconds).toBe(1500)
  })
})

import { displayIngredient } from './units'
describe('dual measures', () => {
  const line = (l: string, scale: number, sys: 'metric' | 'us') => {
    const r = parseIngredientLine(l)!
    const d = displayIngredient(r.quantity!, r.altQuantity, ingredientById(r.ingredientId), scale, sys)
    return `${d.approx ? '≈' : ''}${d.amount} ${d.unit}`.trim() + (d.secondary ? ` (${d.secondary})` : '')
  }
  it('parses the published cup measure', () => {
    expect(parseIngredientLine('375 g sourdough discard (1½ cups)')).toMatchObject({ name: 'sourdough discard', ingredientId: 'starter', quantity: { amount: 375, unit: 'g' }, altQuantity: { amount: 1.5, unit: 'cup' } })
    expect(parseIngredientLine('112 g olive oil (½ cup), split')).toMatchObject({ name: 'olive oil', note: 'split', altQuantity: { unit: 'cup' } })
    expect(parseIngredientLine('128 g butter (9 tbsp — 1 for the pan)')).toMatchObject({ note: '1 for the pan', altQuantity: { amount: 9, unit: 'tbsp' } })
    expect(parseIngredientLine('350 g mashed ripe banana (3)')).toMatchObject({ note: '3' })
  })
  it('uses the stored measure for each system, exactly', () => {
    expect(line('250 g discard (1 cup)', 1, 'metric')).toBe('250 g (1 cup)')
    expect(line('250 g discard (1 cup)', 1, 'us')).toBe('1 cup (250 g)')
    expect(line('250 g discard (1 cup)', 2, 'us')).toBe('2 cups (500 g)')
    expect(line('3 tsp dried yeast (9 g)', 1, 'metric')).toBe('9 g (3 tsp)')
    expect(line('3 tsp dried yeast (9 g)', 1, 'us')).toBe('3 tsp (9 g)')
  })
})
