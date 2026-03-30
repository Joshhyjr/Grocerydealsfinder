import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, ExternalLink, List, ShoppingCart, Check, X, Moon, Sun, LoaderCircle, MapPin, Navigation } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { BasketResponseData, fetchBasketResults, normalizePostalCode } from '../data/api';

export function MapViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentList, isDarkMode, toggleDarkMode } = useGrocery();
  const postalCode = normalizePostalCode(searchParams.get('postalCode') || 'B3K9Z0');
  const budget = searchParams.get('budget') || '100';

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
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
        const preferredStore =
          response.stores.find((store) => store.is_best_price || store.is_within_drive_window) ?? response.stores[0] ?? null;
        setSelectedStoreId(preferredStore?.store_id ?? preferredStore?.store ?? null);
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

  const selectedStoreData =
    basketData?.stores.find((store) => (store.store_id ?? store.store) === selectedStoreId) ?? null;
  const visibleStores = useMemo(() => {
    return basketData?.stores.filter((store) => store.is_best_price || store.is_within_drive_window) ?? [];
  }, [basketData]);
  const storesWithCoordinates = useMemo(
    () => visibleStores.filter((store) => store.coordinates),
    [visibleStores],
  );
  const mapCenter = basketData?.user_coordinates ?? storesWithCoordinates[0]?.coordinates ?? null;
  const selectedStoreCoordinates = selectedStoreData?.coordinates ?? null;
  const mapUrls = useMemo(() => {
    if (!mapCenter) {
      return null;
    }

    // The iframe embed keeps native OpenStreetMap pan/zoom behavior without
    // depending on Leaflet layout calculations inside this responsive card.
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
              {visibleStores.map((store) => (
                <Card
                  key={store.store_id ?? store.store}
                  className={`cursor-pointer transition-all hover:shadow-md dark:bg-gray-800 ${
                    selectedStoreId === (store.store_id ?? store.store) ? 'border-2 border-green-600' : 'dark:border-gray-700'
                  }`}
                  onClick={() => setSelectedStoreId(store.store_id ?? store.store)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="dark:text-white">{store.store}</h3>
                      {store.is_nearest && <Badge className="bg-green-600 text-white">Nearest</Badge>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
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
                    <h3 className="text-2xl mb-2 dark:text-white">Nearest store explorer</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      Stores shown here are within about 20 minutes of {postalCode}, while the best overall deal stays visible even when it is farther away.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      When the backend does not send coordinates yet, this page falls back to registry-based store metadata so the local-only store filter can still work.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
              <CardContent className="p-0">
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
                        {selectedStoreData.is_nearest && <Badge className="bg-green-600 text-white">Nearest</Badge>}
                        {selectedStoreData.is_best_price && <Badge variant="secondary">Best Price</Badge>}
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
