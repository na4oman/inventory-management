'use client'

import { useQuery } from '@tanstack/react-query'
import { AnalyticsSummary, InventoryOverview } from '@/lib/types/database'
import { ApiResponse } from '@/lib/types/api'

export interface AnalyticsFilters {
  startDate?: string
  endDate?: string
}

/**
 * Fetch inventory overview with aggregated data
 */
export function useInventoryOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/overview')
      if (!response.ok) throw new Error('Failed to fetch inventory overview')
      const result = await response.json() as ApiResponse<InventoryOverview>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch inventory overview')
      return result.data
    },
    staleTime: 1000 * 60 * 5,
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
 * Fetch analytics summary with sales data and trends
 */
export function useAnalyticsSummary(filters: AnalyticsFilters = {}) {
  const queryKey = ['analytics', 'summary', filters]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/analytics/summary?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch analytics summary')
      const result = await response.json() as ApiResponse<AnalyticsSummary>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch analytics summary')
      return result.data
    },
    staleTime: 1000 * 60 * 5,
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
