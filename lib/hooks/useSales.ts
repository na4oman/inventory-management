'use client'

import { useQuery } from '@tanstack/react-query'
import { SaleWithDetails } from '@/lib/types/database'
import { ApiResponse, PaginatedResponse, TableFilters } from '@/lib/types/api'

/**
 * Fetch sales with pagination, search, and filtering
 */
export function useSales(filters: TableFilters = {}) {
  const queryKey = ['sales', filters]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
      if (filters.page) params.append('page', String(filters.page))
      if (filters.pageSize) params.append('pageSize', String(filters.pageSize))
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/sales?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch sales')
      const result = await response.json() as ApiResponse<PaginatedResponse<SaleWithDetails>>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch sales')
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

/**
 * Fetch a single sale by ID with details
 */
export function useSale(saleId: string) {
  return useQuery({
    queryKey: ['sales', saleId],
    queryFn: async () => {
      const response = await fetch(`/api/sales/${saleId}`)
      if (!response.ok) throw new Error('Failed to fetch sale')
      return response.json() as Promise<ApiResponse<SaleWithDetails>>
    },
    enabled: !!saleId,
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
