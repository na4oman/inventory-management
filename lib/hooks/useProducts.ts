'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Product, ProductWithAvailability } from '@/lib/types/database'
import { ApiResponse, PaginatedResponse, TableFilters } from '@/lib/types/api'

/**
 * Fetch products with pagination, search, and filtering
 */
export function useProducts(filters: TableFilters = {}) {
  const queryKey = ['products', filters]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
      if (filters.page) params.append('page', String(filters.page))
      if (filters.pageSize) params.append('pageSize', String(filters.pageSize))
      if (filters.priceMin !== undefined) params.append('priceMin', String(filters.priceMin))
      if (filters.priceMax !== undefined) params.append('priceMax', String(filters.priceMax))
      if (filters.stockMin !== undefined) params.append('stockMin', String(filters.stockMin))
      if (filters.stockMax !== undefined) params.append('stockMax', String(filters.stockMax))

      const response = await fetch(`/api/products?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch products')
      const result = await response.json() as ApiResponse<PaginatedResponse<ProductWithAvailability>>
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch products')
      return result.data
    },
    retry: (failureCount, error) => {
      // Retry on network errors and 5xx errors
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
 * Fetch a single product by ID
 */
export function useProduct(productId: string) {
  return useQuery({
    queryKey: ['products', productId],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}`)
      if (!response.ok) throw new Error('Failed to fetch product')
      return response.json() as Promise<ApiResponse<Product>>
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

/**
 * Create a new product
 */
export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create product')
      }
      return response.json() as Promise<ApiResponse<Product>>
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
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/**
 * Update an existing product
 */
export function useUpdateProduct(productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update product')
      }
      return response.json() as Promise<ApiResponse<Product>>
    },
    retry: (failureCount, error) => {
      if (failureCount < 2) {
        const message = error instanceof Error ? error.message : ''
        return message.includes('network') || message.includes('500') || message.includes('502') || message.includes('503')
      }
      return false
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onSuccess: (data) => {
      queryClient.setQueryData(['products', productId], data)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/**
 * Delete a product
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete product')
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
    onSuccess: (_, productId) => {
      // Clear all product-related queries to force a fresh fetch
      queryClient.removeQueries({ queryKey: ['products'] })
      queryClient.removeQueries({ queryKey: ['products', productId] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

/**
 * Import products from Excel file
 */
export function useImportProducts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to import products')
      }
      return response.json() as Promise<ApiResponse<{ imported: number; errors: string[] }>>
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
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
