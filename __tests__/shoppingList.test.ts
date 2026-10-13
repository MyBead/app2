import { itemTextFromDeal, matchDeals, planList, type ListItem } from '../src/core/shoppingList';
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

describe('itemTextFromDeal', () => {
  it('drops pack sizes and trademark signs', () => {
    expect(itemTextFromDeal(deal('lidl', 'Masło extra Pilos 200 g', 4.99))).toBe('masło extra pilos');
    expect(itemTextFromDeal(deal('lidl', 'LIVARNO® Lampa stojąca LED', 55.9))).toBe('livarno lampa stojąca led');
  });
});
