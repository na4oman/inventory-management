/**
 * Order Form Validation Schemas
 */

import { z } from 'zod';

/**
 * Schema for order items in the request
 */
export const orderItemSchema = z.object({
  product_id: z
    .string()
    .uuid('Product ID must be a valid UUID'),
  ordered_qty: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0'),
  unit_price: z
    .number()
    .nonnegative('Unit price must be 0 or greater'),
});

/**
 * Schema for creating a new order
 */
export const createOrderSchema = z.object({
  client_id: z
    .string()
    .uuid('Client ID must be a valid UUID')
    .nullable()
    .optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'Order must have at least one item'),
  notes: z
    .string()
    .max(500, 'Notes must be 500 characters or less')
    .optional()
    .nullable(),
  order_type: z
    .enum(['customer', 'forecast'])
    .optional(),
});

/**
 * Schema for updating order item status and received quantity
 */
export const updateOrderItemSchema = z.object({
  received_qty: z
    .number()
    .int('Received quantity must be an integer')
    .nonnegative('Received quantity must be 0 or greater'),
  status: z
    .enum(['pending', 'received', 'shipped'])
    .optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
