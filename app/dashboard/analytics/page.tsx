'use client'

import React, { useState } from 'react'
import { useInventoryOverview, useAnalyticsSummary } from '@/lib/hooks/useAnalytics'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { SalesChart } from '@/components/analytics/SalesChart'
import { TopProductsTable } from '@/components/analytics/TopProductsTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Percent,
} from 'lucide-react'

export default function AnalyticsDashboard() {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const inventoryQuery = useInventoryOverview()
  const analyticsQuery = useAnalyticsSummary({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
  }

  if (inventoryQuery.isLoading || analyticsQuery.isLoading) {
    return <LoadingSpinner />
  }

  if (inventoryQuery.isError || analyticsQuery.isError) {
    return (
      <ErrorMessage
        message={
          inventoryQuery.error?.message ||
          analyticsQuery.error?.message ||
          'Failed to load analytics data'
        }
      />
    )
  }

  const inventory = inventoryQuery.data
  const analytics = analyticsQuery.data

  const profitMarginValue =
    analytics?.profit_margin !== undefined
      ? analytics.profit_margin.toFixed(2)
      : '0.00'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-slate-500 mt-2">
          View your inventory and sales performance metrics
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium text-slate-700">
            Start Date
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-slate-700">
            End Date
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleClearFilters}
          className="whitespace-nowrap"
        >
          Clear Filters
        </Button>
      </div>

      {/* Inventory Overview Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Inventory Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsCard
            title="Total Quantity"
            value={inventory?.total_qty || 0}
            subtitle="Total items in stock"
            icon={<Package className="h-4 w-4" />}
          />
          <AnalyticsCard
            title="Booked Quantity"
            value={inventory?.booked_qty || 0}
            subtitle="Items reserved in orders"
            icon={<ShoppingCart className="h-4 w-4" />}
          />
          <AnalyticsCard
            title="Available Quantity"
            value={inventory?.available_qty || 0}
            subtitle="Items ready to sell"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <AnalyticsCard
            title="Total Value"
            value={`€${(inventory?.total_value || 0).toFixed(2)}`}
            subtitle="Inventory cost value"
            icon={<DollarSign className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Sales Summary Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Sales Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsCard
            title="Total Revenue"
            value={`€${(analytics?.total_revenue || 0).toFixed(2)}`}
            subtitle={`${analytics?.total_sales || 0} sales`}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <AnalyticsCard
            title="Total Profit"
            value={`€${(analytics?.total_profit || 0).toFixed(2)}`}
            subtitle="Net profit from sales"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <AnalyticsCard
            title="Total Sales"
            value={analytics?.total_sales || 0}
            subtitle="Number of transactions"
            icon={<ShoppingCart className="h-4 w-4" />}
          />
          <AnalyticsCard
            title="Profit Margin"
            value={`${profitMarginValue}%`}
            subtitle="Profit as % of revenue"
            icon={<Percent className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Sales Chart */}
      <SalesChart data={analytics?.sales_by_period || []} />

      {/* Top Products Table */}
      <TopProductsTable products={analytics?.top_selling_products || []} />
    </div>
  )
}
