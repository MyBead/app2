/**
 * "Stores near me" from OpenStreetMap (Overpass API): which supported chains have a shop
 * within walking/driving distance, and how far the nearest one is.
 */
import { STORES } from './stores';
import type { StoreId } from './types';

export interface NearbyShop {
  store: StoreId;
  name: string;
  /** Metres from the user. */
  distance: number;
  lat: number;
  lon: number;
}

/** OSM `brand`/`name` patterns per chain. */
const BRAND_PATTERNS: Partial<Record<StoreId, RegExp>> = {
  lidl: /\blidl\b/i,
  biedronka: /biedronka/i,
  zabka: /[żz]abka/i,
  kaufland: /kaufland/i,
  mediamarkt: /media\s*markt/i,
  euro: /rtv\s*euro\s*agd|\beuro\s*rtv/i,
  mediaexpert: /media\s*expert/i,
  neonet: /neonet/i,
  aldi: /\baldi\b/i,
  carrefour: /carrefour/i,
  netto: /\bnetto\b/i,
  dino: /\bdino\b/i,
  auchan: /auchan/i,
  intermarche: /intermarch/i,
  polomarket: /polo\s*market/i,
  stokrotka: /stokrotka/i,
  lewiatan: /lewiatan/i,
  rossmann: /rossmann/i,
  hebe: /\bhebe\b/i,
  pepco: /pepco/i,
  action: /^action\b/i,
  castorama: /castorama/i,
  leroymerlin: /leroy\s*merlin/i,
  obi: /\bobi\b/i,
};

export function storeForBrand(brand: string | undefined, name: string | undefined): StoreId | undefined {
  const text = `${brand ?? ''} ${name ?? ''}`;
  return (Object.keys(BRAND_PATTERNS) as StoreId[]).find((id) => BRAND_PATTERNS[id]!.test(text));
}

/** Great-circle distance in metres. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(a)));
}

/** Overpass QL for shops of the given chains around a point. */
export function overpassQuery(lat: number, lon: number, radius: number, stores: StoreId[]): string {
  const names = stores
    .map((s) => STORES[s].name.replace('Żabka', '[ŻżZz]abka').replace('Intermarché', 'Intermarch'))
    .join('|');
  return `[out:json][timeout:20];nwr["shop"]["brand"~"${names}",i](around:${radius},${lat},${lon});out center 200;`;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Shops from an Overpass response, nearest first. */
export function parseOverpass(json: { elements?: OverpassElement[] }, lat: number, lon: number): NearbyShop[] {
  const out: NearbyShop[] = [];
  for (const e of json.elements ?? []) {
    const plat = e.lat ?? e.center?.lat;
    const plon = e.lon ?? e.center?.lon;
    const store = storeForBrand(e.tags?.brand, e.tags?.name);
    if (plat === undefined || plon === undefined || !store) continue;
    out.push({
      store,
      name: e.tags?.name ?? STORES[store].name,
      distance: distanceMeters(lat, lon, plat, plon),
      lat: plat,
      lon: plon,
    });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

/** Nearest shop per chain. */
export function nearestPerStore(shops: NearbyShop[]): NearbyShop[] {
  const seen = new Set<StoreId>();
  return shops.filter((s) => (seen.has(s.store) ? false : (seen.add(s.store), true)));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1).replace('.', ',')} км`;
}
