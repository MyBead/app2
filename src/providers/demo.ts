import { classify } from '../core/categories';
import { discountFromPrices } from '../core/price';
import { isoDate } from '../core/scoring';
import { STORES } from '../core/stores';
import { slugify } from '../core/text';
import type { Deal, StoreId } from '../core/types';

type Row = [StoreId, string, string | undefined, number | undefined, number | undefined, string?, boolean?];

// Illustrative offers — typical of Polish weekly promotions, not real current prices.
const ROWS: Row[] = [
  ['lidl', 'Masło extra Pilos', '200 g', 4.99, 8.49],
  ['lidl', 'Filet z piersi kurczaka', 'cena za 1 kg', 16.99, 24.99],
  ['lidl', 'Kawa ziarnista Bellarom', '1 kg', 39.99, 62.99, undefined, true],
  ['lidl', 'Banany', 'cena za 1 kg', 3.99, 5.99],
  ['lidl', 'Ser Gouda Pilos plastry', '300 g', 7.49, 10.99],
  ['lidl', 'Czekolada Fin Carré', '100 g', 2.29, 3.49, '1+1 gratis'],
  ['lidl', 'Patelnia Ernesto 28 cm', undefined, 49.99, 69.99],
  ['lidl', 'Proszek do prania Formil', '2,6 kg', 19.99, 29.99],
  ['biedronka', 'Jogurt naturalny Piątnica', '400 g', 2.99, 4.49],
  ['biedronka', 'Karkówka wieprzowa bez kości', 'cena za 1 kg', 14.99, 22.99, undefined, true],
  ['biedronka', 'Pomidory malinowe', 'cena za 1 kg', 6.99, 11.99],
  ['biedronka', 'Piwo Tyskie Gronie puszka', '500 ml', 2.79, 3.99, '4+2 gratis'],
  ['biedronka', 'Chleb wiejski krojony', '500 g', 3.49, 4.99],
  ['biedronka', 'Kawa mielona Lavazza Qualità Rossa', '250 g', 14.99, 24.99, '-50% na drugą'],
  ['biedronka', 'Płyn do naczyń Ludwik', '900 ml', 6.49, 9.99],
  ['biedronka', 'Mleko UHT Łaciate 3,2%', '1 l', 2.99, 3.79, undefined, true],
  ['zabka', 'Hot-dog z parówką', undefined, 4.99, 6.99, undefined, true],
  ['zabka', 'Napój energetyczny Tiger', '250 ml', 2.99, 4.49, '2+1 gratis'],
  ['zabka', 'Woda Żywiec Zdrój niegazowana', '1,5 l', 2.49, 3.29],
  ['zabka', 'Kawa latte Cafe del Mundo', 'kubek 300 ml', 6.99, 9.99, undefined, true],
  ['zabka', 'Baton Snickers', '50 g', 1.99, 3.29, '1+1 gratis'],
  ['zabka', 'Lody Magnum Classic', '110 ml', 5.99, 8.99],
  ['kaufland', 'Schab wieprzowy bez kości', 'cena za 1 kg', 15.99, 25.99],
  ['kaufland', 'Łosoś atlantycki filet', '250 g', 17.99, 27.99, undefined, true],
  ['kaufland', 'Jabłka Gala', 'cena za 1 kg', 2.99, 4.99],
  ['kaufland', 'Oliwa z oliwek Monini', '1 l', 34.99, 49.99],
  ['kaufland', 'Makaron Barilla spaghetti', '500 g', 4.79, 7.99],
  ['kaufland', 'Szampon Head & Shoulders', '400 ml', 14.99, 26.99, '-40% na drugi'],
  ['kaufland', 'Wino Carlo Rossi czerwone', '750 ml', 19.99, 27.99],
  ['kaufland', 'Jaja z wolnego wybiegu L', '10 szt.', 8.99, 12.49],
  ['mediamarkt', 'Laptop Lenovo IdeaPad Slim 3 15"', '16 GB, 512 GB SSD', 1999, 2599],
  ['mediamarkt', 'Słuchawki Sony WH-1000XM5', undefined, 1199, 1599],
  ['euro', 'Telewizor Samsung 55" QLED', undefined, 2499, 3299],
  ['euro', 'Odkurzacz pionowy Dreame R10', undefined, 699, 999],
  ['mediaexpert', 'Smartfon Xiaomi Redmi Note 14', '8/256 GB', 999, 1299],
  ['neonet', 'Ekspres do kawy DeLonghi Magnifica S', undefined, 1299, 1799],
];

export function demoDeals(now = new Date()): Deal[] {
  const from = new Date(now);
  from.setDate(from.getDate() - 1);
  const to = new Date(now);
  to.setDate(to.getDate() + 5);
  return ROWS.map(([store, title, subtitle, price, regular, promoLabel, requiresApp], i) => {
    // Multi-buy offers keep the shelf price; the saving comes from the mechanic.
    const oldPrice = promoLabel ? undefined : regular;
    return {
      id: `${store}:demo-${slugify(title)}`,
      store,
      title,
      subtitle,
      price,
      oldPrice,
      discountPercent: discountFromPrices(price, oldPrice),
      promoLabel,
      category: classify(title, subtitle),
      url: STORES[store].website,
      validFrom: isoDate(from),
      // Stagger end dates so "ends soon" sorting has something to show.
      validTo: isoDate(new Date(to.getTime() - (i % 4) * 86_400_000)),
      requiresApp,
      source: 'demo',
    };
  });
}
