'use client'

import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorMessageProps {
  title?: string
  message: string
  onDismiss?: () => void
}

export function ErrorMessage({
  title = 'Error',
  message,
  onDismiss,
}: ErrorMessageProps) {
  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
      <CardContent className="flex gap-4 pt-6">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 dark:text-red-100">
            {title}
          </h3>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200">
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            ✕
          </button>
        )}
      </CardContent>
    </Card>
  )
}
