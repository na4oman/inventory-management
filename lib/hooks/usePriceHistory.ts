'use client'

import { useQuery } from '@tanstack/react-query'
import { ApiResponse } from '@/lib/types/api'
import { PriceHistoryEntry } from '@/lib/types/price'

/**
 * Fetch price history for a product, ordered by changed_at descending
 */
export function usePriceHistory(productId: string) {
  return useQuery({
    queryKey: ['prices', 'history', productId],
    queryFn: async () => {
      const response = await fetch(`/api/prices/history/${productId}`)
      if (!response.ok) throw new Error('Failed to fetch price history')
      const result = await response.json() as ApiResponse<PriceHistoryEntry[]>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch price history')
      return result.data
    },
    enabled: !!productId,
    retry: (failureCount, error) => {
      if (failureCount < 3) {
        const message = error instanceof Error ? error.message : ''
        return message.includes('network') || message.includes('500') || message.includes('502') || message.includes('503')
      }
      return false
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}
