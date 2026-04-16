/**
 * Sale Form Validation Schemas
 */

import { z } from 'zod';

/**
 * Schema for creating a sale from an order
 */
export const convertOrderToSaleSchema = z.object({
  order_id: z
    .string()
    .uuid('Invalid order ID'),
});

export type ConvertOrderToSaleInput = z.infer<typeof convertOrderToSaleSchema>;
