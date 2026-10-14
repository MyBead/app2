import { dealsForProduct, isProductBarcode, parseProductJson, productQuery } from '../src/core/barcode';
import type { Deal } from '../src/core/types';

const deal = (store: Deal['store'], title: string, price?: number): Deal => ({
  id: `${store}:${title}`,
  store,
  title,
  price,
  category: 'other',
  source: 'live',
});

describe('barcodes', () => {
  it.each([
    ['5900259000002', true], // EAN-13
    ['3017620422003', true], // Nutella
    ['3017620422004', false], // wrong check digit
    ['96385074', true], // EAN-8
    ['036000291452', true], // UPC-A
    ['https://example.com', false],
    ['12345', false],
  ])('%s → %p', (code, expected) => {
    expect(isProductBarcode(code)).toBe(expected);
  });

  it('reads Open Food Facts answers, preferring the Polish name', () => {
    expect(
      parseProductJson('3017620422003', {
        status: 1,
        product: {
          product_name: 'Nutella',
          product_name_pl: 'Nutella krem do smarowania z orzechami laskowymi i kakao',
          brands: 'Nutella, Ferrero',
          quantity: '400 g',
        },
      }),
    ).toEqual({
      code: '3017620422003',
      name: 'Nutella krem do smarowania z orzechami laskowymi i kakao',
      brand: 'Nutella',
      quantity: '400 g',
    });
    expect(parseProductJson('1', { status: 0 })).toBeNull();
    expect(parseProductJson('1', { status: 1, product: { product_name: ' ' } })).toBeNull();
  });
});

describe('deals for a scanned product', () => {
  const deals = [
    deal('lidl', 'Krem czekoladowy Nutella 600 g', 21.99),
    deal('biedronka', 'Nutella krem orzechowy 350 g', 13.99),
    deal('kaufland', 'Krem orzechowy z kakao Nussbaum', 7.99),
    deal('zabka', 'Nutella B-ready', 4.49),
    deal('aldi', 'Kawa mielona Lavazza', 19.99),
    deal('netto', 'Krem do rąk Nivea', 9.99),
  ];
  const nutella = {
    code: '3017620422003',
    name: 'Krem orzechowy z kakao Nutella',
    brand: 'Nutella',
  };

  it('puts the same brand first, then the same kind of product', () => {
    const found = dealsForProduct(nutella, deals);
    expect(found.map((m) => [m.deal.store, m.exact])).toEqual([
      ['biedronka', true],
      ['lidl', true],
      ['kaufland', false],
    ]);
  });

  it('builds a short query for the list', () => {
    expect(productQuery(nutella)).toBe('Nutella krem');
    expect(productQuery({ code: '1', name: 'Mleko UHT 3,2% Łaciate' })).toBe('mleko uht');
  });

  it('works with a typed name and no brand', () => {
    const found = dealsForProduct({ code: '1', name: 'kawa mielona' }, deals);
    expect(found.map((m) => m.deal.store)).toEqual(['aldi']);
  });
});
