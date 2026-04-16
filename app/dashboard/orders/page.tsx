'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrders } from '@/lib/hooks/useOrders';
import { useClients } from '@/lib/hooks/useClients';
import { useFilterState } from '@/lib/hooks/useFilterState';
import { useToast } from '@/components/shared/Toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Order } from '@/lib/types/database';
import { Eye, Trash2, Sliders } from 'lucide-react';
import { OrderFiltersDialog } from '@/components/filters/OrderFiltersDialog';

const { formatDate } = require('@/lib/utils/dateFormat');

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  received: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pageSize = 20;

  const { data: clientsData } = useClients({ pageSize: 100 });
  const { filters, setFilters, resetFilters } = useFilterState(
    { dateFrom: undefined as string | undefined, dateTo: undefined as string | undefined, status: undefined as string | undefined, clientId: undefined as string | undefined },
    { prefix: 'ord' }
  );

  const { data, isLoading, error } = useOrders({ page: 1, pageSize: 1000, status: filters.status || undefined });

  const filteredOrders = useMemo(() => {
    if (!data?.data) return [];
    return data.data.filter(order => {
      if (filters.clientId && order.client_id !== filters.clientId) return false;
      if (filters.dateFrom && new Date(order.created_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const to = new Date(filters.dateTo); to.setHours(23, 59, 59, 999);
        if (new Date(order.created_at) > to) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const matchesOrder = order.order_number?.toLowerCase().includes(s);
        const matchesClient = order.client?.name?.toLowerCase().includes(s) || (order.order_type === 'forecast' && 'forecast'.includes(s));
        const matchesProduct = order.items?.some(item =>
          item.product?.part_number?.toLowerCase().includes(s) ||
          item.product?.model?.toLowerCase().includes(s) ||
          item.product?.model_code?.toLowerCase().includes(s)
        );
        if (!matchesOrder && !matchesClient && !matchesProduct) return false;
      }
      return true;
    });
  }, [data?.data, filters, search]);

  const handleDelete = useCallback(async (orderId: string, orderNumber: string) => {
    if (!confirm(`Delete order ${orderNumber}?`)) return;
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete order');
      addToast({ type: 'success', title: 'Order deleted' });
      window.location.reload();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete order', message: err instanceof Error ? err.message : '' });
    } finally { setDeletingId(null); }
  }, [addToast]);

  const paged = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load orders" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Link href="/dashboard/orders/new"><Button>New Order</Button></Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search by order #, client, part number, model..."
          value={search}
          onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <Button variant="outline" onClick={() => setFiltersOpen(true)} className="gap-2">
          <Sliders className="h-4 w-4" /> Filters
        </Button>
      </div>

      {(filters.dateFrom || filters.dateTo || filters.status || filters.clientId) && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-gray-600">Active filters:</span>
          {filters.dateFrom && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">From {formatDate(filters.dateFrom)}</span>}
          {filters.dateTo && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">To {formatDate(filters.dateTo)}</span>}
          {filters.status && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">Status: {filters.status}</span>}
          {filters.clientId && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Client: {clientsData?.data.find(c => c.id === filters.clientId)?.name}</span>}
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">Clear</Button>
        </div>
      )}

      <Card className="p-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-gray-300 bg-gray-50">
              <th className="text-left py-2 px-2 font-semibold">Order #</th>
              <th className="text-left py-2 px-2 font-semibold">Client</th>
              <th className="text-left py-2 px-2 font-semibold">Status</th>
              <th className="text-right py-2 px-2 font-semibold">Total</th>
              <th className="text-left py-2 px-2 font-semibold">Created</th>
              <th className="text-center py-2 px-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No orders found</td></tr>
            ) : paged.map(order => (
              <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-1.5 px-2 font-medium whitespace-nowrap">{order.order_number}</td>
                <td className="py-1.5 px-2 whitespace-nowrap">
                  {order.order_type === 'forecast'
                    ? <span className="text-amber-700">Forecast</span>
                    : (clientsData?.data.find(c => c.id === order.client_id)?.name || order.client?.name || '—')}
                </td>
                <td className="py-1.5 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_STYLES[order.status] || ''}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right whitespace-nowrap">€{order.total_amount.toFixed(2)}</td>
                <td className="py-1.5 px-2 whitespace-nowrap text-gray-600">{formatDate(order.created_at)}</td>
                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                  <div className="flex gap-1 justify-center">
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                      onClick={() => handleDelete(order.id, order.order_number)}
                      disabled={deletingId === order.id}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {filteredOrders.length > pageSize && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Page {currentPage} of {totalPages} ({filteredOrders.length} orders)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* Totals */}
      {filteredOrders.length > 0 && (
        <Card className="p-3 bg-blue-50">
          <div className="grid sm:grid-cols-3 gap-6 text-xs">
            <div>
              <div className="text-gray-500 mb-1">Total Orders</div>
              <div className="text-xl font-bold">{filteredOrders.length}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Total Amount</div>
              <div className="text-xl font-bold text-blue-600">€{filteredOrders.reduce((s, o) => s + o.total_amount, 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Pending</div>
              <div className="text-xl font-bold text-yellow-600">{filteredOrders.filter(o => o.status === 'pending').length}</div>
            </div>
          </div>
        </Card>
      )}

      <OrderFiltersDialog open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} onApply={setFilters} clients={clientsData?.data} />
    </div>
  );
}
