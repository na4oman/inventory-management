'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { OrderItem } from '@/lib/types/database';
import { Edit2, Save, X } from 'lucide-react';

interface EditableOrderItemsProps {
  items: (OrderItem & { product: any })[];
  onUpdateItem: (itemId: string, quantity: number, unitPrice: number) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  isLoading?: boolean;
}

export function EditableOrderItems({
  items,
  onUpdateItem,
  onDeleteItem,
  isLoading = false,
}: EditableOrderItemsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ [key: string]: { quantity: number; unitPrice: number } }>({});

  const handleEdit = (item: OrderItem & { product: any }) => {
    setEditingId(item.id);
    setEditValues({
      [item.id]: {
        quantity: item.ordered_qty,
        unitPrice: item.unit_price,
      },
    });
  };

  const handleSave = async (itemId: string) => {
    const values = editValues[itemId];
    if (!values) return;

    try {
      await onUpdateItem(itemId, values.quantity, values.unitPrice);
      setEditingId(null);
      setEditValues({});
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await onDeleteItem(itemId);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const isEditing = editingId === item.id;
        const values = editValues[item.id] || { quantity: item.ordered_qty, unitPrice: item.unit_price };
        const subtotal = values.quantity * values.unitPrice;

        return (
          <Card key={item.id} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
              {/* Product Info */}
              <div className="md:col-span-2">
                <div className="font-medium">{item.product.part_number}</div>
                <div className="text-sm text-gray-600">{item.product.model}</div>
              </div>

              {/* Quantity */}
              <div>
                {isEditing ? (
                  <Input
                    type="number"
                    min="1"
                    value={values.quantity}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        [item.id]: { ...values, quantity: parseInt(e.target.value) || 0 },
                      })
                    }
                    disabled={isLoading}
                    className="w-full"
                  />
                ) : (
                  <div className="text-sm font-medium">{item.ordered_qty}</div>
                )}
              </div>

              {/* Unit Price */}
              <div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={values.unitPrice}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        [item.id]: { ...values, unitPrice: parseFloat(e.target.value) || 0 },
                      })
                    }
                    disabled={isLoading}
                    className="w-full"
                  />
                ) : (
                  <div className="text-sm">€{item.unit_price.toFixed(2)}</div>
                )}
              </div>

              {/* Subtotal */}
              <div className="text-sm font-medium">€{subtotal.toFixed(2)}</div>

              {/* Actions */}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleSave(item.id)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(item)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(item.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
