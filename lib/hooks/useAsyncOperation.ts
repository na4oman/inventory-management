'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/components/shared/Toast'

interface UseAsyncOperationOptions {
  successMessage?: string
  errorMessage?: string
  onSuccess?: () => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>
}

/**
 * Custom hook for managing async operations with loading state and toast notifications
 */
export function useAsyncOperation(options: UseAsyncOperationOptions = {}) {
  const {
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    onSuccess,
    onError,
  } = options

  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async <T,>(asyncFn: () => Promise<T>): Promise<T | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await asyncFn()
        toast.showSuccess(successMessage)
        if (onSuccess) {
          await onSuccess()
        }
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        const message = error.message || errorMessage
        toast.showError('Error', message)
        if (onError) {
          await onError(error)
        }
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [toast, successMessage, errorMessage, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
  }, [])

  return { execute, isLoading, error, reset }
}
