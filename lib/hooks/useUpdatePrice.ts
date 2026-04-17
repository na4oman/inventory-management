'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiResponse } from '@/lib/types/api'
import { ProductPriceRow } from '@/lib/types/price'

export interface UpdatePricePayload {
  cost_price?: number
  sell_price?: number
}

/**
 * Update cost_price and/or sell_price for a product.
 * Invalidates the price list query on success.
 */
export function useUpdatePrice(productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdatePricePayload) => {
      const response = await fetch(`/api/prices/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update price')
      }
      return response.json() as Promise<ApiResponse<ProductPriceRow>>
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
      queryClient.invalidateQueries({ queryKey: ['prices'] })
    },
  })
}
