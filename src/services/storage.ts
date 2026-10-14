import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_ALERT_STATE, type AlertState, type PriceWatch } from '../core/alerts';
import type { PriceHistory } from '../core/compare';
import { EMPTY_NOTIFY_STATE, type NotifyState } from '../core/notify';
import { DEFAULT_TRIP, type ListItem, type SavingEntry, type TripOptions } from '../core/shoppingList';
import { mergePreferences, type Preferences } from '../core/types';
import type { LeafletCache, StoreResult } from '../providers';

const KEYS = {
  prefs: 'okazje/preferences/v1',
  results: 'okazje/results/v1',
  notify: 'okazje/notify/v1',
  leaflets: 'okazje/leaflets/v1',
  history: 'okazje/price-history/v1',
  list: 'okazje/shopping-list/v1',
  trip: 'okazje/trip/v1',
  watches: 'okazje/watches/v1',
  alerts: 'okazje/alerts/v1',
  favorites: 'okazje/favorites/v1',
  savings: 'okazje/savings/v1',
};

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const writeJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

export const loadPreferences = async () => mergePreferences(await readJson<Partial<Preferences>>(KEYS.prefs));
export const savePreferences = (prefs: Preferences) => writeJson(KEYS.prefs, prefs);

export const loadResults = async () => (await readJson<StoreResult[]>(KEYS.results)) ?? [];
export const saveResults = (results: StoreResult[]) => writeJson(KEYS.results, results);

export const loadNotifyState = async () => (await readJson<NotifyState>(KEYS.notify)) ?? EMPTY_NOTIFY_STATE;
export const saveNotifyState = (state: NotifyState) => writeJson(KEYS.notify, state);

export const loadLeafletCache = async () => (await readJson<LeafletCache>(KEYS.leaflets)) ?? {};
export const saveLeafletCache = (cache: LeafletCache) => writeJson(KEYS.leaflets, cache);

export const loadPriceHistory = async () => (await readJson<PriceHistory>(KEYS.history)) ?? {};
export const savePriceHistory = (history: PriceHistory) => writeJson(KEYS.history, history);

export const loadShoppingList = async () => (await readJson<ListItem[]>(KEYS.list)) ?? [];
export const saveShoppingList = (items: ListItem[]) => writeJson(KEYS.list, items);

export const loadTripOptions = async () => ({ ...DEFAULT_TRIP, ...(await readJson<Partial<TripOptions>>(KEYS.trip)) });
export const saveTripOptions = (trip: TripOptions) => writeJson(KEYS.trip, trip);

export const loadWatches = async () => (await readJson<PriceWatch[]>(KEYS.watches)) ?? [];
export const saveWatches = (watches: PriceWatch[]) => writeJson(KEYS.watches, watches);

export const loadAlertState = async () => (await readJson<AlertState>(KEYS.alerts)) ?? EMPTY_ALERT_STATE;
export const saveAlertState = (state: AlertState) => writeJson(KEYS.alerts, state);

export const loadFavorites = async () => (await readJson<string[]>(KEYS.favorites)) ?? [];
export const saveFavorites = (ids: string[]) => writeJson(KEYS.favorites, ids);

export const loadSavings = async () => (await readJson<SavingEntry[]>(KEYS.savings)) ?? [];
export const saveSavings = (entries: SavingEntry[]) => writeJson(KEYS.savings, entries);
