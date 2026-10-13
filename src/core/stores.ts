import type { StoreId } from './types';

export interface StoreInfo {
  id: StoreId;
  name: string;
  color: string;
  textColor: string;
  website: string;
  loyaltyApp: string;
  /** Shop pages scraped for offers. Can be overridden in settings. */
  sourceUrls: string[];
  /** Store slug on blix.pl, the leaflet aggregator (see providers/blix.ts). */
  blixSlug: string;
}

export const STORES: Record<StoreId, StoreInfo> = {
  lidl: {
    id: 'lidl',
    name: 'Lidl',
    color: '#0050AA',
    textColor: '#FFF000',
    website: 'https://www.lidl.pl',
    loyaltyApp: 'Lidl Plus',
    // The homepage carries the week's non-food offers with regular prices.
    sourceUrls: ['https://www.lidl.pl/'],
    blixSlug: 'lidl',
  },
  biedronka: {
    id: 'biedronka',
    name: 'Biedronka',
    color: '#E30613',
    textColor: '#FFFFFF',
    website: 'https://www.biedronka.pl',
    loyaltyApp: 'Moja Biedronka',
    // biedronka.pl publishes offers only as leaflet images.
    sourceUrls: [],
    blixSlug: 'biedronka',
  },
  zabka: {
    id: 'zabka',
    name: 'Żabka',
    color: '#00843D',
    textColor: '#FFFFFF',
    website: 'https://www.zabka.pl',
    loyaltyApp: 'Żappka',
    sourceUrls: ['https://www.zabka.pl/'],
    blixSlug: 'zabka',
  },
  kaufland: {
    id: 'kaufland',
    name: 'Kaufland',
    color: '#E10915',
    textColor: '#FFFFFF',
    website: 'https://www.kaufland.pl',
    loyaltyApp: 'Kaufland Card',
    // kaufland.pl answers automated requests with a Cloudflare challenge.
    sourceUrls: [],
    blixSlug: 'kaufland',
  },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];
