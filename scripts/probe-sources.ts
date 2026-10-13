/**
 * Diagnoses shop pages from a machine with normal internet access (run in GitHub Actions):
 * fetches candidate offer pages and prints what structure they have, so the extractor can be
 * adapted. Usage: npx tsx scripts/probe-sources.ts [--pages] [store...]
 * Without --pages it runs the app's own loading code end to end.
 */
import { STORES } from '../src/core/stores';
import { formatPrice } from '../src/core/price';
import type { StoreId } from '../src/core/types';
import { embeddedJson, extractDeals } from '../src/providers/extract';
import { fetchStore, sourceUrls, type LeafletCache } from '../src/providers';
import { BLIX, blixLeaflets, pickLeaflets } from '../src/providers/blix';
import { isoDate } from '../src/core/scoring';
import { normalize } from '../src/core/text';
import { categoryInfo } from '../src/core/categories';
import { DEFAULT_PREFERENCES } from '../src/core/types';
import { rankDeals } from '../src/core/scoring';

/** Pages dumped by --pages, by group name (a store id or any label). */
const CANDIDATES: Record<string, string[]> = {
  euro: [
    'https://www.euro.com.pl/promocje.bhtml',
    'https://www.euro.com.pl/cms/promocje.bhtml',
    'https://www.euro.com.pl/telefony-komorkowe.bhtml',
    'https://blix.pl/sklep/euro-rtv-agd/',
  ],
  oldprice: [
    'https://ding.pl/oferty',
    'https://blix.pl/produkt/rum-bacardi-carta-blanca,4431be06b',
    'https://www.gazetki.pl/',
  ],
  electronics_blix: [
    'https://blix.pl/sklep/media-expert/',
    'https://blix.pl/sklep/rtv-euro-agd/',
    'https://blix.pl/sklep/media-markt/',
    'https://blix.pl/sklep/neonet/',
    'https://blix.pl/sklep/x-kom/',
  ],
  electronics_sites: [
    'https://www.x-kom.pl/goracy_strzal',
    'https://www.x-kom.pl/promocje',
    'https://www.mediaexpert.pl/promocje',
    'https://www.euro.com.pl/promocje.bhtml',
    'https://mediamarkt.pl/pl/promotions.html',
    'https://www.neonet.pl/promocje.html',
    'https://www.morele.net/promocje/',
    'https://www.komputronik.pl/promotions/',
  ],
};

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pl-PL,pl;q=0.9',
};

const top = (items: string[], n: number) => {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ×${v}`);
};

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

async function probe(group: string, url: string) {
  console.log(`\n===== ${group} ${url}`);
  let res: Response;
  try {
    res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(25_000) });
  } catch (e) {
    console.log(`FETCH ERROR: ${e instanceof Error ? `${e.name}: ${e.message} ${String(e.cause ?? '')}` : e}`);
    return;
  }
  const html = await res.text();
  console.log(`status=${res.status} final=${res.url} type=${res.headers.get('content-type')} bytes=${html.length}`);
  console.log(`server=${res.headers.get('server')} cf-ray=${res.headers.get('cf-ray') ?? '-'}`);
  console.log(`title: ${oneLine(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '-')}`);

  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
  console.log(
    `ld+json=${scripts.filter((a) => /ld\+json/i.test(a)).length} next_data=${/__NEXT_DATA__/.test(html)} ` +
      `nuxt=${/__NUXT__|__NUXT_DATA__/.test(html)} json-scripts=${scripts.filter((a) => /application\/json/i.test(a)).length} ` +
      `embeddedJson=${embeddedJson(html).length} "zł"=${(html.match(/zł/g) ?? []).length}`,
  );

  // Where do prices live inside embedded JSON? Print paths of objects with price-like keys.
  const pricePaths: string[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 30 || pricePaths.length > 400 || typeof v !== 'object' || v === null) return;
    if (Array.isArray(v)) return v.slice(0, 50).forEach((x, i) => walk(x, `${path}[${i < 3 ? i : '*'}]`, depth + 1));
    const keys = Object.keys(v);
    if (keys.some((k) => /price|cena/i.test(k)))
      pricePaths.push(`${path.replace(/\[\d+\]/g, '[]')} :: ${JSON.stringify(v).slice(0, 400)}`);
    for (const k of keys) walk((v as Record<string, unknown>)[k], `${path}.${k}`, depth + 1);
  };
  embeddedJson(html).forEach((doc, i) => walk(doc, `doc${i}`, 0));
  const seenPaths = new Set<string>();
  for (const line of pricePaths) {
    const key = line.split(' :: ')[0];
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    console.log(`json price path: ${line}`);
    if (seenPaths.size >= 12) break;
  }

  const deals = extractDeals(html, 'lidl', res.url || url);
  console.log(`EXTRACTED ${deals.length} deals`);
  for (const d of deals.slice(0, 8)) {
    console.log(
      `  - ${d.title} | ${d.subtitle ?? ''} | ${formatPrice(d.price)} old=${formatPrice(d.oldPrice)} ${d.promoLabel ?? ''} -> ${d.url ?? ''}`,
    );
  }

  const classes = [...html.matchAll(/class=["']([^"']+)["']/g)].flatMap((m) => m[1].split(/\s+/));
  console.log(
    `classes: ${top(
      classes.filter((c) => /product|offer|price|promo|tile|card|teaser|badge|discount/i.test(c)),
      40,
    ).join(', ')}`,
  );
  console.log(
    `data-attrs: ${top(
      [...html.matchAll(/\s(data-[\w-]+)=/g)].map((m) => m[1]),
      25,
    ).join(', ')}`,
  );
  console.log(
    `script src: ${scripts
      .map((a) => a.match(/src=["']([^"']+)/)?.[1])
      .filter(Boolean)
      .slice(0, 15)
      .join(' ')}`,
  );
  const apis = [
    ...html.matchAll(
      /["'`]((?:https?:\/\/[^"'`\s]*)?\/[^"'`\s]*(?:api|graphql|offers?|promo|leaflet|gazet)[^"'`\s]*)["'`]/gi,
    ),
  ].map((m) => m[1]);
  console.log(`api-like urls: ${top(apis, 25).join(' | ')}`);
  const links = [...html.matchAll(/href=["']([^"'#]*(?:promoc|ofert|okazj|gazet|aktualn)[^"'#]*)["']/gi)].map(
    (m) => m[1],
  );
  console.log(`offer links: ${top(links, 25).join(' | ')}`);

  for (const re of [/<[^>]*class="offer[ "][\s\S]{0,2500}/g, /<[^>]*data-leaflet-id[^>]*>[\s\S]{0,600}/g]) {
    const samples = [...html.matchAll(re)];
    console.log(`${re.source.slice(0, 30)}: ${samples.length} matches`);
    for (const k of [0, 1, Math.floor(samples.length / 2), samples.length - 1]) {
      if (samples[k]) console.log(`--- sample #${k}\n${samples[k][0]}`);
    }
  }
  for (const marker of ['class="product ', 'class="product"', 'class="product-item"']) {
    const at = html.indexOf(marker);
    if (at >= 0) {
      console.log(`tile sample (${marker}):\n${html.slice(Math.max(0, at - 200), at + 2500)}`);
      break;
    }
  }
  const tileLinks = [
    ...html.matchAll(/href=["'](https:\/\/blix\.pl\/[^"']*(?:oferta|produkt|promocj)[^"']*)["']/gi),
  ].map((m) => m[1]);
  if (tileLinks.length) console.log(`blix offer links: ${top(tileLinks, 15).join(' | ')}`);

  const i = html.search(/\d+[,.]\d{2}\s*(?:zł|PLN)/);
  if (i >= 0) console.log(`excerpt around first price:\n${html.slice(Math.max(0, i - 1500), i + 700)}`);
  else console.log(`excerpt (body start):\n${html.slice(html.search(/<body/i), html.search(/<body/i) + 1500)}`);
}

/** Runs the app's real loading code against the live sites. */
async function endToEnd(stores: StoreId[]) {
  const cache: LeafletCache = {};
  for (const store of stores) {
    const storeHtml = await (await fetch(`${BLIX}/sklep/${STORES[store].blixSlug}/`, { headers: HEADERS })).text();
    const leaflets = blixLeaflets(storeHtml, STORES[store].blixSlug);
    const picked = new Set(pickLeaflets(leaflets, isoDate(new Date())).map((l) => l.id));
    console.log(`\nleaflets of ${store}:`);
    for (const l of leaflets) console.log(`  ${picked.has(l.id) ? '*' : ' '} ${l.id} ${l.start}..${l.end} ${l.name}`);
    const started = Date.now();
    const r = await fetchStore(store, sourceUrls(store, DEFAULT_PREFERENCES), cache);
    console.log(`\n##### ${store}: ${r.deals.length} deals in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    if (r.error) console.log(`errors:\n${r.error}`);
    const cats = top(
      r.deals.map((d) => categoryInfo(d.category).label),
      13,
    );
    console.log(`categories: ${cats.join(', ')}`);
    const withOld = r.deals.filter((d) => d.oldPrice).length;
    console.log(`with old price: ${withOld}, with app requirement: ${r.deals.filter((d) => d.requiresApp).length}`);
    for (const d of r.deals.filter((_, i) => i % Math.max(1, Math.floor(r.deals.length / 12)) === 0).slice(0, 12)) {
      console.log(
        `  - ${d.title} | ${d.subtitle ?? ''} | ${formatPrice(d.price)} old=${formatPrice(d.oldPrice)} ${d.promoLabel ?? ''} ${d.validFrom ?? ''}..${d.validTo ?? ''} [${d.category}]`,
      );
    }
    const otherWords = r.deals.filter((d) => d.category === 'other').map((d) => normalize(d.title).split(' ')[0]);
    console.log(`'other' first words: ${top(otherWords, 70).join(', ')}`);
    const prefs = { ...DEFAULT_PREFERENCES, keywords: ['kawa', 'masło', 'kurczak'] };
    const hot = rankDeals(r.deals, prefs).filter((s) => s.hot);
    console.log(
      `hot with keywords kawa/masło/kurczak: ${hot.length}: ${hot
        .slice(0, 8)
        .map((s) => s.deal.title)
        .join('; ')}`,
    );
  }
  console.log(`\nleaflets cached: ${Object.keys(cache).join(', ')}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--pages')) {
    const groups = args.filter((a) => a in CANDIDATES);
    for (const g of groups.length ? groups : Object.keys(CANDIDATES))
      for (const url of CANDIDATES[g]) await probe(g, url);
    for (const url of args.filter((a) => /^https?:/.test(a))) await probe('url', url);
    return;
  }
  const wanted = args.filter((a) => a in STORES) as StoreId[];
  await endToEnd(wanted.length ? wanted : (Object.keys(STORES) as StoreId[]));
}

main();
