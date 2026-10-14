import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  DEFAULT_TRIP,
  itemTextFromDeal,
  planList,
  type ListItem,
  type ListPlan,
  type TripOptions,
} from '../core/shoppingList';
import type { PriceWatch } from '../core/alerts';
import type { Deal } from '../core/types';
import {
  loadShoppingList,
  loadTripOptions,
  loadWatches,
  saveShoppingList,
  saveTripOptions,
  saveWatches,
} from '../services/storage';
import { useDeals } from './DealsContext';

interface ShoppingListState {
  items: ListItem[];
  plan: ListPlan;
  addText: (text: string) => void;
  addDeal: (deal: Deal) => void;
  /** Pins a specific deal for an item (or unpins with `undefined`). */
  pick: (itemId: string, dealId: string | undefined) => void;
  toggle: (itemId: string) => void;
  remove: (itemId: string) => void;
  clearChecked: () => void;
  hasDeal: (dealId: string) => boolean;
  trip: TripOptions;
  setTrip: (trip: TripOptions) => void;
  watches: PriceWatch[];
  addWatch: (text: string, maxPrice?: number) => void;
  removeWatch: (id: string) => void;
}

const Ctx = createContext<ShoppingListState | null>(null);

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const { results, prefs } = useDeals();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [trip, setTripState] = useState<TripOptions>(DEFAULT_TRIP);
  const [watches, setWatches] = useState<PriceWatch[]>([]);

  useEffect(() => {
    Promise.all([loadShoppingList(), loadTripOptions(), loadWatches()]).then(([saved, savedTrip, savedWatches]) => {
      setItems(saved);
      setTripState(savedTrip);
      setWatches(savedWatches);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveWatches(watches).catch(() => {});
  }, [watches, loaded]);

  const addWatch = useCallback((text: string, maxPrice?: number) => {
    const t = text.trim().toLowerCase();
    if (!t) return;
    setWatches((cur) => [
      ...cur.filter((w) => w.text !== t),
      { id: newId(), text: t, maxPrice, createdAt: new Date().toISOString() },
    ]);
  }, []);
  const removeWatch = useCallback((id: string) => setWatches((cur) => cur.filter((w) => w.id !== id)), []);

  const setTrip = useCallback((next: TripOptions) => {
    setTripState(next);
    saveTripOptions(next).catch(() => {});
  }, []);

  useEffect(() => {
    if (loaded) saveShoppingList(items).catch(() => {});
  }, [items, loaded]);

  const addText = useCallback((text: string) => {
    const entries = text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (entries.length === 0) return;
    const now = new Date().toISOString();
    setItems((cur) => [
      ...cur,
      ...entries
        .filter((t) => !cur.some((i) => !i.checked && i.text.toLowerCase() === t.toLowerCase()))
        .map((t) => ({ id: newId(), text: t, checked: false, addedAt: now })),
    ]);
  }, []);

  const addDeal = useCallback((deal: Deal) => {
    setItems((cur) =>
      cur.some((i) => i.dealId === deal.id)
        ? cur
        : [
            ...cur,
            {
              id: newId(),
              text: itemTextFromDeal(deal),
              dealId: deal.id,
              checked: false,
              addedAt: new Date().toISOString(),
            },
          ],
    );
  }, []);

  const pick = useCallback(
    (itemId: string, dealId: string | undefined) =>
      setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, dealId } : i))),
    [],
  );
  const toggle = useCallback(
    (itemId: string) => setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i))),
    [],
  );
  const remove = useCallback((itemId: string) => setItems((cur) => cur.filter((i) => i.id !== itemId)), []);
  const clearChecked = useCallback(() => setItems((cur) => cur.filter((i) => !i.checked)), []);

  const plan = useMemo(
    () =>
      planList(
        items,
        results.flatMap((r) => r.deals),
        prefs,
        new Date(),
        trip,
      ),
    [items, results, prefs, trip],
  );
  const hasDeal = useCallback((dealId: string) => items.some((i) => i.dealId === dealId), [items]);

  const value = useMemo(
    () => ({
      items,
      plan,
      addText,
      addDeal,
      pick,
      toggle,
      remove,
      clearChecked,
      hasDeal,
      trip,
      setTrip,
      watches,
      addWatch,
      removeWatch,
    }),
    [
      items,
      plan,
      addText,
      addDeal,
      pick,
      toggle,
      remove,
      clearChecked,
      hasDeal,
      trip,
      setTrip,
      watches,
      addWatch,
      removeWatch,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShoppingList(): ShoppingListState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShoppingList outside ShoppingListProvider');
  return v;
}
