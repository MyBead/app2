import * as Network from 'expo-network';

import { planAlerts } from '../core/alerts';
import { recordPrices } from '../core/compare';
import {
  EMPTY_NOTIFY_STATE,
  markNotified,
  markSeen,
  nextAllowedTime,
  planNotification,
  type NotificationPlan,
} from '../core/notify';
import { isoDate, rankDeals } from '../core/scoring';
import type { Preferences } from '../core/types';
import { fetchAllDeals, pruneLeafletCache, type StoreResult } from '../providers';
import { deliver, hasPermission, notify } from './notifications';
import {
  loadAlertState,
  loadLeafletCache,
  loadPriceHistory,
  loadNotifyState,
  loadPreferences,
  loadResults,
  loadShoppingList,
  loadTripOptions,
  loadWatches,
  saveAlertState,
  saveLeafletCache,
  savePriceHistory,
  saveNotifyState,
  saveResults,
} from './storage';
import { updateHotDealsWidget } from '../widget/update';

/** Leaflet pages are big; with "Wi-Fi only" on, mobile data uses cached leaflets. */
async function mayDownloadLeaflets(prefs: Preferences): Promise<boolean> {
  if (!prefs.wifiOnlyLeaflets) return true;
  try {
    const state = await Network.getNetworkStateAsync();
    return state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET;
  } catch {
    return true;
  }
}

/**
 * Loads fresh offers. A store that fails this time keeps its last good result, so a
 * flaky connection doesn't wipe the list.
 */
export async function refreshDeals(prefs: Preferences): Promise<StoreResult[]> {
  const [cache, previous] = await Promise.all([loadLeafletCache(), loadResults()]);
  const fresh = await fetchAllDeals(prefs, cache, new Date(), await mayDownloadLeaflets(prefs));
  await saveLeafletCache(pruneLeafletCache(cache));
  const merged = fresh.map((r) => {
    if (r.deals.length > 0) return r;
    const old = previous.find(
      (p) => p.store === r.store && p.deals.length > 0 && p.deals[0].source === (prefs.useDemoData ? 'demo' : 'live'),
    );
    return old ? { ...old, error: r.error } : r;
  });
  await saveResults(merged);
  if (!prefs.useDemoData) {
    const live = fresh.flatMap((r) => r.deals);
    await savePriceHistory(recordPrices(await loadPriceHistory(), live, isoDate(new Date())));
  }
  await updateHotDealsWidget();
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

/**
 * Price watches and shopping-list reminders. These are explicit requests, so they ignore
 * the daily cap, but still wait out quiet hours.
 */
export async function sendListAndWatchAlerts(results: StoreResult[], prefs: Preferences): Promise<number> {
  if (prefs.useDemoData || !(await hasPermission())) return 0;
  const [list, trip, watches, state] = await Promise.all([
    loadShoppingList(),
    loadTripOptions(),
    loadWatches(),
    loadAlertState(),
  ]);
  const { alerts, state: next } = planAlerts(
    { deals: results.flatMap((r) => r.deals), prefs, list, trip, watches },
    state,
  );
  const at = nextAllowedTime(prefs.notifications, new Date());
  for (const a of alerts) await notify(a.title, a.body, at, a.kind === 'watch' ? 'all' : 'list');
  await saveAlertState(next);
  return alerts.length;
}

/** The whole background job: refresh, then notify. */
export async function backgroundCheck(): Promise<void> {
  const prefs = await loadPreferences();
  if (!prefs.notifications.enabled) return;
  const results = await refreshDeals(prefs);
  await notifyAboutNewDeals(results, prefs);
  await sendListAndWatchAlerts(results, prefs);
}
