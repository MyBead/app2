import {
  buildShareText,
  itemTextFromDeal,
  matchDeals,
  parseListText,
  planList,
  type ListItem,
} from '../src/core/shoppingList';
import { DEFAULT_PREFERENCES, type Deal } from '../src/core/types';

const NOW = new Date('2026-10-13T12:00:00');

const deal = (store: Deal['store'], title: string, price: number, over: Partial<Deal> = {}): Deal => ({
  id: `${store}:${title}`,
  store,
  title,
  price,
  category: 'other',
  source: 'live',
  ...over,
});

const item = (text: string, over: Partial<ListItem> = {}): ListItem => ({
  id: text,
  text,
  checked: false,
  addedAt: '2026-10-13T10:00:00Z',
  ...over,
});

const DEALS = [
  deal('lidl', 'Masło extra Pilos', 4.99),
  deal('biedronka', 'Masło ekstra Mlekovita', 5.49),
  deal('kaufland', 'Kawa mielona Dallmayr', 19.99),
  deal('biedronka', 'Kawa mielona Lavazza', 14.99),
  deal('kaufland', 'Karma dla kotów z kurczakiem', 3.99, { category: 'pets' }),
  deal('kaufland', 'Filet z piersi kurczaka', 16.99),
  deal('lidl', 'Kawa ziarnista stara', 9.99, { validTo: '2026-10-10' }),
];

describe('matchDeals', () => {
  it('finds current matches cheapest first and skips pet food for food items', () => {
    expect(matchDeals('kawa', DEALS).map((d) => d.title)).toEqual([
      'Kawa ziarnista stara',
      'Kawa mielona Lavazza',
      'Kawa mielona Dallmayr',
    ]);
    expect(matchDeals('kurczak', DEALS).map((d) => d.title)).toEqual(['Filet z piersi kurczaka']);
  });
});

describe('planList', () => {
  it('picks the cheapest current deal per item and groups the trip by store', () => {
    const plan = planList(
      [item('masło'), item('kawa'), item('kurczak'), item('chleb'), item('jajka', { checked: true })],
      DEALS,
      DEFAULT_PREFERENCES,
      NOW,
    );
    expect(plan.stops.map((s) => [s.store, s.items.map((i) => i.best?.title), s.total])).toEqual([
      ['kaufland', ['Filet z piersi kurczaka'], 16.99],
      ['biedronka', ['Kawa mielona Lavazza'], 14.99],
      ['lidl', ['Masło extra Pilos'], 4.99],
    ]);
    expect(plan.noDeal.map((p) => p.item.text)).toEqual(['chleb']);
    expect(plan.checked.map((p) => p.item.text)).toEqual(['jajka']);
    expect(plan.total).toBeCloseTo(36.97);
  });

  it('keeps a deal the user picked even if another store is cheaper', () => {
    const plan = planList(
      [item('kawa', { dealId: 'kaufland:Kawa mielona Dallmayr' })],
      DEALS,
      DEFAULT_PREFERENCES,
      NOW,
    );
    expect(plan.stops[0].store).toBe('kaufland');
    expect(plan.stops[0].items[0]).toMatchObject({ pinned: true });
    expect(plan.stops[0].items[0].best?.title).toBe('Kawa mielona Dallmayr');
  });

  it('falls back to the cheapest match when the picked deal has expired', () => {
    const plan = planList([item('kawa', { dealId: 'lidl:Kawa ziarnista stara' })], DEALS, DEFAULT_PREFERENCES, NOW);
    expect(plan.stops[0].items[0]).toMatchObject({ pinned: false });
    expect(plan.stops[0].items[0].best?.title).toBe('Kawa mielona Lavazza');
  });

  it('respects disabled stores', () => {
    const plan = planList([item('masło')], DEALS, { ...DEFAULT_PREFERENCES, stores: ['biedronka'] }, NOW);
    expect(plan.stops[0].items[0].best?.title).toBe('Masło ekstra Mlekovita');
  });
});

describe('trip options', () => {
  const items = [item('masło'), item('kawa'), item('kurczak')];

  it('limits the trip to N stores, covering as many items as possible at the lowest total', () => {
    const one = planList(items, DEALS, DEFAULT_PREFERENCES, NOW, { maxStores: 1, allowedStores: [] });
    // Kaufland and Biedronka each cover two items; Biedronka's pair is cheaper (20,48 vs 36,98 zł).
    expect(one.stops.map((s) => s.store)).toEqual(['biedronka']);
    expect(one.stops[0].items.map((p) => p.best?.title)).toEqual(['Masło ekstra Mlekovita', 'Kawa mielona Lavazza']);
    expect(one.noDeal.map((p) => p.item.text)).toEqual(['kurczak']);

    const two = planList(items, DEALS, DEFAULT_PREFERENCES, NOW, { maxStores: 2, allowedStores: [] });
    expect(two.stops.map((s) => s.store).sort()).toEqual(['biedronka', 'kaufland']);
    expect(two.noDeal).toEqual([]);
  });

  it('keeps pinned stores within the limit', () => {
    const pinned = [item('masło', { dealId: 'lidl:Masło extra Pilos' }), item('kawa'), item('kurczak')];
    const plan = planList(pinned, DEALS, DEFAULT_PREFERENCES, NOW, { maxStores: 2, allowedStores: [] });
    expect(plan.stops.map((s) => s.store).sort()).toEqual(['kaufland', 'lidl']);
  });

  it('uses only the allowed stores', () => {
    const plan = planList(items, DEALS, DEFAULT_PREFERENCES, NOW, { maxStores: null, allowedStores: ['biedronka'] });
    expect(plan.stops.map((s) => s.store)).toEqual(['biedronka']);
    expect(plan.noDeal.map((p) => p.item.text)).toEqual(['kurczak']);
  });
});

describe('itemTextFromDeal', () => {
  it('drops pack sizes and trademark signs', () => {
    expect(itemTextFromDeal(deal('lidl', 'Masło extra Pilos 200 g', 4.99))).toBe('masło extra pilos');
    expect(itemTextFromDeal(deal('lidl', 'LIVARNO® Lampa stojąca LED', 55.9))).toBe('livarno lampa stojąca led');
  });
});

describe('share and import', () => {
  const money = (n?: number) => (n === undefined ? '' : `${n.toFixed(2).replace('.', ',')} zł`);
  const names = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  it('round-trips a shared list', () => {
    const plan = planList([item('masło'), item('kawa'), item('chleb')], DEALS, DEFAULT_PREFERENCES, NOW);
    const text = buildShareText(plan, names, money);
    expect(text).toContain('Lidl — 4,99 zł\n• masło — Masło extra Pilos, 4,99 zł');
    expect(text).toContain('Без акций\n• chleb');
    expect(parseListText(text).sort()).toEqual(['chleb', 'kawa', 'masło']);
  });

  it('reads plain lines and comma-separated words', () => {
    expect(parseListText('Masło\nkawa, jajka\n\n')).toEqual(['masło', 'kawa', 'jajka']);
  });
});
