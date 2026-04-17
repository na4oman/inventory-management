'use client'

import { useQuery } from '@tanstack/react-query'
import { ApiResponse } from '@/lib/types/api'
import { CustomerPriceWithDetails } from '@/lib/types/price'

export interface CustomerPricesFilters {
  product_id?: string
  client_id?: string
}

/**
 * Fetch customer prices filtered by product_id or client_id (at least one required).
 * Returns CustomerPriceWithDetails[] with joined client/product info.
 */
export function useCustomerPrices(filters: CustomerPricesFilters) {
  const queryKey = ['customer-prices', filters]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.product_id) params.append('product_id', filters.product_id)
      if (filters.client_id) params.append('client_id', filters.client_id)

      const response = await fetch(`/api/customer-prices?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch customer prices')
      const result = await response.json() as ApiResponse<CustomerPriceWithDetails[]>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch customer prices')
      return result.data
    },
    enabled: !!(filters.product_id || filters.client_id),
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
