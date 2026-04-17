import { describe, it, expect } from 'vitest';
import { validatePrice } from './price';

describe('validatePrice', () => {
  it('accepts zero', () => {
    expect(validatePrice(0)).toBe(0);
  });

  it('accepts positive integers', () => {
    expect(validatePrice(100)).toBe(100);
  });

  it('accepts positive decimals', () => {
    expect(validatePrice(9.99)).toBe(9.99);
  });

  it('accepts numeric strings', () => {
    expect(validatePrice('42')).toBe(42);
  });

  it('accepts zero as string', () => {
    expect(validatePrice('0')).toBe(0);
  });

  it('rejects negative values with descriptive message', () => {
    expect(() => validatePrice(-1)).toThrow('Price must be 0 or greater');
  });

  it('rejects negative decimals', () => {
    expect(() => validatePrice(-0.01)).toThrow('Price must be 0 or greater');
  });

  it('rejects NaN with descriptive message', () => {
    expect(() => validatePrice(NaN)).toThrow('Price must be a valid number');
  });

  it('rejects non-numeric strings', () => {
    expect(() => validatePrice('abc')).toThrow('Price must be a valid number');
  });

  it('rejects null', () => {
    expect(() => validatePrice(null)).toThrow('Price must be a valid number');
  });

  it('rejects undefined', () => {
    expect(() => validatePrice(undefined)).toThrow('Price must be a valid number');
  });

  it('rejects empty string', () => {
    expect(() => validatePrice('')).toThrow('Price must be a valid number');
  });

  it('rejects boolean values', () => {
    expect(() => validatePrice(true)).toThrow('Price must be a valid number');
    expect(() => validatePrice(false)).toThrow('Price must be a valid number');
  });
});
