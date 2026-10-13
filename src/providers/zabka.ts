/**
 * zabka.pl (WordPress) renders offers as `product-item` tiles with the price split into
 * whole and decimal parts ("5" + "50*"), which the generic tile parser can't read.
 */
import { discountFromPrices, parsePrice } from '../core/price';
import { stripTags } from '../core/text';
import type { RawOffer } from './extract';

const inner = (chunk: string, cls: string): string | undefined =>
  chunk.match(new RegExp(`<[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:span|h\\d|p|div)>`))?.[1];

const text = (chunk: string, cls: string) => {
  const html = inner(chunk, cls);
  return html === undefined ? undefined : stripTags(html) || undefined;
};

/** "5" + "50*" → 5.5 */
function splitPrice(whole?: string, decimal?: string): number | undefined {
  const w = whole?.match(/\d+/)?.[0];
  if (!w) return undefined;
  const d = decimal?.match(/\d{1,2}/)?.[0] ?? '0';
  return Number(w) + Number(d.padEnd(2, '0')) / 100;
}

export function zabkaOffers(html: string): RawOffer[] {
  const out: RawOffer[] = [];
  const tiles = html.split(/<div class="product-item">/).slice(1);
  for (const raw of tiles) {
    const chunk = raw.split(/<div class="splide__slide/)[0].replace(/<style[\s\S]*?<\/style>/g, '');
    const title = text(chunk, 'product-item-content__title');
    if (!title) continue;

    const price = splitPrice(text(chunk, 'product-price__text--main'), text(chunk, 'product-price__text--decimal'));
    const lines = (inner(chunk, 'product-item-content__informations') ?? '')
      .split(/<br\s*\/?>/i)
      .map(stripTags)
      .filter(Boolean);
    const before = lines.find((l) => /przed obni[żz]k|cena regularna/i.test(l));
    const oldPrice =
      splitPrice(text(chunk, 'product-price__base-main'), text(chunk, 'product-price__base-decimal')) ??
      parsePrice(before?.split(':').pop());
    const labels = [...chunk.matchAll(/class="product-label__text">([^<]*)</g)].map((m) => stripTags(m[1]));
    const discount = text(chunk, 'product-price__discount');

    const old = oldPrice && price && oldPrice > price ? oldPrice : undefined;
    out.push({
      title,
      subtitle: lines.filter((l) => !/^cena\b/i.test(l)).join(', ') || undefined,
      price,
      oldPrice: old,
      discountPercent: discount ? parsePrice(discount.replace('-', '')) : discountFromPrices(price, old),
      promoLabel: labels.filter((l) => !/tylko w [żz]abce/i.test(l)).join(' · ') || undefined,
      imageUrl: chunk.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1],
      requiresApp: labels.some((l) => /[żz]app/i.test(l)) || undefined,
    });
  }
  return out;
}
