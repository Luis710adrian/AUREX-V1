import Decimal from 'decimal.js';
export function margin(revenue: string, cost: string, complete: boolean) {
  const r = new Decimal(revenue);
  const c = new Decimal(cost);
  if (r.isNegative() || c.isNegative()) throw new Error('Invalid financial inputs');
  return complete && r.gt(0) ? r.minus(c).div(r).times(100).toDecimalPlaces(2).toString() : null;
}
export function outstanding(subtotal: string, tax: string, payments: string[]) {
  return new Decimal(subtotal)
    .plus(tax)
    .minus(payments.reduce((s, p) => s.plus(p), new Decimal(0)))
    .toFixed(2);
}
