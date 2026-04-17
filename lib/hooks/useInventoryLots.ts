'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InventoryLot } from '@/lib/types/database'
import { ApiResponse } from '@/lib/types/api'

export type LotStatus = 'active' | 'depleted' | 'all'

interface InventoryLotsResponse {
  data: InventoryLot[]
  total: number
}

/**
 * Fetch inventory lots for a product with optional status filter.
 * Lots are ordered by arrival_date ASC (oldest first).
 */
export function useInventoryLots(productId: string, status: LotStatus = 'active') {
  return useQuery({
    queryKey: ['inventory-lots', productId, status],
    queryFn: async () => {
      const params = new URLSearchParams({ product_id: productId })
      if (status !== 'all') params.append('status', status)

      const response = await fetch(`/api/inventory-lots?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch inventory lots')
      const result = await response.json() as ApiResponse<InventoryLotsResponse>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch inventory lots')
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

interface CreateLotInput {
  product_id: string
  quantity: number
  cost_price: number
  arrival_date: string
  notes?: string
}

/**
 * Create a new free-stock inventory lot.
 * Invalidates inventory-lots and products queries on success.
 */
export function useCreateInventoryLot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateLotInput) => {
      const response = await fetch('/api/inventory-lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create inventory lot')
      }
      return response.json() as Promise<ApiResponse<InventoryLot>>
    },
    retry: (failureCount, error) => {
      if (failureCount < 2) {
        const message = error instanceof Error ? error.message : ''
        return message.includes('network') || message.includes('500') || message.includes('502') || message.includes('503')
      }
      return false
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onSuccess: (_, variables) => {
      // Invalidate lots for this product (all statuses)
      queryClient.invalidateQueries({ queryKey: ['inventory-lots', variables.product_id] })
      // Sync products.qty is handled by the RPC, so invalidate the product too
      queryClient.invalidateQueries({ queryKey: ['products', variables.product_id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
