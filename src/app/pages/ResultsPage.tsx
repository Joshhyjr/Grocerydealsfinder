import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import { ArrowLeft, ShoppingCart, Check, X, MapPin, Save, Moon, Sun } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { getStoresByPostalCode, calculateBasketTotal } from '../data/groceryData';
import { toast } from 'sonner';

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentList, saveList, isDarkMode, toggleDarkMode } = useGrocery();
  const budget = parseFloat(searchParams.get('budget') || '0');
  const postalCode = searchParams.get('postalCode') || '';

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [listName, setListName] = useState('');

  const storesInArea = getStoresByPostalCode(postalCode);

  // Calculate basket for each store
  const storeResults = useMemo(() => {
    return storesInArea.map(store => {
      const basket = calculateBasketTotal(store, currentList);
      return {
        store,
        basket,
        hasAllItems: basket.availableCount === currentList.length,
        matchPercentage: Math.round((basket.availableCount / currentList.length) * 100),
      };
    });
  }, [storesInArea, currentList]);

  // Sort by total price (cheapest first)
  const sortedResults = useMemo(() => {
    return [...storeResults].sort((a, b) => a.basket.total - b.basket.total);
  }, [storeResults]);

  const handleSaveList = () => {
    if (listName.trim()) {
      saveList(listName, currentList);
      toast.success(`List "${listName}" saved successfully!`);
      setListName('');
      setSaveDialogOpen(false);
    }
  };

  // Calculate distance (mock - in real app would use geolocation)
  const getDistance = (index: number) => {
    const distances = [1.2, 2.4, 0.8, 3.1, 1.8];
    return distances[index % distances.length];
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="dark:text-gray-300 dark:hover:bg-gray-800">
                <ArrowLeft className="size-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-green-600" />
                <span className="text-lg dark:text-white">Grocery Deals Finder</span>
              </div>
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
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950">
                    <Save className="size-4 mr-2" />
                    Save List
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Shopping List</DialogTitle>
                    <DialogDescription>
                      Give your list a name so you can reuse it later
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm">List Name</label>
                      <Input
                        placeholder="e.g., Weekly Shopping"
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveList} 
                      disabled={!listName.trim()}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Save List
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button 
                onClick={() => navigate(`/map?postalCode=${postalCode}`)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <MapPin className="size-4 mr-2" />
                Map View
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl mb-3 dark:text-white">See Results at a Glance</h1>
          <p className="text-gray-600 dark:text-gray-400">Compare stores side by side. Spot savings instantly.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sortedResults.map((result, index) => {
            const isBestPrice = index === 0;
            const distance = getDistance(index);

            return (
              <Card
                key={result.store.id}
                className={`p-6 dark:bg-gray-800 ${
                  isBestPrice ? 'border-2 border-green-600' : 'border dark:border-gray-700'
                }`}
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl dark:text-white">{result.store.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="size-3" />
                      {distance} km
                    </div>
                  </div>
                  {isBestPrice && (
                    <Badge className="bg-green-600 text-white">Best Price</Badge>
                  )}
                </div>

                <div className="space-y-2 mb-6">
                  {result.basket.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {item.available ? (
                          <Check className="size-4 text-green-600" />
                        ) : (
                          <X className="size-4 text-red-500" />
                        )}
                        <span className={item.available ? 'dark:text-gray-300' : 'line-through text-gray-400'}>
                          {item.name}
                        </span>
                      </div>
                      <span className={item.available ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                        {item.available ? `$${item.price.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t dark:border-gray-700">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</p>
                      <p className="text-2xl dark:text-white">${result.basket.total.toFixed(2)}</p>
                    </div>
                    {result.basket.savings > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-green-600">Save ${result.basket.savings.toFixed(2)}</p>
                      </div>
                    )}
                  </div>

                  {result.basket.total > budget && (
                    <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300">
                      ⚠️ Over budget by ${(result.basket.total - budget).toFixed(2)}
                    </div>
                  )}

                  {!result.hasAllItems && (
                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                      {result.basket.availableCount} of {currentList.length} items available
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {sortedResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No stores found in postal code {postalCode}</p>
            <Button variant="outline" onClick={() => navigate('/')} className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Try Different Postal Code
            </Button>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t dark:border-gray-700 py-6 mt-12">
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
