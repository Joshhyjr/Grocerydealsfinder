import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, List, ShoppingCart, Check, X, Moon, Sun, LoaderCircle, MapPin } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { BasketResponseData, fetchBasketResults, normalizePostalCode } from '../data/api';

export function MapViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentList, isDarkMode, toggleDarkMode } = useGrocery();
  const postalCode = normalizePostalCode(searchParams.get('postalCode') || 'B3K9Z0');
  const budget = searchParams.get('budget') || '100';

  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [basketData, setBasketData] = useState<BasketResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This page now uses the live backend too. The current backend does not yet
  // expose precise store coordinates, so the page acts as a live store explorer
  // until geographic metadata is added to the API.
  useEffect(() => {
    if (currentList.length === 0) {
      setBasketData(null);
      setIsLoading(false);
      setError('Add at least one grocery item before opening the store explorer.');
      return;
    }

    const controller = new AbortController();

    async function loadBasket() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchBasketResults(currentList, postalCode, controller.signal);
        setBasketData(response);
        setSelectedStore(response.stores[0]?.store ?? null);
      } catch (nextError) {
        if (!(nextError instanceof DOMException && nextError.name === 'AbortError')) {
          setBasketData(null);
          setError(nextError instanceof Error ? nextError.message : 'Failed to load store explorer data.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadBasket();
    return () => controller.abort();
  }, [currentList, postalCode]);

  const selectedStoreData = basketData?.stores.find((store) => store.store === selectedStore) ?? null;

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
              <Button
                onClick={() => navigate(`/results?budget=${budget}&postalCode=${postalCode}`)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <List className="size-4 mr-2" />
                List View
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h2 className="text-2xl mb-2 dark:text-white">Store Explorer</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Live comparison data for {postalCode}</p>
            </div>

            {isLoading && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <LoaderCircle className="size-4 mr-2 animate-spin" />
                Loading stores...
              </div>
            )}

            {!isLoading && error && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-4 text-sm text-gray-600 dark:text-gray-300">{error}</CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {basketData?.stores.map((store) => (
                <Card
                  key={store.store}
                  className={`cursor-pointer transition-all hover:shadow-md dark:bg-gray-800 ${
                    selectedStore === store.store ? 'border-2 border-green-600' : 'dark:border-gray-700'
                  }`}
                  onClick={() => setSelectedStore(store.store)}
                >
                  <CardContent className="p-4">
                    <h3 className="mb-1 dark:text-white">{store.store}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs dark:bg-gray-700 dark:text-gray-300">
                        {store.total_cost_str}
                      </Badge>
                      <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-400">
                        {store.available_count}/{currentList.length} items
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-2xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                    <MapPin className="size-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl mb-2 dark:text-white">Live pricing is connected</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      The frontend is now using the FastAPI backend for real basket totals, item availability, and store ranking.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      The current backend response does not include store latitude/longitude yet, so this page shows a live store explorer instead of exact map markers.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedStoreData && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-2xl dark:text-white">{selectedStoreData.store}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedStoreData.available_count} available, {selectedStoreData.missing_count} missing
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white">{selectedStoreData.total_cost_str}</Badge>
                  </div>

                  <div className="space-y-3">
                    {currentList.map((itemName) => {
                      const match = selectedStoreData.breakdown.find((item) => item.item.toLowerCase() === itemName.toLowerCase());
                      const isAvailable = Boolean(match);

                      return (
                        <div key={`${selectedStoreData.store}-${itemName}`} className="flex items-center justify-between gap-3 border-b dark:border-gray-700 pb-3 last:border-b-0">
                          <div className="flex items-start gap-3">
                            {isAvailable ? (
                              <Check className="size-4 text-green-600 mt-0.5" />
                            ) : (
                              <X className="size-4 text-red-500 mt-0.5" />
                            )}
                            <div>
                              <p className={isAvailable ? 'dark:text-white' : 'text-gray-400 line-through'}>
                                {match?.name || itemName}
                              </p>
                              {match?.unit_price && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{match.unit_price}</p>
                              )}
                            </div>
                          </div>
                          <span className={isAvailable ? 'dark:text-white' : 'text-gray-400'}>
                            {match?.price_str || '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

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
