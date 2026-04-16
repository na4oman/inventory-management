'use client'

import { useState, useCallback } from 'react'

interface UseRetryOptions {
  maxAttempts?: number
  delayMs?: number
  backoffMultiplier?: number
}

/**
 * Custom hook for implementing retry logic with exponential backoff
 */
export function useRetry(options: UseRetryOptions = {}) {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
  } = options

  const [attempts, setAttempts] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const execute = useCallback(
    async <T,>(asyncFn: () => Promise<T>): Promise<T> => {
      let lastError: Error | null = null
      let currentAttempt = 0

      while (currentAttempt < maxAttempts) {
        try {
          setAttempts(currentAttempt + 1)
          return await asyncFn()
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          currentAttempt++

          if (currentAttempt < maxAttempts) {
            setIsRetrying(true)
            const delay = delayMs * Math.pow(backoffMultiplier, currentAttempt - 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
            setIsRetrying(false)
          }
        }
      }

      throw lastError || new Error('Max retry attempts reached')
    },
    [maxAttempts, delayMs, backoffMultiplier]
  )

  const reset = useCallback(() => {
    setAttempts(0)
    setIsRetrying(false)
  }, [])

  return { execute, attempts, isRetrying, reset }
}
