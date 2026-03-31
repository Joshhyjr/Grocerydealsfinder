export interface StoreCoordinates {
  lat: number;
  lng: number;
}

export interface StoreRegistryEntry {
  id: string;
  displayName: string;
  aliases: string[];
  source: string;
  address: string;
  regionKeys: string[];
  coordinates: StoreCoordinates | null;
}

export interface RegionConfig {
  key: string;
  name: string;
  postalPrefixes: string[];
  center: StoreCoordinates;
  defaultStoreIds: string[];
}

export const regions: RegionConfig[] = [
  {
    key: 'halifax-metro',
    name: 'Halifax Metro',
    postalPrefixes: [
      'B3H',
      'B3J',
      'B3K',
      'B3L',
      'B3M',
      'B3N',
      'B3P',
      'B3R',
      'B3S',
      'B3T',
      'B3V',
      'B3X',
      'B4A',
      'B4B',
      'B4C',
      'B4E',
    ],
    center: { lat: 44.6488, lng: -63.5752 },
    defaultStoreIds: ['loblaws-hfx', 'nofrills-hfx', 'rcss-hfx', 'walmart-hfx', 'flipp-hfx'],
  },
];

export const storeRegistry: StoreRegistryEntry[] = [
  {
    id: 'atlantic-superstore-almon',
    displayName: 'Atlantic Superstore',
    aliases: ['Loblaws', 'Atlantic Superstore'],
    source: 'pcx',
    address: '5840 Almon St, Halifax, NS',
    regionKeys: ['halifax-metro'],
    coordinates: { lat: 44.6604, lng: -63.6115 },
  },
  {
    id: 'atlantic-superstore-young',
    displayName: 'Atlantic Superstore',
    aliases: ['Loblaws', 'Atlantic Superstore'],
    source: 'pcx',
    address: '6141 Young St, Halifax, NS',
    regionKeys: ['halifax-metro'],
    coordinates: { lat: 44.6577, lng: -63.6103 },
  },
  {
    id: 'nofrills-hfx',
    displayName: 'No Frills',
    aliases: ['No Frills'],
    source: 'pcx',
    address: '3601 Joseph Howe Dr, Halifax, NS',
    regionKeys: ['halifax-metro'],
    coordinates: { lat: 44.6528, lng: -63.6268 },
  },
  {
    id: 'rcss-hfx',
    displayName: 'Real Canadian Superstore',
    aliases: ['Real Canadian Superstore', 'RCSS'],
    source: 'pcx',
    address: '660 Portland St, Dartmouth, NS',
    regionKeys: ['halifax-metro'],
    coordinates: { lat: 44.6717, lng: -63.5348 },
  },
  {
    id: 'walmart-hfx',
    displayName: 'Walmart',
    aliases: ['Walmart', 'Walmart Supercentre'],
    source: 'walmart',
    address: '6990 Mumford Rd, Halifax, NS',
    regionKeys: ['halifax-metro'],
    coordinates: { lat: 44.6483, lng: -63.6204 },
  },
  {
    id: 'flipp-hfx',
    displayName: 'Flipp',
    aliases: ['Flipp'],
    source: 'flipp',
    address: 'Flyer deals for Halifax-region stores',
    regionKeys: ['halifax-metro'],
    coordinates: null,
  },
];

export function getRegionForPostalCode(postalCode: string): RegionConfig | null {
  const normalized = postalCode.trim().toUpperCase().replace(/\s+/g, '');
  const prefix = normalized.slice(0, 3);

  if (!prefix) {
    return null;
  }

  return regions.find((region) => region.postalPrefixes.includes(prefix)) ?? null;
}

export function getStoreRegistryEntry(storeName: string, regionKey?: string | null): StoreRegistryEntry | null {
  return getStoreRegistryCandidates(storeName, regionKey)[0] ?? null;
}

export function getStoreRegistryCandidates(storeName: string, regionKey?: string | null): StoreRegistryEntry[] {
  const normalizedStoreName = storeName.trim().toLowerCase();

  return storeRegistry.filter((entry) => {
      const matchesAlias = entry.aliases.some((alias) => alias.toLowerCase() === normalizedStoreName);
      if (!matchesAlias) {
        return false;
      }

      return regionKey ? entry.regionKeys.includes(regionKey) : true;
    });
}

export function chooseBestStoreRegistryEntry(
  storeName: string,
  regionKey?: string | null,
  userCoordinates?: StoreCoordinates | null,
): StoreRegistryEntry | null {
  const candidates = getStoreRegistryCandidates(storeName, regionKey);
  if (candidates.length === 0) {
    return null;
  }

  if (!userCoordinates) {
    return candidates[0];
  }

  // When multiple branches share the same brand label, choose the branch that
  // is physically closest to the user's resolved location.
  return candidates.reduce<StoreRegistryEntry>((bestEntry, nextEntry) => {
    if (!bestEntry.coordinates) {
      return nextEntry;
    }

    if (!nextEntry.coordinates) {
      return bestEntry;
    }

    const bestDistance = calculateDistanceKm(userCoordinates, bestEntry.coordinates);
    const nextDistance = calculateDistanceKm(userCoordinates, nextEntry.coordinates);
    return nextDistance < bestDistance ? nextEntry : bestEntry;
  }, candidates[0]);
}

export function getRegionStores(regionKey: string): StoreRegistryEntry[] {
  const region = regions.find((entry) => entry.key === regionKey);
  if (!region) {
    return [];
  }

  return region.defaultStoreIds
    .map((storeId) => storeRegistry.find((entry) => entry.id === storeId) ?? null)
    .filter((entry): entry is StoreRegistryEntry => entry !== null);
}

export function calculateDistanceKm(origin: StoreCoordinates, destination: StoreCoordinates): number {
  const earthRadiusKm = 6371;
  const latDiff = degreesToRadians(destination.lat - origin.lat);
  const lngDiff = degreesToRadians(destination.lng - origin.lng);
  const lat1 = degreesToRadians(origin.lat);
  const lat2 = degreesToRadians(destination.lat);

  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.sin(lngDiff / 2) * Math.sin(lngDiff / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
