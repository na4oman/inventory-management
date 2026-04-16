'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TopSellingProduct } from '@/lib/types/database'

interface TopProductsTableProps {
  products: TopSellingProduct[]
}

export function TopProductsTable({ products }: TopProductsTableProps) {
  if (!products || products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-slate-500">
            No product data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Number</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Quantity Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Avg Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.product_id}>
                  <TableCell className="font-medium">
                    {product.part_number}
                  </TableCell>
                  <TableCell>{product.model}</TableCell>
                  <TableCell className="text-right">
                    {product.total_quantity_sold}
                  </TableCell>
                  <TableCell className="text-right">
                    €{product.total_revenue.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={product.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      €{product.total_profit.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={product.avg_margin >= 10 ? 'text-green-600 font-medium' : product.avg_margin >= 5 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium'}>
                      {product.avg_margin.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
