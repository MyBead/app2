import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  crossStorePrices,
  priceInsight,
  type OtherStorePrice,
  type PriceHistory,
  type PriceInsight,
} from '../core/compare';
import { rankDeals, type ScoredDeal } from '../core/scoring';
import type { Deal, Preferences } from '../core/types';
import type { StoreResult } from '../providers';
import { setBackgroundChecks } from '../services/backgroundTask';
import { ensurePermission, setupNotificationChannel } from '../services/notifications';
import { markHotDealsSeen, refreshDeals, sendListAndWatchAlerts } from '../services/refresh';
import { loadPreferences, loadPriceHistory, loadResults, savePreferences } from '../services/storage';

interface DealsState {
  ready: boolean;
  prefs: Preferences;
  results: StoreResult[];
  ranked: ScoredDeal[];
  refreshing: boolean;
  lastError?: string;
  /** All loaded deals by id (including ones hidden by filters). */
  dealById: Map<string, Deal>;
  /** How this deal's price compares: regular price, other chains or earlier prices. */
  insightFor: (deal: Deal) => PriceInsight;
  /** The same product in other chains right now, cheapest first. */
  othersFor: (dealId: string) => OtherStorePrice[];
  /** Prices this app has seen for the deal, oldest first. */
  historyFor: (dealId: string) => PriceHistory[string];
  refresh: () => Promise<void>;
  updatePrefs: (patch: Partial<Preferences> | ((p: Preferences) => Preferences)) => void;
}

const Ctx = createContext<DealsState | null>(null);

export function DealsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [results, setResults] = useState<StoreResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string>();
  const [history, setHistory] = useState<PriceHistory>({});
  const prefsRef = useRef<Preferences | null>(null);

  const refresh = useCallback(async () => {
    const p = prefsRef.current;
    if (!p) return;
    setRefreshing(true);
    setLastError(undefined);
    try {
      const fresh = await refreshDeals(p);
      setResults(fresh);
      setHistory(await loadPriceHistory());
      // The user is looking at the app, so these deals are already known — the background
      // check will only notify about ones that appear later.
      await markHotDealsSeen(fresh, p);
      // Watches and list reminders were asked for explicitly — send them even while the app is open.
      await sendListAndWatchAlerts(fresh, p).catch(() => 0);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [p, cached, h] = await Promise.all([loadPreferences(), loadResults(), loadPriceHistory()]);
      setHistory(h);
      prefsRef.current = p;
      setPrefs(p);
      setResults(cached);
      setReady(true);
      await setupNotificationChannel().catch(() => {});
      if (p.notifications.enabled) {
        await ensurePermission().catch(() => false);
        await setBackgroundChecks(true).catch(() => false);
      }
      const stale = cached.length === 0 || cached.some((r) => Date.now() - Date.parse(r.fetchedAt) > 60 * 60 * 1000);
      if (stale) await refresh();
    })();
  }, [refresh]);

  const updatePrefs = useCallback<DealsState['updatePrefs']>(
    (patch) => {
      const prev = prefsRef.current;
      if (!prev) return;
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      prefsRef.current = next;
      setPrefs(next);
      savePreferences(next).catch(() => {});

      if (next.notifications.enabled !== prev.notifications.enabled) {
        if (next.notifications.enabled) ensurePermission().catch(() => false);
        setBackgroundChecks(next.notifications.enabled).catch(() => false);
      }
      // A different data source means the cached list is from the wrong place.
      const sourceChanged =
        next.useDemoData !== prev.useDemoData ||
        next.stores.some((s) => !prev.stores.includes(s)) ||
        JSON.stringify(next.customSourceUrls) !== JSON.stringify(prev.customSourceUrls);
      if (sourceChanged) refresh();
    },
    [refresh],
  );

  const ranked = useMemo(
    () =>
      prefs
        ? rankDeals(
            results.flatMap((r) => r.deals),
            prefs,
          )
        : [],
    [results, prefs],
  );

  const allDeals = useMemo(() => results.flatMap((r) => r.deals), [results]);
  const dealById = useMemo(() => new Map(allDeals.map((d) => [d.id, d])), [allDeals]);
  const others = useMemo(() => crossStorePrices(allDeals), [allDeals]);
  const insightFor = useCallback(
    (deal: Deal) => priceInsight(deal, others.get(deal.id), history[deal.id]),
    [others, history],
  );

  const othersFor = useCallback((dealId: string) => others.get(dealId) ?? [], [others]);
  const historyFor = useCallback((dealId: string) => history[dealId] ?? [], [history]);

  const value = useMemo<DealsState | null>(
    () =>
      prefs
        ? {
            ready,
            prefs,
            results,
            ranked,
            refreshing,
            lastError,
            dealById,
            insightFor,
            othersFor,
            historyFor,
            refresh,
            updatePrefs,
          }
        : null,
    [
      ready,
      prefs,
      results,
      ranked,
      refreshing,
      lastError,
      dealById,
      insightFor,
      othersFor,
      historyFor,
      refresh,
      updatePrefs,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeals(): DealsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDeals outside DealsProvider (or before preferences loaded)');
  return v;
}

/** Null until preferences are loaded — for the root layout's splash gate. */
export function useDealsMaybe(): DealsState | null {
  return useContext(Ctx);
}
