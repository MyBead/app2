import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_NOTIFY_STATE, type NotifyState } from '../core/notify';
import { mergePreferences, type Preferences } from '../core/types';
import type { LeafletCache, StoreResult } from '../providers';

const KEYS = {
  prefs: 'okazje/preferences/v1',
  results: 'okazje/results/v1',
  notify: 'okazje/notify/v1',
  leaflets: 'okazje/leaflets/v1',
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
