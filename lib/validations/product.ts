/**
 * Product Form Validation Schemas
 */

import { z } from 'zod';

/**
 * Schema for creating a new product
 */
export const createProductSchema = z.object({
  part_number: z
    .string()
    .min(1, 'Part number is required')
    .max(100, 'Part number must be 100 characters or less'),
  model: z
    .string()
    .min(1, 'Model is required')
    .max(100, 'Model must be 100 characters or less'),
  model_code: z
    .string()
    .min(1, 'Model code is required')
    .max(50, 'Model code must be 50 characters or less'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be 500 characters or less'),
  color: z
    .string()
    .max(50, 'Color must be 50 characters or less')
    .optional()
    .nullable(),
  qty: z
    .number()
    .min(0, 'Quantity must be non-negative')
    .default(0),
  cost_price: z
    .number()
    .min(0, 'Cost price must be non-negative')
    .default(0),
  sell_price: z
    .number()
    .min(0, 'Sell price must be non-negative')
    .default(0),
});

/**
 * Schema for updating a product (all fields optional)
 */
export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
