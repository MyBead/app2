import { isoDate } from '../core/scoring';
import { STORES } from '../core/stores';
import type { Deal, Preferences, StoreId } from '../core/types';
import { BLIX, blixLeaflets, blixOffers, leafletUrl, pickLeaflets } from './blix';
import { demoDeals } from './demo';
import { extractDeals, toDeals } from './extract';
import { zabkaOffers } from './zabka';

export interface StoreResult {
  store: StoreId;
  deals: Deal[];
  /** Human-readable reason when nothing could be loaded. */
  error?: string;
  fetchedAt: string;
}

/**
 * Parsed blix leaflets by `${store}:${leafletId}`. A leaflet never changes and its page weighs
 * up to ~3 MB, so each one is downloaded once and kept until it expires.
 */
export type LeafletCache = Record<string, { end: string; deals: Deal[] }>;

const TIMEOUT_MS = 30_000;
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

/** Picks the parser for a shop page; the generic extractor is the fallback. */
export function parsePage(html: string, store: StoreId, url: string): Deal[] {
  if (/zabka\.pl/.test(url)) {
    const deals = toDeals(zabkaOffers(html), store, url);
    if (deals.length > 0) return deals;
  }
  return extractDeals(html, store, url);
}

/** Current leaflet offers of one chain from blix.pl; a leaflet that fails is reported, not fatal. */
async function fetchBlix(
  store: StoreId,
  cache: LeafletCache,
  today: string,
  errors: string[],
  downloadLeaflets: boolean,
): Promise<Deal[]> {
  const slug = STORES[store].blixSlug;
  const leaflets = pickLeaflets(blixLeaflets(await fetchText(`${BLIX}/sklep/${slug}/`), slug), today);
  if (leaflets.length === 0) throw new Error('нет действующих газеток');
  const deals: Deal[] = [];
  for (const leaflet of leaflets) {
    const key = `${store}:${leaflet.id}`;
    if (!cache[key] && !downloadLeaflets) {
      errors.push(`«${leaflet.name}»: загрузится по Wi-Fi`);
    } else if (!cache[key]) {
      const url = leafletUrl(slug, leaflet.id);
      try {
        const found = toDeals(blixOffers(await fetchText(url), slug, leaflet.id), store, url);
        // An empty parse may be a temporary error page — don't remember it.
        if (found.length > 0) cache[key] = { end: leaflet.end, deals: found };
        else errors.push(`${url}: акций в газетке не найдено`);
      } catch (e) {
        errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    deals.push(...(cache[key]?.deals ?? []));
  }
  return deals;
}

/** Reads every source of one store; a source that fails doesn't sink the others. */
export async function fetchStore(
  store: StoreId,
  urls: string[],
  cache: LeafletCache = {},
  now = new Date(),
  downloadLeaflets = true,
): Promise<StoreResult> {
  const deals = new Map<string, Deal>();
  const errors: string[] = [];
  const add = (found: Deal[]) => {
    for (const d of found) if (!deals.has(d.id)) deals.set(d.id, d);
  };
  for (const url of urls) {
    try {
      const found = parsePage(await fetchText(url), store, url);
      if (found.length === 0) errors.push(`${url}: акций на странице не найдено`);
      add(found);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  try {
    add(await fetchBlix(store, cache, isoDate(now), errors, downloadLeaflets));
  } catch (e) {
    errors.push(`blix.pl: ${e instanceof Error ? e.message : String(e)}`);
  }
  return {
    store,
    deals: [...deals.values()],
    error: errors.length > 0 ? errors.join('\n') : undefined,
    fetchedAt: now.toISOString(),
  };
}

export async function fetchAllDeals(
  prefs: Preferences,
  cache: LeafletCache = {},
  now = new Date(),
  downloadLeaflets = true,
): Promise<StoreResult[]> {
  if (prefs.useDemoData) {
    const all = demoDeals(now);
    return prefs.stores.map((store) => ({
      store,
      deals: all.filter((d) => d.store === store),
      fetchedAt: now.toISOString(),
    }));
  }
  return Promise.all(
    prefs.stores.map((store) => fetchStore(store, sourceUrls(store, prefs), cache, now, downloadLeaflets)),
  );
}

/** Drops leaflets that have ended. */
export function pruneLeafletCache(cache: LeafletCache, now = new Date()): LeafletCache {
  const today = isoDate(now);
  return Object.fromEntries(Object.entries(cache).filter(([, v]) => v.end >= today));
}
