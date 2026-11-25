/** Built-in categories seeded into the database on first run (SPEC §5). */
export const BUILT_IN_CATEGORIES = [
  'Breakfast', 'Lunch', 'Dinner', 'Desserts', 'Snacks', 'Drinks', 'Soups', 'Salads', 'Bakery', 'Other',
] as const

/** Icon names (see ui/Icon) for the seeded categories. Unknown names fall back to a default. */
export const BUILT_IN_CATEGORY_ICONS: Record<(typeof BUILT_IN_CATEGORIES)[number], string> = {
  Breakfast: 'sunrise',
  Lunch: 'sandwich',
  Dinner: 'utensils',
  Desserts: 'cake',
  Snacks: 'cookie',
  Drinks: 'cup',
  Soups: 'soup',
  Salads: 'leaf',
  Bakery: 'bread',
  Other: 'tag',
}
