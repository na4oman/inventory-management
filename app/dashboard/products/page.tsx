'use client';

import { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProducts, useDeleteProduct } from '@/lib/hooks/useProducts';
import { useFilterState } from '@/lib/hooks/useFilterState';
import { ProductWithAvailability } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { useToast } from '@/components/shared/Toast';
import { ProductFiltersDialog } from '@/components/filters/ProductFiltersDialog';
import { SidebarContext } from '@/components/layout/DashboardWrapper';
import { Edit, Trash2, Sliders } from 'lucide-react';

export default function ProductsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { isCollapsed } = useContext(SidebarContext);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { filters, setFilters, resetFilters } = useFilterState(
    {
      priceMin: undefined as number | undefined,
      priceMax: undefined as number | undefined,
      stockMin: undefined as number | undefined,
      stockMax: undefined as number | undefined,
    },
    { prefix: 'prod' }
  );

  const { data, isLoading, error } = useProducts({
    search: debouncedSearch,
    sortBy,
    sortOrder,
    page,
    pageSize,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    stockMin: filters.stockMin,
    stockMax: filters.stockMax,
  });

  const deleteProduct = useDeleteProduct();
  const filteredData = data?.data || [];

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct.mutateAsync(id);
        showSuccess('Product deleted', 'The product has been successfully deleted');
      } catch (err) {
        showError('Delete failed', 'Failed to delete the product. Please try again.');
      }
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load products" />;

  return (
    <ErrorBoundary moduleName="Products">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Products</h1>
          <div className="flex gap-2">
            <Link href="/dashboard/products/new">
              <Button>New Product</Button>
            </Link>
            <Link href="/dashboard/products/import">
              <Button variant="outline">Import</Button>
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search by part number, model, model code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <Button
            variant={filters.stockMin === 1 ? 'default' : 'outline'}
            onClick={() => {
              setFilters({ ...filters, stockMin: filters.stockMin === 1 ? undefined : 1 });
              setPage(1);
            }}
            title="Show only products with available stock"
          >
            In Stock
          </Button>
          <Button variant="outline" onClick={() => setFiltersOpen(true)} className="gap-2">
            <Sliders className="h-4 w-4" /> Filters
          </Button>
        </div>

        {/* Active filter badges */}
        {(filters.priceMin !== undefined || filters.priceMax !== undefined || filters.stockMin !== undefined || filters.stockMax !== undefined) && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-gray-600">Active filters:</span>
            {filters.priceMin !== undefined && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Price ≥ €{filters.priceMin}</span>}
            {filters.priceMax !== undefined && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Price ≤ €{filters.priceMax}</span>}
            {filters.stockMin !== undefined && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Stock ≥ {filters.stockMin}</span>}
            {filters.stockMax !== undefined && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Stock ≤ {filters.stockMax}</span>}
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">Clear</Button>
          </div>
        )}

        {/* Table */}
        <Card className="p-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50">
                <th className="text-left py-2 px-2 font-semibold">
                  <button onClick={() => handleSort('part_number')} className="hover:text-blue-600">
                    Part # {sortBy === 'part_number' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-2 font-semibold">
                  <button onClick={() => handleSort('model')} className="hover:text-blue-600">
                    Model {sortBy === 'model' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                {isCollapsed && (
                  <th className="text-left py-2 px-2 font-semibold hidden md:table-cell">Model Code</th>
                )}
                <th className="text-left py-2 px-2 font-semibold hidden lg:table-cell">Description</th>
                <th className="text-right py-2 px-2 font-semibold">Avail.</th>
                <th className="text-right py-2 px-2 font-semibold hidden sm:table-cell">Cost</th>
                <th className="text-right py-2 px-2 font-semibold">Price</th>
                <th className="text-center py-2 px-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">No products found</td></tr>
              ) : filteredData.map((product: ProductWithAvailability) => (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 px-2 font-medium whitespace-nowrap">{product.part_number}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{product.model}</td>
                  {isCollapsed && (
                    <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap hidden md:table-cell">{product.model_code}</td>
                  )}
                  <td className="py-1.5 px-2 text-gray-600 max-w-[200px] truncate hidden lg:table-cell" title={product.description}>
                    {product.description || '—'}
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold whitespace-nowrap">{product.available_qty}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap hidden sm:table-cell">€{product.cost_price.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">€{product.sell_price.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-center whitespace-nowrap">
                    <div className="flex gap-1 justify-center">
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                        onClick={() => router.push(`/dashboard/products/${product.id}/edit`)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(product.id)}
                        disabled={deleteProduct.isPending}>
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
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {filteredData.length > 0
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data?.total || 0)} of ${data?.total || 0} products`
              : '0 products'}
          </span>
          <div className="flex gap-2 items-center">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= (data?.totalPages || 1)}>Next</Button>
          </div>
        </div>

        <ProductFiltersDialog
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          filters={filters}
          onApply={setFilters}
        />
      </div>
    </ErrorBoundary>
  );
}
