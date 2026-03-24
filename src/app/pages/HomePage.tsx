import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ShoppingCart, X, Search, BookMarked, DollarSign, List as ListIcon, BarChart3, MapPin as MapPinIcon, Moon, Sun } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { searchGroceryItems } from '../data/groceryData';

export function HomePage() {
  const navigate = useNavigate();
  const { currentList, addItem, removeItem, isDarkMode, toggleDarkMode } = useGrocery();
  const [budget, setBudget] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      const results = searchGroceryItems(value);
      setSuggestions(results.map(item => item.name).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleAddItem = (itemName?: string) => {
    const item = itemName || searchQuery;
    if (item.trim()) {
      addItem(item);
      setSearchQuery('');
      setSuggestions([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (budget && postalCode && currentList.length > 0) {
      navigate(`/results?budget=${budget}&postalCode=${postalCode}`);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-green-600" />
              <span className="text-lg dark:text-white">Grocery Deals Finder</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
                className="dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {isDarkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/saved-lists')}
                className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              >
                Start Saving
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Compare prices. Save money.</p>
            <h1 className="text-5xl mb-6 dark:text-white">
              Smart grocery shopping
              <br />
              <span className="text-green-600">starts here</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
              Enter your budget, postal code, and grocery list — we'll show you which nearby stores have the lowest total basket price.
            </p>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-6"
              onClick={() => {
                if (!budget || !postalCode) {
                  const budgetInput = document.getElementById('budget');
                  budgetInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  budgetInput?.focus();
                }
              }}
            >
              Start Saving →
            </Button>
          </div>

          {/* Input Form Card */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">Budget</label>
                  <Input
                    id="budget"
                    type="number"
                    placeholder="$50.00"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    className="bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">Postal Code</label>
                  <Input
                    type="text"
                    placeholder="M5V 3L9"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    maxLength={10}
                    required
                    className="bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">Your Grocery List</label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Type to add items (e.g., Chicken, Milk, Eggs)..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 bg-white dark:bg-gray-700 dark:text-white"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm dark:text-white"
                          onClick={() => handleAddItem(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {currentList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentList.map((item, index) => (
                      <Badge
                        key={index}
                        className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 px-3 py-1.5"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeItem(item)}
                          className="ml-2 hover:text-green-900 dark:hover:text-green-100"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={!budget || !postalCode || currentList.length === 0}
              >
                Find Deals →
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 dark:bg-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-3 dark:text-white">How It Works</h2>
            <p className="text-gray-600 dark:text-gray-400">Four simple steps to lower your grocery bill every week.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="relative mb-6">
                <div className="size-16 bg-green-50 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                  <DollarSign className="size-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="absolute -top-2 -right-2 left-0 mx-auto w-fit">
                  <span className="size-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                    1
                  </span>
                </div>
              </div>
              <h3 className="mb-2 dark:text-white">Set Your Budget</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your budget and postal code to find stores near you.
              </p>
            </div>

            <div className="text-center">
              <div className="relative mb-6">
                <div className="size-16 bg-green-50 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                  <ListIcon className="size-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="absolute -top-2 -right-2 left-0 mx-auto w-fit">
                  <span className="size-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                    2
                  </span>
                </div>
              </div>
              <h3 className="mb-2 dark:text-white">Build Your List</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add grocery items you need — type or pick from suggestions.
              </p>
            </div>

            <div className="text-center">
              <div className="relative mb-6">
                <div className="size-16 bg-green-50 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                  <BarChart3 className="size-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="absolute -top-2 -right-2 left-0 mx-auto w-fit">
                  <span className="size-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                    3
                  </span>
                </div>
              </div>
              <h3 className="mb-2 dark:text-white">Compare Prices</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                See the full basket cost at each nearby store, side by side.
              </p>
            </div>

            <div className="text-center">
              <div className="relative mb-6">
                <div className="size-16 bg-green-50 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                  <BookMarked className="size-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="absolute -top-2 -right-2 left-0 mx-auto w-fit">
                  <span className="size-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                    4
                  </span>
                </div>
              </div>
              <h3 className="mb-2 dark:text-white">Save & Reuse</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Save your list for next week. One tap to re-compare.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-3 dark:text-white">Features</h2>
            <p className="text-gray-600 dark:text-gray-400">Everything you need to make smarter grocery decisions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="size-12 bg-green-50 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <Search className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="mb-2 dark:text-white">Smart Grocery Search</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Search thousands of items and instantly see availability at nearby stores.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="size-12 bg-green-50 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="mb-2 dark:text-white">Full Basket Pricing</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Compare your entire grocery list cost across stores — not just individual items.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="size-12 bg-green-50 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPinIcon className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="mb-2 dark:text-white">Map View</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See which stores carry your items on an interactive map with distances.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="size-12 bg-green-50 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookMarked className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="mb-2 dark:text-white">Saved Lists</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Save, name, and reuse your grocery lists week after week.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl mb-4 dark:text-white">Ready to stop overpaying for groceries?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            No signup required. Enter your list and start comparing prices in seconds.
          </p>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white px-8"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Get Started Free →
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t dark:border-gray-700 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-4 text-green-600" />
              <span>Grocery Deals Finder</span>
            </div>
            <p>© 2026 Grocery Deals Finder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
