/**
 * Client Form Validation Schemas
 */

import { z } from 'zod';

/**
 * Schema for creating a new client
 */
export const createClientSchema = z.object({
  name: z
    .string()
    .min(1, 'Client name is required')
    .max(200, 'Client name must be 200 characters or less'),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be 255 characters or less')
    .optional()
    .nullable(),
  phone: z
    .string()
    .max(20, 'Phone must be 20 characters or less')
    .optional()
    .nullable(),
  address: z
    .string()
    .max(500, 'Address must be 500 characters or less')
    .optional()
    .nullable(),
});

/**
 * Schema for updating a client (all fields optional)
 */
export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
