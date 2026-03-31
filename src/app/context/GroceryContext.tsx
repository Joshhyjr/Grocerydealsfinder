import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GroceryListItem, normalizeGroceryListItems, SavedGroceryList } from '../data/groceryData';
import { ActiveLocation } from '../data/location';

interface GroceryContextType {
  currentList: GroceryListItem[];
  addItem: (item: string) => void;
  removeItem: (item: string) => void;
  clearList: () => void;
  setCurrentList: (items: GroceryListItem[]) => void;
  incrementItemQuantity: (item: string) => void;
  decrementItemQuantity: (item: string) => void;

  savedLists: SavedGroceryList[];
  saveList: (name: string, items: GroceryListItem[]) => void;
  deleteList: (id: string) => void;
  loadList: (list: SavedGroceryList) => void;
  addItemToSavedList: (listId: string, item: string) => boolean;
  removeItemFromSavedList: (listId: string, item: string) => void;

  activeLocation: ActiveLocation | null;
  setActiveLocation: (location: ActiveLocation | null) => void;
  preferredStoreId: string | null;
  setPreferredStoreId: (storeId: string | null) => void;

  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const GroceryContext = createContext<GroceryContextType | undefined>(undefined);

export function GroceryProvider({ children }: { children: ReactNode }) {
  const [currentList, setCurrentList] = useState<GroceryListItem[]>(() => {
    const stored = localStorage.getItem('currentGroceryList');
    if (!stored) {
      return [];
    }

    try {
      return normalizeGroceryListItems(JSON.parse(stored) as Array<GroceryListItem | string>);
    } catch {
      return [];
    }
  });
  const [savedLists, setSavedLists] = useState<SavedGroceryList[]>([]);
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(() => {
    const stored = localStorage.getItem('activeLocation');
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as ActiveLocation;
    } catch {
      return null;
    }
  });
  const [preferredStoreId, setPreferredStoreId] = useState<string | null>(() => {
    const stored = localStorage.getItem('preferredStoreId');
    return stored || null;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('darkMode');
    // New visitors should land in dark mode, but an explicit stored choice
    // still wins so we do not flip returning users back unexpectedly.
    if (!stored) {
      return true;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return true;
    }
  });

  // Load saved lists from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('savedGroceryLists');
    if (stored) {
      try {
        const parsedLists = JSON.parse(stored) as Array<Omit<SavedGroceryList, 'items'> & { items: Array<GroceryListItem | string> }>;
        setSavedLists(parsedLists.map((list) => ({ ...list, items: normalizeGroceryListItems(list.items) })));
      } catch (e) {
        console.error('Failed to load saved lists', e);
      }
    }
  }, []);

  // Save to localStorage whenever savedLists changes
  useEffect(() => {
    localStorage.setItem('savedGroceryLists', JSON.stringify(savedLists));
  }, [savedLists]);

  // Persist the active list so results pages can survive refreshes while
  // the frontend is now fetching live data from the backend API.
  useEffect(() => {
    localStorage.setItem('currentGroceryList', JSON.stringify(currentList));
  }, [currentList]);

  // The resolved search location is persisted so refreshes and cross-page
  // navigation keep the same place context without forcing a new geocode lookup.
  useEffect(() => {
    if (!activeLocation) {
      localStorage.removeItem('activeLocation');
      return;
    }

    localStorage.setItem('activeLocation', JSON.stringify(activeLocation));
  }, [activeLocation]);

  // The user's chosen comparison store should survive page changes so the
  // basket summary and map can stay anchored to the same place.
  useEffect(() => {
    if (!preferredStoreId) {
      localStorage.removeItem('preferredStoreId');
      return;
    }

    localStorage.setItem('preferredStoreId', preferredStoreId);
  }, [preferredStoreId]);

  // Apply dark mode class to document and save to localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const addItem = (item: string) => {
    const trimmed = item.trim();
    if (trimmed) {
      // Multi-add flows should increment quantity for repeats instead of
      // sprinkling duplicate rows through the active working list.
      setCurrentList((prev) => {
        const existingItem = prev.find((entry) => entry.name.toLowerCase() === trimmed.toLowerCase());
        if (!existingItem) {
          return [...prev, { name: trimmed, quantity: 1 }];
        }

        return prev.map((entry) =>
          entry.name.toLowerCase() === trimmed.toLowerCase()
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        );
      });
    }
  };

  const removeItem = (item: string) => {
    setCurrentList(prev => prev.filter((entry) => entry.name !== item));
  };

  const clearList = () => {
    setCurrentList([]);
  };

  const incrementItemQuantity = (item: string) => {
    setCurrentList((prev) =>
      prev.map((entry) => (entry.name === item ? { ...entry, quantity: entry.quantity + 1 } : entry)),
    );
  };

  const decrementItemQuantity = (item: string) => {
    setCurrentList((prev) =>
      prev.flatMap((entry) => {
        if (entry.name !== item) {
          return [entry];
        }

        if (entry.quantity <= 1) {
          return [];
        }

        return [{ ...entry, quantity: entry.quantity - 1 }];
      }),
    );
  };

  const saveList = (name: string, items: GroceryListItem[]) => {
    const newList: SavedGroceryList = {
      id: Date.now().toString(),
      name,
      items: normalizeGroceryListItems(items),
      createdAt: new Date().toISOString(),
    };
    setSavedLists(prev => [newList, ...prev]);
  };

  const deleteList = (id: string) => {
    setSavedLists(prev => prev.filter(list => list.id !== id));
  };

  const loadList = (list: SavedGroceryList) => {
    setCurrentList(normalizeGroceryListItems(list.items));
    // Update lastUsed
    setSavedLists(prev =>
      prev.map(l =>
        l.id === list.id ? { ...l, lastUsed: new Date().toISOString() } : l
      )
    );
  };

  const addItemToSavedList = (listId: string, item: string) => {
    const trimmed = item.trim();
    if (!trimmed) {
      return false;
    }

    let didAdd = false;
    setSavedLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const alreadyExists = list.items.some((savedItem) => savedItem.name.toLowerCase() === trimmed.toLowerCase());
        if (alreadyExists) {
          return list;
        }

        didAdd = true;
        // Saved list edits are intentionally isolated from the active working
        // list so results-page changes never overwrite a saved template silently.
        return { ...list, items: [...list.items, { name: trimmed, quantity: 1 }] };
      }),
    );

    return didAdd;
  };

  const removeItemFromSavedList = (listId: string, item: string) => {
    setSavedLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        return {
          ...list,
          items: list.items.filter((savedItem) => savedItem.name !== item),
        };
      }),
    );
  };

  return (
    <GroceryContext.Provider
      value={{
        currentList,
        addItem,
        removeItem,
        clearList,
        setCurrentList,
        incrementItemQuantity,
        decrementItemQuantity,
        savedLists,
        saveList,
        deleteList,
        loadList,
        addItemToSavedList,
        removeItemFromSavedList,
        activeLocation,
        setActiveLocation,
        preferredStoreId,
        setPreferredStoreId,
        isDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </GroceryContext.Provider>
  );
}

export function useGrocery() {
  const context = useContext(GroceryContext);
  if (context === undefined) {
    throw new Error('useGrocery must be used within a GroceryProvider');
  }
  return context;
}
