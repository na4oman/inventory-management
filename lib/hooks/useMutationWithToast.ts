'use client'

import { useMutation, UseMutationOptions } from '@tanstack/react-query'
import { useToast } from '@/components/shared/Toast'

interface UseMutationWithToastOptions<TData, TError, TVariables>
  extends Omit<UseMutationOptions<TData, TError, TVariables>, 'onSuccess' | 'onError'> {
  successMessage?: string
  errorMessage?: string
  onSuccess?: (data: TData) => void | Promise<void>
  onError?: (error: TError) => void | Promise<void>
}

/**
 * Custom hook that wraps useMutation with automatic toast notifications
 */
export function useMutationWithToast<TData, TError extends Error, TVariables>(
  options: UseMutationWithToastOptions<TData, TError, TVariables>
) {
  const toast = useToast()
  const {
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    onSuccess: customOnSuccess,
    onError: customOnError,
    ...mutationOptions
  } = options

  return useMutation({
    ...mutationOptions,
    onSuccess: async (data) => {
      toast.showSuccess(successMessage)
      if (customOnSuccess) {
        await customOnSuccess(data)
      }
    },
    onError: async (error) => {
      const message = error instanceof Error ? error.message : errorMessage
      toast.showError('Error', message)
      if (customOnError) {
        await customOnError(error)
      }
    },
  })
}
