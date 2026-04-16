'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema } from '@/lib/validations/product';
import { Product } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
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
    formState: { errors, isSubmitting, isDirty },
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

  // Update form when product data loads
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

  const isFormLoading = isLoading || isSubmitting;

  const renderFieldError = (fieldName: string, error: any) => {
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
            <Input
              id="qty"
              type="number"
              placeholder="0"
              {...register('qty', { valueAsNumber: true })}
              disabled={isFormLoading}
              className={errors.qty ? 'border-red-500 focus:border-red-500' : ''}
              aria-invalid={!!errors.qty}
              aria-describedby={errors.qty ? 'qty-error' : undefined}
            />
            {renderFieldError('qty', errors.qty)}
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
    </Card>
  );
}
