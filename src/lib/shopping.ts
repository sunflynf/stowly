/** Suggested amount to buy: enough to get back above the low-stock threshold. */
export function suggestedBuyQuantity(quantity: number, min: number | null): number {
  if (min === null) return 1;
  return Math.max(1, Math.ceil(min - quantity + 1));
}
