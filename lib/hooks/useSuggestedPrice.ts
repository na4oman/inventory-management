'use client'

import { useQuery } from '@tanstack/react-query'
import { ApiResponse } from '@/lib/types/api'

export interface SuggestedPrice {
  price: number
  source: 'customer_price' | 'sell_price'
}

/**
 * Fetch suggested unit price for a client–product combination.
 * Returns null on any error (network, 404, 500) — the UI degrades gracefully
 * by leaving the price field empty rather than throwing.
 */
export function useSuggestedPrice(clientId: string, productId: string) {
  const enabled = clientId.trim().length > 0 && productId.trim().length > 0

  return useQuery<SuggestedPrice | null>({
    queryKey: ['prices', 'suggest', clientId, productId],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ client_id: clientId, product_id: productId })
        const response = await fetch(`/api/prices/suggest?${params.toString()}`)
        if (!response.ok) return null
        const result = await response.json() as ApiResponse<SuggestedPrice>
        if (!result.success || !result.data) return null
        return result.data
      } catch {
        return null
      }
    },
    enabled,
    retry: false,
  })
}
