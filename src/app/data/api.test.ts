import { describe, expect, it } from 'vitest';
import { BasketStoreResult, compareBasketValue } from './api';

function basket(store: string, availableCount: number, totalCost: number): BasketStoreResult {
  // The test fixture includes the complete response shape so ranking changes
  // remain compatible with both scraper/provider and estimate responses.
  return {
    store,
    total_cost: totalCost,
    total_cost_str: `$${totalCost.toFixed(2)}`,
    available_items: [],
    missing_items: [],
    breakdown: [],
    available_count: availableCount,
    missing_count: 0,
  };
}

describe('basket result ranking', () => {
  it('ranks a complete basket ahead of a cheaper partial basket', () => {
    const complete = basket('Complete Store', 3, 15);
    const partial = basket('Partial Store', 1, 2);

    expect([partial, complete].sort(compareBasketValue)[0]).toBe(complete);
  });

  it('uses price to rank stores with equal item coverage', () => {
    const expensive = basket('Expensive Store', 3, 18);
    const affordable = basket('Affordable Store', 3, 14);

    expect([expensive, affordable].sort(compareBasketValue)[0]).toBe(affordable);
  });
});
