/**
 * Diagnoses shop pages from a machine with normal internet access (run in GitHub Actions):
 * fetches candidate offer pages and prints what structure they have, so the extractor can be
 * adapted. Usage: npx tsx scripts/probe-sources.ts [store...]
 */
import { STORES } from '../src/core/stores';
import { formatPrice } from '../src/core/price';
import type { StoreId } from '../src/core/types';
import { embeddedJson, extractDeals } from '../src/providers/extract';

const CANDIDATES: Record<StoreId, string[]> = {
  lidl: ['https://blix.pl/sklep/lidl/'],
  biedronka: ['https://blix.pl/sklep/biedronka/'],
  zabka: ['https://blix.pl/sklep/zabka/', 'https://www.zabka.pl/'],
  // kaufland.pl answers datacenter IPs with a Cloudflare challenge; blix.pl lists its offers.
  kaufland: [
    'https://blix.pl/sklep/kaufland/',
    'https://blix.pl/sklep/kaufland/gazetka/528900/',
    'https://blix.pl/sklep/kaufland/oferty/',
    'https://blix.pl/sklep/kaufland/produkty/',
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

async function probe(store: StoreId, url: string) {
  console.log(`\n===== ${store} ${url}`);
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

  const deals = extractDeals(html, store, res.url || url);
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

async function main() {
  const wanted = (process.argv.slice(2) as StoreId[]).filter((s) => s in CANDIDATES);
  for (const store of wanted.length ? wanted : (Object.keys(CANDIDATES) as StoreId[])) {
    for (const url of CANDIDATES[store]) await probe(store, url);
  }
}

main();
