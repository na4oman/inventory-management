'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Card } from '@/components/ui/card';
import { SaleWithDetails } from '@/lib/types/database';

export default function SaleDetailsPage() {
  const params = useParams();
  const saleId = params.id as string;
  const [sale, setSale] = useState<SaleWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}`);
        if (!response.ok) throw new Error('Failed to fetch sale');
        const result = await response.json();
        setSale(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sale');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSale();
  }, [saleId]);

  if (isLoading) return <LoadingSpinner />;
  if (error || !sale) return <ErrorMessage message={error || 'Failed to load sale'} />;

  const profitMargin = sale.total_cost > 0 
    ? ((sale.profit / sale.total_cost) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sale {sale.sale_number}</h1>
        <p className="text-gray-600 mt-2">
          {(() => { const { formatDateTime } = require('@/lib/utils/dateFormat'); return formatDateTime(sale.sale_date); })()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Sale Information</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-600">Sale Number:</span> {sale.sale_number}</div>
            <div><span className="text-gray-600">Sale Date:</span> {(() => { const { formatDate } = require('@/lib/utils/dateFormat'); return formatDate(sale.sale_date); })()}</div>
            <div><span className="text-gray-600">Created:</span> {(() => { const { formatDate } = require('@/lib/utils/dateFormat'); return formatDate(sale.created_at); })()}</div>
            {sale.notes && <div><span className="text-gray-600">Notes:</span> {sale.notes}</div>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Client Information</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-600">Client:</span> {sale.client?.name}</div>
            {sale.client?.email && <div><span className="text-gray-600">Email:</span> {sale.client.email}</div>}
            {sale.client?.phone && <div><span className="text-gray-600">Phone:</span> {sale.client.phone}</div>}
            {sale.client?.address && <div><span className="text-gray-600">Address:</span> {sale.client.address}</div>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Financial Summary</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-600">Total Amount:</span> <span className="font-medium">€{sale.total_amount.toFixed(2)}</span></div>
            <div><span className="text-gray-600">Total Cost:</span> <span className="font-medium">€{sale.total_cost.toFixed(2)}</span></div>
            <div><span className="text-gray-600">Profit:</span> <span className="font-medium text-green-600">€{sale.profit.toFixed(2)}</span></div>
            <div><span className="text-gray-600">Margin:</span> <span className="font-medium">{profitMargin}%</span></div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Sale Items ({sale.items?.length || 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-2 font-semibold">Product</th>
                <th className="text-left py-3 px-2 font-semibold">Model</th>
                <th className="text-right py-3 px-2 font-semibold">Qty</th>
                <th className="text-right py-3 px-2 font-semibold">Unit Price</th>
                <th className="text-right py-3 px-2 font-semibold">Subtotal</th>
                <th className="text-right py-3 px-2 font-semibold">Unit Cost</th>
                <th className="text-right py-3 px-2 font-semibold">Cost Total</th>
                <th className="text-right py-3 px-2 font-semibold">Profit</th>
              </tr>
            </thead>
            <tbody>
              {sale.items && sale.items.length > 0 ? (
                sale.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-2">{item.product?.part_number}</td>
                    <td className="py-3 px-2">{item.product?.model}</td>
                    <td className="py-3 px-2 text-right font-medium">{item.quantity}</td>
                    <td className="py-3 px-2 text-right">€{item.unit_price.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-medium">€{item.subtotal.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right">€{item.unit_cost.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-medium">€{item.cost_total.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right text-green-600 font-medium">€{item.profit.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-gray-500">
                    No items in this sale
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={4} className="py-3 px-2 font-semibold text-right">Totals:</td>
                <td className="py-3 px-2 text-right font-bold">€{sale.total_amount.toFixed(2)}</td>
                <td colSpan={2} className="py-3 px-2 text-right font-bold">€{sale.total_cost.toFixed(2)}</td>
                <td className="py-3 px-2 text-right font-bold text-green-600">€{sale.profit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
