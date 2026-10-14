import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  DEFAULT_TRIP,
  itemTextFromDeal,
  planList,
  type ListItem,
  type ListPlan,
  type SavingEntry,
  type TripOptions,
} from '../core/shoppingList';
import type { PriceWatch } from '../core/alerts';
import { provenSaving } from '../core/filter';
import type { Deal } from '../core/types';
import {
  loadFavorites,
  loadSavings,
  loadShoppingList,
  loadTripOptions,
  loadWatches,
  saveFavorites,
  saveSavings,
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
  favorites: string[];
  toggleFavorite: (dealId: string) => void;
  savings: SavingEntry[];
}

const Ctx = createContext<ShoppingListState | null>(null);

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const { results, prefs, insightFor } = useDeals();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [trip, setTripState] = useState<TripOptions>(DEFAULT_TRIP);
  const [watches, setWatches] = useState<PriceWatch[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savings, setSavings] = useState<SavingEntry[]>([]);

  useEffect(() => {
    Promise.all([loadShoppingList(), loadTripOptions(), loadWatches(), loadFavorites(), loadSavings()]).then(
      ([saved, savedTrip, savedWatches, savedFavorites, savedSavings]) => {
        setItems(saved);
        setTripState(savedTrip);
        setWatches(savedWatches);
        setFavorites(savedFavorites);
        setSavings(savedSavings);
        setLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveFavorites(favorites).catch(() => {});
    saveSavings(savings).catch(() => {});
  }, [favorites, savings, loaded]);

  const toggleFavorite = useCallback(
    (dealId: string) =>
      setFavorites((cur) => (cur.includes(dealId) ? cur.filter((x) => x !== dealId) : [...cur, dealId])),
    [],
  );

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
  // Latest plan for `toggle`, which records the saving of the deal being bought.
  const planRef = useRef<ListPlan | null>(null);
  const toggle = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      if (item.checked) {
        setSavings((cur) => cur.filter((e) => e.itemId !== itemId));
      } else {
        const p = planRef.current?.stops.flatMap((s) => s.items).find((x) => x.item.id === itemId);
        const amount = p?.best ? provenSaving(insightFor(p.best)) : 0;
        if (p?.best && amount > 0) {
          setSavings((cur) => [
            ...cur.filter((e) => e.itemId !== itemId),
            { itemId, title: p.best!.title, store: p.best!.store, amount, at: new Date().toISOString() },
          ]);
        }
      }
      setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)));
    },
    [items, insightFor],
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
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
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
      favorites,
      toggleFavorite,
      savings,
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
      favorites,
      toggleFavorite,
      savings,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShoppingList(): ShoppingListState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShoppingList outside ShoppingListProvider');
  return v;
}
