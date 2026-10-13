import { readFileSync } from 'fs';
import { join } from 'path';

import { blixLeaflets, blixOffers, parseBlixDate, pickLeaflets } from '../src/providers/blix';
import { fetchStore, parsePage, pruneLeafletCache, type LeafletCache } from '../src/providers';
import { decodeHtmlEntities } from '../src/core/text';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('blix.pl', () => {
  it('parses dates', () => {
    expect(parseBlixDate('October 15, 2026 00:00')).toBe('2026-10-15');
    expect(parseBlixDate('May 3, 2027 23:59')).toBe('2027-05-03');
    expect(parseBlixDate('15.10.2026')).toBeUndefined();
  });

  it('lists the chain’s non-archival leaflets once each', () => {
    const leaflets = blixLeaflets(fixture('blix-store.html'), 'kaufland');
    expect(leaflets.map((l) => l.id)).toEqual(['528900', '526170', '529999']);
    expect(leaflets[0]).toEqual({ id: '528900', name: 'Gazetka Tygodnia', start: '2026-10-15', end: '2026-10-21' });
  });

  it('picks leaflets valid today or starting within 3 days', () => {
    const leaflets = blixLeaflets(fixture('blix-store.html'), 'kaufland');
    expect(pickLeaflets(leaflets, '2026-10-13').map((l) => l.id)).toEqual(['526170', '528900']);
    expect(pickLeaflets(leaflets, '2026-10-11').map((l) => l.id)).toEqual(['526170']);
    expect(pickLeaflets(leaflets, '2026-10-22').map((l) => l.id)).toEqual([]);
  });

  it('reads leaflet items with price, dates, image and a link to the leaflet page', () => {
    const offers = blixOffers(fixture('blix-leaflet.html'), 'kaufland', '528900');
    expect(offers.map((o) => o.title)).toEqual([
      'Schab wieprzowy bez kości',
      'Ogórki gruntowe luzem',
      'Papryka czerwona',
    ]);
    expect(offers[0]).toEqual({
      title: 'Schab wieprzowy bez kości',
      price: 9.99,
      validFrom: '2026-10-15',
      validTo: '2026-10-21',
      imageUrl: 'https://imgproxy.blix.pl/product_occurrence//99223c0a-999.jpg?bucket=400',
      url: 'https://blix.pl/sklep/kaufland/gazetka/528900/?pageNumber=1',
    });
    expect(offers[2].validFrom).toBe('2026-10-19');
  });
});

describe('zabka.pl', () => {
  it('reads split prices, old prices, labels and the Żappka requirement', () => {
    const deals = parsePage(fixture('zabka-home.html'), 'zabka', 'https://www.zabka.pl/');
    expect(deals.map((d) => [d.title, d.price, d.oldPrice])).toEqual([
      ['Galaretka Konjac Diet Jelly', 5, undefined],
      ['Kubek do Bubble Tea Soti', 5.5, 6.5],
      ['Shot S!', 3.99, 5.19],
    ]);
    expect(deals[0]).toMatchObject({ subtitle: '150 g, 33,33 zł/kg', promoLabel: undefined, requiresApp: undefined });
    expect(deals[1]).toMatchObject({
      subtitle: 'różne rodzaje, 80 g, 68,75 zł/kg',
      promoLabel: 'Cena z Żappką · Przy zakupie 2 szt.',
      discountPercent: 15,
      requiresApp: true,
      imageUrl: 'https://cdn.zabka.pl/wp-content/uploads/2026/09/05144345/Kubek-do-bubble-tea.png',
    });
    expect(deals[2].discountPercent).toBe(23);
  });
});

describe('fetchStore', () => {
  const pages: Record<string, string> = {
    'https://blix.pl/sklep/kaufland/': fixture('blix-store.html'),
    'https://blix.pl/sklep/kaufland/gazetka/528900/': fixture('blix-leaflet.html'),
  };
  const fetchMock = jest.fn(async (url: string) => {
    const body = pages[url];
    return { ok: body !== undefined, status: body ? 200 : 404, text: async () => body ?? '' } as Response;
  });

  beforeEach(() => {
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('collects current leaflets, reports failures and caches parsed leaflets', async () => {
    const cache: LeafletCache = {};
    const now = new Date('2026-10-13T12:00:00');
    const first = await fetchStore('kaufland', [], cache, now);
    expect(first.deals.map((d) => d.title)).toEqual([
      'Schab wieprzowy bez kości',
      'Ogórki gruntowe luzem',
      'Papryka czerwona',
    ]);
    expect(first.deals[0]).toMatchObject({ store: 'kaufland', category: 'meat', source: 'live' });
    // The other current leaflet (526170) isn't served by the mock → reported, not fatal.
    expect(first.error).toContain('gazetka/526170/: HTTP 404');
    expect(Object.keys(cache)).toEqual(['kaufland:528900']);

    fetchMock.mockClear();
    await fetchStore('kaufland', [], cache, now);
    const fetched = fetchMock.mock.calls.map(([url]) => url);
    expect(fetched).not.toContain('https://blix.pl/sklep/kaufland/gazetka/528900/');
  });

  it('forgets leaflets that have ended', () => {
    const cache: LeafletCache = {
      'kaufland:1': { end: '2026-10-12', deals: [] },
      'kaufland:2': { end: '2026-10-13', deals: [] },
    };
    expect(Object.keys(pruneLeafletCache(cache, new Date('2026-10-13T08:00:00')))).toEqual(['kaufland:2']);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes Polish and typographic named entities', () => {
    expect(decodeHtmlEntities('Suszarka do włos&oacute;w &ndash; 2&nbsp;szt. &amp;quot;')).toBe(
      'Suszarka do włosów – 2 szt. &quot;',
    );
  });
});
