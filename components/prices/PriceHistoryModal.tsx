'use client';

import { usePriceHistory } from '@/lib/hooks/usePriceHistory';
import { ProductPriceRow } from '@/lib/types/price';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Clock } from 'lucide-react';

interface PriceHistoryModalProps {
  product: ProductPriceRow;
  onClose: () => void;
}

function formatUtc(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function PriceHistoryModal({ product, onClose }: PriceHistoryModalProps) {
  const { data: history, isLoading } = usePriceHistory(product.id);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Price History</DialogTitle>
          <DialogDescription>
            {product.part_number} — {product.model}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !history || history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
            <Clock className="h-8 w-8 opacity-40" />
            <p className="text-sm">No price changes have been recorded for this product.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50 text-left">
                  <th className="py-2 px-3 font-semibold">Field</th>
                  <th className="py-2 px-3 font-semibold text-right">Old Value</th>
                  <th className="py-2 px-3 font-semibold text-right">New Value</th>
                  <th className="py-2 px-3 font-semibold">Changed By</th>
                  <th className="py-2 px-3 font-semibold">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">
                      {entry.field_name === 'cost_price' ? 'Cost Price' : 'Sell Price'}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      €{Number(entry.old_value).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold">
                      €{Number(entry.new_value).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 max-w-[120px] truncate" title={entry.changed_by}>
                      {entry.changed_by}
                    </td>
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                      {formatUtc(entry.changed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
