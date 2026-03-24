import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SavedGroceryList } from '../data/groceryData';

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

  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const GroceryContext = createContext<GroceryContextType | undefined>(undefined);

export function GroceryProvider({ children }: { children: ReactNode }) {
  const [currentList, setCurrentList] = useState<string[]>([]);
  const [savedLists, setSavedLists] = useState<SavedGroceryList[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  });

  // Load saved lists from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('savedGroceryLists');
    if (stored) {
      try {
        setSavedLists(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load saved lists', e);
      }
    }
  }, []);

  // Save to localStorage whenever savedLists changes
  useEffect(() => {
    localStorage.setItem('savedGroceryLists', JSON.stringify(savedLists));
  }, [savedLists]);

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
