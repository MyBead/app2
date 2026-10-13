import {
  EMPTY_NOTIFY_STATE,
  inQuietHours,
  markNotified,
  markSeen,
  nextAllowedTime,
  planNotification,
  plural,
} from '../src/core/notify';
import { DEFAULT_PREFERENCES, type Deal, type Preferences } from '../src/core/types';

const at = (iso: string) => new Date(iso);
const NOON = at('2026-10-13T12:00:00');

const deal = (title: string, discountPercent: number, over: Partial<Deal> = {}): Deal => ({
  id: `biedronka:${title}`,
  store: 'biedronka',
  title,
  price: 5,
  discountPercent,
  category: 'other',
  source: 'live',
  ...over,
});

const prefs = (over: Partial<Preferences> = {}): Preferences => ({ ...DEFAULT_PREFERENCES, minDiscount: 30, ...over });

describe('quiet hours', () => {
  const n = DEFAULT_PREFERENCES.notifications; // 22 → 8

  it('handles a window that crosses midnight', () => {
    expect(inQuietHours(n, at('2026-10-13T23:30:00'))).toBe(true);
    expect(inQuietHours(n, at('2026-10-13T03:00:00'))).toBe(true);
    expect(inQuietHours(n, at('2026-10-13T08:00:00'))).toBe(false);
    expect(inQuietHours(n, NOON)).toBe(false);
  });

  it('postpones to the end of quiet hours', () => {
    expect(nextAllowedTime(n, NOON)).toBeNull();
    expect(nextAllowedTime(n, at('2026-10-13T23:30:00'))).toEqual(at('2026-10-14T08:00:00'));
    expect(nextAllowedTime(n, at('2026-10-14T03:00:00'))).toEqual(at('2026-10-14T08:00:00'));
  });

  it('treats equal start and end as "no quiet hours"', () => {
    expect(inQuietHours({ ...n, quietStart: 0, quietEnd: 0 }, at('2026-10-13T03:00:00'))).toBe(false);
  });
});

describe('planNotification', () => {
  const deals = [deal('Masło', 40), deal('Kawa', 50), deal('Chleb', 10)];

  it('notifies about hot deals, best first', () => {
    const plan = planNotification(deals, prefs(), EMPTY_NOTIFY_STATE, NOON)!;
    expect(plan.deals.map((s) => s.deal.title)).toEqual(['Kawa', 'Masło']);
    expect(plan.title).toBe('🔥 2 новые выгодные акции');
    expect(plan.body).toBe('Biedronka: Kawa · −50% · 5,00 zł\nBiedronka: Masło · −40% · 5,00 zł');
    expect(plan.deliverAt).toBeNull();
  });

  it('names the store when there is a single deal', () => {
    const plan = planNotification([deal('Kawa', 50)], prefs(), EMPTY_NOTIFY_STATE, NOON)!;
    expect(plan.title).toBe('🔥 Выгодная акция в Biedronka');
  });

  it('never repeats deals already notified or seen', () => {
    const first = planNotification(deals, prefs(), EMPTY_NOTIFY_STATE, NOON)!;
    const state = markNotified(EMPTY_NOTIFY_STATE, first, NOON);
    expect(planNotification(deals, prefs(), state, NOON)).toBeNull();

    const more = [...deals, deal('Schab', 35)];
    expect(planNotification(more, prefs(), state, NOON)!.deals.map((s) => s.deal.title)).toEqual(['Schab']);

    const seen = markSeen(state, ['biedronka:Schab'], NOON);
    expect(planNotification(more, prefs(), seen, NOON)).toBeNull();
  });

  it('respects the daily limit', () => {
    let state = EMPTY_NOTIFY_STATE;
    const p = prefs({ notifications: { ...DEFAULT_PREFERENCES.notifications, maxPerDay: 1 } });
    state = markNotified(state, planNotification([deal('A', 50)], p, state, NOON)!, NOON);
    expect(planNotification([deal('B', 50)], p, state, NOON)).toBeNull();
    // Next day is fine again.
    expect(planNotification([deal('B', 50)], p, state, at('2026-10-14T12:00:00'))).not.toBeNull();
  });

  it('schedules for the morning during quiet hours', () => {
    const plan = planNotification(deals, prefs(), EMPTY_NOTIFY_STATE, at('2026-10-13T23:00:00'))!;
    expect(plan.deliverAt).toEqual(at('2026-10-14T08:00:00'));
  });

  it('does nothing when notifications are off', () => {
    const p = prefs({ notifications: { ...DEFAULT_PREFERENCES.notifications, enabled: false } });
    expect(planNotification(deals, p, EMPTY_NOTIFY_STATE, NOON)).toBeNull();
  });

  it('forgets old notified deals after 30 days', () => {
    const plan = planNotification([deal('A', 50)], prefs(), EMPTY_NOTIFY_STATE, NOON)!;
    const state = markNotified(EMPTY_NOTIFY_STATE, plan, NOON);
    const later = markSeen(state, [], at('2026-11-20T12:00:00'));
    expect(later.notified).toEqual({});
    expect(later.sentPerDay).toEqual({});
  });
});

describe('plural', () => {
  it.each([
    [1, 'акция'],
    [2, 'акции'],
    [5, 'акций'],
    [11, 'акций'],
    [21, 'акция'],
    [22, 'акции'],
    [112, 'акций'],
  ])('%i → %s', (n, word) => {
    expect(plural(n, 'акция', 'акции', 'акций')).toBe(word);
  });
});
