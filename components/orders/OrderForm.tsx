'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOrderSchema } from '@/lib/validations/order';
import { useClients } from '@/lib/hooks/useClients';
import { useProducts } from '@/lib/hooks/useProducts';
import { useSuggestedPrice } from '@/lib/hooks/useSuggestedPrice';
import { useToast } from '@/components/shared/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Trash2, Plus, Loader2, AlertCircle } from 'lucide-react';

/**
 * Inner component for a single order item row.
 * Isolated so we can call useSuggestedPrice as a hook (hooks can't be called in loops).
 */
function OrderItemPriceFetcher({
  clientId,
  productId,
  onSuggestedPrice,
  onError,
}: {
  clientId: string;
  productId: string;
  onSuggestedPrice: (price: number) => void;
  onError: () => void;
}) {
  const { data, isError } = useSuggestedPrice(clientId, productId);

  useEffect(() => {
    if (data !== undefined && data !== null) {
      onSuggestedPrice(data.price);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (isError) {
      onError();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError]);

  return null;
}

interface OrderFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function OrderForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: OrderFormProps) {
  const [isForecastOrder, setIsForecastOrder] = useState(false);
  const { showWarning } = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    control,
    setValue,
  } = useForm({
    resolver: zodResolver(createOrderSchema),
    mode: 'onBlur',
    defaultValues: {
      client_id: '',
      items: [{ product_id: '', ordered_qty: 1, unit_price: 0 }],
      notes: '',
      order_type: 'customer',
    },
  });

  const isFormLoading = isLoading || isSubmitting;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const [clientSearch, setClientSearch] = useState('');
  const [productSearches, setProductSearches] = useState<{ [key: number]: string }>({});
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showProductDropdowns, setShowProductDropdowns] = useState<{ [key: number]: boolean }>({});

  const { data: clientsData } = useClients({
    search: clientSearch,
    pageSize: 100,
  });

  // Load all products initially, then filter by search
  const { data: allProductsData, isLoading: productsLoading } = useProducts({
    pageSize: 1000,
  });

  // Filter products based on individual search inputs
  const productsData = allProductsData ? {
    ...allProductsData,
    data: allProductsData.data.filter(product => {
      // Get all active searches (non-empty)
      const activeSearches = Object.values(productSearches).filter(s => s && s.trim());
      
      // If no active searches, show all products
      if (activeSearches.length === 0) return true;
      
      // Build searchable string from product fields
      const searchStr = `${product.part_number || ''} ${product.model || ''} ${product.model_code || ''} ${product.description || ''}`.toLowerCase();
      
      // Product matches if it contains ANY of the search terms
      return activeSearches.some(search => searchStr.includes(search.toLowerCase()));
    })
  } : { data: [], total: 0, page: 1, pageSize: 1000, totalPages: 0 };

  const selectedClientId = watch('client_id');
  const items = watch('items');

  // Calculate total amount
  const totalAmount = items.reduce((sum, item) => {
    const unitPrice = item.unit_price || 0;
    return sum + (unitPrice * item.ordered_qty);
  }, 0);

  const handleAddItem = () => {
    append({ product_id: '', ordered_qty: 1, unit_price: 0 });
  };

  const handleRemoveItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const handleProductSelect = (index: number, product: any) => {
    setValue(`items.${index}.product_id`, product.id);
    // Clear price so useSuggestedPrice can populate it; fall back to sell_price if no client
    if (!selectedClientId) {
      setValue(`items.${index}.unit_price`, product.sell_price);
    } else {
      setValue(`items.${index}.unit_price`, 0);
    }
    setShowProductDropdowns({ ...showProductDropdowns, [index]: false });
    setProductSearches({ ...productSearches, [index]: '' });
  };

  const renderFieldError = (error: any) => {
    if (!error) return null;
    return (
      <div className="mt-1 flex items-start gap-2 rounded-md bg-red-50 p-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600 mt-0.5" />
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-6">
          {/* Forecast Order Toggle */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="forecast"
                checked={isForecastOrder}
                onChange={(e) => {
                  setIsForecastOrder(e.target.checked);
                  if (e.target.checked) {
                    setValue('client_id', null);
                    setValue('order_type', 'forecast');
                  } else {
                    setValue('client_id', '');
                    setValue('order_type', 'customer');
                  }
                }}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="forecast" className="flex-1 cursor-pointer">
                <div className="font-semibold text-sm">Create as Forecast Order</div>
                <div className="text-xs text-gray-600">
                  {isForecastOrder 
                    ? 'This order will not book inventory and is for planning purposes only'
                    : 'Link this order to a specific customer'}
                </div>
              </label>
            </div>
          </div>

          {/* Client Selection */}
          {!isForecastOrder && (
            <div>
              <Label htmlFor="client_id" className="flex items-center gap-1 mb-2">
                Client
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="client_id"
                  placeholder="Search and select client..."
                  value={
                    clientsData?.data.find((c) => c.id === selectedClientId)?.name || ''
                  }
                  onChange={(e) => setClientSearch(e.target.value)}
                  onFocus={() => setShowClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  disabled={isFormLoading}
                  className={`cursor-pointer ${errors.client_id ? 'border-red-500 focus:border-red-500' : ''}`}
                  autoComplete="off"
                  aria-invalid={!!errors.client_id}
                  aria-describedby={errors.client_id ? 'client_id-error' : undefined}
                />
                {showClientDropdown && clientsData?.data && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-xl z-50 max-h-48 overflow-y-auto">
                    {clientsData.data.map((client) => (
                      <div
                        key={client.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setValue('client_id', client.id);
                          setShowClientDropdown(false);
                          setClientSearch('');
                        }}
                      >
                        {client.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {renderFieldError(errors.client_id)}
            </div>
          )}
        </Card>

        {/* Order Items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <Label className="flex items-center gap-1">
              Order Items
              <span className="text-red-500">*</span>
            </Label>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => {
              const selectedProduct = productsData?.data.find(
                (p) => p.id === items[index]?.product_id
              );
              const orderedQty = items[index]?.ordered_qty || 1;
              const unitPrice = items[index]?.unit_price || 0;
              const subtotal = unitPrice * orderedQty;

              return (
                <Card key={field.id} className="p-4 space-y-4">
                  {/* Fetch suggested price when both client and product are selected */}
                  {selectedClientId && items[index]?.product_id && (
                    <OrderItemPriceFetcher
                      clientId={selectedClientId}
                      productId={items[index].product_id}
                      onSuggestedPrice={(price) => setValue(`items.${index}.unit_price`, price)}
                      onError={() =>
                        showWarning('Price suggestion unavailable', 'Could not load suggested price. Please enter the price manually.')
                      }
                    />
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* Product Selection */}
                    <div className="relative">
                      <Label htmlFor={`product-${index}`} className="flex items-center gap-1 mb-2">
                        Product
                        <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id={`product-${index}`}
                          placeholder="Search product..."
                          value={productSearches[index] || (selectedProduct ? `${selectedProduct.part_number} - ${selectedProduct.model}` : '')}
                          onChange={(e) => setProductSearches({ ...productSearches, [index]: e.target.value })}
                          onFocus={() => setShowProductDropdowns({ ...showProductDropdowns, [index]: true })}
                          onBlur={() => setTimeout(() => setShowProductDropdowns({ ...showProductDropdowns, [index]: false }), 200)}
                          disabled={isFormLoading}
                          className={`cursor-pointer ${errors.items?.[index]?.product_id ? 'border-red-500 focus:border-red-500' : ''}`}
                          autoComplete="off"
                          aria-invalid={!!errors.items?.[index]?.product_id}
                          aria-describedby={errors.items?.[index]?.product_id ? `product-${index}-error` : undefined}
                        />
                        {showProductDropdowns[index] && productsData?.data && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-xl z-50 max-h-64 overflow-y-auto">
                            {productsData.data.length > 0 ? (
                              productsData.data.map((product) => (
                                <div
                                  key={product.id}
                                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                  onClick={() => handleProductSelect(index, product)}
                                >
                                  <div className="font-medium text-sm">
                                    {product.part_number} - {product.model}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    Available: {product.available_qty} | Default Price: €{product.sell_price.toFixed(2)}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-gray-500 text-sm">No products found</div>
                            )}
                          </div>
                        )}
                      </div>
                      {renderFieldError(errors.items?.[index]?.product_id)}
                      {selectedProduct && (
                        <p className="mt-1 text-xs text-gray-500">
                          Available: {selectedProduct.available_qty}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <Label htmlFor={`quantity-${index}`} className="flex items-center gap-1 mb-2">
                        Ordered Qty
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`quantity-${index}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter quantity"
                        {...register(`items.${index}.ordered_qty`, { 
                          valueAsNumber: true,
                          validate: (value) => {
                            if (!value || value <= 0) return 'Quantity must be greater than 0';
                            return true;
                          }
                        })}
                        disabled={isFormLoading}
                        className={errors.items?.[index]?.ordered_qty ? 'border-red-500 focus:border-red-500' : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          e.target.value = value;
                          // Ensure form state is updated
                          const numValue = value ? parseInt(value, 10) : 0;
                          setValue(`items.${index}.ordered_qty`, numValue);
                        }}
                        aria-invalid={!!errors.items?.[index]?.ordered_qty}
                        aria-describedby={errors.items?.[index]?.ordered_qty ? `quantity-${index}-error` : undefined}
                      />
                      {renderFieldError(errors.items?.[index]?.ordered_qty)}
                    </div>

                    {/* Unit Price */}
                    <div>
                      <Label htmlFor={`unit-price-${index}`} className="flex items-center gap-1 mb-2">
                        Unit Price
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`unit-price-${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...register(`items.${index}.unit_price`, {
                          valueAsNumber: true,
                          validate: (value) => {
                            if (value === undefined || value === null || value < 0) return 'Price must be 0 or greater';
                            return true;
                          }
                        })}
                        disabled={isFormLoading}
                        className={errors.items?.[index]?.unit_price ? 'border-red-500 focus:border-red-500' : ''}
                        aria-invalid={!!errors.items?.[index]?.unit_price}
                        aria-describedby={errors.items?.[index]?.unit_price ? `unit-price-${index}-error` : undefined}
                      />
                      {selectedProduct && (
                        <p className="mt-1 text-xs text-gray-500">
                          Cost: €{selectedProduct.cost_price.toFixed(2)}
                        </p>
                      )}
                      {renderFieldError(errors.items?.[index]?.unit_price)}
                    </div>
                  </div>

                  {/* Subtotal Display */}
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
                    <span className="text-sm font-medium">Subtotal:</span>
                    <span className="text-lg font-semibold text-blue-600">€{subtotal.toFixed(2)}</span>
                  </div>

                  {/* Remove Button */}
                  {fields.length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                        disabled={isFormLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {errors.items && (
            <p className="mt-2 text-sm text-red-500">{errors.items.message}</p>
          )}

          {/* Add Item Button - Moved to bottom */}
          <div className="flex justify-center mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddItem}
              disabled={isFormLoading}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Another Item
            </Button>
          </div>
        </div>

        {/* Total Amount */}
        <Card className="p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total Amount:</span>
            <span className="text-2xl font-bold text-blue-600">€{totalAmount.toFixed(2)}</span>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <Label htmlFor="notes" className="mb-2 block">Notes</Label>
          <textarea
            id="notes"
            placeholder="Optional order notes..."
            className={`w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
              errors.notes ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={3}
            {...register('notes')}
            disabled={isFormLoading}
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? 'notes-error' : undefined}
          />
          {renderFieldError(errors.notes)}
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <Button
            type="submit"
            disabled={isFormLoading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            {isFormLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isFormLoading ? 'Creating...' : 'Create Order'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isFormLoading}
            className="flex-1 py-3"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
