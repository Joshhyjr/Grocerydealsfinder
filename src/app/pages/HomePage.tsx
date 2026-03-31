import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { ShoppingCart, X, Search, BookMarked, DollarSign, List as ListIcon, BarChart3, MapPin as MapPinIcon, Moon, Sun, Plus, Minus } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { useLocationInput } from '../hooks/useLocationInput';
import { buildLocationSearchParams } from '../data/location';
import { toast } from 'sonner';

export function HomePage() {
  const navigate = useNavigate();
  const {
    currentList,
    addItem,
    removeItem,
    incrementItemQuantity,
    decrementItemQuantity,
    activeLocation,
    setActiveLocation,
    isDarkMode,
    toggleDarkMode,
  } = useGrocery();
  const [budget, setBudget] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    locationInput,
    setLocationInput,
    isResolvingLocation,
    resolveLocation,
    useCurrentLocation,
  } = useLocationInput(activeLocation?.input ?? '');

  const handleAddItems = () => {
    const nextItems = parseMultiItemInput(searchQuery);
    if (nextItems.length === 0) {
      return;
    }

    nextItems.forEach((item) => addItem(item));
    setSearchQuery('');
    toast.success(`${nextItems.length} ${nextItems.length === 1 ? 'item' : 'items'} added to your list`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!budget || !locationInput || currentList.length === 0) {
      return;
    }

    try {
      const location = await resolveLocation();
      setActiveLocation(location);
      navigate(`/results?${buildLocationSearchParams(budget, location).toString()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to resolve that location right now.');
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const location = await useCurrentLocation();
      setActiveLocation(location);
      toast.success('Using your current location.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to use your current location right now.');
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
              Enter your budget, address or postal code, and grocery list. We&apos;ll show you which nearby stores have the lowest total basket price.
            </p>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-6"
              onClick={() => {
                if (!budget || !locationInput) {
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
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">Address or Postal Code</label>
                  <Input
                    id="location"
                    type="text"
                    placeholder="123 Main St Halifax or B3H 2Y7"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    required
                    className="bg-white dark:bg-gray-700 dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseCurrentLocation}
                    disabled={isResolvingLocation}
                    className="mt-3 w-full border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
                  >
                    <MapPinIcon className="size-4" />
                    {isResolvingLocation ? 'Finding your location...' : 'Use My Location'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">Your Grocery List</label>
                <div className="mb-3 space-y-3">
                  <Textarea
                    placeholder={'Add one or many items at once.\nExample:\nMilk\nEggs\nBananas, Chicken Breast'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-h-28 bg-white dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Separate items with commas or new lines. Re-adding the same item increases its quantity.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddItems}
                    disabled={parseMultiItemInput(searchQuery).length === 0}
                  >
                    Add Items
                  </Button>
                </div>

                {currentList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentList.map((item) => (
                      <Badge
                        key={item.name}
                        className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 px-3 py-1.5"
                      >
                        <span>{item.name}</span>
                        <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs dark:bg-gray-900/60">
                          x{item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => decrementItemQuantity(item.name)}
                          className="ml-2 hover:text-green-900 dark:hover:text-green-100"
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          <Minus className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => incrementItemQuantity(item.name)}
                          className="ml-1 hover:text-green-900 dark:hover:text-green-100"
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.name)}
                          className="ml-2 hover:text-green-900 dark:hover:text-green-100"
                          aria-label={`Remove ${item.name} from your list`}
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
                disabled={!budget || !locationInput || currentList.length === 0 || isResolvingLocation}
              >
                {isResolvingLocation ? 'Resolving location...' : 'Find Deals →'}
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
                Enter your budget and address or postal code to find stores near you.
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
                Paste or type multiple items at once, then fine-tune quantities before you compare.
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

function parseMultiItemInput(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
