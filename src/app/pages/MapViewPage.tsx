import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, List, ShoppingCart, Check, X, Moon, Sun } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { getStoresByPostalCode, calculateBasketTotal } from '../data/groceryData';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function MapViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentList, isDarkMode, toggleDarkMode } = useGrocery();
  const postalCode = searchParams.get('postalCode') || '';
  const budget = searchParams.get('budget') || '100';

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const storesInArea = getStoresByPostalCode(postalCode);

  // Calculate basket for each store
  const storeResults = storesInArea.map(store => {
    const basket = calculateBasketTotal(store, currentList);
    return {
      store,
      basket,
      hasAllItems: basket.availableCount === currentList.length,
      matchPercentage: Math.round((basket.availableCount / currentList.length) * 100),
    };
  });

  // Calculate center of map based on stores
  const centerLat = storesInArea.length > 0
    ? storesInArea.reduce((sum, store) => sum + store.coordinates.lat, 0) / storesInArea.length
    : 40.7128;
  const centerLng = storesInArea.length > 0
    ? storesInArea.reduce((sum, store) => sum + store.coordinates.lng, 0) / storesInArea.length
    : -74.0060;

  const selectedStore = selectedStoreId
    ? storeResults.find(r => r.store.id === selectedStoreId)
    : null;

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
          {/* Stores List */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h2 className="text-2xl mb-2 dark:text-white">Nearby Stores</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{storesInArea.length} stores found</p>
            </div>

            <div className="space-y-3">
              {storesInArea.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No stores found in this postal code.</p>
              ) : (
                storeResults.map(result => (
                  <Card
                    key={result.store.id}
                    className={`cursor-pointer transition-all hover:shadow-md dark:bg-gray-800 ${
                      selectedStoreId === result.store.id ? 'border-2 border-green-600' : 'dark:border-gray-700'
                    }`}
                    onClick={() => setSelectedStoreId(result.store.id)}
                  >
                    <CardContent className="p-4">
                      <h3 className="mb-1 dark:text-white">{result.store.name}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{result.store.address}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs dark:bg-gray-700 dark:text-gray-300">
                          ${result.basket.total.toFixed(2)}
                        </Badge>
                        {result.hasAllItems ? (
                          <Badge className="text-xs bg-green-600">All items</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-400">
                            {result.basket.availableCount}/{currentList.length} items
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {selectedStore && (
              <Card className="border-green-600 dark:bg-gray-800">
                <CardContent className="p-4">
                  <h3 className="mb-3 dark:text-white">{selectedStore.store.name}</h3>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Price</p>
                    <p className="text-2xl text-green-600">${selectedStore.basket.total.toFixed(2)}</p>
                    {selectedStore.basket.savings > 0 && (
                      <p className="text-xs text-green-600">Save ${selectedStore.basket.savings.toFixed(2)}</p>
                    )}
                  </div>

                  <div className="border-t dark:border-gray-700 pt-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {selectedStore.basket.availableCount} of {currentList.length} items available
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedStore.basket.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1.5">
                            {item.available ? (
                              <Check className="size-3 text-green-600" />
                            ) : (
                              <X className="size-3 text-gray-400" />
                            )}
                            <span className={item.available ? 'dark:text-gray-300' : 'line-through text-gray-400'}>
                              {item.name}
                            </span>
                          </div>
                          {item.available && (
                            <span className="text-green-700 dark:text-green-500">${item.price.toFixed(2)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-0">
                {storesInArea.length === 0 ? (
                  <div className="h-[600px] flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                    <div className="text-center">
                      <ShoppingCart className="size-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 dark:text-gray-400">No stores to display on map</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Try a different postal code</p>
                    </div>
                  </div>
                ) : (
                  <MapContainer
                    center={[centerLat, centerLng]}
                    zoom={13}
                    style={{ height: '700px', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {storeResults.map(result => (
                      <Marker
                        key={result.store.id}
                        position={[result.store.coordinates.lat, result.store.coordinates.lng]}
                        eventHandlers={{
                          click: () => setSelectedStoreId(result.store.id),
                        }}
                      >
                        <Popup>
                          <div className="p-2 min-w-[200px]">
                            <h3 className="mb-2">{result.store.name}</h3>
                            <p className="text-sm text-gray-600 mb-3">{result.store.address}</p>
                            
                            <div className="space-y-2 mb-3">
                              <div className="flex justify-between text-sm">
                                <span>Total:</span>
                                <span className="text-green-600">${result.basket.total.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Items available:</span>
                                <span>{result.basket.availableCount} / {currentList.length}</span>
                              </div>
                              {result.basket.savings > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span>Savings:</span>
                                  <span className="text-green-600">${result.basket.savings.toFixed(2)}</span>
                                </div>
                              )}
                            </div>

                            {result.hasAllItems ? (
                              <Badge className="w-full justify-center bg-green-600">
                                All items available
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="w-full justify-center">
                                {result.matchPercentage}% match
                              </Badge>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
