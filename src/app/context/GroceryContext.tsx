import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SavedGroceryList } from '../data/groceryData';
import { readStoredItems, readStoredSavedLists } from '../data/persistence';

interface GroceryContextType {
  currentList: string[];
  addItem: (item: string) => void;
  removeItem: (item: string) => void;
  clearList: () => void;
  setCurrentList: (items: string[]) => void;

  savedLists: SavedGroceryList[];
  saveList: (name: string, items: string[]) => void;
  deleteList: (id: string) => void;
  loadList: (list: SavedGroceryList) => void;
  addItemToSavedList: (listId: string, item: string) => boolean;
  removeItemFromSavedList: (listId: string, item: string) => void;

  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const GroceryContext = createContext<GroceryContextType | undefined>(undefined);

export function GroceryProvider({ children }: { children: ReactNode }) {
  // Migrate browser data before the first render so React never receives legacy
  // item objects as children.
  const [currentList, setCurrentList] = useState<string[]>(() =>
    readStoredItems('currentGroceryList')
  );
  const [savedLists, setSavedLists] = useState<SavedGroceryList[]>(() =>
    readStoredSavedLists('savedGroceryLists')
  );
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

  // Persisting immediately also upgrades legacy browser data to the canonical
  // string-only shape after the first successful render.
  useEffect(() => {
    localStorage.setItem('savedGroceryLists', JSON.stringify(savedLists));
  }, [savedLists]);

  // Persist the active list so results pages can survive refreshes while
  // the frontend is now fetching live data from the backend API.
  useEffect(() => {
    localStorage.setItem('currentGroceryList', JSON.stringify(currentList));
  }, [currentList]);

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
    if (trimmed && !currentList.includes(trimmed)) {
      setCurrentList(prev => [...prev, trimmed]);
    }
  };

  const removeItem = (item: string) => {
    setCurrentList(prev => prev.filter(i => i !== item));
  };

  const clearList = () => {
    setCurrentList([]);
  };

  const saveList = (name: string, items: string[]) => {
    const newList: SavedGroceryList = {
      id: Date.now().toString(),
      name,
      items,
      createdAt: new Date().toISOString(),
    };
    setSavedLists(prev => [newList, ...prev]);
  };

  const deleteList = (id: string) => {
    setSavedLists(prev => prev.filter(list => list.id !== id));
  };

  const loadList = (list: SavedGroceryList) => {
    setCurrentList([...list.items]);
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

        const alreadyExists = list.items.some((savedItem) => savedItem.toLowerCase() === trimmed.toLowerCase());
        if (alreadyExists) {
          return list;
        }

        didAdd = true;
        // Saved list edits are intentionally isolated from the active working
        // list so results-page changes never overwrite a saved template silently.
        return { ...list, items: [...list.items, trimmed] };
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
          items: list.items.filter((savedItem) => savedItem !== item),
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
        savedLists,
        saveList,
        deleteList,
        loadList,
        addItemToSavedList,
        removeItemFromSavedList,
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
