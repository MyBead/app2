/**
 * Barcode scanner support: which codes name a retail product, how to read a product from the
 * Open Food Facts family of databases, and which current deals are that product (or close to it).
 */
import { productTokens } from './compare';
import { matchesKeyword, words } from './text';
import type { Deal } from './types';

export interface ScannedProduct {
  code: string;
  name: string;
  brand?: string;
  /** Pack size as printed, e.g. "400 g". */
  quantity?: string;
}

/** EAN-13, EAN-8, UPC-A or UPC-E with a valid check digit. */
export function isProductBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // Weights 3,1,3,1… from the rightmost data digit.
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Food, cosmetics and other products: same API, different databases. */
export const PRODUCT_DATABASES = [
  'https://world.openfoodfacts.org',
  'https://world.openbeautyfacts.org',
  'https://world.openproductsfacts.org',
];

export function productApiUrl(base: string, code: string): string {
  return `${base}/api/v2/product/${code}.json?fields=product_name,product_name_pl,generic_name_pl,brands,quantity`;
}

interface ProductJson {
  status?: number;
  product?: {
    product_name?: string;
    product_name_pl?: string;
    generic_name_pl?: string;
    brands?: string;
    quantity?: string;
  };
}

/** The product from an API response, or null when the database doesn't know the code. */
export function parseProductJson(code: string, json: ProductJson): ScannedProduct | null {
  const p = json.product;
  if (json.status !== 1 || !p) return null;
  const name = (p.product_name_pl || p.product_name || p.generic_name_pl || '').trim();
  const brand = p.brands?.split(',')[0].trim() || undefined;
  if (!name && !brand) return null;
  return { code, name: name || brand!, brand, quantity: p.quantity?.trim() || undefined };
}

function brandWords(p: ScannedProduct): string[] {
  return p.brand ? words(p.brand) : [];
}

function nameTokens(p: ScannedProduct): string[] {
  const brand = new Set(brandWords(p));
  return productTokens(p.name).filter((t) => !brand.has(t));
}

/** Short Polish text for the shopping list or a price watch: "Nutella krem". */
export function productQuery(p: ScannedProduct): string {
  const brand = p.brand ?? '';
  const name = nameTokens(p).slice(0, brand ? 1 : 2);
  return [brand, ...name].join(' ').trim() || p.name;
}

export interface ProductMatch {
  deal: Deal;
  /** Same brand and product name — most likely the scanned item itself. */
  exact: boolean;
}

/**
 * Deals for a scanned product: same brand and name first, then the same kind of product from
 * other brands (two name words in common, or the only one), each group cheapest first.
 */
export function dealsForProduct(p: ScannedProduct, deals: Deal[]): ProductMatch[] {
  const brand = brandWords(p);
  const name = nameTokens(p);
  const out: (ProductMatch & { score: number })[] = [];
  for (const deal of deals) {
    const title = words(deal.title);
    const brandHit = brand.length > 0 && brand.every((b) => title.some((w) => w.startsWith(b)));
    const nameHits = name.filter((t) => matchesKeyword(deal.title, t)).length;
    const nameMatch = nameHits >= Math.min(2, name.length) && nameHits > 0;
    // The first name word is the product itself ("krem" in "krem orzechowy"): required for similar items.
    const headHit = name.length > 0 && matchesKeyword(deal.title, name[0]);
    if (brandHit && (nameHits > 0 || name.length === 0)) out.push({ deal, exact: true, score: 2 + nameHits });
    else if (nameMatch && headHit) out.push({ deal, exact: false, score: nameHits });
  }
  return out
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        (a.deal.price ?? Infinity) - (b.deal.price ?? Infinity) ||
        b.score - a.score,
    )
    .map(({ deal, exact }) => ({ deal, exact }));
}
