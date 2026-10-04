import { describe, expect, it } from 'vitest'
import { isoMinutes, recipeFromHtml, recipeFromText } from './importers'

const page = `<html><head>
<meta property="og:site_name" content="Farmhouse on Boone" />
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"WebPage","name":"x"},
 {"@type":"Recipe","name":"Sourdough Pancakes","author":{"@type":"Person","name":"Lisa Bass"},
  "description":"Fluffy &amp; tangy.","prepTime":"PT10M","cookTime":"PT20M","totalTime":"PT8H30M",
  "recipeYield":["12","12 pancakes"],"keywords":"sourdough, breakfast",
  "image":["https://example.com/a.jpg"],
  "recipeIngredient":["1 cup sourdough starter","2 &frac12; cups flour","2 eggs","1 tsp baking soda"],
  "recipeInstructions":[{"@type":"HowToSection","name":"Night before","itemListElement":[{"@type":"HowToStep","text":"Mix starter and flour. Rest 8 hours."}]},
   {"@type":"HowToSection","name":"Morning","itemListElement":[{"@type":"HowToStep","text":"Add eggs and soda."},{"@type":"HowToStep","text":"Cook on a 375°F griddle for 2 minutes per side."}]}]}
]}</script></head><body></body></html>`

describe('web page import', () => {
  it('reads schema.org Recipe from a @graph', () => {
    const d = recipeFromHtml(page, 'https://www.farmhouseonboone.com/sourdough-pancakes/')!
    expect(d.title).toBe('Sourdough Pancakes')
    expect(d.description).toBe('Fluffy & tangy.')
    expect(d.source).toEqual({ name: 'Farmhouse on Boone', url: 'https://www.farmhouseonboone.com/sourdough-pancakes/', originalTitle: 'Sourdough Pancakes', originalCreator: 'Lisa Bass' })
    expect(d.ingredients).toHaveLength(4)
    expect(d.ingredients[1]).toMatchObject({ name: 'flour', quantity: { amount: 2.5, unit: 'cup' } })
    expect(d.steps.map((s) => s.group)).toEqual(['Night before', 'Morning', 'Morning'])
    expect(d.yield).toEqual({ amount: 12, unit: 'pancakes' })
    expect(d.totalMinutes).toBe(510)
    expect(d.oven).toEqual({ value: 375, unit: 'F' })
    expect(d.tags).toEqual(['sourdough', 'breakfast'])
  })
  it('returns null without recipe data', () => {
    expect(recipeFromHtml('<html></html>', 'https://x.com')).toBeNull()
  })
  it('iso durations', () => {
    expect(isoMinutes('PT1H30M')).toBe(90)
    expect(isoMinutes('P0DT0H45M')).toBe(45)
  })
})

describe('text import', () => {
  it('handles a typical pasted recipe', () => {
    const d = recipeFromText(`Oma's Streuselkuchen
Makes 1 tray
Ingredients
500 g flour
1 packet dry yeast
250 ml milk, warm
Streusel:
150 g butter
Method
1. Mix everything into a smooth dough and let
it rise for 1 hour.
2. Bake at 180 °C for 25 minutes.`)
    expect(d.title).toBe("Oma's Streuselkuchen")
    expect(d.yield).toEqual({ amount: 1, unit: 'tray' })
    expect(d.ingredients.map((i) => i.name)).toEqual(['flour', 'packet dry yeast', 'milk', 'butter'])
    expect(d.ingredients[3].group).toBe('Streusel')
    expect(d.steps.map((s) => s.text)).toEqual(['Mix everything into a smooth dough and let it rise for 1 hour.', 'Bake at 180 °C for 25 minutes.'])
    expect(d.oven).toEqual({ value: 180, unit: 'C' })
  })
  it('works without headings (German card)', () => {
    const d = recipeFromText(`Zitronenkuchen
250 g Butter
200 g Zucker
4 Eier
Butter und Zucker schaumig rühren.
Eier nach und nach unterrühren.`)
    expect(d.title).toBe('Zitronenkuchen')
    expect(d.ingredients).toHaveLength(3)
    expect(d.ingredients[1].ingredientId).toBe('sugar')
    expect(d.steps).toHaveLength(2)
  })
})
