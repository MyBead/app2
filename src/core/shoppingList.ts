import { classify } from './categories';
import { isVisible } from './scoring';
import { matchesKeyword } from './text';
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

const byPrice = (a: Deal, b: Deal) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.title.localeCompare(b.title);

/** Current deals matching a list item, cheapest first. Pet food only matches pet-related items. */
export function matchDeals(text: string, deals: Deal[]): Deal[] {
  const pets = classify(text) === 'pets';
  return deals.filter((d) => matchesKeyword(d.title, text) && (d.category !== 'pets' || pets)).sort(byPrice);
}

/** Decides where to buy each list item and groups the result by store. */
export function planList(items: ListItem[], deals: Deal[], prefs: Preferences, now = new Date()): ListPlan {
  const visible = deals.filter((d) => isVisible(d, prefs, now));
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
