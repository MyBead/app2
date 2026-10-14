/**
 * Pack sizes and unit prices from Polish product texts: "500 g", "1,5 l", "4 x 0,5 l",
 * "cena za 1 kg", "68,75 zł/kg". Lets the app compare a 250 g pack with a 1 kg one.
 */
import type { CategoryId, Deal } from './types';

/** "Pralka 6 kg" is not sold by the kilo. */
const NOT_PER_UNIT: CategoryId[] = ['electronics', 'nonfood'];

type Priced = Pick<Deal, 'title' | 'subtitle' | 'price'> & { category?: CategoryId };

export type Unit = 'kg' | 'l' | 'szt';

export interface UnitPrice {
  value: number;
  unit: Unit;
}

const num = (s: string) => Number(s.replace(',', '.'));

const BASE: Record<string, { unit: Unit; factor: number }> = {
  kg: { unit: 'kg', factor: 1 },
  g: { unit: 'kg', factor: 0.001 },
  dag: { unit: 'kg', factor: 0.01 },
  l: { unit: 'l', factor: 1 },
  ml: { unit: 'l', factor: 0.001 },
  cl: { unit: 'l', factor: 0.01 },
  szt: { unit: 'szt', factor: 1 },
};

/** Total quantity of a pack in kg, l or pieces; undefined when the text names no size. */
export function parseQuantity(text: string): { amount: number; unit: Unit } | undefined {
  const t = text.toLowerCase().replace(/ /g, ' ');
  // "4 x 500 ml", "2x100g", "6 × 0,5 l"
  const multi = t.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|dag|g|ml|cl|l)\b/);
  if (multi) {
    const b = BASE[multi[3]];
    return { amount: num(multi[1]) * num(multi[2]) * b.factor, unit: b.unit };
  }
  // Skip "zł/kg"-style unit prices; they are handled separately.
  const single = t
    .replace(/\d+(?:[.,]\d+)?\s*zł\s*\/\s*\w+/g, '')
    .match(/(\d+(?:[.,]\d+)?)\s*(kg|dag|g|ml|cl|l|szt)\b\.?/);
  if (single) {
    const b = BASE[single[2]];
    const amount = num(single[1]) * b.factor;
    return amount > 0 ? { amount, unit: b.unit } : undefined;
  }
  return undefined;
}

/** Price per kg / l / piece, when the deal's texts allow it. */
export function unitPrice(deal: Priced): UnitPrice | undefined {
  if (deal.category && NOT_PER_UNIT.includes(deal.category)) return undefined;
  const text = `${deal.title} ${deal.subtitle ?? ''}`;
  const lower = text.toLowerCase();
  // Stated unit price: "68,75 zł/kg"
  const stated = lower.match(/(\d+(?:[.,]\d+)?)\s*zł\s*\/\s*(kg|l|szt)/);
  if (stated) return { value: num(stated[1]), unit: stated[2] as Unit };
  if (!deal.price) return undefined;
  // Price is already per unit: "cena za 1 kg", "za kg", "/kg"
  const per = lower.match(/(?:cena\s+)?za\s+(?:1\s*)?(kg|l|szt)\b|\/\s*(kg|l)\b/);
  if (per) return { value: deal.price, unit: (per[1] ?? per[2]) as Unit };
  const q = parseQuantity(text);
  if (!q || q.unit === 'szt') return undefined;
  return { value: Math.round((deal.price / q.amount) * 100) / 100, unit: q.unit };
}

export function formatUnitPrice(u: UnitPrice): string {
  return `${u.value.toFixed(2).replace('.', ',')} zł/${u.unit}`;
}

/**
 * Compares two deals by what you actually pay for the product: unit price when both have one
 * in the same unit, otherwise the shelf price.
 */
export function comparablePrices(a: Priced, b: Priced): [number, number] | undefined {
  const ua = unitPrice(a);
  const ub = unitPrice(b);
  if (ua && ub && ua.unit === ub.unit) return [ua.value, ub.value];
  if (a.price && b.price) return [a.price, b.price];
  return undefined;
}
