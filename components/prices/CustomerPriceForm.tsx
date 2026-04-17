'use client';

import { useState } from 'react';
import { useUpsertCustomerPrice } from '@/lib/hooks/useUpsertCustomerPrice';
import { useDeleteCustomerPrice } from '@/lib/hooks/useDeleteCustomerPrice';
import { useCustomerPrices } from '@/lib/hooks/useCustomerPrices';
import { useClients } from '@/lib/hooks/useClients';
import { useProducts } from '@/lib/hooks/useProducts';
import { validatePrice } from '@/lib/validations/price';
import { CustomerPriceWithDetails } from '@/lib/types/price';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

interface CustomerPriceFormProps {
  /** Pre-filter by product or client */
  productId?: string;
  clientId?: string;
}

export function CustomerPriceForm({ productId, clientId }: CustomerPriceFormProps) {
  const [selectedClientId, setSelectedClientId] = useState(clientId ?? '');
  const [selectedProductId, setSelectedProductId] = useState(productId ?? '');
  const [price, setPrice] = useState('');
  const [priceError, setPriceError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();

  const upsert = useUpsertCustomerPrice();
  const deletePrice = useDeleteCustomerPrice();

  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: productsData } = useProducts({ pageSize: 100 });

  // Show records filtered by whichever dimension is pre-set, or all when both are selected
  const filterKey = selectedClientId || selectedProductId
    ? { client_id: selectedClientId || undefined, product_id: selectedProductId || undefined }
    : null;

  const { data: customerPrices, isLoading: loadingPrices } = useCustomerPrices(
    filterKey ?? { client_id: undefined, product_id: undefined }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPriceError(undefined);
    setSubmitError(undefined);

    if (!selectedClientId) { setSubmitError('Please select a client'); return; }
    if (!selectedProductId) { setSubmitError('Please select a product'); return; }

    let validatedPrice: number;
    try {
      validatedPrice = validatePrice(price);
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : 'Invalid price');
      return;
    }

    try {
      await upsert.mutateAsync({ client_id: selectedClientId, product_id: selectedProductId, price: validatedPrice });
      setPrice('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save customer price');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer price?')) return;
    try {
      await deletePrice.mutateAsync(id);
    } catch {
      // error handled silently; toast shown by hook
    }
  };

  const clients = clientsData?.data ?? [];
  const products = productsData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Add / Update Customer Price</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="cp-client">Client</Label>
              <select
                id="cp-client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                disabled={!!clientId || upsert.isPending}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="cp-product">Product</Label>
              <select
                id="cp-product"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={!!productId || upsert.isPending}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.part_number} — {p.model}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="cp-price">Negotiated Price</Label>
              <Input
                id="cp-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setPriceError(undefined); }}
                disabled={upsert.isPending}
                className={priceError ? 'border-red-500' : ''}
              />
              {priceError && (
                <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {priceError}
                </div>
              )}
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          <Button type="submit" disabled={upsert.isPending} size="sm">
            {upsert.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save Customer Price
          </Button>
        </form>
      </Card>

      {/* Records table */}
      {!filterKey ? (
        <p className="text-sm text-gray-500">Select a client or product above to view customer prices.</p>
      ) : loadingPrices ? (
        <div className="flex justify-center py-6"><LoadingSpinner /></div>
      ) : !customerPrices || customerPrices.length === 0 ? (
        <p className="text-sm text-gray-500">No customer prices found.</p>
      ) : (
        <Card className="p-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50 text-left">
                <th className="py-2 px-3 font-semibold">Client</th>
                <th className="py-2 px-3 font-semibold">Product</th>
                <th className="py-2 px-3 font-semibold text-right">Price</th>
                <th className="py-2 px-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customerPrices.map((cp: CustomerPriceWithDetails) => (
                <tr key={cp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">{cp.client?.name ?? cp.client_id}</td>
                  <td className="py-2 px-3">
                    {cp.product ? `${cp.product.part_number} — ${cp.product.model}` : cp.product_id}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold">€{Number(cp.price).toFixed(2)}</td>
                  <td className="py-2 px-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(cp.id)}
                      disabled={deletePrice.isPending}
                      title="Delete customer price"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
