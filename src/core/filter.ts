import type { PriceInsight } from './compare';
import type { ScoredDeal } from './scoring';
import { STORES } from './stores';
import { matchesSearch } from './text';
import type { CategoryId, StoreGroup, StoreId } from './types';

export type SortId = 'score' | 'saving' | 'priceAsc' | 'priceDesc' | 'ending';

export interface DealFilter {
  query: string;
  group: StoreGroup | 'all';
  /** Empty = every store of the group. */
  stores: StoreId[];
  /** Empty = every category. */
  categories: CategoryId[];
  minPrice?: number;
  maxPrice?: number;
  /** Only deals whose saving is known: regular price, cheaper than other chains, or cheaper than before. */
  knownSavingOnly: boolean;
  /** Only deals matching favourite products or categories. */
  favoritesOnly: boolean;
  sort: SortId;
}

export const EMPTY_FILTER: DealFilter = {
  query: '',
  group: 'all',
  stores: [],
  categories: [],
  knownSavingOnly: false,
  favoritesOnly: false,
  sort: 'score',
};

export const SORTS: { id: SortId; label: string }[] = [
  { id: 'score', label: 'Для меня' },
  { id: 'saving', label: 'Наибольшая выгода' },
  { id: 'priceAsc', label: 'Сначала дешёвые' },
  { id: 'priceDesc', label: 'Сначала дорогие' },
  { id: 'ending', label: 'Скоро закончится' },
];

/** Saving in złoty that the insight proves (0 when unknown or when another chain is cheaper). */
export function provenSaving(insight: PriceInsight): number {
  return insight.kind === 'saving' ||
    insight.kind === 'mechanic' ||
    insight.kind === 'cheapest' ||
    (insight.kind === 'history' && insight.amount > 0)
    ? insight.amount
    : 0;
}

/** Number of filter settings that differ from the defaults (shown on the filter button). */
export function activeFilterCount(f: DealFilter): number {
  return (
    (f.group !== 'all' ? 1 : 0) +
    (f.stores.length ? 1 : 0) +
    (f.categories.length ? 1 : 0) +
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    (f.knownSavingOnly ? 1 : 0) +
    (f.favoritesOnly ? 1 : 0)
  );
}

export function applyFilter(
  items: ScoredDeal[],
  f: DealFilter,
  insightFor: (s: ScoredDeal) => PriceInsight,
): ScoredDeal[] {
  const q = f.query.trim();
  const savings = new Map<string, number>();
  const saving = (s: ScoredDeal) => {
    let v = savings.get(s.deal.id);
    if (v === undefined) savings.set(s.deal.id, (v = provenSaving(insightFor(s))));
    return v;
  };
  const filtered = items.filter((s) => {
    const d = s.deal;
    if (f.group !== 'all' && STORES[d.store].group !== f.group) return false;
    if (f.stores.length && !f.stores.includes(d.store)) return false;
    if (f.categories.length && !f.categories.includes(d.category)) return false;
    if (f.minPrice !== undefined && (d.price ?? 0) < f.minPrice) return false;
    if (f.maxPrice !== undefined && (d.price ?? Infinity) > f.maxPrice) return false;
    if (f.favoritesOnly && !s.matchedKeywords.length && !s.favoriteCategory) return false;
    if (q && !matchesSearch(`${d.title} ${d.subtitle ?? ''}`, q)) return false;
    if (f.knownSavingOnly && saving(s) <= 0 && s.discount <= 0) return false;
    return true;
  });
  const price = (s: ScoredDeal) => s.deal.price;
  const compare: Record<SortId, (a: ScoredDeal, b: ScoredDeal) => number> = {
    score: (a, b) => b.score - a.score,
    saving: (a, b) => saving(b) - saving(a) || b.discount - a.discount,
    priceAsc: (a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity),
    priceDesc: (a, b) => (price(b) ?? -1) - (price(a) ?? -1),
    ending: (a, b) => (a.deal.validTo ?? '9999').localeCompare(b.deal.validTo ?? '9999'),
  };
  return filtered.sort(compare[f.sort]);
}
