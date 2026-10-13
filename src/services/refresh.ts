import { EMPTY_NOTIFY_STATE, markNotified, markSeen, planNotification, type NotificationPlan } from '../core/notify';
import { rankDeals } from '../core/scoring';
import type { Preferences } from '../core/types';
import { fetchAllDeals, pruneLeafletCache, type StoreResult } from '../providers';
import { deliver, hasPermission } from './notifications';
import {
  loadLeafletCache,
  loadNotifyState,
  loadPreferences,
  loadResults,
  saveLeafletCache,
  saveNotifyState,
  saveResults,
} from './storage';

/**
 * Loads fresh offers. A store that fails this time keeps its last good result, so a
 * flaky connection doesn't wipe the list.
 */
export async function refreshDeals(prefs: Preferences): Promise<StoreResult[]> {
  const [cache, previous] = await Promise.all([loadLeafletCache(), loadResults()]);
  const fresh = await fetchAllDeals(prefs, cache);
  await saveLeafletCache(pruneLeafletCache(cache));
  const merged = fresh.map((r) => {
    if (r.deals.length > 0) return r;
    const old = previous.find(
      (p) => p.store === r.store && p.deals.length > 0 && p.deals[0].source === (prefs.useDemoData ? 'demo' : 'live'),
    );
    return old ? { ...old, error: r.error } : r;
  });
  await saveResults(merged);
  return merged;
}

/** Sends a notification about new hot deals, if any. Returns what was sent. */
export async function notifyAboutNewDeals(
  results: StoreResult[],
  prefs: Preferences,
): Promise<NotificationPlan | null> {
  if (!prefs.notifications.enabled || !(await hasPermission())) return null;
  const state = await loadNotifyState();
  const plan = planNotification(
    results.flatMap((r) => r.deals),
    prefs,
    state,
  );
  if (!plan) return null;
  await deliver(plan);
  await saveNotifyState(markNotified(state, plan));
  return plan;
}

/** Called when the user looks at the list in the app: current hot deals are no longer news. */
export async function markHotDealsSeen(results: StoreResult[], prefs: Preferences): Promise<void> {
  const hot = rankDeals(
    results.flatMap((r) => r.deals),
    prefs,
  ).filter((s) => s.hot);
  await saveNotifyState(
    markSeen(
      await loadNotifyState(),
      hot.map((s) => s.deal.id),
    ),
  );
}

/** Shows right now what a notification about the current hot deals looks like (history untouched). */
export async function sendPreviewNotification(results: StoreResult[], prefs: Preferences): Promise<boolean> {
  const plan = planNotification(
    results.flatMap((r) => r.deals),
    { ...prefs, notifications: { enabled: true, quietStart: 0, quietEnd: 0, maxPerDay: Infinity } },
    EMPTY_NOTIFY_STATE,
  );
  if (!plan) return false;
  await deliver(plan);
  return true;
}

/** The whole background job: refresh, then notify. */
export async function backgroundCheck(): Promise<void> {
  const prefs = await loadPreferences();
  if (!prefs.notifications.enabled) return;
  const results = await refreshDeals(prefs);
  await notifyAboutNewDeals(results, prefs);
}
