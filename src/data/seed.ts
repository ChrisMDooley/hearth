import { matchIngredient } from '../domain/ingredients'
import { parseIngredientLine } from '../domain/parse'
import type {
  BakeEntry,
  Collection,
  Creator,
  Instruction,
  Recipe,
  RecipeIngredient,
} from '../domain/types'
import type { Snapshot } from './repository'
import { DISCARD_DESCRIPTION, SOURDOUGH_DESCRIPTION, SOURDOUGH_KITCHEN } from './sourdoughKitchen'

/**
 * Sample library so the interface can be judged with real-looking data.
 *
 * - Our own and family recipes are written out in full (written for this app).
 * - Recipes from external creators are stored as *reference* entries: title,
 *   category, link to the original and our own notes/bakes — not a copy of
 *   their ingredients and method.
 * - Bake entries and notes are illustrative and can be deleted, or wiped with
 *   "Reset sample data" on the profile screen.
 */

const T0 = Date.parse('2026-09-01T10:00:00Z')
const day = (n: number) => new Date(T0 + n * 86400000).toISOString()

export const USERS = [
  { id: 'u_chris', name: 'Chris', avatarColor: '#C8643B', unitSystem: 'metric' as const, showOriginal: true, createdAt: day(0) },
  { id: 'u_janina', name: 'Janina', avatarColor: '#7A8B6F', unitSystem: 'metric' as const, showOriginal: true, createdAt: day(0) },
]

export const CREATORS: Creator[] = [
  { id: 'c_fob', name: 'Farmhouse on Boone', kind: 'external', website: 'https://www.farmhouseonboone.com', blurb: 'Lisa Bass’s homestead kitchen — lots of sourdough and from-scratch family baking.' },
  { id: 'c_kab', name: 'King Arthur Baking', kind: 'external', website: 'https://www.kingarthurbaking.com', blurb: 'The Vermont flour company’s test kitchen — reliable, well-tested breads.' },
  { id: 'c_sba', name: 'Sally’s Baking Addiction', kind: 'external', website: 'https://sallysbakingaddiction.com', blurb: 'Sally McKenney’s baking blog — cookies, cakes and sweet rolls.' },
  { id: 'c_family', name: 'Family Recipes', kind: 'family', blurb: 'Handed down from Oma and the rest of the family.' },
  { id: 'c_chris', name: 'Chris', kind: 'person', userId: 'u_chris' },
  { id: 'c_janina', name: 'Janina', kind: 'person', userId: 'u_janina' },
]

const C = (id: string, name: string, sort: number): Collection => ({ id, name, ownerId: null, sort })
export const COLLECTIONS: Collection[] = [
  C('col_bread', 'Bread', 1),
  { ...C('col_sourdough', 'Sourdough', 2), description: SOURDOUGH_DESCRIPTION },
  { ...C('col_discard', 'Sourdough discard', 2.5), description: DISCARD_DESCRIPTION },
  C('col_cakes', 'Cakes', 3),
  C('col_cookies', 'Cookies', 4),
  C('col_muffins', 'Muffins', 5),
  C('col_breakfast', 'Breakfast', 6),
  C('col_desserts', 'Desserts', 7),
  C('col_christmas', 'Christmas', 8),
  C('col_kids', 'Kids’ Favorites', 9),
  C('col_quick', 'Quick Recipes', 10),
  C('col_family', 'Family Recipes', 11),
]

let n = 0
function ing(lines: string, group?: string): RecipeIngredient[] {
  return lines
    .trim()
    .split('\n')
    .map((l) => {
      const optional = /\(optional\)/i.test(l)
      const r = parseIngredientLine(l.replace(/\(optional\)/i, '').trim())!
      return { ...r, id: `ri_${++n}`, group, optional: optional || undefined, ingredientId: r.ingredientId ?? matchIngredient(r.name)?.id }
    })
}
function steps(lines: string, group?: string): Instruction[] {
  return lines
    .trim()
    .split('\n')
    .map((t) => ({ id: `st_${++n}`, text: t.trim(), group }))
}

type Draft = Omit<Recipe, 'createdAt' | 'updatedAt' | 'equipment' | 'tags' | 'visibility' | 'contentMode' | 'ingredients' | 'steps'> &
  Partial<Pick<Recipe, 'equipment' | 'tags' | 'visibility' | 'contentMode' | 'ingredients' | 'steps'>> & { added: number; cols: string[] }

const drafts: Draft[] = [
  {
    id: 'r_boule',
    title: 'Everyday Sourdough Boule',
    description: 'Our weekly loaf. Crackly crust, open crumb, overnight in the fridge.',
    kind: 'mine',
    creatorId: 'c_chris',
    ownerId: 'u_chris',
    createdBy: 'u_chris',
    category: 'sourdough',
    tags: ['overnight', 'dutch oven'],
    prepMinutes: 45,
    bakeMinutes: 45,
    totalMinutes: 20 * 60,
    yield: { amount: 1, unit: 'loaf' },
    oven: { value: 250, unit: 'C', note: 'Dutch oven preheated inside' },
    equipment: ['Dutch oven', 'Banneton', 'Bench scraper'],
    art: 'boule',
    ingredients: ing(`
100 g active sourdough starter, fed 4–8 hours earlier
350 g water, lukewarm
450 g bread flour
50 g whole wheat flour
10 g salt`),
    steps: steps(`
Mix the starter with most of the water. Add both flours and mix until no dry flour is left. Cover and rest 30 minutes.
Add the salt and the rest of the water, then squeeze and fold until it disappears into the dough.
Over the next 2 hours, do 4 sets of stretch-and-folds, one every 30 minutes.
Leave to bulk ferment until about 50 % bigger, domed and jiggly — usually 3–5 hours at 24 °C.
Pre-shape into a round, rest 20 minutes, then shape tightly and place seam-up in a floured banneton.
Cover and refrigerate overnight, 10–16 hours.
Put the Dutch oven in the oven and preheat to 250 °C for 45 minutes.
Turn the cold dough onto parchment, score it, lower it into the pot and bake covered for 20 minutes.
Remove the lid, turn down to 230 °C and bake 20–25 minutes more, until deep brown.
Cool on a rack for at least 1 hour before slicing.`),
    recipeNotes: 'Hydration is 70 %. In a cold kitchen bulk fermentation takes longer — go by the dough, not the clock.',
    added: 2,
    cols: ['col_bread', 'col_sourdough'],
  },
  {
    id: 'r_apfelkuchen',
    title: 'Oma’s Versunkener Apfelkuchen',
    description: 'Sunken apple cake — the Sunday-afternoon one. Buttery sponge, apples pressed in on top.',
    kind: 'family',
    creatorId: 'c_family',
    ownerId: 'u_janina',
    createdBy: 'u_janina',
    category: 'cake',
    tags: ['apples', 'sunday', 'springform'],
    prepMinutes: 25,
    bakeMinutes: 45,
    totalMinutes: 85,
    yield: { amount: 1, unit: 'cake (26 cm tin)' },
    oven: { value: 180, unit: 'C', note: 'top/bottom heat, or 160 °C fan' },
    equipment: ['26 cm springform tin'],
    art: 'cake',
    ingredients: [
      ...ing(`
125 g butter, soft
125 g sugar
8 g vanilla sugar
3 eggs
200 g flour
2 tsp baking powder
1 pinch salt
3 tbsp milk`, 'Cake'),
      ...ing(`
4 apples, tart (e.g. Boskoop)
1/2 tsp ground cinnamon (optional)
powdered sugar, for dusting`, 'Topping'),
    ],
    steps: steps(`
Preheat the oven to 180 °C. Grease the springform tin.
Peel, quarter and core the apples. Cut shallow slits into the rounded backs.
Beat the butter, sugar and vanilla sugar until pale, about 3 minutes.
Beat in the eggs one at a time.
Mix flour, baking powder and salt, and stir into the batter with the milk.
Spread the batter in the tin. Press the apple quarters in, rounded side up. Dust with cinnamon if using.
Bake 40–45 minutes, until a skewer comes out clean.
Cool 15 minutes in the tin, then dust with powdered sugar.`),
    recipeNotes: 'Best on the day, with whipped cream.',
    added: 5,
    cols: ['col_cakes', 'col_family', 'col_desserts', 'col_kids'],
  },
  {
    id: 'r_cookies',
    title: 'Chocolate Chip Cookies',
    description: 'Crisp edges, soft middles. Measured in cups — try the Metric toggle.',
    kind: 'mine',
    creatorId: 'c_janina',
    ownerId: 'u_janina',
    createdBy: 'u_janina',
    category: 'cookies',
    tags: ['chocolate', 'bake sale'],
    prepMinutes: 20,
    bakeMinutes: 11,
    totalMinutes: 60,
    yield: { amount: 36, unit: 'cookies' },
    oven: { value: 375, unit: 'F' },
    equipment: ['2 baking sheets', 'Cookie scoop'],
    art: 'cookie',
    ingredients: ing(`
1 cup butter, softened
3/4 cup granulated sugar
3/4 cup brown sugar, packed
2 large eggs
2 tsp vanilla extract
2 1/4 cups all-purpose flour
1 tsp baking soda
1 tsp salt
2 cups chocolate chips`),
    steps: steps(`
Preheat the oven to 375 °F and line two baking sheets with parchment.
Cream the butter and both sugars until light, about 2 minutes.
Beat in the eggs and vanilla.
Whisk flour, baking soda and salt, then stir into the butter mixture until just combined.
Fold in the chocolate chips. Chill the dough 30 minutes if it feels soft.
Scoop 2-tablespoon balls onto the sheets, 5 cm apart.
Bake 9–11 minutes, until the edges are golden and the centres still look soft.
Leave on the sheet 5 minutes, then move to a rack.`),
    added: 8,
    cols: ['col_cookies', 'col_kids', 'col_desserts'],
  },
  {
    id: 'r_muffins',
    title: 'Blueberry Muffins',
    description: 'Tall, sugar-topped muffins. Uses oil, so they stay soft for days.',
    kind: 'mine',
    creatorId: 'c_chris',
    ownerId: 'u_chris',
    createdBy: 'u_chris',
    category: 'muffins',
    tags: ['berries', 'lunchbox'],
    prepMinutes: 15,
    bakeMinutes: 20,
    yield: { amount: 12, unit: 'muffins' },
    oven: { value: 400, unit: 'F' },
    equipment: ['12-cup muffin tin', 'Paper liners'],
    art: 'muffin',
    ingredients: ing(`
2 cups all-purpose flour
3/4 cup granulated sugar
2 tsp baking powder
1/2 tsp salt
1 large egg
1/2 cup milk
1/3 cup vegetable oil
1 tsp vanilla extract
1 1/2 cups blueberries
2 tbsp sugar, for the tops`),
    steps: steps(`
Preheat the oven to 400 °F and line a 12-cup muffin tin.
Whisk flour, sugar, baking powder and salt in a large bowl.
In a jug, whisk the egg, milk, oil and vanilla.
Pour the wet into the dry and stir until just combined — lumps are fine.
Fold in the blueberries.
Fill the cups almost to the top and sprinkle with sugar.
Bake 18–20 minutes, until a toothpick comes out clean.
Cool in the tin 10 minutes.`),
    added: 12,
    cols: ['col_muffins', 'col_breakfast', 'col_kids', 'col_quick'],
  },
  {
    id: 'r_kipferl',
    title: 'Vanillekipferl',
    description: 'Little almond crescents rolled in vanilla sugar. Christmas isn’t Christmas without them.',
    kind: 'family',
    creatorId: 'c_family',
    ownerId: 'u_janina',
    createdBy: 'u_janina',
    category: 'cookies',
    tags: ['christmas', 'almonds', 'plätzchen'],
    prepMinutes: 45,
    bakeMinutes: 12,
    totalMinutes: 2 * 60,
    yield: { amount: 60, unit: 'cookies' },
    oven: { value: 175, unit: 'C', note: 'or 160 °C fan' },
    equipment: ['Baking sheets'],
    art: 'crescent',
    ingredients: [
      ...ing(`
250 g flour
200 g butter, cold, in pieces
100 g ground almonds
70 g sugar
2 egg yolks
1 pinch salt`, 'Dough'),
      ...ing(`
50 g powdered sugar
16 g vanilla sugar`, 'Coating'),
    ],
    steps: steps(`
Knead all dough ingredients quickly into a smooth dough. Wrap and chill 1 hour.
Preheat the oven to 175 °C and line two baking sheets.
Roll the dough into logs about 3 cm thick and cut into 1 cm slices.
Roll each slice into a small sausage with thinner ends and bend into a crescent.
Bake 10–12 minutes, until just golden at the tips.
Mix powdered sugar and vanilla sugar. Let the crescents cool 2 minutes, then roll them in it while still warm.`),
    recipeNotes: 'They break easily while hot — the 2-minute wait matters.',
    added: 15,
    cols: ['col_christmas', 'col_cookies', 'col_family'],
  },
  {
    id: 'r_banana',
    title: 'One-Bowl Banana Bread',
    description: 'For the brown bananas on the counter. One bowl, no mixer.',
    kind: 'mine',
    creatorId: 'c_chris',
    ownerId: 'u_chris',
    createdBy: 'u_chris',
    category: 'breakfast',
    tags: ['bananas', 'one bowl'],
    prepMinutes: 10,
    bakeMinutes: 55,
    yield: { amount: 1, unit: 'loaf' },
    oven: { value: 175, unit: 'C' },
    equipment: ['Loaf tin (25 cm)'],
    art: 'loaf',
    ingredients: ing(`
3 very ripe bananas
75 g butter, melted
100 g brown sugar
1 egg
1 tsp vanilla extract
1 tsp baking soda
1 pinch salt
190 g flour
50 g walnuts, chopped (optional)`),
    steps: steps(`
Preheat the oven to 175 °C and line the loaf tin.
Mash the bananas in a bowl. Stir in the melted butter.
Mix in the sugar, egg, vanilla, baking soda and salt.
Stir in the flour until just combined, then the walnuts.
Bake 55–60 minutes, until a skewer comes out clean.
Cool 10 minutes in the tin.`),
    added: 18,
    cols: ['col_breakfast', 'col_quick', 'col_kids'],
  },
  {
    id: 'r_zopf',
    title: 'Hefezopf',
    description: 'Soft, lightly sweet braided bread for Sunday breakfast and Easter.',
    kind: 'family',
    creatorId: 'c_family',
    ownerId: 'u_chris',
    createdBy: 'u_chris',
    category: 'bread',
    tags: ['yeast', 'easter', 'braid'],
    prepMinutes: 30,
    bakeMinutes: 35,
    totalMinutes: 2 * 60 + 30,
    yield: { amount: 1, unit: 'braid' },
    oven: { value: 180, unit: 'C' },
    equipment: ['Baking sheet'],
    art: 'braid',
    ingredients: [
      ...ing(`
500 g flour
7 g instant yeast
250 ml milk, lukewarm
60 g sugar
60 g butter, soft
1 egg
1 pinch salt`, 'Dough'),
      ...ing(`
1 egg yolk
1 tbsp milk
pearl sugar, for sprinkling`, 'To finish'),
    ],
    steps: steps(`
Mix all dough ingredients and knead 8–10 minutes, until smooth and elastic.
Cover and let rise in a warm place for 1 hour, until doubled.
Divide into 3 pieces, roll into long strands and braid.
Place on a lined sheet, cover and rise 30 minutes. Preheat the oven to 180 °C.
Whisk yolk and milk, brush over the braid and sprinkle with pearl sugar.
Bake 30–35 minutes, until deep golden. It should sound hollow underneath.`),
    added: 20,
    cols: ['col_bread', 'col_breakfast', 'col_family'],
  },
  {
    id: 'r_zwetschgenkuchen',
    title: 'Sourdough Zwetschgenkuchen',
    description: 'Plum sheet cake on an enriched sourdough base instead of the usual Hefeteig. Mix the dough the evening before, bake the next day.',
    kind: 'mine',
    creatorId: 'c_chris',
    ownerId: 'u_chris',
    createdBy: 'u_chris',
    category: 'cake',
    tags: ['plums', 'zwetschgen', 'overnight', 'sheet cake', 'autumn'],
    prepMinutes: 45,
    bakeMinutes: 45,
    totalMinutes: 13 * 60,
    yield: { amount: 1, unit: 'tray (30 × 40 cm), about 20 pieces' },
    oven: { value: 180, unit: 'C', note: '160 °C fan · lower-middle rack' },
    equipment: ['30 × 40 cm baking tray', 'Rolling pin'],
    art: 'bar',
    ingredients: [
      ...ing(`
150 g active white starter, fed and at its peak (⅔ cup)
450 g flour, Type 550 (3¼ cups)
200 g milk, lukewarm (scant 1 cup)
1 egg
70 g sugar (⅓ cup)
70 g butter, soft (5 tbsp)
6 g salt (1 tsp)
1/2 tsp lemon zest (optional)`, 'Dough'),
      ...ing(`
2 kg Zwetschgen, stoned and quartered lengthwise (4½ lb)
30 g ground almonds (⅓ cup)
30 g butter, melted, for brushing the crust (2 tbsp)`, 'Filling'),
      ...ing(`
50 g sugar (¼ cup)
50 g brown sugar, packed (¼ cup)
16 g vanilla sugar, 2 packets
2 tsp ground cinnamon`, 'Spiced sugar topping (the one I made)'),
      ...ing(`
50 g sugar, for the plums (¼ cup)
150 g flour (1 cup)
100 g sugar (½ cup)
100 g butter, cold (7 tbsp)
1 tsp ground cinnamon`, 'Or: streusel topping'),
    ],
    steps: steps(`
Mix the starter, flour, milk, egg, sugar, salt and lemon zest. Knead for 5 minutes.
Work in the soft butter a little at a time, then knead 5–8 minutes more until the dough is smooth and elastic.
Cover and leave at about 20 °C until roughly doubled, usually 10–12 hours. Go by size, not the clock. In a warm kitchen, move it to the fridge after 3–4 hours.
Grease or line the tray. Roll the dough out, lay it in and push it into the corners. A slightly thick base is fine — it soaks up the plum juice.
Spiced sugar: mix the topping and scatter half over the dough, then the ground almonds. Streusel: scatter only the ground almonds over the dough.
Stand the plum quarters upright in tight, overlapping rows, like roof tiles.
Spiced sugar: cover the plums with the rest of the spiced sugar. Streusel: sprinkle the plums with the 50 g sugar.
Leave to rise until the edges look puffy, 1–2 hours (less if the base is already thick). Streusel: meanwhile rub the streusel ingredients into crumbs and chill them. Preheat the oven to 180 °C.
Streusel: scatter the crumbs over the plums. Bake for 20 minutes.
Brush the exposed crust edges with the melted butter. Bake 20–25 minutes more, until the underside is golden and the plums bubble. Lay foil loosely on top if it browns too fast.
Leave in the tray for at least 30 minutes so the juices set. Serve with Schlagsahne.`),
    recipeNotes: [
      'Two toppings: the spiced sugar (what I made) or streusel. The steps say which applies to which.',
      'Sour Zwetschgen need the sugar — don’t cut it back.',
      'Keep the ground almonds in either way; they stop the base going soggy.',
      'With a thicker base, lift a corner before taking it out: the underside should be golden, not pale.',
      'Plain Hessian version: skip both toppings and dust with sugar after baking.',
      'Lisa Bass (Farmhouse on Boone) has no plum kuchen; her sourdough cinnamon roll dough is the closest enriched base if you want to try hers.',
    ].join('\n\n'),
    added: 33,
    cols: ['col_cakes', 'col_sourdough', 'col_desserts'],
  },

  // ---------- external creators: reference entries (link + our notes) ----------
  ref('r_fob_sandwich', 'Sourdough Sandwich Bread', 'c_fob', 'sourdough', 'loaf', 'https://www.farmhouseonboone.com/?p=35891', 'Lisa Bass', ['sandwich', 'loaf pan'], 3, ['col_bread', 'col_sourdough']),
  ref('r_fob_brioche', 'Sourdough Brioche', 'c_fob', 'sourdough', 'roll', 'https://www.farmhouseonboone.com/?p=35915', 'Lisa Bass', ['enriched', 'butter'], 10, ['col_bread', 'col_sourdough', 'col_breakfast']),
  ref('r_fob_sticks', 'Sourdough Breadsticks', 'c_fob', 'sourdough', 'stick', 'https://www.farmhouseonboone.com/delicious-sourdough-breadsticks', 'Lisa Bass', ['dinner', 'kids'], 22, ['col_sourdough', 'col_kids']),
  ref('r_kab_white', 'Classic White Sandwich Bread', 'c_kab', 'bread', 'loaf', 'https://www.kingarthurbaking.com/recipes/king-arthurs-classic-white-sandwich-bread-recipe', 'King Arthur Baking', ['sandwich', 'yeast'], 7, ['col_bread'], 'King Arthur’s Classic White Sandwich Bread'),
  ref('r_sba_rolls', 'Easy Cinnamon Rolls', 'c_sba', 'pastry', 'roll', 'https://sallysbakingaddiction.com/easy-cinnamon-rolls-from-scratch/', 'Sally McKenney', ['cinnamon', 'weekend'], 24, ['col_breakfast', 'col_desserts', 'col_kids'], 'Easy Cinnamon Rolls (from scratch)'),
]

function ref(
  id: string,
  title: string,
  creatorId: string,
  category: Recipe['category'],
  art: Recipe['art'],
  url: string,
  person: string,
  tags: string[],
  added: number,
  cols: string[],
  originalTitle = title,
): Draft {
  const creator = CREATORS.find((c) => c.id === creatorId)!
  return {
    id,
    title,
    kind: 'creator',
    contentMode: 'reference',
    creatorId,
    source: { name: creator.name, url, originalTitle, originalCreator: person },
    ownerId: 'u_chris',
    createdBy: 'u_chris',
    category,
    tags,
    art,
    added,
    cols,
  }
}

const bakes: BakeEntry[] = [
  { id: 'b1', userId: 'u_chris', recipeId: 'r_boule', date: '2026-10-04', notes: 'Fermented overnight. Best crust so far.', modifications: 'Used 20 g less water (330 g).', rating: 5, result: 'great', photoIds: [], createdAt: '2026-10-04T12:00:00Z' },
  { id: 'b2', userId: 'u_chris', recipeId: 'r_boule', date: '2026-09-27', notes: 'Kitchen was cold, bulk ran almost 6 hours. Crumb a bit tight.', rating: 3, result: 'okay', photoIds: [], createdAt: '2026-09-27T12:00:00Z' },
  { id: 'b3', userId: 'u_janina', recipeId: 'r_cookies', date: '2026-09-20', notes: 'Double batch for the school bake sale — all gone.', scale: 2, rating: 5, result: 'great', photoIds: [], createdAt: '2026-09-20T12:00:00Z' },
  { id: 'b4', userId: 'u_janina', recipeId: 'r_apfelkuchen', date: '2026-09-13', notes: 'Boskoop from the market. Kids wanted seconds.', rating: 5, result: 'great', photoIds: [], createdAt: '2026-09-13T12:00:00Z' },
  { id: 'b5', userId: 'u_chris', recipeId: 'r_fob_sandwich', date: '2026-09-29', notes: 'Followed the original. Good for school sandwiches.', rating: 4, result: 'good', photoIds: [], createdAt: '2026-09-29T12:00:00Z' },
  { id: 'b6', userId: 'u_chris', recipeId: 'r_muffins', date: '2026-09-24', notes: 'Frozen blueberries straight from the freezer, +2 min.', rating: 4, result: 'good', photoIds: [], createdAt: '2026-09-24T12:00:00Z' },
]

/**
 * Bump when the sample library gains records. Existing devices get the new
 * records merged in (nothing of theirs is overwritten); see mergeSeed().
 */
export const SEED_VERSION = 3
/** Seed records retired in later versions; removed only if nobody has used them. */
export const RETIRED_SEED_IDS = ['r_fob_ww']

export function buildSeed(): Snapshot {
  const recipes: Recipe[] = drafts.map(({ added, cols: _c, ...d }) => ({
    contentMode: 'full',
    visibility: 'shared',
    equipment: [],
    tags: [],
    ingredients: [],
    steps: [],
    ...d,
    createdAt: day(added),
    updatedAt: day(added),
  }))
  recipes.push(...SOURDOUGH_KITCHEN.map((x) => x.recipe))
  const recipeCollections = [
    ...drafts.flatMap((d) => d.cols.map((c) => ({ recipeId: d.id, collectionId: c }))),
    ...SOURDOUGH_KITCHEN.flatMap((x) => x.cols.map((c) => ({ recipeId: x.recipe.id, collectionId: c }))),
  ]
  const fav = (userId: string, recipeId: string, k: number) => ({ userId, recipeId, createdAt: day(k) })
  return {
    users: USERS,
    creators: CREATORS,
    collections: COLLECTIONS,
    recipes,
    recipeCollections,
    favorites: [
      fav('u_chris', 'r_boule', 3),
      fav('u_chris', 'r_fob_sandwich', 4),
      fav('u_chris', 'r_muffins', 13),
      fav('u_chris', 'r_apfelkuchen', 6),
      fav('u_janina', 'r_cookies', 9),
      fav('u_janina', 'r_apfelkuchen', 6),
      fav('u_janina', 'r_kipferl', 16),
    ],
    notes: [
      { id: 'n1', userId: 'u_chris', recipeId: 'r_boule', text: 'Use the Staub Dutch oven.', createdAt: day(4), updatedAt: day(4) },
      { id: 'n2', userId: 'u_janina', recipeId: 'r_apfelkuchen', text: 'Kids prefer this with less cinnamon.', createdAt: day(13), updatedAt: day(13) },
      { id: 'n3', userId: 'u_chris', recipeId: 'r_muffins', text: 'Increase baking time by 5 minutes when doubling.', createdAt: day(14), updatedAt: day(14) },
    ],
    bakes,
  }
}
