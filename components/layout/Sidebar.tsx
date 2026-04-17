'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Package,
  ShoppingCart,
  DollarSign,
  Users,
  BarChart3,
  Menu,
  X,
  Home,
  ChevronLeft,
  ChevronRight,
  Bell,
  Settings,
  Clock,
  Search,
  Tag,
} from 'lucide-react'
import { useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Products', href: '/dashboard/products', icon: Package },
  {
    label: 'Orders',
    href: '/dashboard/orders',
    icon: ShoppingCart,
    subItems: [{ label: 'Pending Orders', href: '/dashboard/orders/pending' }],
  },
  { label: 'Sales', href: '/dashboard/sales', icon: DollarSign },
  { label: 'Prices', href: '/dashboard/prices', icon: Tag },
  { label: 'Clients', href: '/dashboard/clients', icon: Users },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Price Check', href: '/dashboard/price-check', icon: Search },
]

export function Sidebar({ onCollapsedChange }: { onCollapsedChange?: (collapsed: boolean) => void }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
    onCollapsedChange?.(collapsed)
  }

  const NavContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-semibold">Inventory</span>
            </div>
            {/* Desktop only: collapse button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCollapse(true)}
              className="h-8 w-8 hidden md:flex"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Mobile only: close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCollapse(false)}
            className="h-8 w-8 mx-auto"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
              {item.subItems && !collapsed && (
                <div className="space-y-1 pl-4 mt-1">
                  {item.subItems.map((subItem) => {
                    const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/')
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                          isSubActive
                            ? 'bg-amber-100 text-amber-900 border-l-2 border-amber-500'
                            : 'text-slate-600 hover:bg-slate-100 border-l-2 border-transparent'
                        }`}
                      >
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>{subItem.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={`border-t border-slate-200 space-y-1 p-2 dark:border-slate-800 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        <button className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors w-full ${collapsed ? 'justify-center' : ''}`}>
          <Bell className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Notifications</span>}
        </button>
        <button className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors w-full ${collapsed ? 'justify-center' : ''}`}>
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${collapsed ? 'justify-center' : ''}`}>
          <UserButton />
          {!collapsed && <span className="text-sm font-medium text-slate-700">Account</span>}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger button — only shown when sidebar is closed */}
      {!isOpen && (
        <div className="fixed top-3 left-3 z-40 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex fixed left-0 top-0 h-screen flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 transition-all duration-300 z-30 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <NavContent collapsed={isCollapsed} />
      </aside>

      {/* Mobile sidebar — always full width, no collapse */}
      <aside className={`md:hidden fixed left-0 top-0 h-screen w-64 flex flex-col border-r border-slate-200 bg-white dark:bg-slate-950 transition-transform duration-300 z-30 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <NavContent collapsed={false} />
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  )
}
