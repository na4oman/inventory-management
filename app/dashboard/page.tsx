'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useProducts } from '@/lib/hooks/useProducts'
import { useOrders } from '@/lib/hooks/useOrders'
import { useSales } from '@/lib/hooks/useSales'
import { useInventoryOverview } from '@/lib/hooks/useAnalytics'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Plus,
  Eye,
  Euro,
} from 'lucide-react'

export default function DashboardPage() {
  // Fetch data
  const productsQuery = useProducts({ pageSize: 1000 })
  const ordersQuery = useOrders({ pageSize: 100, status: 'pending' })
  const salesQuery = useSales({ pageSize: 10 })
  const inventoryQuery = useInventoryOverview()

  const isLoading =
    productsQuery.isLoading ||
    ordersQuery.isLoading ||
    salesQuery.isLoading ||
    inventoryQuery.isLoading

  const hasError =
    productsQuery.isError ||
    ordersQuery.isError ||
    salesQuery.isError ||
    inventoryQuery.isError

  // Calculate stats
  const totalProducts = productsQuery.data?.total || 0
  const pendingOrdersCount = ordersQuery.data?.total || 0
  const recentSalesCount = salesQuery.data?.total || 0
  const inventory = inventoryQuery.data

  // Calculate products with available stock and total inventory cost
  // Use qty directly — booked_qty is not reliably maintained
  const productsWithStock = useMemo(() => {
    if (!productsQuery.data?.data) return { count: 0, totalCost: 0 }
    return productsQuery.data.data.reduce(
      (acc, product) => {
        if (product.qty > 0) {
          acc.count += 1
          acc.totalCost += product.qty * product.cost_price
        }
        return acc
      },
      { count: 0, totalCost: 0 }
    )
  }, [productsQuery.data?.data])

  // Get low stock products (qty < 5)
  const lowStockProducts = useMemo(() => {
    if (!productsQuery.data?.data) return []
    return productsQuery.data.data
      .filter((p) => p.qty < 5)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 5)
  }, [productsQuery.data?.data])

  // Get high booked quantity products (booked_qty > 10)
  const highBookedProducts = useMemo(() => {
    if (!productsQuery.data?.data) return []
    return productsQuery.data.data
      .filter((p) => p.booked_qty > 10)
      .sort((a, b) => b.booked_qty - a.booked_qty)
      .slice(0, 5)
  }, [productsQuery.data?.data])

  // Get recent orders
  const recentOrders = useMemo(() => {
    if (!ordersQuery.data?.data) return []
    return ordersQuery.data.data.slice(0, 5)
  }, [ordersQuery.data?.data])

  // Get recent sales
  const recentSales = useMemo(() => {
    if (!salesQuery.data?.data) return []
    return salesQuery.data.data.slice(0, 5)
  }, [salesQuery.data?.data])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (hasError) {
    return <ErrorMessage message="Failed to load dashboard data" />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-2">
          Welcome back. Here's your inventory overview.
        </p>
      </div>

      {/* Quick Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsCard
            title="Total Products"
            value={totalProducts}
            subtitle="Items in catalog"
            icon={<Package className="h-4 w-4" />}
            detail={{
              label: 'All Products',
              items: (
                <div className="space-y-2">
                  {productsQuery.data?.data?.slice(0, 20).map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/products/${p.id}/edit`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.part_number}</p>
                        <p className="text-xs text-slate-500">{p.model}</p>
                      </div>
                      <span className="text-xs text-slate-600">qty: {p.qty}</span>
                    </Link>
                  ))}
                  {(productsQuery.data?.total ?? 0) > 20 && (
                    <Link href="/dashboard/products" className="block text-center text-xs text-blue-500 pt-2 hover:underline">
                      View all {productsQuery.data?.total} products →
                    </Link>
                  )}
                </div>
              ),
            }}
          />
          <AnalyticsCard
            title="Products in Stock"
            value={productsWithStock.count}
            subtitle="With available quantity"
            icon={<Package className="h-4 w-4" />}
            detail={{
              label: 'Products with Stock',
              items: (
                <div className="space-y-2">
                  {productsQuery.data?.data
                    ?.filter((p) => p.qty > 0)
                    .slice(0, 20)
                    .map((p) => (
                      <Link
                        key={p.id}
                        href={`/dashboard/products/${p.id}/edit`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.part_number}</p>
                          <p className="text-xs text-slate-500">{p.model}</p>
                        </div>
                        <span className="text-xs font-semibold text-green-600">qty: {p.qty}</span>
                      </Link>
                    ))}
                </div>
              ),
            }}
          />
          <AnalyticsCard
            title="Inventory Cost"
            value={`€${productsWithStock.totalCost.toFixed(2)}`}
            subtitle="Total cost value"
            icon={<Euro className="h-4 w-4" />}
            detail={{
              label: 'Inventory Cost Breakdown',
              items: (
                <div className="space-y-2">
                  {productsQuery.data?.data
                    ?.filter((p) => p.qty > 0)
                    .sort((a, b) => (b.qty * b.cost_price) - (a.qty * a.cost_price))
                    .slice(0, 20)
                    .map((p) => (
                      <Link
                        key={p.id}
                        href={`/dashboard/products/${p.id}/edit`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.part_number}</p>
                          <p className="text-xs text-slate-500">{p.qty} × €{p.cost_price.toFixed(2)}</p>
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          €{(p.qty * p.cost_price).toFixed(2)}
                        </span>
                      </Link>
                    ))}
                </div>
              ),
            }}
          />
          <AnalyticsCard
            title="Pending Orders"
            value={pendingOrdersCount}
            subtitle="Awaiting conversion"
            icon={<ShoppingCart className="h-4 w-4" />}
            detail={{
              label: 'Pending Orders',
              items: (
                <div className="space-y-2">
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No pending orders</p>
                  ) : (
                    ordersQuery.data?.data?.map((order) => (
                      <Link
                        key={order.id}
                        href={`/dashboard/orders/${order.id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{order.order_number}</p>
                          <p className="text-xs text-slate-500">€{order.total_amount.toFixed(2)}</p>
                        </div>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          {order.status}
                        </span>
                      </Link>
                    ))
                  )}
                  <Link href="/dashboard/orders/pending" className="block text-center text-xs text-blue-500 pt-2 hover:underline">
                    View all pending orders →
                  </Link>
                </div>
              ),
            }}
          />
          <AnalyticsCard
            title="Recent Sales"
            value={recentSalesCount}
            subtitle="Total transactions"
            icon={<TrendingUp className="h-4 w-4" />}
            detail={{
              label: 'Recent Sales',
              items: (
                <div className="space-y-2">
                  {recentSales.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No recent sales</p>
                  ) : (
                    recentSales.map((sale) => (
                      <Link
                        key={sale.id}
                        href={`/dashboard/sales/${sale.id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{sale.sale_number}</p>
                          <p className="text-xs text-slate-500">€{sale.total_amount.toFixed(2)}</p>
                        </div>
                        <span className={`text-xs font-semibold ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          €{sale.profit.toFixed(2)}
                        </span>
                      </Link>
                    ))
                  )}
                  <Link href="/dashboard/sales" className="block text-center text-xs text-blue-500 pt-2 hover:underline">
                    View all sales →
                  </Link>
                </div>
              ),
            }}
          />
          <AnalyticsCard
            title="Available Stock"
            value={inventory?.available_qty || 0}
            subtitle="Ready to sell"
            icon={<Package className="h-4 w-4" />}
            detail={{
              label: 'Available Stock',
              items: (
                <div className="space-y-2">
                  {productsQuery.data?.data
                    ?.filter((p) => p.qty > 0)
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 20)
                    .map((p) => (
                      <Link
                        key={p.id}
                        href={`/dashboard/products/${p.id}/edit`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.part_number}</p>
                          <p className="text-xs text-slate-500">{p.model}</p>
                        </div>
                        <span className="text-xs font-semibold text-blue-600">qty: {p.qty}</span>
                      </Link>
                    ))}
                </div>
              ),
            }}
          />
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/products/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        </Link>
        <Link href="/dashboard/orders/new">
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </Link>
        <Link href="/dashboard/analytics">
          <Button variant="outline" className="gap-2">
            <Eye className="h-4 w-4" />
            View Analytics
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
          <Card className="overflow-hidden">
            {recentOrders.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No pending orders
              </div>
            ) : (
              <div className="divide-y">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">{order.order_number}</p>
                      <p className="text-xs text-slate-500">
                        €{order.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      {order.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Sales */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Sales</h2>
          <Card className="overflow-hidden">
            {recentSales.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No recent sales
              </div>
            ) : (
              <div className="divide-y">
                {recentSales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/dashboard/sales/${sale.id}`}
                    className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">{sale.sale_number}</p>
                      <p className="text-xs text-slate-500">
                        €{sale.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        sale.profit >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      €{sale.profit.toFixed(2)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Inventory Alerts */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Inventory Alerts
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Low Stock */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 text-sm">Low Stock Products</h3>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-slate-500">All products well stocked</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/dashboard/products/${product.id}/edit`}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.part_number}
                      </p>
                      <p className="text-xs text-gray-600">{product.model}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-semibold text-red-600">
                        {product.qty}
                      </p>
                      <p className="text-xs text-gray-600">qty</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* High Booked Quantity */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 text-sm">High Booked Quantity</h3>
            {highBookedProducts.length === 0 ? (
              <p className="text-sm text-slate-500">
                No products with high bookings
              </p>
            ) : (
              <div className="space-y-3">
                {highBookedProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/dashboard/products/${product.id}/edit`}
                    className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.part_number}
                      </p>
                      <p className="text-xs text-gray-600">{product.model}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-semibold text-orange-600">
                        {product.booked_qty}
                      </p>
                      <p className="text-xs text-gray-600">booked</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
