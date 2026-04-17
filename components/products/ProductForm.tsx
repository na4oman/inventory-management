'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema } from '@/lib/validations/product';
import { Product } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateInventoryLot } from '@/lib/hooks/useInventoryLots';
import { useToast } from '@/components/shared/Toast';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

interface LotFormState {
  quantity: string;
  cost_price: string;
  arrival_date: string;
  notes: string;
}

interface LotFormErrors {
  quantity?: string;
  cost_price?: string;
  arrival_date?: string;
}

export function ProductForm({
  product,
  onSubmit,
  onCancel,
  isLoading = false,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createProductSchema),
    mode: 'onBlur',
    defaultValues: {
      part_number: '',
      model: '',
      model_code: '',
      description: '',
      color: '',
      qty: 0,
      cost_price: 0,
      sell_price: 0,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        part_number: product.part_number,
        model: product.model,
        model_code: product.model_code,
        description: product.description,
        color: product.color || '',
        qty: product.qty,
        cost_price: product.cost_price,
        sell_price: product.sell_price,
      });
    }
  }, [product, reset]);

  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [lotForm, setLotForm] = useState<LotFormState>({
    quantity: '',
    cost_price: '',
    arrival_date: todayISO(),
    notes: '',
  });
  const [lotErrors, setLotErrors] = useState<LotFormErrors>({});
  const createLot = useCreateInventoryLot();
  const toast = useToast();

  const openLotModal = () => {
    setLotForm({ quantity: '', cost_price: '', arrival_date: todayISO(), notes: '' });
    setLotErrors({});
    setLotModalOpen(true);
  };

  const validateLotForm = (): boolean => {
    const errs: LotFormErrors = {};
    const qty = parseFloat(lotForm.quantity);
    const cp = parseFloat(lotForm.cost_price);
    if (!lotForm.quantity || isNaN(qty) || qty <= 0) {
      errs.quantity = 'Quantity must be greater than 0';
    }
    if (lotForm.cost_price === '' || isNaN(cp) || cp < 0) {
      errs.cost_price = 'Cost price must be 0 or greater';
    }
    if (!lotForm.arrival_date) {
      errs.arrival_date = 'Arrival date is required';
    }
    setLotErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLotSubmit = async () => {
    if (!product?.id || !validateLotForm()) return;
    try {
      await createLot.mutateAsync({
        product_id: product.id,
        quantity: parseFloat(lotForm.quantity),
        cost_price: parseFloat(lotForm.cost_price),
        arrival_date: lotForm.arrival_date,
        notes: lotForm.notes || undefined,
      });
      setLotModalOpen(false);
      toast.showSuccess('Stock added', 'Inventory lot created successfully.');
    } catch (error) {
      toast.showError('Error', error instanceof Error ? error.message : 'Failed to create lot');
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  const renderFieldError = (_fieldName: string, error: any) => {
    if (!error) return null;
    return (
      <div className="mt-1 flex items-start gap-2 rounded-md bg-red-50 p-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600 mt-0.5" />
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl p-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Part Number */}
          <div>
            <Label htmlFor="part_number" className="flex items-center gap-1 mb-2 font-semibold">
              Part Number
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="part_number"
              placeholder="e.g., PN-001"
              {...register('part_number')}
              disabled={isFormLoading}
              className={errors.part_number ? 'border-red-500 focus:border-red-500' : ''}
              aria-invalid={!!errors.part_number}
              aria-describedby={errors.part_number ? 'part_number-error' : undefined}
            />
            {renderFieldError('part_number', errors.part_number)}
          </div>

          {/* Model */}
          <div>
            <Label htmlFor="model" className="flex items-center gap-1 mb-2 font-semibold">
              Model
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="model"
              placeholder="e.g., iPhone 15"
              {...register('model')}
              disabled={isFormLoading}
              className={errors.model ? 'border-red-500 focus:border-red-500' : ''}
              aria-invalid={!!errors.model}
              aria-describedby={errors.model ? 'model-error' : undefined}
            />
            {renderFieldError('model', errors.model)}
          </div>

          {/* Model Code */}
          <div>
            <Label htmlFor="model_code" className="flex items-center gap-1 mb-2 font-semibold">
              Model Code
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="model_code"
              placeholder="e.g., A3111"
              {...register('model_code')}
              disabled={isFormLoading}
              className={errors.model_code ? 'border-red-500 focus:border-red-500' : ''}
              aria-invalid={!!errors.model_code}
              aria-describedby={errors.model_code ? 'model_code-error' : undefined}
            />
            {renderFieldError('model_code', errors.model_code)}
          </div>

          {/* Color */}
          <div>
            <Label htmlFor="color" className="mb-2 font-semibold block">Color</Label>
            <Input
              id="color"
              placeholder="e.g., Black"
              {...register('color')}
              disabled={isFormLoading}
              className={errors.color ? 'border-red-500 focus:border-red-500' : ''}
              aria-invalid={!!errors.color}
              aria-describedby={errors.color ? 'color-error' : undefined}
            />
            {renderFieldError('color', errors.color)}
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description" className="flex items-center gap-1 mb-2 font-semibold">
            Description
            <span className="text-red-500">*</span>
          </Label>
          <textarea
            id="description"
            placeholder="Product description"
            className={`w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            {...register('description')}
            disabled={isFormLoading}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'description-error' : undefined}
          />
          {renderFieldError('description', errors.description)}
        </div>

        {/* Quantity, Cost Price, Sell Price */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <Label htmlFor="qty" className="mb-2 font-semibold block">Quantity</Label>
            <div className="flex items-center gap-2">
              <Input
                id="qty"
                type="number"
                value={product?.qty ?? 0}
                readOnly
                disabled
                className="bg-gray-50 cursor-not-allowed text-gray-500"
                aria-label="Current quantity (read-only)"
              />
              {product?.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openLotModal}
                  disabled={isFormLoading}
                  className="whitespace-nowrap flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Free Stock
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="cost_price" className="mb-2 font-semibold block">Cost Price (€)</Label>
            <Input
              id="cost_price"
              type="number"
              placeholder="0.00"
              step="0.01"
              {...register('cost_price', { valueAsNumber: true })}
              disabled={isFormLoading}
              className={errors.cost_price ? 'border-red-500 focus:border-red-500' : ''}
              aria-invalid={!!errors.cost_price}
              aria-describedby={errors.cost_price ? 'cost_price-error' : undefined}
            />
            {renderFieldError('cost_price', errors.cost_price)}
          </div>

          <div>
            <Label htmlFor="sell_price" className="mb-2 font-semibold block">Sell Price (€)</Label>
            <Input
              id="sell_price"
              type="number"
              placeholder="0.00"
              step="0.01"
              {...register('sell_price', { valueAsNumber: true })}
              disabled={isFormLoading}
              className={errors.sell_price ? 'border-red-500 focus:border-red-500' : ''}
              aria-invalid={!!errors.sell_price}
              aria-describedby={errors.sell_price ? 'sell_price-error' : undefined}
            />
            {renderFieldError('sell_price', errors.sell_price)}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <Button
            type="submit"
            disabled={isFormLoading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            {isFormLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isFormLoading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
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

      {/* Add Free Stock Modal */}
      <Dialog open={lotModalOpen} onOpenChange={setLotModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Free Stock</DialogTitle>
            <DialogDescription>
              Create a new inventory lot for this product
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="lot_quantity">Quantity *</Label>
              <Input
                id="lot_quantity"
                type="number"
                placeholder="Enter quantity"
                value={lotForm.quantity}
                onChange={(e) => setLotForm({ ...lotForm, quantity: e.target.value })}
                disabled={createLot.isPending}
              />
              {lotErrors.quantity && (
                <p className="text-sm text-red-600 mt-1">{lotErrors.quantity}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lot_cost_price">Cost Price (€) *</Label>
              <Input
                id="lot_cost_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={lotForm.cost_price}
                onChange={(e) => setLotForm({ ...lotForm, cost_price: e.target.value })}
                disabled={createLot.isPending}
              />
              {lotErrors.cost_price && (
                <p className="text-sm text-red-600 mt-1">{lotErrors.cost_price}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lot_arrival_date">Arrival Date *</Label>
              <Input
                id="lot_arrival_date"
                type="date"
                value={lotForm.arrival_date}
                onChange={(e) => setLotForm({ ...lotForm, arrival_date: e.target.value })}
                disabled={createLot.isPending}
              />
              {lotErrors.arrival_date && (
                <p className="text-sm text-red-600 mt-1">{lotErrors.arrival_date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lot_notes">Notes</Label>
              <textarea
                id="lot_notes"
                placeholder="Optional notes"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                rows={3}
                value={lotForm.notes}
                onChange={(e) => setLotForm({ ...lotForm, notes: e.target.value })}
                disabled={createLot.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLotModalOpen(false)}
              disabled={createLot.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleLotSubmit} disabled={createLot.isPending}>
              {createLot.isPending ? 'Creating...' : 'Create Lot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
