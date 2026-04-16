'use client';

import { useState } from 'react';
import { useConvertOrderToSale } from '@/lib/hooks/useOrders';
import { useToast } from '@/components/shared/Toast';
import { updateOrderStatusIfNeeded } from '@/lib/utils/orderStatusManager';
import { OrderWithDetails } from '@/lib/types/viewModels';
import { supabase } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ConvertOrderDialogProps {
  orderId: string;
  order: OrderWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConvertOrderDialog({
  orderId,
  order,
  onClose,
  onSuccess,
}: ConvertOrderDialogProps) {
  const toast = useToast();
  const [isConverting, setIsConverting] = useState(false);
  const convertOrder = useConvertOrderToSale(orderId);

  // Check inventory availability
  const inventoryIssues = order.items.filter(
    (item) => item.ordered_qty > item.product.qty
  );

  const handleConvert = async () => {
    if (inventoryIssues.length > 0) {
      toast.showError('Inventory Error', 'Insufficient inventory for some products');
      return;
    }

    setIsConverting(true);
    try {
      await convertOrder.mutateAsync();

      // Fetch updated order items to check fulfillment status
      const { data: updatedOrder, error: fetchError } = await supabase
        .from('orders')
        .select('items:order_items(*)')
        .eq('id', orderId)
        .single();

      if (!fetchError && updatedOrder?.items) {
        // Update order status based on fulfillment
        const newStatus = await updateOrderStatusIfNeeded(orderId, updatedOrder.items);
        if (newStatus) {
          toast.showSuccess(
            'Order Converted & Status Updated',
            `Sale created and order status changed to ${newStatus}`
          );
        } else {
          toast.showSuccess('Order converted successfully', 'Sale created and inventory updated');
        }
      } else {
        toast.showSuccess('Order converted successfully', 'Sale created and inventory updated');
      }

      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to convert order';
      toast.showError('Conversion Error', message);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Convert Order to Sale</DialogTitle>
          <DialogDescription>
            Review the order details and confirm the conversion to sale
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">Order Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="font-medium">{order.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Client</p>
                <p className="font-medium">{order.client.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="font-medium">{order.item_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="font-bold text-blue-600">€{order.total_amount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Inventory Check */}
          <div>
            <h3 className="font-semibold mb-3">Inventory Check</h3>
            <div className="rounded-md border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const hasEnough = item.ordered_qty <= item.product.qty;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product.model}</p>
                            <p className="text-sm text-gray-600">
                              {item.product.part_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.ordered_qty}</TableCell>
                        <TableCell className="text-right">{item.product.qty}</TableCell>
                        <TableCell className="text-center">
                          {hasEnough ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {inventoryIssues.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Insufficient Inventory</p>
                  <p className="text-sm text-red-800">
                    {inventoryIssues.map((item) => item.product.model).join(', ')} do not have
                    enough stock
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div>
            <h3 className="font-semibold mb-3">Order Items</h3>
            <div className="rounded-md border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.product.model}</p>
                      </TableCell>
                      <TableCell className="text-right">{item.ordered_qty}</TableCell>
                      <TableCell className="text-right">€{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        €{(item.unit_price * item.ordered_qty).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isConverting}>
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={isConverting || inventoryIssues.length > 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isConverting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isConverting ? 'Converting...' : 'Convert to Sale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
