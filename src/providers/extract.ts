/**
 * Store-agnostic offer extraction from raw HTML. React Native has no DOM, so this works on
 * strings: it looks for structured data the shop pages embed for themselves (JSON-LD,
 * Next.js/Nuxt state, JSON in data-* attributes) and pulls out anything product-shaped.
 */
import { classify } from '../core/categories';
import { discountFromPrices, parsePrice } from '../core/price';
import { decodeHtmlEntities, slugify, stripTags } from '../core/text';
import type { Deal, StoreId } from '../core/types';

export type RawOffer = Omit<Deal, 'id' | 'store' | 'category' | 'source'> & { categoryHint?: string };

const TITLE_KEYS = ['fullTitle', 'title', 'name', 'productName', 'displayName', 'headline'];
const SUBTITLE_KEYS = [
  'subtitle',
  'subTitle',
  'description',
  'shortDescription',
  'packaging',
  'basicPrice',
  'supplementalDescription',
];
const PRICE_KEYS = [
  'price',
  'currentPrice',
  'promoPrice',
  'promotionPrice',
  'priceValue',
  'salePrice',
  'finalPrice',
  'lowPrice',
];
const OLD_PRICE_KEYS = [
  'oldPrice',
  'previousPrice',
  'regularPrice',
  'strikePrice',
  'basePrice',
  'originalPrice',
  'priceBefore',
  'highPrice',
  'listPrice',
];
const DISCOUNT_KEYS = ['percentageDiscount', 'discountPercent', 'discountPercentage', 'discount', 'saving'];
const LABEL_KEYS = ['discountText', 'promoLabel', 'promotionText', 'badge', 'label', 'mechanic', 'promotionType'];
const IMAGE_KEYS = ['image', 'imageUrl', 'img', 'mainImage', 'imageSrc', 'thumbnail', 'picture'];
const URL_KEYS = ['canonicalUrl', 'url', 'link', 'href', 'productUrl', 'detailUrl'];
const FROM_KEYS = ['validFrom', 'startDate', 'dateFrom', 'availableFrom', 'promotionStart', 'from'];
const TO_KEYS = [
  'validTo',
  'validThrough',
  'priceValidUntil',
  'endDate',
  'dateTo',
  'availableTo',
  'promotionEnd',
  'to',
];
const CATEGORY_KEYS = ['category', 'categoryName', 'productCategory'];
const APP_HINT = /lidl\s*plus|moja\s*biedronk|aplikacj|[żŻzZ]app|kaufland\s*card|z\s*kart[ąa]|kupon/i;

type Json = unknown;

const looksLikePromo = (label?: string) => !!label && /\d\s*\+\s*\d|%|gratis|taniej|za\s*p[oó]ł/i.test(label);
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(obj: Obj, keys: string[]): Json {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  return undefined;
}

function asText(v: Json): string | undefined {
  if (typeof v === 'string') {
    const t = stripTags(v);
    return t || undefined;
  }
  if (typeof v === 'number') return String(v);
  if (isObj(v)) return asText(pick(v, ['text', 'value', 'name', 'title', 'label']));
  return undefined;
}

function asPrice(v: Json): number | undefined {
  if (isObj(v)) return asPrice(pick(v, ['price', 'value', 'amount', 'current', 'gross']));
  return parsePrice(v);
}

function asPercent(v: Json): number | undefined {
  if (isObj(v)) return asPercent(pick(v, DISCOUNT_KEYS.concat(['value', 'percent'])));
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string' && /%|^-?\d+$/.test(v.trim())
        ? parsePrice(v.replace('-', ''))
        : undefined;
  if (n === undefined) return undefined;
  const p = Math.abs(n) <= 1 && Math.abs(n) > 0 ? Math.abs(n) * 100 : Math.abs(n);
  return p > 0 && p < 100 ? Math.round(p) : undefined;
}

function asUrl(v: Json): string | undefined {
  if (Array.isArray(v)) return asUrl(v[0]);
  if (isObj(v)) return asUrl(pick(v, ['url', 'src', 'href', 'contentUrl', 'image']));
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return /^(https?:)?\/\//.test(s) || s.startsWith('/') ? s : undefined;
}

function asDate(v: Json): string | undefined {
  if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000).toISOString().slice(0, 10);
  if (typeof v !== 'string') return undefined;
  const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const pl = v.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (pl) return `${pl[3]}-${pl[2].padStart(2, '0')}-${pl[1].padStart(2, '0')}`;
  return undefined;
}

/** Interprets one JSON object as an offer, if it has at least a name and a price-ish field. */
export function offerFromObject(obj: Obj): RawOffer | null {
  const title = asText(pick(obj, TITLE_KEYS));
  if (!title || title.length < 2 || title.length > 160) return null;

  // schema.org Product nests price data under `offers`.
  const offers = obj.offers;
  const offer = Array.isArray(offers) ? (offers.find(isObj) as Obj | undefined) : isObj(offers) ? offers : undefined;
  const priceSrc: Obj = offer ? { ...obj, ...offer } : obj;
  const priceField = pick(priceSrc, PRICE_KEYS);

  let price = asPrice(priceField);
  let oldPrice = asPrice(pick(priceSrc, OLD_PRICE_KEYS));
  let discountPercent = asPercent(pick(priceSrc, DISCOUNT_KEYS));
  let promoLabel = asText(pick(priceSrc, LABEL_KEYS));

  // Lidl-style: { price: { price, oldPrice, discount: { percentageDiscount, discountText } } }
  if (isObj(priceField)) {
    oldPrice ??= asPrice(pick(priceField, OLD_PRICE_KEYS));
    const disc = priceField.discount;
    if (isObj(disc)) {
      discountPercent ??= asPercent(disc);
      promoLabel ??= asText(pick(disc, LABEL_KEYS));
    } else {
      discountPercent ??= asPercent(disc);
    }
  }
  if (!price && !discountPercent && !looksLikePromo(promoLabel)) return null;
  if (oldPrice && price && oldPrice <= price) oldPrice = undefined;
  discountPercent ??= discountFromPrices(price, oldPrice);
  if (promoLabel && promoLabel.length > 60) promoLabel = undefined;

  const subtitle = asText(pick(obj, SUBTITLE_KEYS));
  const fullText = `${title} ${subtitle ?? ''} ${promoLabel ?? ''} ${asText(obj.badges) ?? ''}`;
  return {
    title,
    subtitle: subtitle && subtitle !== title && subtitle.length <= 120 ? subtitle : undefined,
    price,
    oldPrice,
    discountPercent,
    promoLabel,
    imageUrl: asUrl(pick(obj, IMAGE_KEYS)),
    url: asUrl(pick(obj, URL_KEYS)) ?? (offer ? asUrl(pick(offer, URL_KEYS)) : undefined),
    validFrom: asDate(pick(priceSrc, FROM_KEYS)),
    validTo: asDate(pick(priceSrc, TO_KEYS)),
    requiresApp: APP_HINT.test(fullText) || undefined,
    categoryHint: asText(pick(obj, CATEGORY_KEYS)),
  };
}

/** Depth-first walk collecting product-shaped objects (bounded, to stay cheap on big pages). */
export function collectOffers(root: Json, out: RawOffer[] = [], budget = { nodes: 60_000 }, depth = 0): RawOffer[] {
  if (depth > 25 || --budget.nodes < 0) return out;
  if (Array.isArray(root)) {
    for (const item of root) collectOffers(item, out, budget, depth + 1);
    return out;
  }
  if (!isObj(root)) return out;
  const offer = offerFromObject(root);
  if (offer) {
    out.push(offer);
    return out; // don't descend into a product's own variants
  }
  for (const v of Object.values(root))
    if (typeof v === 'object' && v !== null) collectOffers(v, out, budget, depth + 1);
  return out;
}

function tryParse(text: string): Json {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** All JSON documents embedded in a page that may describe products. */
export function embeddedJson(html: string): Json[] {
  const docs: Json[] = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (let m; (m = scriptRe.exec(html));) {
    const attrs = m[1];
    const body = m[2].trim();
    if (!body) continue;
    if (/application\/(ld\+)?json/i.test(attrs) || /id=["']__NEXT_DATA__["']/i.test(attrs)) {
      const doc = tryParse(body);
      if (doc !== undefined) docs.push(doc);
      continue;
    }
    // window.__NUXT__ = {...}; window.__INITIAL_STATE__ = {...};
    const assign = body.match(/^(?:window\.)?__[A-Z_]+__\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (assign) {
      const doc = tryParse(assign[1]);
      if (doc !== undefined) docs.push(doc);
    }
  }
  // JSON in attributes, e.g. Lidl's data-grid-data="{&quot;fullTitle&quot;:...}"
  const attrRe = /\sdata-[\w-]+=(["'])(\{(?:(?!\1)[\s\S])*\}|\[(?:(?!\1)[\s\S])*\])\1/g;
  for (let m; (m = attrRe.exec(html));) {
    const doc = tryParse(decodeHtmlEntities(m[2]));
    if (doc !== undefined) docs.push(doc);
  }
  return docs;
}

/**
 * Fallback for pages that render offers only as HTML tiles: finds elements whose class
 * mentions "product"/"offer"/"tile" and reads title/price/old price from their inner classes.
 */
export function offersFromTiles(html: string): RawOffer[] {
  const out: RawOffer[] = [];
  const starts = [...html.matchAll(TILE_RE)];
  for (let i = 0; i < starts.length; i++) {
    const begin = starts[i].index ?? 0;
    const end = i + 1 < starts.length ? (starts[i + 1].index ?? html.length) : Math.min(html.length, begin + 6000);
    const chunk = html.slice(begin, end);
    // Text up to the first closing tag; a lookahead so nested elements are matched too.
    const elements = [...chunk.matchAll(/<\w+\b[^>]*class=["']([^"']*)["'][^>]*>(?=([\s\S]*?)<\/)/g)].map((m) => ({
      cls: m[1].toLowerCase(),
      text: stripTags(m[2]),
    }));
    const byClass = (re: RegExp, not?: RegExp) =>
      elements.find((e) => e.text && re.test(e.cls) && !(not && not.test(e.cls)))?.text;

    const alt = chunk.match(/\balt=["']([^"']{3,})["']/)?.[1];
    const title = byClass(/title|name/, /sub/) ?? (alt ? decodeHtmlEntities(alt) : undefined);
    const oldPrice = parsePrice(byClass(OLD_PRICE_CLASS));
    // The first "price"-classed element may be a wrapper or a "-40%" badge, so take the first that reads as money.
    const price = parsePrice(
      elements.find(
        (e) =>
          /price/.test(e.cls) &&
          !OLD_PRICE_CLASS.test(e.cls) &&
          !/discount|saving/.test(e.cls) &&
          !e.text.includes('%') &&
          parsePrice(e.text),
      )?.text,
    );
    const label = byClass(/discount|badge|promo|label/);
    const promoLabel = label && label.length <= 60 ? label : undefined;
    if (!title || (!price && !looksLikePromo(promoLabel))) continue;
    out.push({
      title,
      subtitle: byClass(/subtitle|description|quantity|packaging/),
      price,
      oldPrice: oldPrice && price && oldPrice > price ? oldPrice : undefined,
      discountPercent: discountFromPrices(price, oldPrice),
      promoLabel,
      imageUrl: chunk.match(/<img\b[^>]*\b(?:data-src|src)=["']([^"']+)["']/i)?.[1],
      url:
        starts[i][0].match(/\bhref=["']([^"'#]+)["']/i)?.[1] ?? chunk.match(/<a\b[^>]*\bhref=["']([^"'#]+)["']/i)?.[1],
      requiresApp: APP_HINT.test(chunk) || undefined,
    });
  }
  return out;
}

const TILE_RE =
  /<(?:div|article|li|a)\b[^>]*class=["'][^"']*(?:product-tile|product-card|offer-tile|productTile|product-box|product-item)(?=["'\s])[^"']*["'][^>]*>/gi;
const OLD_PRICE_CLASS = /old|strike|regular|before|crossed/;

function absolutize(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, base).toString();
  } catch {
    return undefined;
  }
}

/** Turns raw offers into Deals: absolute URLs, categories, stable ids, de-duplicated. */
export function toDeals(raw: RawOffer[], store: StoreId, baseUrl: string): Deal[] {
  const seen = new Set<string>();
  const deals: Deal[] = [];
  for (const { categoryHint, ...r } of raw) {
    const id = `${store}:${slugify(`${r.title} ${r.subtitle ?? ''}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    deals.push({
      ...r,
      id,
      store,
      category: classify(r.title, r.subtitle, categoryHint),
      url: absolutize(r.url, baseUrl),
      imageUrl: absolutize(r.imageUrl, baseUrl),
      source: 'live',
    });
  }
  return deals;
}

/** Full pipeline for one page: structured data first, HTML tiles as a fallback. */
export function extractDeals(html: string, store: StoreId, pageUrl: string): Deal[] {
  const structured = embeddedJson(html).flatMap((doc) => collectOffers(doc));
  const raw = structured.length > 0 ? structured : offersFromTiles(html);
  return toDeals(raw, store, pageUrl);
}
