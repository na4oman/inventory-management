'use client'

import { useCallback, useMemo, useState } from 'react'
import { InventoryLot } from '@/lib/types/database'
import { useInventoryLots } from './useInventoryLots'

export interface LotAllocationInput {
  lot_id: string
  quantity: number
}

export interface UseLotSelectorReturn {
  lots: InventoryLot[]
  isLoading: boolean
  isError: boolean
  allocations: LotAllocationInput[]
  setAllocation: (lotId: string, qty: number) => void
  /** Distribute qty across lots FIFO (oldest first). Pass 0 to clear all. */
  setTotalQty: (qty: number) => void
  totalAllocated: number
  /** Actual available qty = sum of active lot remaining_qty (more reliable than product.qty) */
  actualAvailable: number
  isValid: boolean
  validationError: string | null
}

/**
 * Manages lot selection state for free-stock sales.
 * Wraps useInventoryLots and tracks per-lot quantity allocations.
 *
 * @param productId - The product to select lots for
 * @param maxQty - Upper bound for total allocation (product.qty)
 */
export function useLotSelector(productId: string, maxQty: number): UseLotSelectorReturn {
  const { data, isLoading, isError } = useInventoryLots(productId, 'active')
  const lots = data?.data ?? []

  // Map of lotId -> quantity allocated
  const [allocationMap, setAllocationMap] = useState<Record<string, number>>({})

  const setAllocation = useCallback((lotId: string, qty: number) => {
    setAllocationMap((prev) => {
      if (qty <= 0) {
        const next = { ...prev }
        delete next[lotId]
        return next
      }
      return { ...prev, [lotId]: qty }
    })
  }, [])

  /**
   * Distribute a total qty across lots FIFO (oldest first, as returned by the API).
   * Fills each lot up to its remaining_qty before moving to the next.
   * Passing 0 clears all allocations.
   */
  const setTotalQty = useCallback((qty: number) => {
    if (qty <= 0) {
      setAllocationMap({})
      return
    }
    const next: Record<string, number> = {}
    let remaining = qty
    for (const lot of lots) {
      if (remaining <= 0) break
      const take = Math.min(remaining, lot.remaining_qty)
      if (take > 0) next[lot.id] = take
      remaining -= take
    }
    setAllocationMap(next)
  }, [lots])

  const allocations: LotAllocationInput[] = useMemo(
    () =>
      Object.entries(allocationMap)
        .filter(([, qty]) => qty > 0)
        .map(([lot_id, quantity]) => ({ lot_id, quantity })),
    [allocationMap]
  )

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, a) => sum + a.quantity, 0),
    [allocations]
  )

  const actualAvailable = useMemo(
    () => lots.reduce((sum, l) => sum + l.remaining_qty, 0),
    [lots]
  )

  const validationError: string | null = useMemo(() => {
    // Use actual lot stock as the ceiling — product.qty can be stale
    const ceiling = actualAvailable > 0 ? actualAvailable : maxQty
    if (totalAllocated > ceiling) {
      return `Total allocated (${totalAllocated}) exceeds available stock (${ceiling})`
    }
    return null
  }, [totalAllocated, maxQty, actualAvailable])

  const isValid = validationError === null && totalAllocated > 0

  return {
    lots,
    isLoading,
    isError,
    allocations,
    setAllocation,
    setTotalQty,
    totalAllocated,
    actualAvailable,
    isValid,
    validationError,
  }
}
