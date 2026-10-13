export type StoreId = 'lidl' | 'biedronka' | 'zabka' | 'kaufland';

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
  | 'other';

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
  /** Per-store override of the pages the scraper reads. */
  customSourceUrls: Partial<Record<StoreId, string>>;
  notifications: NotificationPrefs;
}

export const DEFAULT_PREFERENCES: Preferences = {
  stores: ['lidl', 'biedronka', 'zabka', 'kaufland'],
  favoriteCategories: [],
  hiddenCategories: [],
  keywords: [],
  blockedKeywords: [],
  minDiscount: 30,
  onlyFavoriteCategories: false,
  includeAppOnly: true,
  useDemoData: false,
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
  return {
    ...DEFAULT_PREFERENCES,
    ...saved,
    customSourceUrls: { ...DEFAULT_PREFERENCES.customSourceUrls, ...saved.customSourceUrls },
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...saved.notifications },
  };
}
