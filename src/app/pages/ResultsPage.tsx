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
import { ArrowLeft, ShoppingCart, Check, X, MapPin, Save, Moon, Sun, LoaderCircle, AlertCircle, Navigation } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { applyListQuantitiesToBasketData, BasketResponseData, BasketStoreResult, fetchBasketResults } from '../data/api';
import { buildLocationSearchParams, getLocationDisplayName, readLocationFromSearchParams } from '../data/location';
import { toast } from 'sonner';

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    currentList,
    removeItem,
    incrementItemQuantity,
    decrementItemQuantity,
    saveList,
    activeLocation,
    setActiveLocation,
    preferredStoreId,
    setPreferredStoreId,
    isDarkMode,
    toggleDarkMode,
  } = useGrocery();
  const budget = parseFloat(searchParams.get('budget') || '0');
  const requestedStoreId = searchParams.get('store');
  const routeLocation = useMemo(() => readLocationFromSearchParams(searchParams), [searchParams]);
  const location = routeLocation ?? activeLocation;

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [basketData, setBasketData] = useState<BasketResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (routeLocation) {
      // Search params remain the durable source of truth for refreshes while
      // context makes the same resolved place available across nearby screens.
      setActiveLocation(routeLocation);
    }
  }, [routeLocation, setActiveLocation]);

  // Live basket data comes from the FastAPI backend so the results page reflects
  // the real scrapers instead of the old static inventory snapshot.
  useEffect(() => {
    if (currentList.length === 0) {
      setBasketData(null);
      setIsLoading(false);
      setError('Add at least one grocery item before comparing stores.');
      return;
    }

    if (!location) {
      setBasketData(null);
      setIsLoading(false);
      setError('Choose an address, postal code, or current location before comparing stores.');
      return;
    }

    const controller = new AbortController();

    async function loadBasket() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchBasketResults(
          currentList.map((item) => item.name),
          location,
          controller.signal,
        );
        setBasketData(applyListQuantitiesToBasketData(response, currentList));
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
  }, [currentList, location]);

  const sortedResults = useMemo(() => basketData?.stores ?? [], [basketData]);
  const visibleResults = useMemo(() => {
    // Keep the best deal visible even when it falls outside the preferred
    // drive window so the user can still see if a longer trip is worth it.
    return sortedResults.filter((storeResult) => storeResult.is_best_price || storeResult.is_within_drive_window);
  }, [sortedResults]);
  const cheapestStore = useMemo(() => {
    return visibleResults.reduce<BasketStoreResult | null>((bestStore, storeResult) => {
      if (!bestStore || storeResult.total_cost < bestStore.total_cost) {
        return storeResult;
      }
      return bestStore;
    }, null);
  }, [visibleResults]);
  const nearestStore = visibleResults[0] ?? null;
  const activeStore = useMemo(() => {
    return (
      visibleResults.find((storeResult) => (storeResult.store_id ?? storeResult.store) === preferredStoreId) ??
      visibleResults.find((storeResult) => (storeResult.store_id ?? storeResult.store) === requestedStoreId) ??
      cheapestStore ??
      nearestStore
    );
  }, [cheapestStore, nearestStore, preferredStoreId, requestedStoreId, visibleResults]);

  useEffect(() => {
    if (requestedStoreId) {
      const matchingStore = visibleResults.find((storeResult) => (storeResult.store_id ?? storeResult.store) === requestedStoreId);
      if (matchingStore) {
        setPreferredStoreId(requestedStoreId);
        return;
      }
    }

    if (preferredStoreId) {
      const preferredStoreStillVisible = visibleResults.some(
        (storeResult) => (storeResult.store_id ?? storeResult.store) === preferredStoreId,
      );

      if (!preferredStoreStillVisible) {
        setPreferredStoreId(null);
      }
    }
  }, [preferredStoreId, requestedStoreId, setPreferredStoreId, visibleResults]);

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

  const handleRemoveActiveItem = (itemName: string) => {
    // Results-page list edits are intentionally scoped to the active comparison.
    // Saved lists only change when the user explicitly saves again.
    removeItem(itemName);
    toast.success(`Removed "${itemName}" from this comparison`);
  };

  const handleSetPreferredStore = (storeId: string, storeName: string) => {
    setPreferredStoreId(storeId);
    toast.success(`${storeName} is now your store`);
  };

  const openStoreExplorer = () => {
    if (!location) {
      return;
    }

    const params = buildLocationSearchParams(budget, location);
    const storeId = activeStore?.store_id ?? activeStore?.store;
    if (storeId) {
      params.set('store', storeId);
    }

    navigate(`/map?${params.toString()}`);
  };

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
                onClick={openStoreExplorer}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!location}
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
            Comparing {currentList.length} items for {getLocationDisplayName(location)}.
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Your Store</p>
                <p className="text-2xl dark:text-white">{activeStore?.store ?? 'Unavailable'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {activeStore?.distance_km != null
                    ? `${activeStore.distance_km.toFixed(1)} km away`
                    : activeStore?.address ?? 'Distance unavailable'}
                </p>
              </Card>
              <Card className="p-5 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Basket At Your Store</p>
                <p className="text-3xl text-green-600">{activeStore?.total_cost_str ?? '$0.00'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {activeStore?.store ?? 'No stores available'}
                </p>
              </Card>
              <Card className="p-5 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Best Deal Nearby</p>
                <p className="text-3xl text-green-600">{cheapestStore?.total_cost_str ?? '$0.00'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {cheapestStore?.store ?? 'No stores available'}
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <Card className="p-5 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Budget Status</p>
                <p className={`text-3xl ${activeStore && activeStore.total_cost <= budget ? 'text-green-600' : 'text-amber-500'}`}>
                  {activeStore && activeStore.total_cost <= budget ? 'Within' : 'Over'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {activeStore ? `${activeStore.total_cost_str} at ${activeStore.store}` : `${visibleResults.length} stores shown`}
                </p>
              </Card>
              <Card className="p-5 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Closest Option</p>
                <p className="text-2xl dark:text-white">{nearestStore?.store ?? 'Unavailable'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {nearestStore?.distance_km != null
                    ? `${nearestStore.distance_km.toFixed(1)} km away`
                    : nearestStore?.address ?? 'Distance unavailable'}
                </p>
              </Card>
            </div>

            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Showing stores close to {getLocationDisplayName(location)}, plus the best overall deal if it is farther away.
            </p>

            <Card className="p-5 mb-8 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl dark:text-white">Active Shopping List</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Remove items here to rerun the live basket without touching your saved templates.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => incrementItemQuantity(item.name)}
                      className="ml-2 hover:text-green-900 dark:hover:text-green-100"
                      aria-label={`Increase ${item.name} quantity`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveActiveItem(item.name)}
                      className="ml-2 hover:text-green-900 dark:hover:text-green-100"
                      aria-label={`Remove ${item.name} from active shopping list`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {visibleResults.map((storeResult) => {
                const extraCost = storeResult.total_cost - (cheapestStore?.total_cost ?? storeResult.total_cost);
                const storeId = storeResult.store_id ?? storeResult.store;
                const isPreferredStore = storeId === (activeStore?.store_id ?? activeStore?.store);

                return (
                  <Card
                    key={storeId}
                    className={`p-6 dark:bg-gray-800 ${
                      isPreferredStore ? 'border-2 border-green-600 shadow-sm shadow-green-600/20' : 'border dark:border-gray-700'
                    }`}
                  >
                    <div className="mb-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-xl dark:text-white">{storeResult.store}</h3>
                          {storeResult.source && (
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                              Source: {formatSourceLabel(storeResult.source)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {isPreferredStore && <Badge className="bg-emerald-600 text-white">Your Store</Badge>}
                          {storeResult.is_nearest && <Badge className="bg-green-600 text-white">Nearest</Badge>}
                          {storeResult.is_best_price && <Badge variant="secondary">Best Price</Badge>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {storeResult.available_count} of {currentList.length} items available
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <p className="flex items-center gap-2">
                          <Navigation className="size-4" />
                          {storeResult.distance_km != null
                            ? `${storeResult.distance_km.toFixed(1)} km from ${basketData.region ?? 'your search area'}`
                            : 'Distance unavailable'}
                        </p>
                        {storeResult.address && (
                          <p className="flex items-center gap-2">
                            <MapPin className="size-4" />
                            {storeResult.address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      {currentList.map((listItem) => {
                        const item = buildStoreLineItem(storeResult, listItem.name);
                        const lineTotal = item.available && item.price != null ? item.price * listItem.quantity : null;
                        return (
                          <div key={`${storeResult.store}-${listItem.name}`} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-start gap-2">
                              {item.available ? (
                                <Check className="size-4 text-green-600 mt-0.5" />
                              ) : (
                                <X className="size-4 text-red-500 mt-0.5" />
                              )}
                              <div>
                                <span className={item.available ? 'dark:text-gray-300' : 'line-through text-gray-400'}>
                                  {item.displayName} x{listItem.quantity}
                                </span>
                                {item.available && item.unitPrice && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.unitPrice}</p>
                                )}
                              </div>
                            </div>
                            <span className={item.available ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                              {item.available ? formatLineTotal(lineTotal, item.priceStr, listItem.quantity) : '—'}
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
                        {!storeResult.is_best_price && extraCost > 0 && (
                          <div className="text-right">
                            <p className="text-sm text-amber-600">+${extraCost.toFixed(2)} vs best</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <Button
                          type="button"
                          variant={isPreferredStore ? 'secondary' : 'outline'}
                          className="w-full"
                          disabled={isPreferredStore}
                          onClick={() => handleSetPreferredStore(storeId, storeResult.store)}
                        >
                          {isPreferredStore ? 'Your Current Store' : 'Set This As My Store'}
                        </Button>
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

function formatSourceLabel(source: string): string {
  switch (source) {
    case 'walmart':
      return 'Walmart';
    case 'walmart_graphql':
      return 'Walmart';
    case 'loblaws_api':
      return 'Atlantic Superstore';
    case 'nofrills_api':
      return 'No Frills';
    case 'rcss_api':
      return 'Real Canadian Superstore';
    case 'flipp_flyer':
      return 'Flipp';
    default:
      return source.replace(/_/g, ' ');
  }
}

function formatLineTotal(lineTotal: number | null, fallbackPrice: string | null, quantity: number): string {
  if (lineTotal == null) {
    return '—';
  }

  if (quantity <= 1 && fallbackPrice) {
    return fallbackPrice;
  }

  return `$${lineTotal.toFixed(2)}`;
}
