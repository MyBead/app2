import { comparablePrices, formatUnitPrice, parseQuantity, unitPrice } from '../src/core/units';

describe('parseQuantity', () => {
  it.each([
    ['Masło extra 200 g', { amount: 0.2, unit: 'kg' }],
    ['Woda 1,5 l', { amount: 1.5, unit: 'l' }],
    ['Piwo 4 x 500 ml', { amount: 2, unit: 'l' }],
    ['Jogurt 2x150g', { amount: 0.3, unit: 'kg' }],
    ['Jaja 10 szt.', { amount: 10, unit: 'szt' }],
    ['Kawa mielona Jacobs', undefined],
  ])('%s', (text, expected) => {
    const q = parseQuantity(text);
    if (!expected) return expect(q).toBeUndefined();
    expect(q?.unit).toBe(expected.unit);
    expect(q?.amount).toBeCloseTo(expected.amount);
  });
});

describe('unitPrice', () => {
  it('computes, reads stated and per-kilo prices', () => {
    expect(unitPrice({ title: 'Kawa 250 g', price: 14.99 })).toEqual({ value: 59.96, unit: 'kg' });
    expect(unitPrice({ title: 'Kubek', subtitle: '80 g, 68,75 zł/kg', price: 5.5 })).toEqual({
      value: 68.75,
      unit: 'kg',
    });
    expect(unitPrice({ title: 'Filet z kurczaka', subtitle: 'cena za 1 kg', price: 16.99 })).toEqual({
      value: 16.99,
      unit: 'kg',
    });
    expect(unitPrice({ title: 'Pralka Beko 6 kg', price: 879, category: 'electronics' })).toBeUndefined();
    expect(formatUnitPrice({ value: 59.96, unit: 'kg' })).toBe('59,96 zł/kg');
  });

  it('compares per unit only when both packs state a size in the same unit', () => {
    expect(comparablePrices({ title: 'Kawa 250 g', price: 15 }, { title: 'Kawa 1 kg', price: 50 })).toEqual([60, 50]);
    expect(comparablePrices({ title: 'Kawa 250 g', price: 15 }, { title: 'Kawa', price: 50 })).toEqual([15, 50]);
  });
});
