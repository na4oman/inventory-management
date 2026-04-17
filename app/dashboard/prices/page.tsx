'use client';

import { useState, useCallback } from 'react';
import { usePriceList } from '@/lib/hooks/usePriceList';
import { ProductPriceRow } from '@/lib/types/price';
import { PriceEditDialog } from '@/components/prices/PriceEditDialog';
import { PriceHistoryModal } from '@/components/prices/PriceHistoryModal';
import { CustomerPriceForm } from '@/components/prices/CustomerPriceForm';
import { BulkPriceImport } from '@/components/prices/BulkPriceImport';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { useToast } from '@/components/shared/Toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Edit, History } from 'lucide-react';

type SortField = 'part_number' | 'cost_price' | 'sell_price';

export default function PricesPage() {
  const { showSuccess, showError } = useToast();

  // Price List tab state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('part_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50>(25);

  // Dialog state
  const [editingProduct, setEditingProduct] = useState<ProductPriceRow | null>(null);
  const [historyProduct, setHistoryProduct] = useState<ProductPriceRow | null>(null);

  const { data, isLoading, error } = usePriceList({ search, sortBy, sortOrder, page, pageSize });

  const handleSort = useCallback((field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  }, [sortBy]);

  const sortIndicator = (field: SortField) =>
    sortBy === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  const products = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <ErrorBoundary moduleName="Prices">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Price List</h1>

        <Tabs defaultValue="price-list">
          <TabsList>
            <TabsTrigger value="price-list">Price List</TabsTrigger>
            <TabsTrigger value="customer-prices">Customer Prices</TabsTrigger>
            <TabsTrigger value="bulk-import">Bulk Price Import</TabsTrigger>
          </TabsList>

          {/* ── Price List tab ── */}
          <TabsContent value="price-list">
            <div className="space-y-3 mt-2">
              {/* Search */}
              <input
                type="text"
                placeholder="Search by part number or model…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              {isLoading ? (
                <div className="flex justify-center py-10"><LoadingSpinner /></div>
              ) : error ? (
                <ErrorMessage message="Failed to load price list" />
              ) : (
                <>
                  <Card className="p-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-50">
                          <th className="text-left py-2 px-3 font-semibold">
                            <button onClick={() => handleSort('part_number')} className="hover:text-blue-600">
                              Part #{sortIndicator('part_number')}
                            </button>
                          </th>
                          <th className="text-left py-2 px-3 font-semibold">Model</th>
                          <th className="text-right py-2 px-3 font-semibold">
                            <button onClick={() => handleSort('cost_price')} className="hover:text-blue-600">
                              Cost Price{sortIndicator('cost_price')}
                            </button>
                          </th>
                          <th className="text-right py-2 px-3 font-semibold">
                            <button onClick={() => handleSort('sell_price')} className="hover:text-blue-600">
                              Sell Price{sortIndicator('sell_price')}
                            </button>
                          </th>
                          <th className="text-center py-2 px-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-gray-500">
                              No products found
                            </td>
                          </tr>
                        ) : products.map((product: ProductPriceRow) => (
                          <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium whitespace-nowrap">{product.part_number}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{product.model}</td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              €{Number(product.cost_price).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              €{Number(product.sell_price).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setEditingProduct(product)}
                                  title="Edit prices"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setHistoryProduct(product)}
                                  title="View price history"
                                >
                                  <History className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>

                  {/* Pagination */}
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      {total > 0
                        ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} products`
                        : '0 products'}
                    </span>
                    <div className="flex gap-2 items-center">
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value) as 25 | 50); setPage(1); }}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ── Customer Prices tab ── */}
          <TabsContent value="customer-prices">
            <div className="mt-2">
              <CustomerPriceForm />
            </div>
          </TabsContent>

          {/* ── Bulk Price Import tab ── */}
          <TabsContent value="bulk-import">
            <div className="mt-2">
              <BulkPriceImport />
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {editingProduct && (
          <PriceEditDialog
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSuccess={() => showSuccess('Prices updated', 'The product prices have been saved.')}
          />
        )}

        {historyProduct && (
          <PriceHistoryModal
            product={historyProduct}
            onClose={() => setHistoryProduct(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
