'use client'

import React, { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

interface ModuleWrapperProps {
  children: ReactNode
  moduleName: string
}

/**
 * Wrapper component that provides error boundary for a module
 */
export function ModuleWrapper({ children, moduleName }: ModuleWrapperProps) {
  return (
    <ErrorBoundary moduleName={moduleName}>
      {children}
    </ErrorBoundary>
  )
}
