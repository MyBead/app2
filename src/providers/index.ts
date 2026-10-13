import { STORES } from '../core/stores';
import type { Deal, Preferences, StoreId } from '../core/types';
import { demoDeals } from './demo';
import { extractDeals } from './extract';

export interface StoreResult {
  store: StoreId;
  deals: Deal[];
  /** Human-readable reason when nothing could be loaded. */
  error?: string;
  fetchedAt: string;
}

const TIMEOUT_MS = 20_000;
const HEADERS = {
  // Shops serve the full page (with embedded offer data) to regular mobile browsers.
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pl-PL,pl;q=0.9',
};

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function sourceUrls(store: StoreId, prefs: Preferences): string[] {
  const custom = prefs.customSourceUrls[store]?.trim();
  return custom ? [custom] : STORES[store].sourceUrls;
}

/** Reads every source page of one store; a page that fails doesn't sink the others. */
export async function fetchStore(store: StoreId, urls: string[]): Promise<StoreResult> {
  const deals = new Map<string, Deal>();
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const found = extractDeals(html, store, url);
      if (found.length === 0) errors.push(`${url}: акций на странице не найдено`);
      for (const d of found) if (!deals.has(d.id)) deals.set(d.id, d);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return {
    store,
    deals: [...deals.values()],
    error: deals.size === 0 ? errors.join('\n') || 'Нет данных' : undefined,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAllDeals(prefs: Preferences, now = new Date()): Promise<StoreResult[]> {
  if (prefs.useDemoData) {
    const all = demoDeals(now);
    return prefs.stores.map((store) => ({
      store,
      deals: all.filter((d) => d.store === store),
      fetchedAt: now.toISOString(),
    }));
  }
  return Promise.all(prefs.stores.map((store) => fetchStore(store, sourceUrls(store, prefs))));
}
