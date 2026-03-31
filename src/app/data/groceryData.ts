export interface GroceryListItem {
  name: string;
  quantity: number;
}

export interface GroceryItem {
  id: string;
  name: string;
  category: 'produce' | 'dairy' | 'meat' | 'bakery' | 'pantry' | 'frozen';
  commonNames: string[]; // For search matching
}

export interface StoreInventory {
  itemId: string;
  regularPrice: number;
  salePrice?: number;
  discount?: number;
  inStock: boolean;
  unit: string; // e.g., "lb", "gallon", "dozen", "each"
}

export interface Store {
  id: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  postalCodes: string[];
  inventory: StoreInventory[];
}

export interface SavedGroceryList {
  id: string;
  name: string;
  items: GroceryListItem[];
  createdAt: string;
  lastUsed?: string;
}

export function normalizeGroceryListItems(items: Array<GroceryListItem | string>): GroceryListItem[] {
  const mergedItems = new Map<string, GroceryListItem>();

  items.forEach((item) => {
    const normalizedItem = typeof item === 'string'
      ? { name: item.trim(), quantity: 1 }
      : { name: item.name.trim(), quantity: Math.max(1, Math.floor(item.quantity || 1)) };

    if (!normalizedItem.name) {
      return;
    }

    const itemKey = normalizedItem.name.toLowerCase();
    const existingItem = mergedItems.get(itemKey);

    if (existingItem) {
      existingItem.quantity += normalizedItem.quantity;
      return;
    }

    mergedItems.set(itemKey, { ...normalizedItem });
  });

  return Array.from(mergedItems.values());
}

// All available grocery items
export const groceryItems: GroceryItem[] = [
  { id: '1', name: 'Bananas', category: 'produce', commonNames: ['banana', 'bananas'] },
  { id: '2', name: 'Chicken Breast', category: 'meat', commonNames: ['chicken', 'chicken breast', 'poultry'] },
  { id: '3', name: 'Rice', category: 'pantry', commonNames: ['rice', 'white rice', 'basmati'] },
  { id: '4', name: 'Eggs', category: 'dairy', commonNames: ['egg', 'eggs', 'dozen eggs'] },
  { id: '5', name: 'Milk', category: 'dairy', commonNames: ['milk', 'whole milk', '2% milk'] },
  { id: '6', name: 'Bread', category: 'bakery', commonNames: ['bread', 'white bread', 'wheat bread', 'loaf'] },
  { id: '7', name: 'Apples', category: 'produce', commonNames: ['apple', 'apples', 'red apple', 'green apple'] },
  { id: '8', name: 'Tomatoes', category: 'produce', commonNames: ['tomato', 'tomatoes', 'cherry tomatoes'] },
  { id: '9', name: 'Ground Beef', category: 'meat', commonNames: ['ground beef', 'beef', 'hamburger meat'] },
  { id: '10', name: 'Salmon', category: 'meat', commonNames: ['salmon', 'fish', 'salmon fillet'] },
  { id: '11', name: 'Yogurt', category: 'dairy', commonNames: ['yogurt', 'greek yogurt', 'yoghurt'] },
  { id: '12', name: 'Cheese', category: 'dairy', commonNames: ['cheese', 'cheddar', 'cheddar cheese'] },
  { id: '13', name: 'Pasta', category: 'pantry', commonNames: ['pasta', 'spaghetti', 'noodles'] },
  { id: '14', name: 'Carrots', category: 'produce', commonNames: ['carrot', 'carrots', 'baby carrots'] },
  { id: '15', name: 'Potatoes', category: 'produce', commonNames: ['potato', 'potatoes', 'russet potatoes'] },
  { id: '16', name: 'Onions', category: 'produce', commonNames: ['onion', 'onions', 'yellow onion'] },
  { id: '17', name: 'Lettuce', category: 'produce', commonNames: ['lettuce', 'romaine', 'iceberg lettuce'] },
  { id: '18', name: 'Butter', category: 'dairy', commonNames: ['butter', 'salted butter', 'unsalted butter'] },
  { id: '19', name: 'Orange Juice', category: 'dairy', commonNames: ['orange juice', 'oj', 'juice'] },
  { id: '20', name: 'Cereal', category: 'pantry', commonNames: ['cereal', 'breakfast cereal', 'cornflakes'] },
  { id: '21', name: 'Frozen Pizza', category: 'frozen', commonNames: ['pizza', 'frozen pizza'] },
  { id: '22', name: 'Frozen Vegetables', category: 'frozen', commonNames: ['frozen vegetables', 'frozen veggies', 'mixed vegetables'] },
  { id: '23', name: 'Ice Cream', category: 'frozen', commonNames: ['ice cream', 'icecream', 'frozen dessert'] },
  { id: '24', name: 'Strawberries', category: 'produce', commonNames: ['strawberry', 'strawberries', 'fresh strawberries'] },
  { id: '25', name: 'Broccoli', category: 'produce', commonNames: ['broccoli', 'fresh broccoli'] },
];

// Stores with their inventory
export const stores: Store[] = [
  {
    id: '1',
    name: 'FreshMart Downtown',
    address: '123 Main St',
    coordinates: { lat: 40.7128, lng: -74.0060 },
    postalCodes: ['10001', '10002'],
    inventory: [
      { itemId: '1', regularPrice: 0.69, salePrice: 0.49, discount: 29, inStock: true, unit: 'lb' },
      { itemId: '2', regularPrice: 8.99, salePrice: 6.99, discount: 22, inStock: true, unit: 'lb' },
      { itemId: '3', regularPrice: 12.99, inStock: true, unit: '5 lb bag' },
      { itemId: '4', regularPrice: 4.99, salePrice: 3.99, discount: 20, inStock: true, unit: 'dozen' },
      { itemId: '5', regularPrice: 4.49, inStock: true, unit: 'gallon' },
      { itemId: '6', regularPrice: 3.49, salePrice: 2.49, discount: 29, inStock: true, unit: 'loaf' },
      { itemId: '7', regularPrice: 1.99, inStock: true, unit: 'lb' },
      { itemId: '8', regularPrice: 2.99, salePrice: 1.99, discount: 33, inStock: true, unit: 'lb' },
      { itemId: '10', regularPrice: 14.99, salePrice: 11.99, discount: 20, inStock: true, unit: 'lb' },
      { itemId: '11', regularPrice: 5.99, inStock: true, unit: '32 oz' },
      { itemId: '12', regularPrice: 6.99, salePrice: 5.49, discount: 21, inStock: true, unit: '8 oz' },
      { itemId: '14', regularPrice: 1.49, inStock: true, unit: 'lb' },
      { itemId: '16', regularPrice: 1.29, inStock: true, unit: 'lb' },
      { itemId: '17', regularPrice: 2.49, inStock: true, unit: 'head' },
      { itemId: '18', regularPrice: 5.49, inStock: true, unit: '16 oz' },
      { itemId: '24', regularPrice: 4.99, salePrice: 3.49, discount: 30, inStock: true, unit: '16 oz' },
    ]
  },
  {
    id: '2',
    name: 'SaveMore Supermarket',
    address: '456 Oak Ave',
    coordinates: { lat: 40.7280, lng: -73.9950 },
    postalCodes: ['10002', '10003'],
    inventory: [
      { itemId: '1', regularPrice: 0.79, salePrice: 0.59, discount: 25, inStock: true, unit: 'lb' },
      { itemId: '2', regularPrice: 7.99, inStock: true, unit: 'lb' },
      { itemId: '3', regularPrice: 11.99, salePrice: 9.99, discount: 17, inStock: true, unit: '5 lb bag' },
      { itemId: '4', regularPrice: 5.49, salePrice: 4.49, discount: 18, inStock: true, unit: 'dozen' },
      { itemId: '5', regularPrice: 3.99, salePrice: 2.99, discount: 25, inStock: true, unit: 'gallon' },
      { itemId: '6', regularPrice: 2.99, inStock: true, unit: 'loaf' },
      { itemId: '7', regularPrice: 1.79, salePrice: 1.49, discount: 17, inStock: true, unit: 'lb' },
      { itemId: '9', regularPrice: 6.99, salePrice: 4.99, discount: 29, inStock: true, unit: 'lb' },
      { itemId: '11', regularPrice: 4.99, salePrice: 3.99, discount: 20, inStock: true, unit: '32 oz' },
      { itemId: '12', regularPrice: 6.49, inStock: true, unit: '8 oz' },
      { itemId: '13', regularPrice: 2.49, salePrice: 1.99, discount: 20, inStock: true, unit: '16 oz' },
      { itemId: '15', regularPrice: 4.99, inStock: true, unit: '5 lb bag' },
      { itemId: '16', regularPrice: 1.49, inStock: true, unit: 'lb' },
      { itemId: '18', regularPrice: 4.99, salePrice: 3.99, discount: 20, inStock: true, unit: '16 oz' },
      { itemId: '19', regularPrice: 5.99, inStock: true, unit: '64 oz' },
      { itemId: '20', regularPrice: 4.99, salePrice: 3.49, discount: 30, inStock: true, unit: 'box' },
    ]
  },
  {
    id: '3',
    name: 'Budget Grocery',
    address: '789 Elm St',
    coordinates: { lat: 40.7050, lng: -74.0150 },
    postalCodes: ['10001'],
    inventory: [
      { itemId: '1', regularPrice: 0.59, inStock: true, unit: 'lb' },
      { itemId: '2', regularPrice: 9.99, salePrice: 7.49, discount: 25, inStock: true, unit: 'lb' },
      { itemId: '3', regularPrice: 10.99, inStock: true, unit: '5 lb bag' },
      { itemId: '4', regularPrice: 4.49, inStock: true, unit: 'dozen' },
      { itemId: '5', regularPrice: 4.99, salePrice: 3.49, discount: 30, inStock: true, unit: 'gallon' },
      { itemId: '6', regularPrice: 2.49, inStock: true, unit: 'loaf' },
      { itemId: '7', regularPrice: 1.69, inStock: true, unit: 'lb' },
      { itemId: '9', regularPrice: 7.49, salePrice: 5.99, discount: 20, inStock: true, unit: 'lb' },
      { itemId: '13', regularPrice: 1.99, inStock: true, unit: '16 oz' },
      { itemId: '14', regularPrice: 1.29, salePrice: 0.99, discount: 23, inStock: true, unit: 'lb' },
      { itemId: '15', regularPrice: 3.99, salePrice: 2.99, discount: 25, inStock: true, unit: '5 lb bag' },
      { itemId: '21', regularPrice: 6.99, salePrice: 4.99, discount: 29, inStock: true, unit: 'each' },
      { itemId: '22', regularPrice: 2.99, salePrice: 1.99, discount: 33, inStock: true, unit: '16 oz' },
      { itemId: '23', regularPrice: 5.99, inStock: true, unit: '48 oz' },
    ]
  },
  {
    id: '4',
    name: 'Green Valley Market',
    address: '321 Pine Rd',
    coordinates: { lat: 40.7350, lng: -73.9800 },
    postalCodes: ['10003', '10004'],
    inventory: [
      { itemId: '1', regularPrice: 0.89, salePrice: 0.69, discount: 22, inStock: true, unit: 'lb' },
      { itemId: '2', regularPrice: 8.49, inStock: true, unit: 'lb' },
      { itemId: '4', regularPrice: 6.49, salePrice: 5.49, discount: 15, inStock: true, unit: 'dozen' },
      { itemId: '5', regularPrice: 5.49, inStock: true, unit: 'gallon' },
      { itemId: '6', regularPrice: 4.49, salePrice: 3.49, discount: 22, inStock: true, unit: 'loaf' },
      { itemId: '7', regularPrice: 2.29, salePrice: 1.79, discount: 22, inStock: true, unit: 'lb' },
      { itemId: '8', regularPrice: 3.49, salePrice: 2.49, discount: 29, inStock: true, unit: 'lb' },
      { itemId: '10', regularPrice: 15.99, inStock: true, unit: 'lb' },
      { itemId: '11', regularPrice: 6.99, salePrice: 5.49, discount: 21, inStock: true, unit: '32 oz' },
      { itemId: '14', regularPrice: 1.79, inStock: true, unit: 'lb' },
      { itemId: '17', regularPrice: 2.99, salePrice: 2.29, discount: 23, inStock: true, unit: 'head' },
      { itemId: '24', regularPrice: 5.49, salePrice: 3.99, discount: 27, inStock: true, unit: '16 oz' },
      { itemId: '25', regularPrice: 2.49, inStock: true, unit: 'lb' },
    ]
  },
  {
    id: '5',
    name: 'City Foods',
    address: '654 Maple Dr',
    coordinates: { lat: 40.7200, lng: -74.0100 },
    postalCodes: ['10002'],
    inventory: [
      { itemId: '1', regularPrice: 0.69, inStock: true, unit: 'lb' },
      { itemId: '2', regularPrice: 8.99, salePrice: 6.49, discount: 28, inStock: true, unit: 'lb' },
      { itemId: '3', regularPrice: 13.99, salePrice: 11.99, discount: 14, inStock: true, unit: '5 lb bag' },
      { itemId: '4', regularPrice: 5.99, inStock: true, unit: 'dozen' },
      { itemId: '5', regularPrice: 4.49, salePrice: 3.49, discount: 22, inStock: true, unit: 'gallon' },
      { itemId: '6', regularPrice: 3.99, inStock: true, unit: 'loaf' },
      { itemId: '9', regularPrice: 7.99, inStock: true, unit: 'lb' },
      { itemId: '11', regularPrice: 5.49, inStock: true, unit: '32 oz' },
      { itemId: '12', regularPrice: 7.49, salePrice: 5.99, discount: 20, inStock: true, unit: '8 oz' },
      { itemId: '13', regularPrice: 2.99, salePrice: 2.29, discount: 23, inStock: true, unit: '16 oz' },
      { itemId: '15', regularPrice: 5.49, inStock: true, unit: '5 lb bag' },
      { itemId: '19', regularPrice: 6.49, salePrice: 4.99, discount: 23, inStock: true, unit: '64 oz' },
      { itemId: '20', regularPrice: 5.49, inStock: true, unit: 'box' },
      { itemId: '22', regularPrice: 3.49, inStock: true, unit: '16 oz' },
    ]
  },
];

// Helper function to get grocery item by id
export function getGroceryItemById(id: string): GroceryItem | undefined {
  return groceryItems.find(item => item.id === id);
}

// Helper function to search grocery items
export function searchGroceryItems(query: string): GroceryItem[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  
  return groceryItems.filter(item =>
    item.commonNames.some(name => name.includes(lowerQuery)) ||
    item.name.toLowerCase().includes(lowerQuery)
  );
}

// Helper function to get stores by postal code
export function getStoresByPostalCode(postalCode: string): Store[] {
  return stores.filter(store => store.postalCodes.includes(postalCode));
}

// Helper function to calculate basket total at a store
export function calculateBasketTotal(store: Store, itemNames: string[]): {
  items: Array<{ name: string; price: number; onSale: boolean; unit: string; available: boolean }>;
  total: number;
  regularTotal: number;
  savings: number;
  availableCount: number;
  missingItems: string[];
} {
  const items: Array<{ name: string; price: number; onSale: boolean; unit: string; available: boolean }> = [];
  let total = 0;
  let regularTotal = 0;
  let availableCount = 0;
  const missingItems: string[] = [];

  itemNames.forEach(itemName => {
    const groceryItem = groceryItems.find(gi =>
      gi.name.toLowerCase() === itemName.toLowerCase() ||
      gi.commonNames.some(cn => cn.toLowerCase() === itemName.toLowerCase())
    );

    if (!groceryItem) {
      items.push({ name: itemName, price: 0, onSale: false, unit: '', available: false });
      missingItems.push(itemName);
      return;
    }

    const inventoryItem = store.inventory.find(inv => inv.itemId === groceryItem.id);

    if (!inventoryItem || !inventoryItem.inStock) {
      items.push({ name: groceryItem.name, price: 0, onSale: false, unit: '', available: false });
      missingItems.push(groceryItem.name);
      return;
    }

    const price = inventoryItem.salePrice || inventoryItem.regularPrice;
    items.push({
      name: groceryItem.name,
      price,
      onSale: !!inventoryItem.salePrice,
      unit: inventoryItem.unit,
      available: true
    });

    total += price;
    regularTotal += inventoryItem.regularPrice;
    availableCount++;
  });

  return {
    items,
    total,
    regularTotal,
    savings: regularTotal - total,
    availableCount,
    missingItems
  };
}
