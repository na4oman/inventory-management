'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSales } from '@/lib/hooks/useSales';
import { useClients } from '@/lib/hooks/useClients';
import { useFilterState } from '@/lib/hooks/useFilterState';
import { useToast } from '@/components/shared/Toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Eye, Trash2, Sliders } from 'lucide-react';
import { SalesFiltersDialog } from '@/components/filters/SalesFiltersDialog';

const { formatDate } = require('@/lib/utils/dateFormat');

export default function SalesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageSize = 20;

  const { data: clientsData } = useClients({ pageSize: 100 });
  const { filters, setFilters, resetFilters } = useFilterState(
    { dateFrom: undefined as string | undefined, dateTo: undefined as string | undefined, profitMin: undefined as number | undefined, profitMax: undefined as number | undefined, clientId: undefined as string | undefined },
    { prefix: 'sal' }
  );

  const { data, isLoading, error } = useSales({ page: 1, pageSize: 1000, search: search || undefined });

  const filteredSales = useMemo(() => {
    if (!data?.data) return [];
    return data.data.filter(sale => {
      if (filters.clientId && sale.client_id !== filters.clientId) return false;
      if (filters.dateFrom && new Date(sale.sale_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const to = new Date(filters.dateTo); to.setHours(23, 59, 59, 999);
        if (new Date(sale.sale_date) > to) return false;
      }
      if (filters.profitMin !== undefined && sale.profit < filters.profitMin) return false;
      if (filters.profitMax !== undefined && sale.profit > filters.profitMax) return false;
      return true;
    });
  }, [data?.data, filters]);

  const handleDelete = useCallback(async (saleId: string, saleNumber: string) => {
    if (!confirm(`Delete sale ${saleNumber}?`)) return;
    try {
      const res = await fetch(`/api/sales/${saleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sale');
      addToast({ type: 'success', title: 'Sale deleted' });
      window.location.reload();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete sale', message: err instanceof Error ? err.message : '' });
    }
  }, [addToast]);

  const paged = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredSales.length / pageSize);

  const totalAmount = filteredSales.reduce((s, sale) => s + sale.total_amount, 0);
  const totalCost = filteredSales.reduce((s, sale) => s + sale.total_cost, 0);
  const totalProfit = filteredSales.reduce((s, sale) => s + sale.profit, 0);
  const avgMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load sales" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales</h1>
        <Link href="/dashboard/sales/new"><Button>New Sale</Button></Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input type="text" placeholder="Search sales..."
          value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        <Button variant="outline" onClick={() => setFiltersOpen(true)} className="gap-2">
          <Sliders className="h-4 w-4" /> Filters
        </Button>
      </div>

      {(filters.dateFrom || filters.dateTo || filters.profitMin !== undefined || filters.profitMax !== undefined || filters.clientId) && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-gray-600">Active filters:</span>
          {filters.dateFrom && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">From {formatDate(filters.dateFrom)}</span>}
          {filters.dateTo && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">To {formatDate(filters.dateTo)}</span>}
          {filters.profitMin !== undefined && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Profit ≥ €{filters.profitMin}</span>}
          {filters.profitMax !== undefined && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Profit ≤ €{filters.profitMax}</span>}
          {filters.clientId && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">Client: {clientsData?.data.find(c => c.id === filters.clientId)?.name}</span>}
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">Clear</Button>
        </div>
      )}

      <Card className="p-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-gray-300 bg-gray-50">
              <th className="text-left py-2 px-2 font-semibold">Sale #</th>
              <th className="text-left py-2 px-2 font-semibold">Client</th>
              <th className="text-right py-2 px-2 font-semibold">Amount</th>
              <th className="text-right py-2 px-2 font-semibold">Cost</th>
              <th className="text-right py-2 px-2 font-semibold">Profit</th>
              <th className="text-right py-2 px-2 font-semibold">Margin</th>
              <th className="text-left py-2 px-2 font-semibold">Date</th>
              <th className="text-center py-2 px-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">No sales found</td></tr>
            ) : paged.map(sale => {
              const margin = sale.total_cost > 0 ? ((sale.profit / sale.total_cost) * 100).toFixed(1) : '0';
              const client = clientsData?.data.find(c => c.id === sale.client_id);
              return (
                <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 px-2 font-medium text-blue-600 whitespace-nowrap">{sale.sale_number}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{client?.name || 'Unknown'}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">€{sale.total_amount.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">€{sale.total_cost.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">
                    <span className={sale.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      €{sale.profit.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">{margin}%</td>
                  <td className="py-1.5 px-2 whitespace-nowrap text-gray-600">{formatDate(sale.sale_date)}</td>
                  <td className="py-1.5 px-2 text-center whitespace-nowrap">
                    <div className="flex gap-1 justify-center">
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                        onClick={() => router.push(`/dashboard/sales/${sale.id}`)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                        onClick={() => handleDelete(sale.id, sale.sale_number)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {filteredSales.length > pageSize && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Page {currentPage} of {totalPages} ({filteredSales.length} sales)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</Button>
          </div>
        </div>
      )}

      {filteredSales.length > 0 && (
        <Card className="p-3 bg-blue-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
            <div>
              <div className="text-gray-500 mb-1">Total Revenue</div>
              <div className="text-xl font-bold text-blue-600">€{totalAmount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Total Cost</div>
              <div className="text-xl font-bold text-orange-600">€{totalCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Total Profit</div>
              <div className="text-xl font-bold text-green-600">€{totalProfit.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Avg Margin</div>
              <div className="text-xl font-bold text-purple-600">{avgMargin.toFixed(1)}%</div>
            </div>
          </div>
        </Card>
      )}

      <SalesFiltersDialog open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} onApply={setFilters} clients={clientsData?.data} />
    </div>
  );
}
