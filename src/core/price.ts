import type { Deal } from './types';

/** "4,99 zł", "4.99", "1 299,00 zł/kg", 4.99 → number; anything unparseable → undefined. */
export function parsePrice(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const match = value.replace(/ /g, ' ').match(/\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/);
  if (!match) return undefined;
  let s = match[0].replace(/ /g, '');
  // "1.299,00" → thousands dot; "4.99" → decimal dot.
  if (/\.\d{3}(,|$)/.test(s) && s.includes(',')) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function discountFromPrices(price?: number, oldPrice?: number): number | undefined {
  if (!price || !oldPrice || oldPrice <= price) return undefined;
  return Math.round((1 - price / oldPrice) * 100);
}

/**
 * Effective discount implied by promo mechanics:
 * "1+1 gratis" → 50, "2+1" → 33, "-50% na drugi" → 25, "-30%" → 30.
 */
export function discountFromLabel(label?: string): number | undefined {
  if (!label) return undefined;
  const l = label.toLowerCase();
  const plus = l.match(/(\d+)\s*\+\s*(\d+)/);
  if (plus) {
    const paid = Number(plus[1]);
    const free = Number(plus[2]);
    if (paid > 0 && free > 0) return Math.round((free / (paid + free)) * 100);
  }
  const pct = l.match(/(\d{1,2})\s*%/);
  if (pct) {
    const p = Number(pct[1]);
    if (/drug|kolejn|2\.?\s*szt/.test(l)) return Math.round(p / 2);
    if (/trzec|3\.?\s*szt/.test(l)) return Math.round(p / 3);
    return p;
  }
  if (/za\s*(pol|pół)\s*ceny/.test(l)) return 50;
  return undefined;
}

export function effectiveDiscount(deal: Pick<Deal, 'price' | 'oldPrice' | 'discountPercent' | 'promoLabel'>): number {
  const d = deal.discountPercent ?? discountFromPrices(deal.price, deal.oldPrice) ?? discountFromLabel(deal.promoLabel);
  return d && d > 0 && d < 100 ? d : 0;
}

export function formatPrice(value?: number): string {
  if (value === undefined) return '';
  return `${value.toFixed(2).replace('.', ',')} zł`;
}
