import { describe, expect, it } from 'vitest';
import { normalizeStoredItems, normalizeStoredSavedLists } from './persistence';

describe('grocery localStorage migration', () => {
  it('converts legacy item objects to strings', () => {
    expect(normalizeStoredItems([
      { name: 'Milk', quantity: 1 },
      { name: 'Eggs', quantity: 2 },
      'Bread',
    ])).toEqual(['Milk', 'Eggs', 'Bread']);
  });

  it('drops malformed entries and deduplicates names', () => {
    expect(normalizeStoredItems([
      null,
      { quantity: 1 },
      ' Milk ',
      { name: 'milk', quantity: 3 },
      42,
    ])).toEqual(['Milk']);
  });

  it('migrates saved lists without allowing corrupt records to crash rendering', () => {
    const lists = normalizeStoredSavedLists([
      {
        id: 'weekly',
        name: 'Weekly Staples',
        items: [{ name: 'Milk', quantity: 1 }, { name: 'Eggs', quantity: 1 }],
        createdAt: '2026-06-17T00:00:00.000Z',
      },
      { id: 'invalid', items: [] },
    ]);

    expect(lists).toEqual([{
      id: 'weekly',
      name: 'Weekly Staples',
      items: ['Milk', 'Eggs'],
      createdAt: '2026-06-17T00:00:00.000Z',
      lastUsed: undefined,
    }]);
  });
});
