'use client'

import { useQuery } from '@tanstack/react-query'
import { ApiResponse, PaginatedResponse } from '@/lib/types/api'
import { ProductPriceRow } from '@/lib/types/price'

export interface PriceListFilters {
  page?: number
  pageSize?: 25 | 50
  search?: string
  sortBy?: 'part_number' | 'cost_price' | 'sell_price'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Fetch paginated, searchable, sortable product price list
 */
export function usePriceList(filters: PriceListFilters = {}) {
  const queryKey = ['prices', filters]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
      if (filters.page) params.append('page', String(filters.page))
      if (filters.pageSize) params.append('pageSize', String(filters.pageSize))

      const response = await fetch(`/api/prices?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch price list')
      const result = await response.json() as ApiResponse<PaginatedResponse<ProductPriceRow>>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch price list')
      return result.data
    },
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
