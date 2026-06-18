import { SavedGroceryList } from './groceryData';

interface LegacyGroceryItem {
  name?: unknown;
  quantity?: unknown;
}

// Older builds stored grocery entries as { name, quantity } objects. Normalize
// both that format and the current string format at the localStorage boundary.
export function normalizeStoredItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedItems = value.flatMap((item) => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      return trimmed ? [trimmed] : [];
    }

    if (isRecord(item)) {
      const legacyItem = item as LegacyGroceryItem;
      if (typeof legacyItem.name === 'string') {
        const trimmed = legacyItem.name.trim();
        return trimmed ? [trimmed] : [];
      }
    }

    return [];
  });

  // Case-insensitive deduplication prevents migrated lists from gaining repeated
  // entries when old and new storage formats were mixed.
  const seen = new Set<string>();
  return normalizedItems.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Validate saved-list metadata while migrating item entries so one corrupt list
// cannot crash the complete saved-lists page.
export function normalizeStoredSavedLists(value: unknown): SavedGroceryList[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((list, index) => {
    if (!isRecord(list)) {
      return [];
    }

    const items = normalizeStoredItems(list.items);
    const name = typeof list.name === 'string' ? list.name.trim() : '';
    if (!name) {
      return [];
    }

    return [{
      id: typeof list.id === 'string' && list.id ? list.id : `migrated-${index}`,
      name,
      items,
      createdAt: isValidDateString(list.createdAt)
        ? list.createdAt
        : new Date(0).toISOString(),
      lastUsed: isValidDateString(list.lastUsed) ? list.lastUsed : undefined,
    }];
  });
}

export function readStoredItems(storageKey: string): string[] {
  return normalizeStoredItems(readJsonStorage(storageKey));
}

export function readStoredSavedLists(storageKey: string): SavedGroceryList[] {
  return normalizeStoredSavedLists(readJsonStorage(storageKey));
}

function readJsonStorage(storageKey: string): unknown {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
