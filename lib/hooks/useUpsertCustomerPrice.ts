'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiResponse } from '@/lib/types/api'
import { CustomerPrice } from '@/lib/types/price'

export interface UpsertCustomerPricePayload {
  client_id: string
  product_id: string
  price: number
}

/**
 * Upsert a customer price record (insert or update on conflict).
 * Invalidates customer-prices queries on success.
 */
export function useUpsertCustomerPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpsertCustomerPricePayload) => {
      const response = await fetch('/api/customer-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upsert customer price')
      }
      return response.json() as Promise<ApiResponse<CustomerPrice>>
    },
    retry: (failureCount, error) => {
      if (failureCount < 2) {
        const message = error instanceof Error ? error.message : ''
        return message.includes('network') || message.includes('500') || message.includes('502') || message.includes('503')
      }
      return false
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-prices'] })
    },
  })
}
