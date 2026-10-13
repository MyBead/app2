import { activeFilterCount, applyFilter, EMPTY_FILTER, provenSaving } from '../src/core/filter';
import { priceInsight } from '../src/core/compare';
import { scoreDeal, type ScoredDeal } from '../src/core/scoring';
import { DEFAULT_PREFERENCES, type Deal } from '../src/core/types';

const NOW = new Date('2026-10-13T12:00:00');
const prefs = { ...DEFAULT_PREFERENCES, keywords: ['kawa'] };

const deal = (store: Deal['store'], title: string, price: number, over: Partial<Deal> = {}): ScoredDeal =>
  scoreDeal({ id: `${store}:${title}`, store, title, price, category: 'other', source: 'live', ...over }, prefs, NOW);

const ITEMS = [
  deal('lidl', 'Kawa mielona', 19.99, { oldPrice: 29.99, category: 'drinks' }),
  deal('biedronka', 'Masło', 5.49, { category: 'dairy' }),
  deal('mediamarkt', 'Laptop Lenovo', 1999, { category: 'electronics' }),
  deal('euro', 'Telewizor Samsung 55"', 2499, { category: 'electronics', validTo: '2026-10-14' }),
];
const insight = (s: ScoredDeal) => priceInsight(s.deal, undefined, undefined);
const titles = (f: Partial<typeof EMPTY_FILTER>) =>
  applyFilter(ITEMS, { ...EMPTY_FILTER, ...f }, insight).map((s) => s.deal.title);

describe('applyFilter', () => {
  it('filters by store group, store and category', () => {
    expect(titles({ group: 'electronics' })).toEqual(['Telewizor Samsung 55"', 'Laptop Lenovo']);
    expect(titles({ group: 'grocery', stores: ['biedronka'] })).toEqual(['Masło']);
    expect(titles({ categories: ['dairy', 'drinks'] })).toEqual(['Kawa mielona', 'Masło']);
  });

  it('filters by price range, known saving, favourites and search', () => {
    expect(titles({ maxPrice: 20 })).toEqual(['Kawa mielona', 'Masło']);
    expect(titles({ minPrice: 2000 })).toEqual(['Telewizor Samsung 55"']);
    expect(titles({ knownSavingOnly: true })).toEqual(['Kawa mielona']);
    expect(titles({ favoritesOnly: true })).toEqual(['Kawa mielona']);
    expect(titles({ query: 'lapt' })).toEqual(['Laptop Lenovo']);
  });

  it('sorts by price, saving and end date', () => {
    expect(titles({ sort: 'priceAsc' })).toEqual(['Masło', 'Kawa mielona', 'Laptop Lenovo', 'Telewizor Samsung 55"']);
    expect(titles({ sort: 'priceDesc' })[0]).toBe('Telewizor Samsung 55"');
    expect(titles({ sort: 'saving' })[0]).toBe('Kawa mielona');
    expect(titles({ sort: 'ending' })[0]).toBe('Telewizor Samsung 55"');
  });

  it('counts active filters for the filter button', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTER, group: 'electronics', maxPrice: 50, knownSavingOnly: true })).toBe(3);
  });

  it('treats "cheaper elsewhere" as no proven saving', () => {
    expect(provenSaving({ kind: 'cheaperElsewhere', amount: 3, store: 'lidl', price: 2 })).toBe(0);
    expect(provenSaving({ kind: 'cheapest', amount: 3, store: 'lidl' })).toBe(3);
  });
});
