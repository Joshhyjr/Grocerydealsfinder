import { useEffect, useMemo, useState } from 'react';
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
import { ArrowLeft, ShoppingCart, Check, X, MapPin, Save, Moon, Sun, LoaderCircle, AlertCircle } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { BasketResponseData, BasketStoreResult, fetchBasketResults, normalizePostalCode } from '../data/api';
import { toast } from 'sonner';

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentList, saveList, isDarkMode, toggleDarkMode } = useGrocery();
  const budget = parseFloat(searchParams.get('budget') || '0');
  const postalCode = normalizePostalCode(searchParams.get('postalCode') || 'B3K9Z0');

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [basketData, setBasketData] = useState<BasketResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live basket data comes from the FastAPI backend so the results page reflects
  // the real scrapers instead of the old static inventory snapshot.
  useEffect(() => {
    if (currentList.length === 0) {
      setBasketData(null);
      setIsLoading(false);
      setError('Add at least one grocery item before comparing stores.');
      return;
    }

    const controller = new AbortController();

    async function loadBasket() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchBasketResults(currentList, postalCode, controller.signal);
        setBasketData(response);
      } catch (nextError) {
        if (!(nextError instanceof DOMException && nextError.name === 'AbortError')) {
          setBasketData(null);
          setError(nextError instanceof Error ? nextError.message : 'Failed to load live basket results.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadBasket();
    return () => controller.abort();
  }, [currentList, postalCode]);

  const sortedResults = useMemo(() => basketData?.stores ?? [], [basketData]);

  const handleSaveList = () => {
    if (listName.trim()) {
      saveList(listName, currentList);
      toast.success(`List "${listName}" saved successfully!`);
      setListName('');
      setSaveDialogOpen(false);
    }
  };

  function buildStoreLineItem(store: BasketStoreResult, itemName: string) {
    const matchedItem = store.breakdown.find((entry) => entry.item.toLowerCase() === itemName.toLowerCase());

    if (matchedItem) {
      return {
        available: true,
        displayName: matchedItem.name || itemName,
        price: matchedItem.price,
        priceStr: matchedItem.price_str,
        unitPrice: matchedItem.unit_price,
      };
    }

    return {
      available: false,
      displayName: itemName,
      price: null,
      priceStr: null,
      unitPrice: null,
    };
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
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
                    <DialogDescription>Give your list a name so you can reuse it later.</DialogDescription>
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
                onClick={() => navigate(`/map?budget=${budget}&postalCode=${postalCode}`)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <MapPin className="size-4 mr-2" />
                Store Explorer
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl mb-3 dark:text-white">Live Basket Results</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comparing {currentList.length} items for postal code {postalCode}.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
            <LoaderCircle className="size-5 mr-2 animate-spin" />
            Loading live grocery prices...
          </div>
        )}

        {!isLoading && error && (
          <Card className="max-w-3xl mx-auto p-8 text-center dark:bg-gray-800 dark:border-gray-700">
            <AlertCircle className="size-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl mb-2 dark:text-white">Couldn&apos;t load results</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <Button onClick={() => navigate('/')} className="bg-green-600 hover:bg-green-700 text-white">
              Back To Search
            </Button>
          </Card>
        )}

        {!isLoading && !error && basketData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="p-5 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Stores Compared</p>
                <p className="text-3xl dark:text-white">{basketData.total_stores}</p>
              </Card>
              <Card className="p-5 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Best Basket</p>
                <p className="text-3xl text-green-600">{sortedResults[0]?.total_cost_str ?? '$0.00'}</p>
              </Card>
              <Card className="p-5 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Budget Status</p>
                <p className={`text-3xl ${sortedResults[0] && sortedResults[0].total_cost <= budget ? 'text-green-600' : 'text-amber-500'}`}>
                  {sortedResults[0] && sortedResults[0].total_cost <= budget ? 'Within' : 'Over'}
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sortedResults.map((storeResult, index) => {
                const isBestPrice = index === 0;
                const extraCost = storeResult.total_cost - (sortedResults[0]?.total_cost ?? storeResult.total_cost);

                return (
                  <Card
                    key={storeResult.store}
                    className={`p-6 dark:bg-gray-800 ${isBestPrice ? 'border-2 border-green-600' : 'border dark:border-gray-700'}`}
                  >
                    <div className="mb-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-xl dark:text-white">{storeResult.store}</h3>
                        {isBestPrice && <Badge className="bg-green-600 text-white">Best Price</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {storeResult.available_count} of {currentList.length} items available
                      </p>
                    </div>

                    <div className="space-y-3 mb-6">
                      {currentList.map((itemName) => {
                        const item = buildStoreLineItem(storeResult, itemName);
                        return (
                          <div key={`${storeResult.store}-${itemName}`} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-start gap-2">
                              {item.available ? (
                                <Check className="size-4 text-green-600 mt-0.5" />
                              ) : (
                                <X className="size-4 text-red-500 mt-0.5" />
                              )}
                              <div>
                                <span className={item.available ? 'dark:text-gray-300' : 'line-through text-gray-400'}>
                                  {item.displayName}
                                </span>
                                {item.available && item.unitPrice && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.unitPrice}</p>
                                )}
                              </div>
                            </div>
                            <span className={item.available ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                              {item.available ? item.priceStr || '—' : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-4 border-t dark:border-gray-700">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</p>
                          <p className="text-2xl dark:text-white">{storeResult.total_cost_str}</p>
                        </div>
                        {!isBestPrice && extraCost > 0 && (
                          <div className="text-right">
                            <p className="text-sm text-amber-600">+${extraCost.toFixed(2)} vs best</p>
                          </div>
                        )}
                      </div>

                      {storeResult.total_cost > budget && (
                        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300">
                          Over budget by ${(storeResult.total_cost - budget).toFixed(2)}
                        </div>
                      )}

                      {storeResult.missing_items.length > 0 && (
                        <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
                          Missing: {storeResult.missing_items.join(', ')}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </section>

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
