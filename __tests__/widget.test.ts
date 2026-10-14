import { dealLink, widgetRows } from '../src/core/widget';
import { DEFAULT_PREFERENCES, type Deal } from '../src/core/types';

const deal = (over: Partial<Deal>): Deal => ({
  id: 'x',
  store: 'lidl',
  title: 'Masło extra',
  category: 'dairy',
  source: 'live',
  ...over,
});

describe('home-screen widget', () => {
  const now = new Date('2026-10-14T10:00:00');

  it('shows the best deals with store, price and badge', () => {
    const rows = widgetRows(
      [
        deal({ id: 'a', price: 5.99, oldPrice: 9.99 }),
        deal({
          id: 'b',
          store: 'biedronka',
          title: 'Kawa',
          category: 'drinks',
          price: 19.99,
          promoLabel: 'Super cena',
        }),
        deal({ id: 'c', store: 'zabka', title: 'Hidden', validTo: '2026-10-01' }),
      ],
      { ...DEFAULT_PREFERENCES, stores: ['lidl', 'biedronka', 'zabka'] },
      now,
    );
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b']);
    const a = rows.find((r) => r.id === 'a')!;
    expect(a).toMatchObject({ store: 'Lidl', price: '5,99 zł', badge: '−40%' });
    expect(rows.find((r) => r.id === 'b')!.badge).toBe('Super cena');
  });

  it('links to the deal screen', () => {
    expect(dealLink('lidl:Masło 200 g')).toBe('okazje://deal/lidl%3AMas%C5%82o%20200%20g');
  });
});
