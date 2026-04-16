/**
 * User-friendly error message utilities
 * Converts technical errors to user-readable messages
 */

export interface ErrorMessageConfig {
  title: string
  message: string
  action?: string
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyErrorMessage(error: unknown): ErrorMessageConfig {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        action: 'Retry',
      }
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        action: 'Review',
      }
    }

    // Insufficient inventory
    if (message.includes('insufficient') || message.includes('inventory')) {
      return {
        title: 'Insufficient Inventory',
        message: 'Not enough inventory available for this operation.',
        action: 'Check Stock',
      }
    }

    // Not found errors
    if (message.includes('not found') || message.includes('404')) {
      return {
        title: 'Not Found',
        message: 'The requested item could not be found.',
        action: 'Go Back',
      }
    }

    // Unauthorized/forbidden
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('401') || message.includes('403')) {
      return {
        title: 'Access Denied',
        message: 'You do not have permission to perform this action.',
        action: 'Go Back',
      }
    }

    // Conflict errors (e.g., duplicate)
    if (message.includes('conflict') || message.includes('duplicate') || message.includes('409')) {
      return {
        title: 'Conflict',
        message: 'This item already exists or conflicts with existing data.',
        action: 'Review',
      }
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        title: 'Request Timeout',
        message: 'The request took too long. Please try again.',
        action: 'Retry',
      }
    }

    // Server errors
    if (message.includes('server') || message.includes('500')) {
      return {
        title: 'Server Error',
        message: 'Something went wrong on the server. Please try again later.',
        action: 'Retry',
      }
    }

    // Generic error with original message
    return {
      title: 'Error',
      message: error.message || 'An unexpected error occurred. Please try again.',
      action: 'Retry',
    }
  }

  // Unknown error
  return {
    title: 'Error',
    message: 'An unexpected error occurred. Please try again.',
    action: 'Retry',
  }
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return 'An unexpected error occurred'
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // Network errors are retryable
    if (message.includes('network') || message.includes('fetch')) {
      return true
    }

    // Timeout errors are retryable
    if (message.includes('timeout') || message.includes('timed out')) {
      return true
    }

    // Server errors (5xx) are retryable
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return true
    }

    // Too many requests is retryable
    if (message.includes('429') || message.includes('too many')) {
      return true
    }
  }

  return false
}

/**
 * Get retry delay in milliseconds with exponential backoff
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
  const delay = Math.min(1000 * Math.pow(2, attemptNumber - 1), 16000)
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 1000
  return delay + jitter
}
