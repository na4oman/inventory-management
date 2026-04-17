'use client';

import { useState } from 'react';
import { OrderItem } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';

interface OrderItemsManagerProps {
  items: (OrderItem & { product: any })[];
  onUpdateItem: (itemId: string, received_qty: number, status: string) => Promise<void>;
  isLoading?: boolean;
}

export function OrderItemsManager({
  items,
  onUpdateItem,
  isLoading = false,
}: OrderItemsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ [key: string]: number }>({});

  const handleMarkReceived = async (item: OrderItem & { product: any }) => {
    try {
      await onUpdateItem(item.id, item.ordered_qty, 'received');
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleSaveReceivedQty = async (itemId: string) => {
    const receivedQty = editValues[itemId] ?? 0;
    try {
      await onUpdateItem(itemId, receivedQty, 'received');
      setEditingId(null);
      setEditValues({});
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const pendingQty = (item: OrderItem) => item.ordered_qty - (item.shipped_qty ?? 0);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            {/* Product Info */}
            <div className="md:col-span-2">
              <div className="font-medium">{item.product.part_number}</div>
              <div className="text-sm text-gray-600">{item.product.model}</div>
            </div>

            {/* Quantities */}
            <div className="text-sm">
              <div className="text-gray-600">Ordered: {item.ordered_qty}</div>
              <div className="text-gray-600">Received: {item.received_qty}</div>
              <div className="text-gray-600">Pending: {pendingQty(item)}</div>
            </div>

            {/* Received Qty Input */}
            <div>
              {editingId === item.id ? (
                <Input
                  type="number"
                  min="0"
                  max={item.ordered_qty}
                  value={editValues[item.id] ?? item.received_qty}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      [item.id]: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={isLoading}
                  className="w-full"
                />
              ) : (
                <div className="text-sm font-medium">{item.received_qty}</div>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              {item.status === 'received' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span className="text-sm capitalize">{item.status}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {editingId === item.id ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleSaveReceivedQty(item.id)}
                    disabled={isLoading}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setEditValues({});
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditValues({ [item.id]: item.received_qty });
                    }}
                    disabled={isLoading || item.status === 'shipped'}
                  >
                    Edit
                  </Button>
                  {item.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkReceived(item)}
                      disabled={isLoading}
                    >
                      Mark Received
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
