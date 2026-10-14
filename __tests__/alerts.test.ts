import { EMPTY_ALERT_STATE, planAlerts, watchMatches, type PriceWatch } from '../src/core/alerts';
import { DEFAULT_TRIP, type ListItem } from '../src/core/shoppingList';
import { DEFAULT_PREFERENCES, type Deal } from '../src/core/types';

const NOW = new Date('2026-10-13T12:00:00');
const prefs = DEFAULT_PREFERENCES;

const deal = (store: Deal['store'], title: string, price: number, over: Partial<Deal> = {}): Deal => ({
  id: `${store}:${title}`,
  store,
  title,
  price,
  category: 'other',
  source: 'live',
  ...over,
});
const item = (text: string): ListItem => ({ id: text, text, checked: false, addedAt: '2026-10-01T00:00:00Z' });
const watch = (text: string, maxPrice?: number): PriceWatch => ({ id: text, text, maxPrice, createdAt: '' });

const DEALS = [
  deal('biedronka', 'Kawa mielona Lavazza', 14.99, { validTo: '2026-10-14' }),
  deal('kaufland', 'Kawa mielona Lavazza', 17.99),
  deal('lidl', 'Masło extra', 4.99, { validTo: '2026-10-20' }),
];

describe('watchMatches', () => {
  it('finds current deals at or under the target price', () => {
    expect(watchMatches(watch('kawa lavazza', 15), DEALS, prefs, NOW).map((d) => d.store)).toEqual(['biedronka']);
    expect(watchMatches(watch('kawa lavazza'), DEALS, prefs, NOW)).toHaveLength(2);
    expect(watchMatches(watch('kawa lavazza', 10), DEALS, prefs, NOW)).toEqual([]);
  });
});

describe('planAlerts', () => {
  const input = {
    deals: DEALS,
    prefs,
    list: [item('kawa'), item('masło')],
    trip: DEFAULT_TRIP,
    watches: [watch('kawa lavazza', 15)],
  };

  it('sends watch hits and "ends tomorrow" reminders once', () => {
    const first = planAlerts(input, EMPTY_ALERT_STATE, NOW);
    expect(first.alerts.map((a) => a.kind)).toEqual(['watch', 'ending']);
    expect(first.alerts[0].body).toBe('Biedronka: Kawa mielona Lavazza — 14,99 zł');
    expect(first.alerts[1].body).toContain('kawa — Biedronka: Kawa mielona Lavazza');
    const second = planAlerts(input, first.state, NOW);
    expect(second.alerts).toEqual([]);
  });

  it('announces new deals on list items, but not on the first run', () => {
    const first = planAlerts({ ...input, watches: [] }, EMPTY_ALERT_STATE, NOW);
    expect(first.alerts.some((a) => a.kind === 'listNew')).toBe(false);
    const later = planAlerts(
      { ...input, watches: [], deals: [...DEALS, deal('zabka', 'Masło ekstra', 5.99)] },
      first.state,
      NOW,
    );
    const fresh = later.alerts.find((a) => a.kind === 'listNew');
    expect(fresh?.body).toBe('masło — Żabka: Masło ekstra — 5,99 zł');
  });
});
