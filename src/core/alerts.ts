/**
 * Notifications the user asked for explicitly: price watches and shopping-list reminders.
 * Each alert has a stable key and is sent once.
 */
import { formatPrice } from './price';
import { isoDate, isVisible } from './scoring';
import { matchDeals, planList, type ListItem, type TripOptions } from './shoppingList';
import { STORES } from './stores';
import type { Deal, Preferences } from './types';

export interface PriceWatch {
  id: string;
  /** What to look for, in Polish ("kawa lavazza", "telewizor lg 55"). */
  text: string;
  /** Notify when a matching deal costs at most this; undefined = any deal. */
  maxPrice?: number;
  createdAt: string;
}

export interface AlertState {
  /** Alert key → ISO time sent. */
  sent: Record<string, string>;
  /** List items' matching deal ids already known (so only new ones are announced). */
  knownListDeals: string[];
  initialized: boolean;
}

export const EMPTY_ALERT_STATE: AlertState = { sent: {}, knownListDeals: [], initialized: false };

export interface Alert {
  kind: 'watch' | 'ending' | 'listNew';
  title: string;
  body: string;
  keys: string[];
}

/** Current deals satisfying a watch, cheapest first. */
export function watchMatches(watch: PriceWatch, deals: Deal[], prefs: Preferences, now = new Date()): Deal[] {
  return matchDeals(
    watch.text,
    deals.filter((d) => isVisible(d, prefs, now)),
  ).filter((d) => d.price !== undefined && (watch.maxPrice === undefined || d.price <= watch.maxPrice + 0.001));
}

const line = (d: Deal) => `${STORES[d.store].name}: ${d.title} — ${formatPrice(d.price)}`;

export function planAlerts(
  input: { deals: Deal[]; prefs: Preferences; list: ListItem[]; trip: TripOptions; watches: PriceWatch[] },
  state: AlertState,
  now = new Date(),
): { alerts: Alert[]; state: AlertState } {
  const { deals, prefs, list, trip, watches } = input;
  const alerts: Alert[] = [];
  const isNew = (key: string) => !state.sent[key];

  // 1. Price watches.
  for (const w of watches) {
    const hits = watchMatches(w, deals, prefs, now).filter((d) => isNew(`watch:${w.id}:${d.id}`));
    if (hits.length === 0) continue;
    alerts.push({
      kind: 'watch',
      title: `🎯 «${w.text}»${w.maxPrice !== undefined ? ` до ${formatPrice(w.maxPrice)}` : ''}: есть акция`,
      body: hits.slice(0, 4).map(line).join('\n'),
      keys: hits.map((d) => `watch:${w.id}:${d.id}`),
    });
  }

  // 2. List deals ending tomorrow (or today).
  const today = isoDate(now);
  const tomorrow = isoDate(new Date(now.getTime() + 86_400_000));
  const plan = planList(list, deals, prefs, now, trip);
  const ending = plan.stops
    .flatMap((s) => s.items)
    .filter((p) => p.best?.validTo && (p.best.validTo === tomorrow || p.best.validTo === today))
    .filter((p) => isNew(`ending:${p.item.id}:${p.best!.id}`));
  if (ending.length > 0) {
    alerts.push({
      kind: 'ending',
      title: `⏰ Скоро закончатся акции из вашего списка (${ending.length})`,
      body: ending
        .slice(0, 5)
        .map((p) => `${p.item.text} — ${line(p.best!)}${p.best!.validTo === today ? ' (сегодня последний день)' : ''}`)
        .join('\n'),
      keys: ending.map((p) => `ending:${p.item.id}:${p.best!.id}`),
    });
  }

  // 3. New deals on list items (new leaflets). The first run only learns what exists.
  const known = new Set(state.knownListDeals);
  const visible = deals.filter((d) => isVisible(d, prefs, now));
  const fresh: { item: ListItem; deal: Deal }[] = [];
  const nowKnown = new Set<string>();
  for (const item of list.filter((i) => !i.checked)) {
    for (const d of matchDeals(item.text, visible)) {
      nowKnown.add(d.id);
      if (state.initialized && !known.has(d.id)) fresh.push({ item, deal: d });
    }
  }
  if (fresh.length > 0) {
    const byItem = new Map<string, { item: ListItem; deal: Deal }>();
    for (const f of fresh) {
      const cur = byItem.get(f.item.id);
      if (!cur || (f.deal.price ?? Infinity) < (cur.deal.price ?? Infinity)) byItem.set(f.item.id, f);
    }
    alerts.push({
      kind: 'listNew',
      title: `🆕 Новые акции на товары из списка (${byItem.size})`,
      body: [...byItem.values()]
        .slice(0, 5)
        .map((f) => `${f.item.text} — ${line(f.deal)}`)
        .join('\n'),
      keys: [],
    });
  }

  const stamp = now.toISOString();
  const cutoff = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const sent: Record<string, string> = {};
  for (const [k, at] of Object.entries(state.sent)) if (at >= cutoff) sent[k] = at;
  for (const a of alerts) for (const k of a.keys) sent[k] = stamp;
  return {
    alerts,
    state: { sent, knownListDeals: [...new Set([...known, ...nowKnown])].slice(-3000), initialized: true },
  };
}
