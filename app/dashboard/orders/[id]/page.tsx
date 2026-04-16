'use client';

import { useParams } from 'next/navigation';
import { useOrder } from '@/lib/hooks/useOrders';
import { useToast } from '@/components/shared/Toast';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import Link from 'next/link';
import { EditableOrderItems } from '@/components/orders/EditableOrderItems';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OrderDetailsPage() {
  const params = useParams();
  const { addToast } = useToast();
  const orderId = params.id as string;
  const { data: response, isLoading, error, refetch } = useOrder(orderId);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingItems, setIsUpdatingItems] = useState(false);

  const order = response?.data;

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    received: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const handleUpdateItem = async (itemId: string, quantity: number, unitPrice: number) => {
    setIsUpdatingItems(true);
    try {
      const response = await fetch(`/api/order-items/${itemId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_qty: quantity, unit_price: unitPrice }),
      });

      if (!response.ok) throw new Error('Failed to update item');

      addToast({ type: 'success', title: 'Item updated successfully' });
      await refetch?.();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to update item',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsUpdatingItems(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setIsUpdatingItems(true);
    try {
      const response = await fetch(`/api/order-items/${itemId}/delete`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete item');

      addToast({ type: 'success', title: 'Item deleted successfully' });
      await refetch?.();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to delete item',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsUpdatingItems(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      addToast({ type: 'success', title: 'Order status updated' });
      await refetch?.();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to update status',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error || !order) return <ErrorMessage message="Failed to load order" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order {order.order_number}</h1>
          <p className="text-gray-600 mt-2">Created {(() => { const { formatDate } = require('@/lib/utils/dateFormat'); return formatDate(order.created_at); })()}</p>
        </div>
        <Link href="/dashboard/orders">
          <Button variant="outline">Back to Orders</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Order Information</h2>
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-600">Order Number:</span> {order.order_number}</div>
            {order.order_type === 'forecast' && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Type:</span>
                <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700 font-medium">
                  Forecast Order
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Status:</span>
              <Select value={order.status} onValueChange={handleStatusChange} disabled={isUpdatingStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><span className="text-gray-600">Total Amount:</span> €{order.total_amount.toFixed(2)}</div>
            {order.notes && <div><span className="text-gray-600">Notes:</span> {order.notes}</div>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Client Information</h2>
          <div className="space-y-2 text-sm">
            {order.order_type === 'forecast' ? (
              <div className="text-gray-500 italic">No client assigned (Forecast Order)</div>
            ) : (
              <>
                <div><span className="text-gray-600">Client:</span> {order.client?.name}</div>
                {order.client?.email && <div><span className="text-gray-600">Email:</span> {order.client.email}</div>}
                {order.client?.phone && <div><span className="text-gray-600">Phone:</span> {order.client.phone}</div>}
              </>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-600">Items:</span> {order.items?.length || 0}</div>
            <div><span className="text-gray-600">Total:</span> €{order.total_amount.toFixed(2)}</div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Order Items - Edit Quantities & Prices</h2>
        {order.items && order.items.length > 0 ? (
          <EditableOrderItems
            items={order.items}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            isLoading={isUpdatingItems}
          />
        ) : (
          <div className="text-center text-gray-500 py-8">No items in this order</div>
        )}
      </Card>
    </div>
  );
}
