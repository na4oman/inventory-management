'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreateSaleForm } from '@/components/sales/CreateSaleForm';
import { useToast } from '@/components/shared/Toast';

export default function NewSalePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateSale = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create sale');
      }

      const result = await response.json();
      
      // Invalidate products and orders queries to refresh inventory
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      addToast({
        type: 'success',
        title: 'Sale created successfully',
        message: `Sale ${result.data.sale_number} created`,
      });

      router.push('/dashboard/sales');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to create sale',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Sale</h1>
        <p className="text-gray-600 mt-2">
          Select received items from pending orders to create a sale
        </p>
      </div>

      <CreateSaleForm
        onSubmit={handleCreateSale}
        onCancel={() => router.back()}
        isLoading={isLoading}
      />
    </div>
  );
}
