'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiResponse } from '@/lib/types/api'

/**
 * Delete a customer price record by its id.
 * Invalidates customer-prices queries on success.
 */
export function useDeleteCustomerPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/customer-prices/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete customer price')
      }
      return response.json() as Promise<ApiResponse<null>>
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
