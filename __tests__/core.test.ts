import { classify } from '../src/core/categories';
import { discountFromLabel, effectiveDiscount, formatPrice, parsePrice } from '../src/core/price';
import { isVisible, rankDeals, scoreDeal } from '../src/core/scoring';
import { matchesKeyword, matchesSearch, normalize } from '../src/core/text';
import { DEFAULT_PREFERENCES, mergePreferences, type Deal, type Preferences } from '../src/core/types';
import { demoDeals } from '../src/providers/demo';

const NOW = new Date('2026-10-13T12:00:00');

const deal = (over: Partial<Deal>): Deal => ({
  id: `lidl:${over.title ?? 'x'}`,
  store: 'lidl',
  title: 'Produkt',
  category: 'other',
  source: 'live',
  ...over,
});

const prefs = (over: Partial<Preferences> = {}): Preferences => ({ ...DEFAULT_PREFERENCES, ...over });

describe('text', () => {
  it('normalizes Polish diacritics', () => {
    expect(normalize('Masło ŻÓŁTE, Łosoś!')).toBe('maslo zolte losos');
  });

  it('matches keywords by word prefix, ignoring case and diacritics', () => {
    expect(matchesKeyword('Kawa mielona Lavazza', 'kawa')).toBe(true);
    expect(matchesKeyword('Masło extra', 'maslo')).toBe(true);
    expect(matchesKeyword('Kostka masła 200 g', 'masło')).toBe(true);
    expect(matchesKeyword('Filet z kurczaka', 'kurczak')).toBe(true);
    expect(matchesKeyword('Herbata czarna', 'kawa')).toBe(false);
    expect(matchesKeyword('Kawa ziarnista', 'kawa ziarnista')).toBe(true);
    expect(matchesKeyword('Kawa mielona', 'kawa ziarnista')).toBe(false);
  });
});

describe('keyword matching on real leaflet titles', () => {
  it.each([
    ['Kawa mielona Jacobs Krönung', 'kawa', true],
    ['Filet z kurczaka', 'kurczak', true],
    ['Bułka Kłos Tomcio Paluch z kurczakiem', 'kurczak', true],
    ['Ciastka Sensations z kawałkami czekolady Milka', 'kawa', false],
    ['Przyprawa do kurczaka złocista Kamis XXL', 'kurczak', false],
    ['Ekspres do kawy', 'kawa', false],
    ['Karma dla psów z kurczakiem', 'kurczak', true], // pets are filtered in scoring, not here
  ])('%s ~ %s → %p', (title, keyword, expected) => {
    expect(matchesKeyword(title, keyword)).toBe(expected);
  });

  it('search matches any prefix while typing', () => {
    expect(matchesSearch('Bułka z kurczakiem', 'kurcz')).toBe(true);
    expect(matchesSearch('Bułka z kurczakiem', 'kurczakiem bu')).toBe(true);
    expect(matchesSearch('Bułka z kurczakiem', 'kawa')).toBe(false);
    expect(matchesSearch('Bułka', '  ')).toBe(false);
  });
});

describe('price', () => {
  it.each([
    ['4,99 zł', 4.99],
    ['4.99', 4.99],
    ['1 299,00 zł', 1299],
    ['1.299,00 zł', 1299],
    ['12,49 zł/kg', 12.49],
    [3.5, 3.5],
    ['brak', undefined],
    [0, undefined],
  ])('parses %p', (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each([
    ['1+1 gratis', 50],
    ['2+1', 33],
    ['4+2 gratis', 33],
    ['-50% na drugi', 25],
    ['-40% na drugą sztukę', 20],
    ['-30%', 30],
    ['Druga za pół ceny', 50],
    ['Nowość', undefined],
  ])('reads discount from label %p', (label, expected) => {
    expect(discountFromLabel(label)).toBe(expected);
  });

  it('prefers stated discount, then prices, then label', () => {
    expect(effectiveDiscount({ discountPercent: 20, price: 5, oldPrice: 10 })).toBe(20);
    expect(effectiveDiscount({ price: 5, oldPrice: 10 })).toBe(50);
    expect(effectiveDiscount({ price: 5, promoLabel: '1+1' })).toBe(50);
    expect(effectiveDiscount({ price: 5 })).toBe(0);
  });

  it('formats in Polish style', () => {
    expect(formatPrice(4.9)).toBe('4,90 zł');
  });
});

describe('classify', () => {
  it.each([
    ['Filet z piersi kurczaka', 'meat'],
    ['Masło extra 200 g', 'dairy'],
    ['Ser Gouda plastry', 'dairy'],
    ['Pomidory malinowe', 'produce'],
    ['Piwo Tyskie puszka', 'alcohol'],
    ['Kawa mielona', 'drinks'],
    ['Płyn do naczyń Ludwik', 'household'],
    ['Czekolada mleczna Milka', 'sweets'],
    ['Szampon do włosów', 'cosmetics'],
    ['Patelnia 28 cm', 'nonfood'],
    ['Coś zupełnie innego', 'other'],
    // Real leaflet titles that used to land in "other" or the wrong category:
    ['Karma dla psów Dolina Noteci', 'pets'],
    ['Sucha karma dla kotów Whiskas z kurczakiem', 'pets'],
    ['Przekąska dla psów K-Classic', 'pets'],
    ['Znicz Lilia bez wkładu', 'nonfood'],
    ['Klocki LEGO 76475', 'nonfood'],
    ['Nektar Bobo Frut jabłko-marchew', 'drinks'],
    ['Kombucha BIO Dobra Karma', 'drinks'],
    ['Sałatka lunchbox Gyros z kurczakiem Dobra Karma', 'ready'],
    ['Edamame nasiona soi wasabi Vitasia Japanese Style', 'pantry'],
    ['Przyprawa do kurczaka złocista Kamis XXL', 'pantry'],
    ['Wódka Hlibny Dar', 'alcohol'],
    ['Bombonierka Merci', 'sweets'],
  ])('%s → %s', (title, category) => {
    expect(classify(title)).toBe(category);
  });
});

describe('scoring', () => {
  it('hides deals from disabled stores, hidden categories, blocked words and expired ones', () => {
    const p = prefs({ stores: ['biedronka'] });
    expect(isVisible(deal({}), p, NOW)).toBe(false);
    expect(isVisible(deal({ category: 'alcohol' }), prefs({ hiddenCategories: ['alcohol'] }), NOW)).toBe(false);
    expect(isVisible(deal({ title: 'Piwo jasne' }), prefs({ blockedKeywords: ['piwo'] }), NOW)).toBe(false);
    expect(isVisible(deal({ validTo: '2026-10-12' }), prefs(), NOW)).toBe(false);
    expect(isVisible(deal({ validTo: '2026-10-13' }), prefs(), NOW)).toBe(true);
    expect(isVisible(deal({ requiresApp: true }), prefs({ includeAppOnly: false }), NOW)).toBe(false);
  });

  it('marks deals hot by discount threshold or keyword match', () => {
    const p = prefs({ minDiscount: 30, keywords: ['kawa'] });
    expect(scoreDeal(deal({ price: 7, oldPrice: 10 }), p, NOW).hot).toBe(true); // 30%
    expect(scoreDeal(deal({ price: 8, oldPrice: 10 }), p, NOW).hot).toBe(false); // 20%
    expect(scoreDeal(deal({ title: 'Kawa ziarnista', price: 9, oldPrice: 10 }), p, NOW).hot).toBe(true);
  });

  it('ignores pet food when matching food keywords', () => {
    const p = prefs({ keywords: ['kurczak'] });
    const petFood = deal({ title: 'Karma dla kotów z kurczakiem', category: 'pets' });
    expect(scoreDeal(petFood, p, NOW).hot).toBe(false);
    expect(scoreDeal(petFood, prefs({ keywords: ['karma'] }), NOW).hot).toBe(true);
  });

  it('can restrict hot deals to favourite categories', () => {
    const p = prefs({ minDiscount: 20, favoriteCategories: ['meat'], onlyFavoriteCategories: true });
    expect(scoreDeal(deal({ category: 'meat', discountPercent: 25 }), p, NOW).hot).toBe(true);
    expect(scoreDeal(deal({ category: 'sweets', discountPercent: 60 }), p, NOW).hot).toBe(false);
  });

  it('ranks keyword matches and favourite categories above bigger plain discounts', () => {
    const p = prefs({ keywords: ['masło'], favoriteCategories: ['meat'] });
    const ranked = rankDeals(
      [
        deal({ title: 'Czekolada', discountPercent: 50 }),
        deal({ title: 'Masło extra', discountPercent: 20 }),
        deal({ title: 'Schab', category: 'meat', discountPercent: 40 }),
      ],
      p,
      NOW,
    );
    expect(ranked.map((s) => s.deal.title)).toEqual(['Masło extra', 'Schab', 'Czekolada']);
  });
});

describe('preferences', () => {
  it('fills in fields missing from older saved versions', () => {
    const merged = mergePreferences({
      keywords: ['kawa'],
      notifications: { enabled: false } as Preferences['notifications'],
    });
    expect(merged.keywords).toEqual(['kawa']);
    expect(merged.notifications).toEqual({ ...DEFAULT_PREFERENCES.notifications, enabled: false });
    expect(merged.stores).toEqual(DEFAULT_PREFERENCES.stores);
    expect(mergePreferences(null)).toBe(DEFAULT_PREFERENCES);
  });
});

describe('demo data', () => {
  it('covers all four stores with unique ids and current dates', () => {
    const deals = demoDeals(NOW);
    expect(new Set(deals.map((d) => d.store))).toEqual(new Set(['lidl', 'biedronka', 'zabka', 'kaufland']));
    expect(new Set(deals.map((d) => d.id)).size).toBe(deals.length);
    expect(deals.every((d) => isVisible(d, prefs(), NOW))).toBe(true);
    expect(deals.filter((d) => d.category === 'other')).toEqual([]);
  });
});
