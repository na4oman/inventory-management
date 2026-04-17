/**
 * Price Validation Utilities
 */

/**
 * Validates a price value.
 * - Accepts zero (valid price)
 * - Rejects negative values with message: "Price must be 0 or greater"
 * - Rejects non-numeric values with message: "Price must be a valid number"
 * - Returns the numeric value when valid
 */
export function validatePrice(value: unknown): number {
  const num = Number(value);

  if (value === null || value === undefined || value === '' || typeof value === 'boolean' || isNaN(num)) {
    throw new Error('Price must be a valid number');
  }

  if (num < 0) {
    throw new Error('Price must be 0 or greater');
  }

  return num;
}
