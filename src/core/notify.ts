import { STORES } from './stores';
import { formatPrice } from './price';
import { isoDate, rankDeals, type ScoredDeal } from './scoring';
import type { Deal, NotificationPrefs, Preferences } from './types';

export interface NotifyState {
  /** Deal id → ISO timestamp when the user was told about it. */
  notified: Record<string, string>;
  /** yyyy-mm-dd → notifications sent that day. */
  sentPerDay: Record<string, number>;
}

export const EMPTY_NOTIFY_STATE: NotifyState = { notified: {}, sentPerDay: {} };

export const MAX_DEALS_PER_NOTIFICATION = 5;
const FORGET_AFTER_DAYS = 30;

export interface NotificationPlan {
  deals: ScoredDeal[];
  title: string;
  body: string;
  /** When to show it; `null` = now. Set when "now" falls inside quiet hours. */
  deliverAt: Date | null;
}

export function inQuietHours(n: NotificationPrefs, now: Date): boolean {
  const h = now.getHours();
  if (n.quietStart === n.quietEnd) return false;
  return n.quietStart < n.quietEnd ? h >= n.quietStart && h < n.quietEnd : h >= n.quietStart || h < n.quietEnd;
}

/** First moment after `now` that is outside quiet hours. */
export function nextAllowedTime(n: NotificationPrefs, now: Date): Date | null {
  if (!inQuietHours(n, now)) return null;
  const at = new Date(now);
  at.setHours(n.quietEnd, 0, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Decides whether to notify and about what: hot deals the user hasn't been told about,
 * best first, respecting the daily cap. Returns null when there is nothing to send.
 */
export function planNotification(
  deals: Deal[],
  prefs: Preferences,
  state: NotifyState,
  now = new Date(),
): NotificationPlan | null {
  if (!prefs.notifications.enabled) return null;
  const deliverAt = nextAllowedTime(prefs.notifications, now);
  const day = isoDate(deliverAt ?? now);
  if ((state.sentPerDay[day] ?? 0) >= prefs.notifications.maxPerDay) return null;

  const fresh = rankDeals(deals, prefs, now).filter((s) => s.hot && !state.notified[s.deal.id]);
  if (fresh.length === 0) return null;

  const top = fresh.slice(0, MAX_DEALS_PER_NOTIFICATION);
  const title =
    fresh.length === 1
      ? `🔥 Выгодная акция в ${STORES[top[0].deal.store].name}`
      : `🔥 ${fresh.length} ${plural(fresh.length, 'новая выгодная акция', 'новые выгодные акции', 'новых выгодных акций')}`;
  const body = top.map(describe).join('\n');
  return { deals: fresh, title, body, deliverAt };
}

export function describe(s: ScoredDeal): string {
  const d = s.deal;
  const parts = [`${STORES[d.store].name}: ${d.title}`];
  if (s.discount > 0) parts.push(`−${s.discount}%`);
  else if (d.promoLabel) parts.push(d.promoLabel);
  if (d.price) parts.push(formatPrice(d.price));
  return parts.join(' · ');
}

function prune(state: NotifyState, now: Date): NotifyState {
  const cutoff = new Date(now.getTime() - FORGET_AFTER_DAYS * 86_400_000).toISOString();
  const notified: Record<string, string> = {};
  for (const [id, at] of Object.entries(state.notified)) if (at >= cutoff) notified[id] = at;
  const cutoffDay = isoDate(new Date(now.getTime() - 7 * 86_400_000));
  const sentPerDay: Record<string, number> = {};
  for (const [d, n] of Object.entries(state.sentPerDay)) if (d >= cutoffDay) sentPerDay[d] = n;
  return { notified, sentPerDay };
}

/** Remembers deals the user already knows about (saw in the app), so they aren't notified later. */
export function markSeen(state: NotifyState, ids: string[], now = new Date()): NotifyState {
  const next = prune(state, now);
  const stamp = now.toISOString();
  for (const id of ids) next.notified[id] ??= stamp;
  return next;
}

/** Records a sent notification and forgets deals older than 30 days. */
export function markNotified(state: NotifyState, plan: NotificationPlan, now = new Date()): NotifyState {
  // Every fresh hot deal counts as told — the notification says "N new deals" and the app lists them all.
  const next = markSeen(
    state,
    plan.deals.map((s) => s.deal.id),
    now,
  );
  const day = isoDate(plan.deliverAt ?? now);
  next.sentPerDay[day] = (next.sentPerDay[day] ?? 0) + 1;
  return next;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
