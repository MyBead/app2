import { readFileSync } from 'fs';
import { join } from 'path';

import { extractDeals } from '../src/providers/extract';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('extractDeals', () => {
  it('reads Lidl-style JSON from data-* attributes and ignores non-product JSON', () => {
    const deals = extractDeals(fixture('lidl-grid.html'), 'lidl', 'https://www.lidl.pl/c/promocje');
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      id: 'lidl:maslo-extra',
      title: 'Masło extra',
      price: 4.99,
      oldPrice: 8.49,
      discountPercent: 41,
      promoLabel: '-41%',
      category: 'dairy',
      url: 'https://www.lidl.pl/p/maslo-extra/p100',
      imageUrl: 'https://www.lidl.pl/assets/maslo.jpg',
      source: 'live',
    });
    expect(deals[1]).toMatchObject({
      title: 'Kawa ziarnista Bellarom',
      discountPercent: 37,
      requiresApp: true,
      category: 'drinks',
    });
  });

  it('reads schema.org Products from JSON-LD', () => {
    const deals = extractDeals(fixture('jsonld.html'), 'kaufland', 'https://www.kaufland.pl/oferta.html');
    expect(deals.map((d) => d.title)).toEqual(['Schab wieprzowy bez kości', 'Szampon Head & Shoulders']);
    expect(deals[0]).toMatchObject({
      price: 15.99,
      subtitle: 'cena za 1 kg',
      validFrom: '2026-10-12',
      validTo: '2026-10-18',
      url: 'https://www.kaufland.pl/oferta/schab',
      imageUrl: 'https://www.kaufland.pl/img/schab.jpg',
      category: 'meat',
    });
    expect(deals[1]).toMatchObject({ price: 14.99, oldPrice: 26.99, discountPercent: 44, category: 'cosmetics' });
  });

  it('reads Next.js page state', () => {
    const deals = extractDeals(fixture('next-data.html'), 'zabka', 'https://www.zabka.pl/promocje');
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      title: 'Hot-dog z parówką',
      price: 4.99,
      oldPrice: 6.99,
      validTo: '2026-10-20',
      requiresApp: true,
    });
    expect(deals[1]).toMatchObject({
      title: 'Napój energetyczny Tiger 250 ml',
      promoLabel: '2+1 gratis',
      category: 'drinks',
    });
  });

  it('falls back to HTML product tiles', () => {
    const deals = extractDeals(fixture('tiles.html'), 'kaufland', 'https://www.kaufland.pl/oferta.html');
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      title: 'Jabłka Gala',
      subtitle: 'cena za 1 kg',
      price: 2.99,
      oldPrice: 4.99,
      discountPercent: 40,
      promoLabel: '-40%',
      url: 'https://www.kaufland.pl/oferta/jablka-gala',
      imageUrl: 'https://www.kaufland.pl/img/jablka.jpg',
      category: 'produce',
    });
    expect(deals[1]).toMatchObject({ title: 'Masło 82%', price: 5.49, requiresApp: true });
  });

  it('returns nothing for a page without offers', () => {
    expect(extractDeals('<html><body><h1>Błąd</h1></body></html>', 'lidl', 'https://www.lidl.pl')).toEqual([]);
  });
});
