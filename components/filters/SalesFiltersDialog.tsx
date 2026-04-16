'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SalesFilters {
  dateFrom?: string;
  dateTo?: string;
  profitMin?: number;
  profitMax?: number;
  clientId?: string;
}

interface SalesFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SalesFilters;
  onApply: (filters: SalesFilters) => void;
  clients?: Array<{ id: string; name: string }>;
}

export function SalesFiltersDialog({
  open,
  onOpenChange,
  filters,
  onApply,
  clients = [],
}: SalesFiltersDialogProps) {
  const [localFilters, setLocalFilters] = useState<SalesFilters>(filters);

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
            <Label>Date Range</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={localFilters.dateFrom ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    dateFrom: e.target.value || undefined,
                  })
                }
              />
              <Input
                type="date"
                value={localFilters.dateTo ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    dateTo: e.target.value || undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Profit Range (€)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.profitMin ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    profitMin: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.profitMax ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    profitMax: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Client</Label>
            <Select
              value={localFilters.clientId ?? 'all'}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  clientId: value === 'all' ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
