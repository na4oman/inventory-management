# Error Handling and Loading States Implementation Guide

## Overview

This document describes the comprehensive error handling and loading states system implemented for the Inventory Management App. The system provides graceful error recovery, user-friendly error messages, loading skeletons, and automatic retry logic with exponential backoff.

## Components

### 1. Error Boundaries (`components/shared/ErrorBoundary.tsx`)

Error boundaries catch React component errors and display a user-friendly error UI with a retry button.

**Features:**
- Catches unhandled errors in component tree
- Displays error message with icon
- Provides retry button to recover from errors
- Logs errors to console for debugging
- Customizable fallback UI

**Usage:**
```tsx
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

export default function MyModule() {
  return (
    <ErrorBoundary moduleName="My Module">
      <YourComponent />
    </ErrorBoundary>
  )
}
```

### 2. Loading Skeletons (`components/shared/Skeleton.tsx`)

Skeleton components provide visual placeholders while data is loading.

**Available Skeletons:**
- `Skeleton` - Generic skeleton with customizable dimensions
- `TableSkeleton` - Skeleton for table layouts (configurable rows/columns)
- `FormSkeleton` - Skeleton for form layouts
- `CardSkeleton` - Skeleton for card layouts
- `ChartSkeleton` - Skeleton for chart layouts

**Usage:**
```tsx
import { TableSkeleton, FormSkeleton } from '@/components/shared/Skeleton'

// In a table
{isLoading ? <TableSkeleton rows={5} columns={8} /> : <YourTable />}

// In a form
{isLoading ? <FormSkeleton /> : <YourForm />}
```

### 3. Enhanced Toast Notifications (`components/shared/Toast.tsx`)

Toast notifications provide feedback for user actions with support for success, error, info, and warning messages.

**Features:**
- Multiple toast types (success, error, info, warning)
- Customizable duration
- Optional action buttons
- Auto-dismiss with configurable timeout
- Stacked display for multiple toasts

**Usage:**
```tsx
import { useToast } from '@/components/shared/Toast'

export function MyComponent() {
  const { showSuccess, showError, showInfo, showWarning } = useToast()

  const handleSuccess = () => {
    showSuccess('Success', 'Operation completed successfully')
  }

  const handleError = () => {
    showError('Error', 'Something went wrong', {
      label: 'Retry',
      onClick: () => { /* retry logic */ }
    })
  }

  return (
    <>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
    </>
  )
}
```

### 4. Error Message Utilities (`lib/utils/errorMessages.ts`)

Utilities for converting technical errors to user-friendly messages.

**Functions:**
- `getUserFriendlyErrorMessage(error)` - Converts error to user-friendly message
- `extractErrorMessage(error)` - Extracts message from various error types
- `isRetryableError(error)` - Checks if error should be retried
- `getRetryDelay(attemptNumber)` - Calculates exponential backoff delay

**Usage:**
```tsx
import { getUserFriendlyErrorMessage, isRetryableError } from '@/lib/utils/errorMessages'

try {
  await fetchData()
} catch (error) {
  if (isRetryableError(error)) {
    // Retry with exponential backoff
  } else {
    const friendlyError = getUserFriendlyErrorMessage(error)
    toast.showError(friendlyError.title, friendlyError.message)
  }
}
```

## Hooks

### 1. useRetry Hook (`lib/hooks/useRetry.ts`)

Handles retry logic with exponential backoff for async operations.

**Features:**
- Configurable max attempts (default: 3)
- Exponential backoff with jitter
- Callbacks for retry events
- Manual cancel support

**Usage:**
```tsx
import { useRetry } from '@/lib/hooks/useRetry'

export function MyComponent() {
  const { retry, reset, cancel } = useRetry({
    maxAttempts: 3,
    onRetry: (attemptNumber) => console.log(`Retry attempt ${attemptNumber}`),
    onMaxAttemptsReached: () => console.log('Max retries reached')
  })

  const handleFetch = async () => {
    const result = await retry(async () => {
      const response = await fetch('/api/data')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    })
  }

  return <button onClick={handleFetch}>Fetch Data</button>
}
```

### 2. useMutationWithToast Hook (`lib/hooks/useMutationWithToast.ts`)

Wraps React Query mutations with automatic toast notifications.

**Features:**
- Automatic success/error toasts
- Customizable messages
- Callbacks for success/error handling
- Integrates with error message utilities

**Usage:**
```tsx
import { useMutationWithToast } from '@/lib/hooks/useMutationWithToast'

export function MyComponent() {
  const mutation = useMutationWithToast({
    mutationFn: async (data) => {
      const response = await fetch('/api/items', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to create')
      return response.json()
    },
    successMessage: 'Item created successfully',
    errorMessage: (error) => error.message,
    onSuccess: (data) => {
      // Handle success
    }
  })

  return <button onClick={() => mutation.mutate({})}>Create</button>
}
```

### 3. useAsyncOperation Hook (`lib/hooks/useAsyncOperation.ts`)

Handles async operations with loading and error states.

**Features:**
- Loading state management
- Error state management
- Optional toast notifications
- Manual reset capability

**Usage:**
```tsx
import { useAsyncOperation } from '@/lib/hooks/useAsyncOperation'

export function MyComponent() {
  const { isLoading, error, data, execute, reset } = useAsyncOperation()

  const handleFetch = async () => {
    await execute(
      async () => {
        const response = await fetch('/api/data')
        if (!response.ok) throw new Error('Failed to fetch')
        return response.json()
      },
      { showSuccessToast: true, successMessage: 'Data loaded' }
    )
  }

  return (
    <>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      {data && <DataDisplay data={data} />}
      <button onClick={handleFetch}>Load Data</button>
    </>
  )
}
```

## React Query Integration

All React Query hooks have been enhanced with retry logic:

**Retry Configuration:**
- Max 3 attempts for queries
- Max 2 attempts for mutations
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
- Retries on network errors and 5xx server errors
- No retry on validation errors (4xx)

**Example:**
```tsx
// useProducts hook now includes:
return useQuery({
  queryKey: ['products', filters],
  queryFn: async () => { /* ... */ },
  retry: (failureCount, error) => {
    if (failureCount < 3) {
      const message = error instanceof Error ? error.message : ''
      return message.includes('network') || message.includes('500')
    }
    return false
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
})
```

## Module Wrapper Component

The `ModuleWrapper` component provides error boundaries for entire modules.

**Usage:**
```tsx
import { ModuleWrapper } from '@/components/shared/ModuleWrapper'

export default function ProductsPage() {
  return (
    <ModuleWrapper moduleName="Products">
      <ProductsContent />
    </ModuleWrapper>
  )
}
```

## Error Message Mapping

The system maps technical errors to user-friendly messages:

| Error Type | User Message | Action |
|-----------|--------------|--------|
| Network Error | "Unable to connect to the server" | Retry |
| Validation Error | "Please check your input" | Review |
| Insufficient Inventory | "Not enough inventory available" | Check Stock |
| Not Found | "The requested item could not be found" | Go Back |
| Unauthorized | "You do not have permission" | Go Back |
| Conflict | "This item already exists" | Review |
| Timeout | "The request took too long" | Retry |
| Server Error | "Something went wrong on the server" | Retry |

## Best Practices

### 1. Use Error Boundaries for Modules
Wrap each major module with an error boundary to prevent entire app crashes:
```tsx
<ErrorBoundary moduleName="Orders">
  <OrdersContent />
</ErrorBoundary>
```

### 2. Show Loading Skeletons
Use appropriate skeleton components while data loads:
```tsx
{isLoading ? <TableSkeleton /> : <DataTable data={data} />}
```

### 3. Provide User-Friendly Error Messages
Use the error message utilities to convert technical errors:
```tsx
const friendlyError = getUserFriendlyErrorMessage(error)
toast.showError(friendlyError.title, friendlyError.message)
```

### 4. Implement Retry Logic
Use retry hooks for operations that might fail temporarily:
```tsx
const { retry } = useRetry({ maxAttempts: 3 })
await retry(async () => fetchData())
```

### 5. Use Toast Notifications
Provide feedback for user actions:
```tsx
showSuccess('Product created', 'The product has been added to inventory')
showError('Failed to delete', 'Please try again later')
```

### 6. Handle Mutations with Toast
Use `useMutationWithToast` for automatic feedback:
```tsx
const mutation = useMutationWithToast({
  mutationFn: createProduct,
  successMessage: 'Product created successfully'
})
```

## Testing Error Scenarios

To test error handling:

1. **Network Errors**: Use browser DevTools to throttle network
2. **Server Errors**: Mock API responses with 500 status
3. **Validation Errors**: Submit forms with invalid data
4. **Timeout Errors**: Use slow network simulation
5. **Insufficient Inventory**: Create orders exceeding available stock

## Performance Considerations

- Skeletons use CSS animations (no JavaScript overhead)
- Error boundaries prevent cascading failures
- Retry logic uses exponential backoff to avoid overwhelming servers
- Toast notifications are stacked efficiently
- React Query caching reduces unnecessary retries

## Future Enhancements

- Offline error detection and handling
- Persistent error logging
- Error analytics and monitoring
- Advanced retry strategies (circuit breaker pattern)
- Optimistic UI updates with rollback on error
- Error recovery suggestions based on error type
