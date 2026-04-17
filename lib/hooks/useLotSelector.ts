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
  totalAllocated: number
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
        // Remove the entry when qty is cleared
        const next = { ...prev }
        delete next[lotId]
        return next
      }
      return { ...prev, [lotId]: qty }
    })
  }, [])

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

  const validationError: string | null = useMemo(() => {
    if (totalAllocated > maxQty) {
      return `Total allocated (${totalAllocated}) exceeds available stock (${maxQty})`
    }
    return null
  }, [totalAllocated, maxQty])

  const isValid = validationError === null && totalAllocated > 0

  return {
    lots,
    isLoading,
    isError,
    allocations,
    setAllocation,
    totalAllocated,
    isValid,
    validationError,
  }
}
