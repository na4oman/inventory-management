'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { useInventoryLots } from '@/lib/hooks/useInventoryLots'

interface ProductLotsTableProps {
  productId: string
  showDepleted?: boolean
}

export function ProductLotsTable({ productId, showDepleted = false }: ProductLotsTableProps) {
  const status = showDepleted ? 'all' : 'active'
  const { data, isLoading, isError } = useInventoryLots(productId, status)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading lots...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-8 text-red-500 text-sm">
        Failed to load inventory lots.
      </div>
    )
  }

  const lots = data?.data ?? []

  if (lots.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
        No {showDepleted ? '' : 'active '}lots found for this product.
      </div>
    )
  }

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lot #</TableHead>
            <TableHead>Arrival Date</TableHead>
            <TableHead className="text-right">Remaining Qty</TableHead>
            <TableHead className="text-right">Cost Price/unit</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lots.map((lot) => (
            <TableRow key={lot.id}>
              <TableCell className="font-medium">Lot #{lot.lot_number}</TableCell>
              <TableCell>
                {new Date(lot.arrival_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell className="text-right">{lot.remaining_qty}</TableCell>
              <TableCell className="text-right">€{lot.cost_price.toFixed(2)}</TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    lot.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {lot.status}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
