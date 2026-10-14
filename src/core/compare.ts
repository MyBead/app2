/**
 * Price context for a deal when the store doesn't publish its regular price (leaflets don't):
 * the same product in other chains right now, and what this store charged for it before.
 */
import { effectiveDiscount } from './price';
import { words } from './text';
import { comparablePrices } from './units';
import type { Deal, StoreId } from './types';

const STOP_WORDS = new Set(['z', 'i', 'w', 'na', 'do', 'dla', 'ze', 'o', 'od', 'bez', 'lub', 'oraz', 'a']);

/** Words that identify a product: no stop words, numbers or pack sizes. */
export function productTokens(title: string): string[] {
  return words(title).filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/\d/.test(w));
}

function similarity(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let common = 0;
  for (const w of sa) if (sb.has(w)) common++;
  return common / (sa.size + sb.size - common);
}

/** Two titles name the same product: same first word and mostly the same words. */
export function sameProduct(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0 || a[0] !== b[0]) return false;
  const shorter = Math.min(a.length, b.length);
  // One-word titles ("Banany") are too vague to compare across chains.
  if (shorter < 2) return false;
  return similarity(a, b) >= 0.6;
}

export interface OtherStorePrice {
  store: StoreId;
  price: number;
  dealId: string;
  /** Their price relative to this deal (0.8 = 20% cheaper), per kg/l when both packs state a size. */
  ratio: number;
}

/** For each deal, the cheapest price of the same product in each other chain. */
export function crossStorePrices(deals: Deal[]): Map<string, OtherStorePrice[]> {
  const byHead = new Map<string, { deal: Deal; tokens: string[] }[]>();
  for (const deal of deals) {
    if (!deal.price) continue;
    const tokens = productTokens(deal.title);
    if (tokens.length === 0) continue;
    const bucket = byHead.get(tokens[0]) ?? [];
    bucket.push({ deal, tokens });
    byHead.set(tokens[0], bucket);
  }
  const out = new Map<string, OtherStorePrice[]>();
  for (const bucket of byHead.values()) {
    if (bucket.length < 2) continue;
    for (const a of bucket) {
      const best = new Map<StoreId, OtherStorePrice>();
      for (const b of bucket) {
        if (b.deal.store === a.deal.store || !sameProduct(a.tokens, b.tokens)) continue;
        // Per kg/l when both packs state a size, so 250 g vs 1 kg compares fairly.
        const [mine, theirs] = comparablePrices(a.deal, b.deal) ?? [a.deal.price!, b.deal.price!];
        const ratio = theirs / mine;
        const cur = best.get(b.deal.store);
        if (!cur || ratio < cur.ratio) {
          best.set(b.deal.store, { store: b.deal.store, price: b.deal.price!, dealId: b.deal.id, ratio });
        }
      }
      if (best.size > 0)
        out.set(
          a.deal.id,
          [...best.values()].sort((x, y) => x.price - y.price),
        );
    }
  }
  return out;
}

/** Prices seen per deal id, newest last; kept small and persisted between refreshes. */
export type PriceHistory = Record<string, { price: number; seen: string }[]>;

const HISTORY_LENGTH = 6;
const HISTORY_DAYS = 120;

/** Records today's prices. A new entry is added only when the price changes. */
export function recordPrices(history: PriceHistory, deals: Deal[], today: string): PriceHistory {
  const cutoff = new Date(new Date(`${today}T12:00:00`).getTime() - HISTORY_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const next: PriceHistory = {};
  for (const [id, entries] of Object.entries(history)) {
    const kept = entries.filter((e) => e.seen >= cutoff);
    if (kept.length) next[id] = kept;
  }
  for (const d of deals) {
    if (!d.price) continue;
    const entries = next[d.id] ?? [];
    const last = entries[entries.length - 1];
    if (last && Math.abs(last.price - d.price) < 0.005) last.seen = today;
    else entries.push({ price: d.price, seen: today });
    next[d.id] = entries.slice(-HISTORY_LENGTH);
  }
  return next;
}

export type PriceInsight =
  | { kind: 'saving'; amount: number; percent: number }
  /** Multi-buy mechanics ("1+1", "-50% na drugi"): average saving per item. */
  | { kind: 'mechanic'; amount: number; percent: number; label: string }
  | { kind: 'cheapest'; amount: number; store: StoreId }
  | { kind: 'cheaperElsewhere'; amount: number; store: StoreId; price: number }
  | { kind: 'history'; previous: number; amount: number }
  | { kind: 'unknown' };

/**
 * The single most useful price comparison for a deal, in order: the store's own regular
 * price, other chains, earlier prices in this store.
 */
export function priceInsight(
  deal: Deal,
  others: OtherStorePrice[] | undefined,
  history: PriceHistory[string] | undefined,
): PriceInsight {
  const price = deal.price;
  if (price && deal.oldPrice && deal.oldPrice > price) {
    return { kind: 'saving', amount: deal.oldPrice - price, percent: effectiveDiscount(deal) };
  }
  const percent = effectiveDiscount(deal);
  if (price && deal.promoLabel && percent > 0) {
    return { kind: 'mechanic', amount: (price * percent) / 100, percent, label: deal.promoLabel };
  }
  if (price && others?.length) {
    const cheapestOther = others[0];
    if (cheapestOther.ratio < 0.995) {
      return {
        kind: 'cheaperElsewhere',
        amount: price * (1 - cheapestOther.ratio),
        store: cheapestOther.store,
        price: cheapestOther.price,
      };
    }
    const nextOther = others.find((o) => o.ratio > 1.005);
    if (nextOther) return { kind: 'cheapest', amount: price * (nextOther.ratio - 1), store: nextOther.store };
  }
  if (price && history && history.length > 1) {
    const previous = history[history.length - 2].price;
    if (Math.abs(previous - price) >= 0.01) return { kind: 'history', previous, amount: previous - price };
  }
  return { kind: 'unknown' };
}
