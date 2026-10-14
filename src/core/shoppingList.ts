import { classify } from './categories';
import { isVisible } from './scoring';
import { matchesKeyword } from './text';
import { comparablePrices } from './units';
import type { Deal, Preferences, StoreId } from './types';

export interface ListItem {
  id: string;
  /** What to buy, in Polish ("masło", "kawa ziarnista"). */
  text: string;
  /** Set when the user picked a specific deal; otherwise the cheapest match is chosen. */
  dealId?: string;
  checked: boolean;
  addedAt: string;
}

export interface ItemPlan {
  item: ListItem;
  /** Deal to buy: the pinned one, or the cheapest current match. */
  best?: Deal;
  /** All current matches, cheapest first (includes `best`). */
  matches: Deal[];
  pinned: boolean;
}

export interface StoreStop {
  store: StoreId;
  items: ItemPlan[];
  total: number;
}

export interface ListPlan {
  stops: StoreStop[];
  /** Items with no current deal — buy anywhere at the regular price. */
  noDeal: ItemPlan[];
  checked: ItemPlan[];
  total: number;
}

/** Cheapest first — by price per kg/l when both packs state their size, else by shelf price. */
const byPrice = (a: Deal, b: Deal) => {
  const c = comparablePrices(a, b);
  return (c ? c[0] - c[1] : (a.price ?? Infinity) - (b.price ?? Infinity)) || a.title.localeCompare(b.title);
};

/** Current deals matching a list item, cheapest first. Pet food only matches pet-related items. */
export function matchDeals(text: string, deals: Deal[]): Deal[] {
  const pets = classify(text) === 'pets';
  return deals.filter((d) => matchesKeyword(d.title, text) && (d.category !== 'pets' || pets)).sort(byPrice);
}

export interface TripOptions {
  /** At most this many stores (pinned items' stores included); null = no limit. */
  maxStores: number | null;
  /** Only these stores; empty = every enabled store. */
  allowedStores: StoreId[];
}

export const DEFAULT_TRIP: TripOptions = { maxStores: null, allowedStores: [] };

function* subsets<T>(items: T[], size: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === size) {
    yield acc;
    return;
  }
  for (let i = start; i < items.length; i++) yield* subsets(items, size, i + 1, [...acc, items[i]]);
}

/**
 * Picks the stores to visit: covers as many items with deals as possible, then minimises the
 * total, then prefers fewer stops. Brute force — there are only a handful of chains.
 */
export function chooseStores(plans: ItemPlan[], maxStores: number): Set<StoreId> {
  const forced = new Set(plans.filter((p) => p.pinned && p.best).map((p) => p.best!.store));
  const open = plans.filter((p) => !p.pinned && p.matches.length > 0);
  const candidates = [...new Set(open.flatMap((p) => p.matches.map((d) => d.store)))].filter((s) => !forced.has(s));
  const room = Math.max(0, maxStores - forced.size);
  let best: { stores: Set<StoreId>; covered: number; cost: number } | null = null;
  for (let size = 0; size <= Math.min(room, candidates.length); size++) {
    for (const extra of subsets(candidates, size)) {
      const stores = new Set([...forced, ...extra]);
      let covered = 0;
      let cost = 0;
      for (const p of open) {
        const d = p.matches.find((m) => stores.has(m.store));
        if (d) {
          covered++;
          cost += d.price ?? 0;
        }
      }
      if (!best || covered > best.covered || (covered === best.covered && cost < best.cost - 0.005)) {
        best = { stores, covered, cost };
      }
    }
  }
  return best?.stores ?? forced;
}

/** Decides where to buy each list item and groups the result by store. */
export function planList(
  items: ListItem[],
  deals: Deal[],
  prefs: Preferences,
  now = new Date(),
  trip: TripOptions = DEFAULT_TRIP,
): ListPlan {
  const allowed = trip.allowedStores.length ? trip.allowedStores : prefs.stores;
  const visible = deals.filter((d) => allowed.includes(d.store) && isVisible(d, prefs, now));
  const byId = new Map(deals.map((d) => [d.id, d]));
  const plans: ItemPlan[] = items.map((item) => {
    const matches = matchDeals(item.text, visible);
    const pinnedDeal = item.dealId ? byId.get(item.dealId) : undefined;
    const pinnedValid = pinnedDeal && isVisible(pinnedDeal, { ...prefs, stores: [pinnedDeal.store] }, now);
    return {
      item,
      best: pinnedValid ? pinnedDeal : matches[0],
      matches: pinnedValid && !matches.includes(pinnedDeal) ? [pinnedDeal, ...matches] : matches,
      pinned: !!pinnedValid,
    };
  });

  if (trip.maxStores !== null) {
    const active = plans.filter((p) => !p.item.checked);
    const stores = chooseStores(active, trip.maxStores);
    for (const p of active) if (!p.pinned) p.best = p.matches.find((m) => stores.has(m.store));
  }

  const stops = new Map<StoreId, StoreStop>();
  const noDeal: ItemPlan[] = [];
  const checked: ItemPlan[] = [];
  for (const p of plans) {
    if (p.item.checked) checked.push(p);
    else if (!p.best) noDeal.push(p);
    else {
      const stop = stops.get(p.best.store) ?? { store: p.best.store, items: [], total: 0 };
      stop.items.push(p);
      stop.total += p.best.price ?? 0;
      stops.set(p.best.store, stop);
    }
  }
  const sorted = [...stops.values()].sort((a, b) => b.items.length - a.items.length || b.total - a.total);
  return { stops: sorted, noDeal, checked, total: sorted.reduce((s, x) => s + x.total, 0) };
}

/** Short list text for a deal: drop pack sizes and brand tails ("Masło extra Pilos 200 g" → "masło extra pilos"). */
export function itemTextFromDeal(deal: Deal): string {
  return deal.title
    .replace(/\d+([.,]\d+)?\s*(g|kg|ml|l|szt\.?|%)\b.*$/i, '')
    .replace(/[®™]/g, '')
    .trim()
    .toLowerCase();
}
