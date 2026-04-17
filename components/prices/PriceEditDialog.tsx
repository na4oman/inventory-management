'use client';

import { useState } from 'react';
import { useUpdatePrice } from '@/lib/hooks/useUpdatePrice';
import { ProductPriceRow } from '@/lib/types/price';
import { validatePrice } from '@/lib/validations/price';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

interface PriceEditDialogProps {
  product: ProductPriceRow;
  onClose: () => void;
  onSuccess: () => void;
}

export function PriceEditDialog({ product, onClose, onSuccess }: PriceEditDialogProps) {
  const [costPrice, setCostPrice] = useState(String(product.cost_price));
  const [sellPrice, setSellPrice] = useState(String(product.sell_price));
  const [errors, setErrors] = useState<{ cost_price?: string; sell_price?: string }>({});

  const updatePrice = useUpdatePrice(product.id);

  const validate = (): boolean => {
    const newErrors: { cost_price?: string; sell_price?: string } = {};
    try {
      validatePrice(costPrice);
    } catch (e) {
      newErrors.cost_price = e instanceof Error ? e.message : 'Invalid price';
    }
    try {
      validatePrice(sellPrice);
    } catch (e) {
      newErrors.sell_price = e instanceof Error ? e.message : 'Invalid price';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await updatePrice.mutateAsync({
        cost_price: validatePrice(costPrice),
        sell_price: validatePrice(sellPrice),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setErrors({ sell_price: err instanceof Error ? err.message : 'Failed to update price' });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Prices</DialogTitle>
          <DialogDescription>
            {product.part_number} — {product.model}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cost_price">Cost Price</Label>
            <Input
              id="cost_price"
              type="number"
              min="0"
              step="0.01"
              value={costPrice}
              onChange={(e) => { setCostPrice(e.target.value); setErrors((prev) => ({ ...prev, cost_price: undefined })); }}
              disabled={updatePrice.isPending}
              className={errors.cost_price ? 'border-red-500' : ''}
            />
            {errors.cost_price && (
              <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {errors.cost_price}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="sell_price">Sell Price</Label>
            <Input
              id="sell_price"
              type="number"
              min="0"
              step="0.01"
              value={sellPrice}
              onChange={(e) => { setSellPrice(e.target.value); setErrors((prev) => ({ ...prev, sell_price: undefined })); }}
              disabled={updatePrice.isPending}
              className={errors.sell_price ? 'border-red-500' : ''}
            />
            {errors.sell_price && (
              <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {errors.sell_price}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updatePrice.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updatePrice.isPending}>
            {updatePrice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
