'use client'

import { createContext, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastProvider } from '@/components/shared/Toast'

export const SidebarContext = createContext<{ isCollapsed: boolean }>({ isCollapsed: false })

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <ToastProvider>
      <SidebarContext.Provider value={{ isCollapsed }}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <Sidebar onCollapsedChange={setIsCollapsed} />
          <div className={`transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
            <Header />
            <main className="overflow-y-auto">
              <div className="p-4 pt-14 md:pt-4">{children}</div>
            </main>
          </div>
        </div>
      </SidebarContext.Provider>
    </ToastProvider>
  )
}
