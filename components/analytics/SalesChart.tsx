'use client'

import React, { useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SalesByPeriod } from '@/lib/types/database'

interface SalesChartProps {
  data: SalesByPeriod[]
  period?: 'day' | 'week' | 'month'
}

export function SalesChart({ data, period = 'month' }: SalesChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-slate-500">
            No sales data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const ChartComponent = chartType === 'line' ? LineChart : BarChart

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sales Trends</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={chartType === 'line' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('line')}
          >
            Line
          </Button>
          <Button
            variant={chartType === 'bar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('bar')}
          >
            Bar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip
              formatter={(value) => {
                if (typeof value === 'number') {
                  return `€${value.toFixed(2)}`
                }
                return value
              }}
            />
            <Legend />
            {chartType === 'line' ? (
              <>
                <Line
                  type="monotone"
                  dataKey="total_revenue"
                  stroke="#3b82f6"
                  name="Revenue"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="total_profit"
                  stroke="#10b981"
                  name="Profit"
                  strokeWidth={2}
                />
              </>
            ) : (
              <>
                <Bar dataKey="total_revenue" fill="#3b82f6" name="Revenue" />
                <Bar dataKey="total_profit" fill="#10b981" name="Profit" />
              </>
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
