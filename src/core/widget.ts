/** What the home-screen widget shows: the best current deals under the user's preferences. */
import { formatPrice } from './price';
import { rankDeals } from './scoring';
import { STORES } from './stores';
import type { Deal, Preferences } from './types';

export interface WidgetRow {
  id: string;
  title: string;
  store: string;
  storeColor: string;
  price?: string;
  /** "−30%" or the leaflet's promo mechanic ("2+1 gratis"). */
  badge?: string;
  hot: boolean;
}

export function widgetRows(deals: Deal[], prefs: Preferences, now = new Date(), limit = 8): WidgetRow[] {
  return rankDeals(deals, prefs, now)
    .slice(0, limit)
    .map(({ deal, discount, hot }) => ({
      id: deal.id,
      title: deal.title,
      store: STORES[deal.store]?.name ?? deal.store,
      storeColor: STORES[deal.store]?.color ?? '#888888',
      price: deal.price !== undefined ? formatPrice(deal.price) : undefined,
      badge: discount > 0 ? `−${discount}%` : deal.promoLabel?.slice(0, 18),
      hot,
    }));
}

/** Deep link the widget opens for a deal. */
export function dealLink(id: string): string {
  return `okazje://deal/${encodeURIComponent(id)}`;
}
