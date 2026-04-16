'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  showSuccess: (title: string, message?: string) => void
  showError: (title: string, message?: string, action?: { label: string; onClick: () => void }) => void
  showInfo: (title: string, message?: string) => void
  showWarning: (title: string, message?: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined
)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    setToasts((prev) => [...prev, newToast])

    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id)
      }, toast.duration || 3000)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showSuccess = React.useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'success', title, message, duration: 3000 })
    },
    [addToast]
  )

  const showError = React.useCallback(
    (title: string, message?: string, action?: { label: string; onClick: () => void }) => {
      addToast({ type: 'error', title, message, duration: 5000, action })
    },
    [addToast]
  )

  const showInfo = React.useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'info', title, message, duration: 3000 })
    },
    [addToast]
  )

  const showWarning = React.useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'warning', title, message, duration: 4000 })
    },
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      {mounted && <ToastContainer toasts={toasts} onRemove={removeToast} />}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>,
    document.body
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: () => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const bgColors = {
    success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900',
    error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900',
    info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900',
    warning:
      'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-900',
  }

  const textColors = {
    success: 'text-green-900 dark:text-green-100',
    error: 'text-red-900 dark:text-red-100',
    info: 'text-blue-900 dark:text-blue-100',
    warning: 'text-yellow-900 dark:text-yellow-100',
  }

  const iconColors = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
  }

  const icons = {
    success: <CheckCircle className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
  }

  return (
    <div
      className={`flex gap-3 rounded-lg border p-4 ${bgColors[toast.type]} animate-in slide-in-from-right-full duration-200 pointer-events-auto`}
    >
      <div className={`flex-shrink-0 ${iconColors[toast.type]}`}>
        {icons[toast.type]}
      </div>
      <div className="flex-1">
        <p className={`font-semibold ${textColors[toast.type]}`}>
          {toast.title}
        </p>
        {toast.message && (
          <p className={`text-sm ${textColors[toast.type]}`}>
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className={`mt-2 text-sm font-medium underline hover:opacity-70`}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={onRemove}
        className={`flex-shrink-0 ${textColors[toast.type]} hover:opacity-70`}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
