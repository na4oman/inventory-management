'use client'

import { useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Loader2, AlertCircle } from 'lucide-react'
import { useLotSelector } from '@/lib/hooks/useLotSelector'

export interface LotAllocationWithCost {
  lot_id: string
  quantity: number
  cost_price: number
}

export interface LotSelectorProps {
  productId: string
  maxQty: number
  onChange: (allocations: LotAllocationWithCost[]) => void
  onValidChange?: (isValid: boolean) => void
  disabled?: boolean
}

export function LotSelector({ productId, maxQty, onChange, onValidChange, disabled = false }: LotSelectorProps) {
  const { lots, isLoading, isError, allocations, setAllocation, totalAllocated, isValid, validationError } =
    useLotSelector(productId, maxQty)

  // Notify parent whenever allocations change, enriched with cost_price from lots
  useEffect(() => {
    const enriched: LotAllocationWithCost[] = allocations.map((a) => {
      const lot = lots.find((l) => l.id === a.lot_id)
      return { lot_id: a.lot_id, quantity: a.quantity, cost_price: lot?.cost_price ?? 0 }
    })
    onChange(enriched)
  }, [allocations, lots, onChange])

  // Notify parent of validity changes
  useEffect(() => {
    onValidChange?.(isValid)
  }, [isValid, onValidChange])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading lots...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 py-4 text-red-500 text-sm">
        <AlertCircle className="h-4 w-4" />
        Failed to load inventory lots.
      </div>
    )
  }

  if (lots.length === 0) {
    return (
      <div className="py-4 text-slate-500 text-sm">No active lots available for this product.</div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-slate-200 dark:border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot #</TableHead>
              <TableHead>Arrival Date</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Cost/unit</TableHead>
              <TableHead className="text-right w-28">Qty to sell</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.map((lot) => {
              const currentAlloc =
                allocations.find((a) => a.lot_id === lot.id)?.quantity ?? 0

              return (
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
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={lot.remaining_qty}
                      value={currentAlloc === 0 ? '' : currentAlloc}
                      placeholder="0"
                      disabled={disabled}
                      className="w-24 ml-auto text-right"
                      onChange={(e) => {
                        const raw = parseInt(e.target.value, 10)
                        const qty = isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), lot.remaining_qty)
                        setAllocation(lot.id, qty)
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Running total */}
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-slate-600">Total allocated</span>
        <span className={`font-medium ${validationError ? 'text-red-600' : 'text-slate-900'}`}>
          {totalAllocated}
        </span>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      )}
    </div>
  )
}
