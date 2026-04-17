'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useClients } from '@/lib/hooks/useClients';
import { useOrders } from '@/lib/hooks/useOrders';
import { useProducts } from '@/lib/hooks/useProducts';
import { useSuggestedPrice } from '@/lib/hooks/useSuggestedPrice';
import { useToast } from '@/components/shared/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { LotSelector, LotAllocationWithCost } from '@/components/sales/LotSelector';

/**
 * Fetches the suggested price for a client–product pair and calls back with the result.
 * Isolated as a component so the hook can be called per-item without violating rules of hooks.
 */
function SalePriceFetcher({
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

const createSaleSchema = z.object({
  client_id: z.string().uuid('Client is required'),
  sale_date: z.string().min(1, 'Sale date is required'),
  notes: z.string().optional(),
});

interface SaleItem {
  source: 'order_item' | 'free_stock';
  order_item_id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  lot_allocations?: { lot_id: string; quantity: number }[];
}

interface CreateSaleFormProps {
  onSubmit: (data: { client_id: string; items: SaleItem[]; notes?: string; sale_date?: string }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CreateSaleForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: CreateSaleFormProps) {
  const { showWarning } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(createSaleSchema),
    defaultValues: {
      client_id: '',
      sale_date: new Date().toISOString().slice(0, 16),
      notes: '',
    },
  });

  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedOrderItems, setSelectedOrderItems] = useState<{ [key: string]: { qty: number; price: number } }>({});
  // Free-stock: price per product (user-entered sell price)
  const [selectedFreeStockItems, setSelectedFreeStockItems] = useState<{ [productId: string]: { price: number } }>({});
  // Free-stock: lot allocations with cost_price per product
  const [freeStockAllocations, setFreeStockAllocations] = useState<{ [productId: string]: LotAllocationWithCost[] }>({});
  // Free-stock: validity per product (LotSelector reports isValid)
  const [freeStockValidity, setFreeStockValidity] = useState<{ [productId: string]: boolean }>({});
  const [freeStockSearch, setFreeStockSearch] = useState('');

  const { data: clientsData } = useClients({
    search: clientSearch,
    pageSize: 100,
  });

  const selectedClientId = watch('client_id');

  // Fetch pending orders for selected client
  const { data: ordersData } = useOrders({
    status: 'pending',
    pageSize: 1000,
  });

  // Fetch all products for free stock — increase pageSize to get all products
  const { data: productsData } = useProducts({
    search: freeStockSearch,
    pageSize: 1000,
  });

  // Filter orders by selected client and get items with warehouse stock
  const receivedItems = useMemo(() => {
    if (!ordersData?.data || !selectedClientId) return [];

    return ordersData.data
      .filter(order => order.client_id === selectedClientId)
      .flatMap(order =>
        (order.items || [])
          .map(item => {
            const wh_qty = (item as any).wh_qty || 0; // current warehouse stock
            const sold_qty = (item as any).sold_qty || (item as any).shipped_qty || 0; // already sold
            console.log(`Item ${(item as any).id}: wh_qty=${wh_qty}, sold_qty=${sold_qty}`);
            return {
              ...item,
              order_number: order.order_number,
              order_id: order.id,
              available_qty: wh_qty, // warehouse stock is what's available to sell
            };
          })
          .filter(item => item.available_qty > 0) // Only show items with warehouse stock
      );
  }, [ordersData?.data, selectedClientId]);

  // Get free stock products — products with qty > 0 (warehouse stock)
  const freeStockProducts = useMemo(() => {
    if (!productsData?.data) return [];
    return productsData.data
      .map(product => ({
        ...product,
        free_qty: product.qty,
      }))
      .filter(product => product.free_qty > 0);
  }, [productsData?.data]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    let totalCost = 0;

    // From order items
    Object.entries(selectedOrderItems).forEach(([itemId, data]) => {
      const item = receivedItems.find(i => i.id === itemId);
      if (item && data.qty > 0) {
        totalQty += data.qty;
        totalAmount += data.qty * data.price;
        totalCost += data.qty * item.product.cost_price;
      }
    });

    // From free stock — cost derived from lot allocations (cost_price per lot)
    Object.entries(selectedFreeStockItems).forEach(([productId, data]) => {
      const allocs = freeStockAllocations[productId] ?? [];
      const qty = allocs.reduce((s, a) => s + a.quantity, 0);
      if (qty > 0) {
        totalQty += qty;
        totalAmount += qty * data.price;
        totalCost += allocs.reduce((s, a) => s + a.quantity * a.cost_price, 0);
      }
    });

    return {
      totalQty,
      totalAmount,
      totalCost,
      profit: totalAmount - totalCost,
    };
  }, [selectedOrderItems, selectedFreeStockItems, freeStockAllocations, receivedItems]);

  const handleFormSubmit = async (data: any) => {
    const items: SaleItem[] = [];

    // Add order items
    Object.entries(selectedOrderItems)
      .filter(([_, data]) => data.qty > 0)
      .forEach(([itemId, data]) => {
        const item = receivedItems.find(i => i.id === itemId);
        if (item) {
          items.push({
            source: 'order_item',
            order_item_id: itemId,
            product_id: item.product_id,
            quantity: data.qty,
            unit_price: data.price,
          });
        }
      });

    // Add free stock items with lot allocations
    Object.entries(selectedFreeStockItems).forEach(([productId, data]) => {
      const allocs = freeStockAllocations[productId] ?? [];
      const qty = allocs.reduce((s, a) => s + a.quantity, 0);
      if (qty > 0) {
        items.push({
          source: 'free_stock',
          product_id: productId,
          quantity: qty,
          unit_price: data.price,
          lot_allocations: allocs.map(a => ({ lot_id: a.lot_id, quantity: a.quantity })),
        });
      }
    });

    if (items.length === 0) {
      alert('Please select at least one item');
      return;
    }

    // Convert datetime-local to ISO string
    const saleDate = new Date(data.sale_date).toISOString();

    await onSubmit({
      client_id: data.client_id,
      items,
      notes: data.notes,
      sale_date: saleDate,
    });
  };

  return (
    <Card className="w-full max-w-4xl p-6">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Client Selection */}
        <div>
          <Label htmlFor="client_id">Client *</Label>
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
              disabled={isLoading}
              className="cursor-pointer"
              autoComplete="off"
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
                      setSelectedOrderItems({});
                      setSelectedFreeStockItems({});
                      setFreeStockAllocations({});
                      setFreeStockValidity({});
                    }}
                  >
                    {client.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.client_id && (
            <p className="mt-1 text-sm text-red-500">{errors.client_id.message}</p>
          )}
        </div>

        {/* Sale Date */}
        <div>
          <Label htmlFor="sale_date">Sale Date *</Label>
          <Input
            id="sale_date"
            type="datetime-local"
            {...register('sale_date')}
            disabled={isLoading}
            className="mt-2"
          />
          {errors.sale_date && (
            <p className="mt-1 text-sm text-red-500">{errors.sale_date.message}</p>
          )}
        </div>

        {/* Items Selection Tabs */}
        {selectedClientId && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
              💡 You can combine items from both customer orders and free stock in a single sale
            </div>
            <Tabs defaultValue="orders" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="orders">
                  From Customer Orders
                  {Object.keys(selectedOrderItems).length > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                      {Object.keys(selectedOrderItems).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="free_stock">
                  From Free Stock
                  {Object.keys(selectedFreeStockItems).length > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                      {Object.keys(selectedFreeStockItems).length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

            {/* Tab 1: Customer Orders */}
            <TabsContent value="orders" className="space-y-4">
              <Label>Select Items from Pending Orders *</Label>
              {receivedItems.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  No received items available for this client
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4">
                  {receivedItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedOrderItems[item.id] ? true : false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderItems({
                                ...selectedOrderItems,
                                [item.id]: { qty: (item as any).available_qty, price: item.unit_price },
                              });
                            } else {
                              const newItems = { ...selectedOrderItems };
                              delete newItems[item.id];
                              setSelectedOrderItems(newItems);
                            }
                          }}
                          disabled={isLoading}
                          className="mt-1 cursor-pointer"
                        />
                        {/* Fetch suggested price when item is selected */}
                        {selectedOrderItems[item.id] && selectedClientId && (
                          <SalePriceFetcher
                            clientId={selectedClientId}
                            productId={item.product_id}
                            onSuggestedPrice={(price) =>
                              setSelectedOrderItems((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], price },
                              }))
                            }
                            onError={() =>
                              showWarning('Price suggestion unavailable', 'Could not load suggested price. Please enter the price manually.')
                            }
                          />
                        )}
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {item.order_number} - {item.product.part_number} - {item.product.model}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          WH: {(item as any).wh_qty || 0} | Sold: {(item as any).sold_qty || (item as any).shipped_qty || 0} | Available: {(item as any).available_qty} | Default Price: €{item.unit_price.toFixed(2)} | Cost: €{item.product.cost_price.toFixed(2)}
                        </div>
                      </div>
                      {selectedOrderItems[item.id] && (
                        <div className="flex items-end gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-700">Qty</label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="Qty"
                              value={selectedOrderItems[item.id].qty}
                              onChange={(e) => {
                                const value = Math.min(
                                  (item as any).available_qty,
                                  parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0
                                );
                                setSelectedOrderItems({
                                  ...selectedOrderItems,
                                  [item.id]: {
                                    ...selectedOrderItems[item.id],
                                    qty: value,
                                  },
                                });
                              }}
                              className="w-16 text-right text-xs"
                              disabled={isLoading}
                            />
                          </div>
                          <div className="flex flex-col gap-1 justify-end pb-0.5">
                            <span className="text-xs text-gray-600 text-center">/ {(item as any).available_qty}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-700">Price</label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Price"
                              value={selectedOrderItems[item.id].price}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setSelectedOrderItems({
                                  ...selectedOrderItems,
                                  [item.id]: {
                                    ...selectedOrderItems[item.id],
                                    price: value,
                                  },
                                });
                              }}
                              className="w-20 text-right text-xs"
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Free Stock */}
            <TabsContent value="free_stock" className="space-y-4">
              <div>
                <Label htmlFor="free_stock_search">Search Products</Label>
                <Input
                  id="free_stock_search"
                  placeholder="Search by part number or model..."
                  value={freeStockSearch}
                  onChange={(e) => setFreeStockSearch(e.target.value)}
                  disabled={isLoading}
                  className="mt-2"
                />
              </div>

              <Label>Available Free Stock *</Label>
              {freeStockProducts.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  No free stock available
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4">
                  {freeStockProducts.map((product) => {
                    const isChecked = !!selectedFreeStockItems[product.id];
                    return (
                      <div key={product.id} className="space-y-2">
                        <div className="flex items-start gap-4 p-3 bg-gray-50 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFreeStockItems({
                                  ...selectedFreeStockItems,
                                  [product.id]: { price: product.sell_price },
                                });
                              } else {
                                const newItems = { ...selectedFreeStockItems };
                                delete newItems[product.id];
                                setSelectedFreeStockItems(newItems);
                                // Clear allocations and validity
                                const newAllocs = { ...freeStockAllocations };
                                delete newAllocs[product.id];
                                setFreeStockAllocations(newAllocs);
                                const newValidity = { ...freeStockValidity };
                                delete newValidity[product.id];
                                setFreeStockValidity(newValidity);
                              }
                            }}
                            disabled={isLoading}
                            className="mt-1 cursor-pointer"
                          />
                          {/* Fetch suggested price when item is selected */}
                          {isChecked && selectedClientId && (
                            <SalePriceFetcher
                              clientId={selectedClientId}
                              productId={product.id}
                              onSuggestedPrice={(price) =>
                                setSelectedFreeStockItems((prev) => ({
                                  ...prev,
                                  [product.id]: { ...prev[product.id], price },
                                }))
                              }
                              onError={() =>
                                showWarning('Price suggestion unavailable', 'Could not load suggested price. Please enter the price manually.')
                              }
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {product.part_number} - {product.model}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              Free Stock: {product.free_qty} | Sell Price: €{product.sell_price.toFixed(2)} | Cost: €{product.cost_price.toFixed(2)}
                            </div>
                          </div>
                          {isChecked && (
                            <div className="flex items-end gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700">Price</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Price"
                                  value={selectedFreeStockItems[product.id].price}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setSelectedFreeStockItems({
                                      ...selectedFreeStockItems,
                                      [product.id]: {
                                        ...selectedFreeStockItems[product.id],
                                        price: value,
                                      },
                                    });
                                  }}
                                  className="w-20 text-right text-xs"
                                  disabled={isLoading}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        {/* LotSelector below the product row when checked */}
                        {isChecked && (
                          <div className="ml-10 mr-4">
                            <LotSelector
                              productId={product.id}
                              maxQty={product.free_qty}
                              onChange={(allocs) => {
                                setFreeStockAllocations((prev) => ({
                                  ...prev,
                                  [product.id]: allocs,
                                }));
                              }}
                              onValidChange={(valid) => {
                                setFreeStockValidity((prev) => ({
                                  ...prev,
                                  [product.id]: valid,
                                }));
                              }}
                              disabled={isLoading}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
          </div>
        )}

        {/* Selected Items Summary */}
        {(Object.keys(selectedOrderItems).length > 0 || Object.keys(selectedFreeStockItems).length > 0) && (
          <Card className="p-4 bg-green-50 border border-green-200">
            <div className="space-y-2">
              {Object.keys(selectedOrderItems).length > 0 && (
                <div className="text-sm">
                  <span className="font-semibold text-green-900">From Customer Orders:</span>
                  <span className="text-green-800 ml-2">
                    {Object.keys(selectedOrderItems).length} item(s) selected
                  </span>
                </div>
              )}
              {Object.keys(selectedFreeStockItems).length > 0 && (
                <div className="text-sm">
                  <span className="font-semibold text-green-900">From Free Stock:</span>
                  <span className="text-green-800 ml-2">
                    {Object.keys(selectedFreeStockItems).length} item(s) selected
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Totals */}
        {(Object.keys(selectedOrderItems).length > 0 || Object.keys(selectedFreeStockItems).length > 0) && (
          <Card className="p-4 pl-16 bg-blue-50">
            <div className="grid grid-cols-4 gap-4 w-full">
              <div>
                <div className="text-gray-600 text-sm">Total Items</div>
                <div className="text-3xl font-bold text-blue-600">{totals.totalQty}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Total Amount</div>
                <div className="text-3xl font-bold text-blue-600">€{totals.totalAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Total Cost</div>
                <div className="text-3xl font-bold text-blue-600">€{totals.totalCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Profit</div>
                <div className="text-3xl font-bold text-green-600">€{totals.profit.toFixed(2)}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            placeholder="Optional sale notes..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={3}
            {...register('notes')}
            disabled={isLoading}
          />
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={
              isLoading ||
              (Object.keys(selectedOrderItems).length === 0 && Object.keys(selectedFreeStockItems).length === 0) ||
              // Block if any checked free-stock product has no allocations or invalid state
              Object.keys(selectedFreeStockItems).some((productId) => {
                const allocs = freeStockAllocations[productId] ?? [];
                const qty = allocs.reduce((s, a) => s + a.quantity, 0);
                return qty === 0 || freeStockValidity[productId] === false;
              })
            }
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isLoading ? 'Creating Sale...' : 'Create Sale'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
