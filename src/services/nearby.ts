import * as Location from 'expo-location';

import { nearestPerStore, overpassQuery, parseOverpass, type NearbyShop } from '../core/nearby';
import type { StoreId } from '../core/types';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** Nearest shop of each chain within `radius` metres of the phone, via OpenStreetMap. */
export async function findNearbyStores(stores: StoreId[], radius: number): Promise<NearbyShop[]> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Нет доступа к геолокации — разрешите его в настройках телефона.');
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude, longitude } = position.coords;
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Okazje (personal deals app)' },
    body: `data=${encodeURIComponent(overpassQuery(latitude, longitude, radius, stores))}`,
  });
  if (!res.ok) throw new Error(`Карта магазинов недоступна (HTTP ${res.status}), попробуйте позже.`);
  return nearestPerStore(parseOverpass(await res.json(), latitude, longitude));
}
