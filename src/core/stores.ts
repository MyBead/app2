import type { StoreGroup, StoreId } from './types';

export interface StoreInfo {
  id: StoreId;
  name: string;
  group: StoreGroup;
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
    group: 'grocery',
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
    group: 'grocery',
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
    group: 'grocery',
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
    group: 'grocery',
    name: 'Kaufland',
    color: '#E10915',
    textColor: '#FFFFFF',
    website: 'https://www.kaufland.pl',
    loyaltyApp: 'Kaufland Card',
    // kaufland.pl answers automated requests with a Cloudflare challenge.
    sourceUrls: [],
    blixSlug: 'kaufland',
  },
  // Electronics chains: their own sites block automated requests (Cloudflare) or load offers
  // with scripts, so offers come from their blix.pl leaflets.
  mediamarkt: {
    id: 'mediamarkt',
    group: 'electronics',
    name: 'MediaMarkt',
    color: '#DF0000',
    textColor: '#FFFFFF',
    website: 'https://mediamarkt.pl',
    loyaltyApp: 'myMediaMarkt',
    sourceUrls: [],
    blixSlug: 'media-markt',
  },
  euro: {
    id: 'euro',
    group: 'electronics',
    name: 'RTV Euro AGD',
    color: '#00843F',
    textColor: '#FFFFFF',
    website: 'https://www.euro.com.pl',
    loyaltyApp: 'aplikacja RTV Euro AGD',
    sourceUrls: [],
    blixSlug: 'euro-rtv-agd',
  },
  mediaexpert: {
    id: 'mediaexpert',
    group: 'electronics',
    name: 'Media Expert',
    color: '#FFD200',
    textColor: '#1B1D21',
    website: 'https://www.mediaexpert.pl',
    loyaltyApp: 'aplikacja Media Expert',
    sourceUrls: [],
    blixSlug: 'media-expert',
  },
  neonet: {
    id: 'neonet',
    group: 'electronics',
    name: 'Neonet',
    color: '#F26522',
    textColor: '#FFFFFF',
    website: 'https://www.neonet.pl',
    loyaltyApp: 'aplikacja Neonet',
    sourceUrls: [],
    blixSlug: 'neonet',
  },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];

export const STORE_GROUPS: { id: StoreGroup; label: string; emoji: string }[] = [
  { id: 'grocery', label: 'Продукты', emoji: '🛒' },
  { id: 'electronics', label: 'Электроника', emoji: '📱' },
];

export const storesInGroup = (group: StoreGroup) => STORE_IDS.filter((id) => STORES[id].group === group);
