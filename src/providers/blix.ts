/**
 * blix.pl aggregates the weekly leaflets of Polish chains and lists every leaflet item with
 * its name, promo price, dates and image as plain HTML attributes. Shop sites either publish
 * leaflets only as images (Biedronka, Żabka) or block automated requests (Kaufland), so this
 * is the main source of grocery offers. Leaflets don't state regular prices, so these offers
 * carry no discount — keyword matches decide whether they are "hot".
 */
import { decodeHtmlEntities } from '../core/text';
import type { RawOffer } from './extract';

export const BLIX = 'https://blix.pl';

export interface BlixLeaflet {
  id: string;
  name: string;
  /** yyyy-mm-dd */
  start: string;
  end: string;
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** "October 15, 2026 00:00" → "2026-10-15" */
export function parseBlixDate(value?: string): string | undefined {
  const m = value?.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (month === 0) return undefined;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/\s([\w-]+)="([^"]*)"/g)) out[m[1]] = decodeHtmlEntities(m[2]);
  return out;
}

/** Leaflets of one chain listed on its blix store page (archival ones skipped). */
export function blixLeaflets(html: string, slug: string): BlixLeaflet[] {
  const found = new Map<string, BlixLeaflet>();
  for (const [tag] of html.matchAll(/<div\b[^>]*data-leaflet-id="[^>]*>/g)) {
    const a = attrs(tag);
    if (a['data-brand-slug'] !== slug || /leaflet--archival/.test(a.class ?? '')) continue;
    const start = parseBlixDate(a['data-date-start']);
    const end = parseBlixDate(a['data-date-end']);
    if (!start || !end || found.has(a['data-leaflet-id'])) continue;
    found.set(a['data-leaflet-id'], { id: a['data-leaflet-id'], name: a['data-leaflet-name'] ?? '', start, end });
  }
  return [...found.values()];
}

/** The chains' main weekly leaflets, as opposed to themed ones (alcohol, candles, pets…). */
const MAIN_LEAFLET =
  /od poniedzia|od czwartku|tygodni|gazetka|spo[żz]ywcz|oszcz[ęe]dno|festiwal|mocny start|rewolucja/i;

/**
 * Leaflets valid today or starting within `aheadDays`. Main leaflets go first, then the
 * freshest; upcoming ones after current ones. Parsed leaflets are cached, so `max` mostly
 * bounds the first download.
 */
export function pickLeaflets(leaflets: BlixLeaflet[], today: string, aheadDays = 3, max = 8): BlixLeaflet[] {
  const horizon = new Date(`${today}T12:00:00`);
  horizon.setDate(horizon.getDate() + aheadDays);
  const last = horizon.toISOString().slice(0, 10);
  const rank = (l: BlixLeaflet) => (MAIN_LEAFLET.test(l.name) ? 0 : 2) + (l.start <= today ? 0 : 1);
  return leaflets
    .filter((l) => l.end >= today && l.start <= last)
    .sort((a, b) => rank(a) - rank(b) || b.start.localeCompare(a.start) || a.id.localeCompare(b.id))
    .slice(0, max);
}

export const leafletUrl = (slug: string, id: string, page?: string) =>
  `${BLIX}/sklep/${slug}/gazetka/${id}/${page ? `?pageNumber=${page}` : ''}`;

/** Items of one leaflet page. Items from other leaflets shown on the same page are skipped. */
export function blixOffers(html: string, slug: string, leafletId: string): RawOffer[] {
  const out: RawOffer[] = [];
  const parts = html.split(/(?=<div class="offer[ "])/).slice(1);
  for (const part of parts) {
    const tag = part.slice(0, part.indexOf('>') + 1);
    const a = attrs(tag);
    if (a['data-leaflet-id'] !== leafletId || !a['data-name']) continue;
    const cents = Number(a['data-price']);
    const corners = ['topleftcorner-x', 'topleftcorner-y', 'bottomrightcorner-x', 'bottomrightcorner-y'].map((k) =>
      Number(a[`data-${k}`]),
    );
    out.push({
      title: a['data-name'],
      price: Number.isFinite(cents) && cents > 0 ? cents / 100 : undefined,
      validFrom: parseBlixDate(a['data-date-start']),
      validTo: parseBlixDate(a['data-date-end']),
      imageUrl: part.match(/data-src="(https:\/\/imgproxy\.blix\.pl\/product_occurrence[^"]+)"/)?.[1],
      url: leafletUrl(slug, leafletId, a['data-page-number']),
      leaflet: {
        id: leafletId,
        page: Number(a['data-page-number']) || 1,
        box: corners.every((c) => Number.isFinite(c) && c >= 0 && c <= 1)
          ? (corners as [number, number, number, number])
          : undefined,
      },
    });
  }
  return out.filter((o) => o.price);
}

export interface LeafletPage {
  page: number;
  url: string;
  /** Image size, so the viewer can keep the aspect ratio and place offer frames exactly. */
  width: number;
  height: number;
}

/** Page images of one leaflet (lazy-loaded pages keep the real URL in data-src). */
export function blixPages(html: string, leafletId: string): LeafletPage[] {
  const pages = new Map<number, LeafletPage>();
  for (const [tag] of html.matchAll(/<img\b[^>]*class="page-img[^"]*"[^>]*>/g)) {
    const a = attrs(tag);
    if (a['data-leaflet-id'] !== leafletId) continue;
    const url = [a['data-src'], a.src].find((u) => u && /imgproxy\.blix\.pl\/image\/leaflet/.test(u));
    const page = Number(a['data-page-number']);
    if (!url || !page || pages.has(page)) continue;
    pages.set(page, { page, url, width: Number(a.width) || 1000, height: Number(a.height) || 1414 });
  }
  return [...pages.values()].sort((x, y) => x.page - y.page);
}
