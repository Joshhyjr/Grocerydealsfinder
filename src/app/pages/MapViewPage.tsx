import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, ExternalLink, List, ShoppingCart, Check, X, Moon, Sun, LoaderCircle, MapPin, Navigation } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { applyListQuantitiesToBasketData, BasketResponseData, BasketStoreResult, fetchBasketResults } from '../data/api';
import { buildLocationSearchParams, getLocationDisplayName, readLocationFromSearchParams } from '../data/location';

export function MapViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    currentList,
    incrementItemQuantity,
    decrementItemQuantity,
    activeLocation,
    setActiveLocation,
    preferredStoreId,
    setPreferredStoreId,
    isDarkMode,
    toggleDarkMode,
  } = useGrocery();
  const routeLocation = useMemo(() => readLocationFromSearchParams(searchParams), [searchParams]);
  const location = routeLocation ?? activeLocation;
  const budget = searchParams.get('budget') || '100';
  const requestedStoreId = searchParams.get('store');

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [basketData, setBasketData] = useState<BasketResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (routeLocation) {
      setActiveLocation(routeLocation);
    }
  }, [routeLocation, setActiveLocation]);

  // The store explorer keeps the user's preferred store sticky across map and
  // list views, but still falls back gracefully when the result set changes.
  useEffect(() => {
    if (currentList.length === 0) {
      setBasketData(null);
      setIsLoading(false);
      setError('Add at least one grocery item before opening the store explorer.');
      return;
    }

    if (!location) {
      setBasketData(null);
      setIsLoading(false);
      setError('Choose an address, postal code, or current location before opening the store explorer.');
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

        const initialStore =
          response.stores.find((store) => (store.store_id ?? store.store) === requestedStoreId) ??
          response.stores.find((store) => (store.store_id ?? store.store) === preferredStoreId) ??
          response.stores.find((store) => store.is_best_price || store.is_within_drive_window) ??
          response.stores[0] ??
          null;

        setSelectedStoreId(initialStore?.store_id ?? initialStore?.store ?? null);
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
  }, [currentList, location, preferredStoreId, requestedStoreId]);

  const visibleStores = useMemo(() => {
    return basketData?.stores.filter((store) => store.is_best_price || store.is_within_drive_window) ?? [];
  }, [basketData]);

  useEffect(() => {
    if (requestedStoreId && visibleStores.some((store) => (store.store_id ?? store.store) === requestedStoreId)) {
      setPreferredStoreId(requestedStoreId);
      return;
    }

    if (preferredStoreId && visibleStores.every((store) => (store.store_id ?? store.store) !== preferredStoreId)) {
      setPreferredStoreId(null);
    }
  }, [preferredStoreId, requestedStoreId, setPreferredStoreId, visibleStores]);

  const preferredStore =
    visibleStores.find((store) => (store.store_id ?? store.store) === preferredStoreId) ??
    visibleStores.find((store) => (store.store_id ?? store.store) === requestedStoreId) ??
    null;
  const selectedStoreData =
    visibleStores.find((store) => (store.store_id ?? store.store) === selectedStoreId) ??
    preferredStore ??
    null;
  const storesWithCoordinates = useMemo(
    () => visibleStores.filter((store) => store.coordinates),
    [visibleStores],
  );
  const mapCenter =
    preferredStore?.coordinates ?? selectedStoreData?.coordinates ?? basketData?.user_coordinates ?? storesWithCoordinates[0]?.coordinates ?? null;
  const selectedStoreCoordinates = selectedStoreData?.coordinates ?? null;
  const nearestStore = useMemo(
    () => visibleStores.find((store) => store.is_nearest) ?? visibleStores[0] ?? null,
    [visibleStores],
  );
  const cheapestStore = useMemo(
    () => visibleStores.find((store) => store.is_best_price) ?? visibleStores[0] ?? null,
    [visibleStores],
  );
  const locationSummary = useMemo(() => {
    const closestLine = nearestStore
      ? `Closest store: ${nearestStore.store} ${formatDriveMinutes(nearestStore.drive_minutes)}`
      : 'Closest store: calculating nearby options';

    if (!nearestStore || !cheapestStore) {
      return {
        closestLine,
        cheapestLine: 'Cheapest store: comparing live prices now',
      };
    }

    if ((nearestStore.store_id ?? nearestStore.store) === (cheapestStore.store_id ?? cheapestStore.store)) {
      return {
        closestLine,
        cheapestLine: `Cheapest store: ${cheapestStore.store} is also your closest option`,
      };
    }

    const savings = Math.max(0, nearestStore.total_cost - cheapestStore.total_cost);
    const savingsText = savings > 0 ? `saves ${formatCurrency(savings)} more` : 'matches your closest store on price';

    return {
      closestLine,
      cheapestLine: `Cheapest store: ${cheapestStore.store} ${savingsText} and is ${formatDriveMinutes(cheapestStore.drive_minutes)}`,
    };
  }, [cheapestStore, nearestStore]);
  const smartInsight = useMemo(() => buildSmartInsight(preferredStore ?? selectedStoreData, nearestStore, cheapestStore), [
    cheapestStore,
    nearestStore,
    preferredStore,
    selectedStoreData,
  ]);
  const mapUrls = useMemo(() => {
    if (!mapCenter) {
      return null;
    }

    // The map now recenters around the chosen store when available so the
    // "set this as my store" action has an immediate visible payoff.
    const points = [
      ...storesWithCoordinates.map((store) => store.coordinates!),
      mapCenter,
    ];

    const latitudes = points.map((point) => point.lat);
    const longitudes = points.map((point) => point.lng);
    const minLat = Math.min(...latitudes) - 0.02;
    const maxLat = Math.max(...latitudes) + 0.02;
    const minLng = Math.min(...longitudes) - 0.02;
    const maxLng = Math.max(...longitudes) + 0.02;
    const markerTarget = selectedStoreCoordinates ?? mapCenter;
    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
    const marker = `${markerTarget.lat},${markerTarget.lng}`;

    return {
      embed: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`,
      open: `https://www.openstreetmap.org/?mlat=${markerTarget.lat}&mlon=${markerTarget.lng}#map=13/${markerTarget.lat}/${markerTarget.lng}`,
    };
  }, [mapCenter, selectedStoreCoordinates, storesWithCoordinates]);

  const goToListView = () => {
    if (!location) {
      return;
    }

    const params = buildLocationSearchParams(budget, location);
    const storeId = preferredStore?.store_id ?? selectedStoreData?.store_id ?? selectedStoreData?.store;
    if (storeId) {
      params.set('store', storeId);
    }

    navigate(`/results?${params.toString()}`);
  };

  const handleSetPreferredStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setPreferredStoreId(storeId);
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
              <Button
                onClick={goToListView}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!location}
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Live comparison data for {getLocationDisplayName(location)}</p>
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
              {visibleStores.map((store) => {
                const storeId = store.store_id ?? store.store;
                const isPreferredStore = storeId === (preferredStore?.store_id ?? preferredStore?.store);

                return (
                  <Card
                    key={storeId}
                    className={`cursor-pointer transition-all hover:shadow-md dark:bg-gray-800 ${
                      selectedStoreId === storeId || isPreferredStore ? 'border-2 border-green-600' : 'dark:border-gray-700'
                    }`}
                    onClick={() => setSelectedStoreId(storeId)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="dark:text-white">{store.store}</h3>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {isPreferredStore && <Badge className="bg-emerald-600 text-white">Your Store</Badge>}
                          {store.is_nearest && <Badge className="bg-green-600 text-white">Nearest</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {store.source && (
                          <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-400">
                            {formatSourceLabel(store.source)}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs dark:bg-gray-700 dark:text-gray-300">
                          {store.total_cost_str}
                        </Badge>
                        <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-400">
                          {store.available_count}/{currentList.length} items
                        </Badge>
                        {store.distance_km != null && (
                          <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-400">
                            {store.distance_km.toFixed(1)} km
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant={isPreferredStore ? 'secondary' : 'outline'}
                        className="mt-3 w-full"
                        disabled={isPreferredStore}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSetPreferredStore(storeId);
                        }}
                      >
                        {isPreferredStore ? 'Your Current Store' : 'Set This As My Store'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
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
                    <h3 className="text-2xl mb-2 dark:text-white">Nearest store explorer</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {`📍 Based on your exact location`}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {locationSummary.closestLine}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {locationSummary.cheapestLine}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
              <CardContent className="p-0">
                <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium dark:text-white">Smart insight</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{smartInsight}</p>
                    </div>
                    {preferredStore && (
                      <Badge className="bg-emerald-600 text-white">Your Store: {preferredStore.store}</Badge>
                    )}
                  </div>
                </div>
                {mapUrls ? (
                  <div className="overflow-hidden rounded-b-xl">
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <div>
                        <p className="text-sm font-medium dark:text-white">OpenStreetMap Store Locator</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Drag to explore nearby stores. The selected store is centered in the map.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(mapUrls.open, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="size-4 mr-2" />
                        Open Larger
                      </Button>
                    </div>
                    <iframe
                      key={mapUrls.embed}
                      title="Store locator map"
                      src={mapUrls.embed}
                      className="block h-[520px] w-full border-0 bg-slate-100 dark:bg-slate-900"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : (
                  <div className="p-8 text-sm text-gray-600 dark:text-gray-300">
                    No map coordinates are available for these stores yet, but distance and address details still appear below when known.
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedStoreData && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-2xl dark:text-white">{selectedStoreData.store}</h3>
                        {(selectedStoreData.store_id ?? selectedStoreData.store) === (preferredStore?.store_id ?? preferredStore?.store) && (
                          <Badge className="bg-emerald-600 text-white">Your Store</Badge>
                        )}
                        {selectedStoreData.is_nearest && <Badge className="bg-green-600 text-white">Nearest</Badge>}
                        {selectedStoreData.is_best_price && <Badge variant="secondary">Best Price</Badge>}
                        {selectedStoreData.source && (
                          <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">
                            {formatSourceLabel(selectedStoreData.source)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedStoreData.available_count} available, {selectedStoreData.missing_count} missing
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p className="flex items-center gap-2">
                          <Navigation className="size-4" />
                          {selectedStoreData.distance_km != null
                            ? `${selectedStoreData.distance_km.toFixed(1)} km from ${basketData?.region ?? 'your search area'}`
                            : 'Distance unavailable'}
                        </p>
                        {selectedStoreData.address && (
                          <p className="flex items-center gap-2">
                            <MapPin className="size-4" />
                            {selectedStoreData.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-green-600 text-white">{selectedStoreData.total_cost_str}</Badge>
                      {(selectedStoreData.store_id ?? selectedStoreData.store) !== (preferredStore?.store_id ?? preferredStore?.store) && (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-3 block"
                          onClick={() => handleSetPreferredStore(selectedStoreData.store_id ?? selectedStoreData.store)}
                        >
                          Set This As My Store
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {currentList.map((listItem) => {
                      const match = selectedStoreData.breakdown.find((item) => item.item.toLowerCase() === listItem.name.toLowerCase());
                      const isAvailable = Boolean(match);
                      const lineTotal = isAvailable && match?.price != null ? match.price * listItem.quantity : null;

                      return (
                        <div key={`${selectedStoreData.store}-${listItem.name}`} className="flex items-center justify-between gap-3 border-b dark:border-gray-700 pb-3 last:border-b-0">
                          <div className="flex items-start gap-3">
                            {isAvailable ? (
                              <Check className="size-4 text-green-600 mt-0.5" />
                            ) : (
                              <X className="size-4 text-red-500 mt-0.5" />
                            )}
                            <div>
                              <p className={isAvailable ? 'dark:text-white' : 'text-gray-400 line-through'}>
                                {match?.name || listItem.name} x{listItem.quantity}
                              </p>
                              {match?.unit_price && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{match.unit_price}</p>
                              )}
                              <div className="mt-2 flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => decrementItemQuantity(listItem.name)}
                                >
                                  -
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => incrementItemQuantity(listItem.name)}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          </div>
                          <span className={isAvailable ? 'dark:text-white' : 'text-gray-400'}>
                            {lineTotal != null ? `$${lineTotal.toFixed(2)}` : '—'}
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

function buildSmartInsight(
  activeStore: BasketStoreResult | null,
  nearestStore: BasketStoreResult | null,
  cheapestStore: BasketStoreResult | null,
): string {
  if (!nearestStore || !cheapestStore) {
    return 'We are still lining up the closest and cheapest stores for this basket.';
  }

  const nearestStoreId = nearestStore.store_id ?? nearestStore.store;
  const cheapestStoreId = cheapestStore.store_id ?? cheapestStore.store;
  const activeStoreId = activeStore ? activeStore.store_id ?? activeStore.store : null;
  const savingsVsNearest = Math.max(0, nearestStore.total_cost - cheapestStore.total_cost);
  const fartherThanNearestKm = Math.max(0, (cheapestStore.distance_km ?? 0) - (nearestStore.distance_km ?? 0));

  if (nearestStoreId === cheapestStoreId) {
    return `${cheapestStore.store} is both the cheapest basket and the closest trip right now.`;
  }

  if (activeStoreId === cheapestStoreId) {
    return `You'll save ${formatCurrency(savingsVsNearest)} by going to ${cheapestStore.store}, but it's ${formatDistanceDelta(fartherThanNearestKm)} farther than the closest store.`;
  }

  if (activeStoreId === nearestStoreId) {
    return `${nearestStore.store} is your shortest trip, but switching to ${cheapestStore.store} saves ${formatCurrency(savingsVsNearest)} for ${formatDistanceDelta(fartherThanNearestKm)} more driving.`;
  }

  if (activeStore) {
    const savingsVsSelected = Math.max(0, activeStore.total_cost - cheapestStore.total_cost);
    const distanceVsSelected = Math.abs((activeStore.distance_km ?? 0) - (cheapestStore.distance_km ?? 0));

    if (savingsVsSelected > 0) {
      return `${cheapestStore.store} beats your current store by ${formatCurrency(savingsVsSelected)} with a ${formatDistanceDelta(distanceVsSelected)} trip difference.`;
    }

    return `${activeStore.store} is effectively tied on basket price, so distance may be the better tiebreaker right now.`;
  }

  return `You'll save ${formatCurrency(savingsVsNearest)} by going to ${cheapestStore.store}, but it's ${formatDistanceDelta(fartherThanNearestKm)} farther than the closest store.`;
}

function formatDriveMinutes(minutes: number | null | undefined): string {
  if (minutes == null) {
    return 'distance unavailable';
  }

  return `${minutes} min away`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDistanceDelta(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 'almost no';
  }

  return `${distanceKm.toFixed(1)} km`;
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
