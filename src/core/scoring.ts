import { effectiveDiscount } from './price';
import { matchesKeyword } from './text';
import type { Deal, Preferences } from './types';

export interface ScoredDeal {
  deal: Deal;
  score: number;
  discount: number;
  matchedKeywords: string[];
  favoriteCategory: boolean;
  /** Worth a notification under the user's preferences. */
  hot: boolean;
}

function dealText(deal: Deal): string {
  return `${deal.title} ${deal.subtitle ?? ''}`;
}

/** Whether the deal should be shown at all under the user's filters. */
export function isVisible(deal: Deal, prefs: Preferences, now = new Date()): boolean {
  if (!prefs.stores.includes(deal.store)) return false;
  if (prefs.hiddenCategories.includes(deal.category)) return false;
  if (!prefs.includeAppOnly && deal.requiresApp) return false;
  if (deal.validTo && deal.validTo < isoDate(now)) return false;
  const text = dealText(deal);
  return !prefs.blockedKeywords.some((k) => matchesKeyword(text, k));
}

export function scoreDeal(deal: Deal, prefs: Preferences, now = new Date()): ScoredDeal {
  const discount = effectiveDiscount(deal);
  const text = dealText(deal);
  const matchedKeywords = prefs.keywords.filter((k) => matchesKeyword(text, k));
  const favoriteCategory = prefs.favoriteCategories.includes(deal.category);

  let score = discount;
  if (matchedKeywords.length > 0) score += 40;
  if (favoriteCategory) score += 15;
  if (deal.validTo && daysBetween(now, deal.validTo) <= 1) score += 5; // last chance
  if (deal.validFrom && deal.validFrom > isoDate(now)) score -= 5; // not started yet
  if (deal.requiresApp) score -= 3;

  const categoryOk = !prefs.onlyFavoriteCategories || prefs.favoriteCategories.length === 0 || favoriteCategory;
  const hot = matchedKeywords.length > 0 || (discount >= prefs.minDiscount && categoryOk);

  return { deal, score, discount, matchedKeywords, favoriteCategory, hot };
}

/** Visible deals, best first. */
export function rankDeals(deals: Deal[], prefs: Preferences, now = new Date()): ScoredDeal[] {
  return deals
    .filter((d) => isVisible(d, prefs, now))
    .map((d) => scoreDeal(d, prefs, now))
    .sort((a, b) => b.score - a.score || a.deal.title.localeCompare(b.deal.title));
}

export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(now: Date, iso: string): number {
  const end = new Date(`${iso}T23:59:59`);
  return Math.floor((end.getTime() - now.getTime()) / 86_400_000);
}
