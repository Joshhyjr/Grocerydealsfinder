// Broad grocery terms often map to multiple shelf variants, so we expand them
// into likely shopper intents before sending requests to the backend.
const QUERY_VARIANTS: Record<string, string[]> = {
  chicken: ['chicken breast', 'chicken thighs', 'chicken drumsticks', 'whole chicken'],
  chickens: ['chicken breast', 'chicken thighs', 'chicken drumsticks', 'whole chicken'],
  beef: ['ground beef', 'beef sirloin', 'beef stew meat'],
  pork: ['pork chops', 'pork tenderloin', 'ground pork', 'pork shoulder'],
  apples: ['gala apples', 'fuji apples', 'honeycrisp apples', 'granny smith apples'],
  apple: ['gala apples', 'fuji apples', 'honeycrisp apples', 'granny smith apples'],
  tomatoes: ['roma tomatoes', 'cherry tomatoes', 'grape tomatoes', 'vine tomatoes'],
  tomato: ['roma tomatoes', 'cherry tomatoes', 'grape tomatoes', 'vine tomatoes'],
  potatoes: ['russet potatoes', 'yukon gold potatoes', 'red potatoes', 'sweet potatoes'],
  potato: ['russet potatoes', 'yukon gold potatoes', 'red potatoes', 'sweet potatoes'],
  onions: ['yellow onions', 'red onions', 'sweet onions', 'green onions'],
  onion: ['yellow onions', 'red onions', 'sweet onions', 'green onions'],
  lettuce: ['romaine lettuce', 'iceberg lettuce', 'leaf lettuce', 'spring mix'],
  peppers: ['bell peppers', 'red peppers', 'green peppers', 'mini sweet peppers'],
  pepper: ['bell peppers', 'red peppers', 'green peppers', 'mini sweet peppers'],
  berries: ['strawberries', 'blueberries', 'raspberries', 'blackberries'],
  oranges: ['navel oranges', 'mandarins', 'clementines'],
  orange: ['navel oranges', 'mandarins', 'clementines'],
};

export interface SearchExpansionPlan {
  originalItem: string;
  queries: string[];
}

export function buildSearchExpansionPlan(items: string[]): SearchExpansionPlan[] {
  return items.map((item) => ({
    originalItem: item,
    queries: expandSearchQuery(item),
  }));
}

export function expandSearchQuery(query: string): string[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const normalizedQuery = normalizeSearchText(trimmedQuery);
  const variants = QUERY_VARIANTS[normalizedQuery];

  // Keep the shopper's original wording first so exact matches still win when
  // the term is already specific enough.
  return dedupeSearchTerms([trimmedQuery, ...(variants ?? [])]);
}

function dedupeSearchTerms(terms: string[]): string[] {
  const seen = new Set<string>();

  return terms.filter((term) => {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm || seen.has(normalizedTerm)) {
      return false;
    }

    seen.add(normalizedTerm);
    return true;
  });
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
