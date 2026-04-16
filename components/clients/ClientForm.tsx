'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema } from '@/lib/validations/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

interface ClientFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
}

export function ClientForm({
  onSubmit,
  onCancel,
  isLoading = false,
  initialData,
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createClientSchema),
    mode: 'onBlur',
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
    },
  });

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
    <Card className="w-full max-w-2xl p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <div>
          <Label htmlFor="name" className="flex items-center gap-1">
            Client Name
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Enter client name"
            {...register('name')}
            disabled={isFormLoading}
            className={errors.name ? 'border-red-500 focus:border-red-500' : ''}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {renderFieldError('name', errors.name)}
        </div>

        {/* Email */}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter email address"
            {...register('email')}
            disabled={isFormLoading}
            className={errors.email ? 'border-red-500 focus:border-red-500' : ''}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {renderFieldError('email', errors.email)}
        </div>

        {/* Phone */}
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            placeholder="Enter phone number"
            {...register('phone')}
            disabled={isFormLoading}
            className={errors.phone ? 'border-red-500 focus:border-red-500' : ''}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
          />
          {renderFieldError('phone', errors.phone)}
        </div>

        {/* Address */}
        <div>
          <Label htmlFor="address">Address</Label>
          <textarea
            id="address"
            placeholder="Enter address"
            className={`w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={3}
            {...register('address')}
            disabled={isFormLoading}
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? 'address-error' : undefined}
          />
          {renderFieldError('address', errors.address)}
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isFormLoading}
            className="flex-1"
          >
            {isFormLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isFormLoading ? 'Saving...' : 'Save Client'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isFormLoading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
