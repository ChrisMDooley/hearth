import type { IngredientInfo } from './types'

/**
 * Ingredient catalogue with densities (grams per US cup).
 *
 * Values are in line with commonly published baking weight charts. Anything
 * that varies a lot with packing, grind or brand is marked 'rough' and the UI
 * shows such conversions with "≈". Add new ingredients here; the conversion
 * engine picks them up automatically. Matching uses `aliases`, so keep them
 * lower case and include German names where the family uses them.
 */
export const INGREDIENTS: IngredientInfo[] = [
  { id: 'flour-ap', name: 'all-purpose flour', aliases: ['all-purpose flour', 'all purpose flour', 'plain flour', 'flour', 'mehl', 'weizenmehl', 'type 405', 'type 550'], gramsPerCup: 120, densityConfidence: 'good' },
  { id: 'flour-bread', name: 'bread flour', aliases: ['bread flour', 'strong flour', 'strong white flour', 'type 550 bread flour'], gramsPerCup: 120, densityConfidence: 'good' },
  { id: 'flour-ww', name: 'whole wheat flour', aliases: ['whole wheat flour', 'wholemeal flour', 'vollkornmehl', 'whole-wheat flour'], gramsPerCup: 113, densityConfidence: 'good' },
  { id: 'flour-rye', name: 'rye flour', aliases: ['rye flour', 'roggenmehl'], gramsPerCup: 106, densityConfidence: 'good' },
  { id: 'flour-spelt', name: 'spelt flour', aliases: ['spelt flour', 'dinkelmehl'], gramsPerCup: 112, densityConfidence: 'rough' },
  { id: 'almond-ground', name: 'ground almonds', aliases: ['ground almonds', 'almond flour', 'almond meal', 'gemahlene mandeln'], gramsPerCup: 96, densityConfidence: 'rough' },
  { id: 'oats', name: 'rolled oats', aliases: ['rolled oats', 'oats', 'old-fashioned oats', 'haferflocken'], gramsPerCup: 89, densityConfidence: 'good' },

  { id: 'sugar', name: 'granulated sugar', aliases: ['granulated sugar', 'sugar', 'white sugar', 'caster sugar', 'zucker'], gramsPerCup: 198, densityConfidence: 'good' },
  { id: 'sugar-brown', name: 'brown sugar', aliases: ['brown sugar', 'light brown sugar', 'dark brown sugar', 'brauner zucker'], gramsPerCup: 213, densityConfidence: 'rough' },
  { id: 'sugar-powdered', name: 'powdered sugar', aliases: ['powdered sugar', 'icing sugar', "confectioners' sugar", 'confectioners sugar', 'puderzucker'], gramsPerCup: 113, densityConfidence: 'good' },
  { id: 'vanilla-sugar', name: 'vanilla sugar', aliases: ['vanilla sugar', 'vanillezucker'], gramsPerCup: 200, densityConfidence: 'rough' },
  { id: 'honey', name: 'honey', aliases: ['honey', 'honig'], gramsPerCup: 336, densityConfidence: 'good' },
  { id: 'maple', name: 'maple syrup', aliases: ['maple syrup', 'ahornsirup'], gramsPerCup: 312, densityConfidence: 'good', liquid: true },

  { id: 'butter', name: 'butter', aliases: ['butter', 'unsalted butter', 'salted butter'], gramsPerCup: 227, densityConfidence: 'good' },
  { id: 'oil', name: 'vegetable oil', aliases: ['vegetable oil', 'oil', 'neutral oil', 'sunflower oil', 'canola oil', 'öl'], gramsPerCup: 198, densityConfidence: 'good', liquid: true },
  { id: 'olive-oil', name: 'olive oil', aliases: ['olive oil', 'olivenöl'], gramsPerCup: 200, densityConfidence: 'good', liquid: true },

  { id: 'water', name: 'water', aliases: ['water', 'wasser', 'warm water', 'lukewarm water'], gramsPerCup: 237, densityConfidence: 'good', liquid: true },
  { id: 'milk', name: 'milk', aliases: ['milk', 'whole milk', 'milch'], gramsPerCup: 242, densityConfidence: 'good', liquid: true },
  { id: 'buttermilk', name: 'buttermilk', aliases: ['buttermilk', 'buttermilch'], gramsPerCup: 242, densityConfidence: 'good', liquid: true },
  { id: 'cream', name: 'heavy cream', aliases: ['heavy cream', 'cream', 'whipping cream', 'sahne', 'schlagsahne'], gramsPerCup: 232, densityConfidence: 'good', liquid: true },
  { id: 'sour-cream', name: 'sour cream', aliases: ['sour cream', 'schmand', 'saure sahne'], gramsPerCup: 227, densityConfidence: 'good' },
  { id: 'yogurt', name: 'plain yogurt', aliases: ['yogurt', 'yoghurt', 'plain yogurt', 'plain yoghurt', 'greek yogurt', 'joghurt'], gramsPerCup: 227, densityConfidence: 'good' },
  { id: 'vanilla', name: 'vanilla extract', aliases: ['vanilla extract', 'vanilla', 'vanilleextrakt'], gramsPerCup: 208, densityConfidence: 'good', liquid: true },

  { id: 'egg', name: 'eggs', aliases: ['egg', 'eggs', 'large egg', 'large eggs', 'eier', 'ei'], gramsPerPiece: 50 },
  { id: 'egg-yolk', name: 'egg yolks', aliases: ['egg yolk', 'egg yolks', 'yolk', 'yolks', 'eigelb'], gramsPerPiece: 18 },

  { id: 'salt', name: 'salt', aliases: ['salt', 'fine salt', 'sea salt', 'fine sea salt', 'table salt', 'salz'], gramsPerCup: 288, densityConfidence: 'rough' },
  { id: 'baking-powder', name: 'baking powder', aliases: ['baking powder', 'backpulver'], gramsPerCup: 192, densityConfidence: 'good' },
  { id: 'baking-soda', name: 'baking soda', aliases: ['baking soda', 'bicarbonate of soda', 'natron'], gramsPerCup: 288, densityConfidence: 'good' },
  { id: 'yeast-instant', name: 'instant yeast', aliases: ['instant yeast', 'dry yeast', 'dried yeast', 'active dry yeast', 'trockenhefe'], gramsPerCup: 150, densityConfidence: 'good' },
  { id: 'cinnamon', name: 'ground cinnamon', aliases: ['cinnamon', 'ground cinnamon', 'zimt'], gramsPerCup: 125, densityConfidence: 'rough' },
  { id: 'cocoa', name: 'cocoa powder', aliases: ['cocoa', 'cocoa powder', 'unsweetened cocoa', 'kakao', 'kakaopulver'], gramsPerCup: 84, densityConfidence: 'rough' },

  { id: 'cornmeal', name: 'cornmeal', aliases: ['cornmeal', 'maisgrieß', 'maisgriess', 'polenta'], gramsPerCup: 140, densityConfidence: 'rough' },
  { id: 'cornstarch', name: 'cornstarch', aliases: ['cornstarch', 'cornflour', 'speisestärke', 'maisstärke'], gramsPerCup: 128, densityConfidence: 'good' },
  { id: 'molasses', name: 'molasses', aliases: ['molasses', 'zuckerrübensirup'], gramsPerCup: 337, densityConfidence: 'good' },
  { id: 'parmesan', name: 'grated parmesan', aliases: ['parmesan', 'grated parmesan', 'parmesan cheese'], gramsPerCup: 90, densityConfidence: 'rough' },
  { id: 'starter', name: 'sourdough starter', aliases: ['sourdough starter', 'starter', 'active starter', 'levain', 'sauerteig', 'anstellgut', 'discard', 'sourdough discard', 'starter discard'], gramsPerCup: 240, densityConfidence: 'rough' },

  { id: 'choc-chips', name: 'chocolate chips', aliases: ['chocolate chips', 'chocolate chunks', 'semisweet chocolate chips', 'schokotropfen'], gramsPerCup: 170, densityConfidence: 'good' },
  { id: 'walnuts', name: 'chopped walnuts', aliases: ['walnuts', 'chopped walnuts', 'pecans', 'chopped nuts', 'walnüsse'], gramsPerCup: 113, densityConfidence: 'rough' },
  { id: 'raisins', name: 'raisins', aliases: ['raisins', 'rosinen'], gramsPerCup: 149, densityConfidence: 'good' },
  { id: 'blueberries', name: 'blueberries', aliases: ['blueberries', 'fresh blueberries', 'frozen blueberries', 'heidelbeeren', 'blaubeeren'], gramsPerCup: 148, densityConfidence: 'rough' },
  { id: 'banana', name: 'bananas', aliases: ['banana', 'bananas', 'ripe bananas', 'very ripe bananas'], gramsPerPiece: 115 },
  { id: 'apple', name: 'apples', aliases: ['apple', 'apples', 'äpfel', 'tart apples'] , gramsPerPiece: 180 },
]

const byAlias = new Map<string, IngredientInfo>()
for (const ing of INGREDIENTS) for (const a of ing.aliases) byAlias.set(a, ing)
const byId = new Map(INGREDIENTS.map((i) => [i.id, i]))

export function ingredientById(id?: string): IngredientInfo | undefined {
  return id ? byId.get(id) : undefined
}

/**
 * Best-effort match of free text ("2 cups packed light brown sugar") to the
 * catalogue: tries the longest alias contained in the text.
 */
export function matchIngredient(text: string): IngredientInfo | undefined {
  const t = text.toLowerCase()
  let best: IngredientInfo | undefined
  let bestLen = 0
  for (const [alias, ing] of byAlias) {
    if (alias.length > bestLen && new RegExp(`(?<!\\p{L})${escapeRe(alias)}(?!\\p{L})`, 'u').test(t)) {
      best = ing
      bestLen = alias.length
    }
  }
  return best
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
