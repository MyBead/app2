import { crossStorePrices, priceInsight, productTokens, recordPrices, sameProduct } from '../src/core/compare';
import type { Deal } from '../src/core/types';

const deal = (store: Deal['store'], title: string, price?: number, over: Partial<Deal> = {}): Deal => ({
  id: `${store}:${title}`,
  store,
  title,
  price,
  category: 'other',
  source: 'live',
  ...over,
});

describe('product matching across chains', () => {
  it('ignores pack sizes and stop words', () => {
    expect(productTokens('Kawa mielona Jacobs Krönung 500 g')).toEqual(['kawa', 'mielona', 'jacobs', 'kronung']);
  });

  it.each([
    ['Kawa mielona Jacobs Krönung', 'Kawa mielona Jacobs Krönung 250 g', true],
    ['Napój gazowany Pepsi Zero Cukru', 'Napój gazowany Pepsi Zero', true],
    ['Kawa mielona Jacobs Krönung', 'Kawa mielona Lavazza Qualità Rossa', false],
    ['Banany', 'Banany', false], // too vague
    ['Masło extra Pilos', 'Ser Gouda Pilos', false],
  ])('%s ~ %s → %p', (a, b, expected) => {
    expect(sameProduct(productTokens(a), productTokens(b))).toBe(expected);
  });
});

describe('crossStorePrices', () => {
  it('lists the cheapest same product in each other chain', () => {
    const map = crossStorePrices([
      deal('zabka', 'Kawa mielona Jacobs Krönung', 31.99),
      deal('kaufland', 'Kawa mielona Jacobs Krönung 500 g', 24.99),
      deal('biedronka', 'Kawa mielona Jacobs Krönung', 26.49),
      deal('biedronka', 'Kawa mielona Jacobs Krönung Intense', 22.99),
      deal('lidl', 'Kawa mielona Lavazza', 14.99),
    ]);
    const others = map.get('zabka:Kawa mielona Jacobs Krönung')!;
    expect(others.map((o) => [o.store, o.price, o.dealId])).toEqual([
      ['biedronka', 22.99, 'biedronka:Kawa mielona Jacobs Krönung Intense'],
      ['kaufland', 24.99, 'kaufland:Kawa mielona Jacobs Krönung 500 g'],
    ]);
    expect(others[0].ratio).toBeCloseTo(22.99 / 31.99);
    expect(map.has('lidl:Kawa mielona Lavazza')).toBe(false);
  });
});

describe('priceInsight', () => {
  const d = deal('zabka', 'Kawa', 30);

  it('prefers the store’s own regular price', () => {
    expect(priceInsight({ ...d, oldPrice: 40 }, [], undefined)).toEqual({ kind: 'saving', amount: 10, percent: 25 });
  });

  it('explains multi-buy mechanics as an average saving per item', () => {
    expect(priceInsight({ ...d, promoLabel: '1+1 gratis' }, [], undefined)).toEqual({
      kind: 'mechanic',
      amount: 15,
      percent: 50,
      label: '1+1 gratis',
    });
  });

  it('says where it is cheaper, or by how much this store wins', () => {
    const cheaper = priceInsight(d, [{ store: 'lidl', price: 25, dealId: 'x', ratio: 25 / 30 }], undefined);
    expect(cheaper).toMatchObject({ kind: 'cheaperElsewhere', store: 'lidl', price: 25 });
    expect(cheaper.kind === 'cheaperElsewhere' && cheaper.amount).toBeCloseTo(5);
    const wins = priceInsight(
      d,
      [
        { store: 'lidl', price: 30, dealId: 'x', ratio: 1 },
        { store: 'kaufland', price: 34, dealId: 'y', ratio: 34 / 30 },
      ],
      undefined,
    );
    expect(wins).toMatchObject({ kind: 'cheapest', store: 'kaufland' });
    expect(wins.kind === 'cheapest' && wins.amount).toBeCloseTo(4);
  });

  it('compares per kilo when pack sizes differ', () => {
    const map = crossStorePrices([
      deal('lidl', 'Kawa mielona Lavazza Rossa 250 g', 14.99),
      deal('kaufland', 'Kawa mielona Lavazza Rossa 1 kg', 49.99),
    ]);
    // 59.96 zł/kg vs 49.99 zł/kg: the bigger pack is the better buy despite the higher price.
    const lidl = priceInsight(
      deal('lidl', 'Kawa mielona Lavazza Rossa 250 g', 14.99),
      map.get('lidl:Kawa mielona Lavazza Rossa 250 g'),
      undefined,
    );
    expect(lidl).toMatchObject({ kind: 'cheaperElsewhere', store: 'kaufland' });
  });

  it('falls back to the previous price in this store, then to unknown', () => {
    expect(
      priceInsight(d, undefined, [
        { price: 35, seen: '2026-10-01' },
        { price: 30, seen: '2026-10-13' },
      ]),
    ).toEqual({
      kind: 'history',
      previous: 35,
      amount: 5,
    });
    expect(priceInsight(d, undefined, [{ price: 30, seen: '2026-10-13' }])).toEqual({ kind: 'unknown' });
  });
});

describe('recordPrices', () => {
  it('adds an entry only when the price changes and forgets old ones', () => {
    let h = recordPrices({}, [deal('lidl', 'Kawa', 20)], '2026-10-01');
    h = recordPrices(h, [deal('lidl', 'Kawa', 20)], '2026-10-05');
    expect(h['lidl:Kawa']).toEqual([{ price: 20, seen: '2026-10-05' }]);
    h = recordPrices(h, [deal('lidl', 'Kawa', 17)], '2026-10-13');
    expect(h['lidl:Kawa']).toEqual([
      { price: 20, seen: '2026-10-05' },
      { price: 17, seen: '2026-10-13' },
    ]);
    expect(recordPrices(h, [], '2027-03-01')).toEqual({});
  });
});
