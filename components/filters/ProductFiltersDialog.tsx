'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProductFilters {
  priceMin?: number;
  priceMax?: number;
  stockMin?: number;
  stockMax?: number;
}

interface ProductFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
}

export function ProductFiltersDialog({
  open,
  onOpenChange,
  filters,
  onApply,
}: ProductFiltersDialogProps) {
  const [localFilters, setLocalFilters] = useState<ProductFilters>(filters);

  const handleApply = () => {
    onApply(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalFilters({});
    onApply({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Advanced Filters</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Price Range (€)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.priceMin ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    priceMin: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.priceMax ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    priceMax: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Stock Level</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.stockMin ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    stockMin: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.stockMax ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    stockMax: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
