export type StoreId =
  | 'lidl'
  | 'biedronka'
  | 'zabka'
  | 'kaufland'
  | 'mediamarkt'
  | 'euro'
  | 'mediaexpert'
  | 'neonet'
  | 'aldi'
  | 'carrefour'
  | 'netto'
  | 'dino'
  | 'auchan'
  | 'intermarche'
  | 'polomarket'
  | 'stokrotka'
  | 'lewiatan'
  | 'rossmann'
  | 'hebe'
  | 'pepco'
  | 'action'
  | 'castorama'
  | 'leroymerlin'
  | 'obi';

export type StoreGroup = 'grocery' | 'electronics' | 'drugstore' | 'home';

export type CategoryId =
  | 'meat'
  | 'dairy'
  | 'produce'
  | 'bakery'
  | 'drinks'
  | 'alcohol'
  | 'sweets'
  | 'pantry'
  | 'frozen'
  | 'household'
  | 'cosmetics'
  | 'nonfood'
  | 'pets'
  | 'ready'
  | 'electronics'
  | 'other';

export interface LeafletSpot {
  /** blix.pl leaflet id. */
  id: string;
  page: number;
  /** Offer rectangle as fractions of the page: [left, top, right, bottom]. */
  box?: [number, number, number, number];
}

export interface Deal {
  /** Stable id: `${store}:${slug}` — used to remember which deals were already notified. */
  id: string;
  store: StoreId;
  title: string;
  /** Pack size, brand line etc. ("500 g", "różne rodzaje"). */
  subtitle?: string;
  /** Promo price in PLN. */
  price?: number;
  oldPrice?: number;
  /** Discount as stated by the store, 0–100. */
  discountPercent?: number;
  /** Mechanics that are not a plain price cut: "1+1 gratis", "-50% na drugi". */
  promoLabel?: string;
  category: CategoryId;
  imageUrl?: string;
  url?: string;
  /** ISO dates (yyyy-mm-dd). */
  validFrom?: string;
  validTo?: string;
  /** Only with a loyalty app/card: Lidl Plus, Moja Biedronka, Żappka, Kaufland Card. */
  requiresApp?: boolean;
  source: 'live' | 'demo';
  /** Where the offer sits in its leaflet, for the in-app leaflet viewer. */
  leaflet?: LeafletSpot;
}

export interface NotificationPrefs {
  enabled: boolean;
  /** Hours 0–23. No notifications from quietStart until quietEnd. */
  quietStart: number;
  quietEnd: number;
  maxPerDay: number;
}

export interface Preferences {
  stores: StoreId[];
  /** Stores the user has had the chance to toggle; stores added in app updates start enabled. */
  knownStores: StoreId[];
  /** Favourite categories get a score boost (and can be the only ones notified). */
  favoriteCategories: CategoryId[];
  hiddenCategories: CategoryId[];
  /** Products the user hunts for, in Polish ("kawa", "masło"). Any match is notification-worthy. */
  keywords: string[];
  /** Deals whose title matches these are never shown. */
  blockedKeywords: string[];
  /** Minimum discount (%) for a deal to count as "hot". */
  minDiscount: number;
  onlyFavoriteCategories: boolean;
  includeAppOnly: boolean;
  useDemoData: boolean;
  /** Download new leaflets (up to ~3 MB each) only on Wi-Fi; on mobile data use cached ones. */
  wifiOnlyLeaflets: boolean;
  /** Per-store override of the pages the scraper reads. */
  customSourceUrls: Partial<Record<StoreId, string>>;
  notifications: NotificationPrefs;
}

/** Enabled out of the box. */
const DEFAULT_STORE_IDS: StoreId[] = [
  'lidl',
  'biedronka',
  'zabka',
  'kaufland',
  'mediamarkt',
  'euro',
  'mediaexpert',
  'neonet',
];

/** Opt-in chains (each adds several leaflets to download). */
const EXTRA_STORE_IDS: StoreId[] = [
  'aldi',
  'carrefour',
  'netto',
  'dino',
  'auchan',
  'intermarche',
  'polomarket',
  'stokrotka',
  'lewiatan',
  'rossmann',
  'hebe',
  'pepco',
  'action',
  'castorama',
  'leroymerlin',
  'obi',
];

const ALL_STORE_IDS = [...DEFAULT_STORE_IDS, ...EXTRA_STORE_IDS];

export const DEFAULT_PREFERENCES: Preferences = {
  stores: DEFAULT_STORE_IDS,
  knownStores: ALL_STORE_IDS,
  favoriteCategories: [],
  hiddenCategories: [],
  keywords: [],
  blockedKeywords: [],
  minDiscount: 30,
  onlyFavoriteCategories: false,
  includeAppOnly: true,
  useDemoData: false,
  wifiOnlyLeaflets: false,
  customSourceUrls: {},
  notifications: {
    enabled: true,
    quietStart: 22,
    quietEnd: 8,
    maxPerDay: 2,
  },
};

/** Fills in fields added in newer versions so old saved preferences keep working. */
export function mergePreferences(saved: Partial<Preferences> | null | undefined): Preferences {
  if (!saved) return DEFAULT_PREFERENCES;
  // Preferences saved before `knownStores` existed covered only the first four chains.
  const known = saved.knownStores ?? DEFAULT_STORE_IDS.slice(0, 4);
  // New default chains switch on for existing users; opt-in chains wait to be enabled.
  const added = DEFAULT_STORE_IDS.filter((s) => !known.includes(s));
  return {
    ...DEFAULT_PREFERENCES,
    ...saved,
    stores: [...new Set([...(saved.stores ?? DEFAULT_PREFERENCES.stores), ...added])],
    knownStores: ALL_STORE_IDS,
    customSourceUrls: { ...DEFAULT_PREFERENCES.customSourceUrls, ...saved.customSourceUrls },
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...saved.notifications },
  };
}
