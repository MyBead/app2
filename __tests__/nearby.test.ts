import {
  distanceMeters,
  formatDistance,
  nearestPerStore,
  overpassQuery,
  parseOverpass,
  storeForBrand,
} from '../src/core/nearby';

describe('nearby shops', () => {
  it('maps OSM brands to chains', () => {
    expect(storeForBrand('Żabka', 'Żabka')).toBe('zabka');
    expect(storeForBrand('Carrefour Express', undefined)).toBe('carrefour');
    expect(storeForBrand('RTV Euro AGD', 'RTV Euro AGD')).toBe('euro');
    expect(storeForBrand('United Colors of Benetton', undefined)).toBeUndefined();
  });

  it('measures distances', () => {
    // Warsaw Palace of Culture → Warsaw Central station, roughly 400 m.
    const d = distanceMeters(52.2318, 21.006, 52.2289, 21.0032);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(450);
    expect(formatDistance(437)).toBe('440 м');
    expect(formatDistance(1530)).toBe('1,5 км');
  });

  it('parses an Overpass response, nearest first, one per chain', () => {
    const shops = parseOverpass(
      {
        elements: [
          { lat: 52.24, lon: 21.01, tags: { brand: 'Biedronka', name: 'Biedronka' } },
          { lat: 52.2301, lon: 21.0125, tags: { brand: 'Żabka' } },
          { center: { lat: 52.232, lon: 21.013 }, tags: { brand: 'Żabka' } },
          { lat: 52.23, lon: 21.01, tags: { brand: 'Benetton' } },
        ],
      },
      52.2297,
      21.0122,
    );
    expect(shops.map((s) => s.store)).toEqual(['zabka', 'zabka', 'biedronka']);
    expect(nearestPerStore(shops).map((s) => s.store)).toEqual(['zabka', 'biedronka']);
  });

  it('builds a query for the chosen chains', () => {
    expect(overpassQuery(52.2, 21.0, 2000, ['zabka', 'lidl'])).toContain(
      '"brand"~"[ŻżZz]abka|Lidl",i](around:2000,52.2,21)',
    );
  });
});
