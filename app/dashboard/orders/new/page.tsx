'use client';

import { useRouter } from 'next/navigation';
import { OrderForm } from '@/components/orders/OrderForm';
import { useCreateOrder } from '@/lib/hooks/useOrders';
import { useToast } from '@/components/shared/Toast';

export default function NewOrderPage() {
  const router = useRouter();
  const toast = useToast();
  const createOrder = useCreateOrder();

  const handleSubmit = async (data: any) => {
    try {
      await createOrder.mutateAsync(data);
      toast.showSuccess('Order created successfully', 'Redirecting to orders list...');
      setTimeout(() => {
        router.push('/dashboard/orders');
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create order';
      toast.showError('Error', message);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/orders');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Order</h1>
        <p className="text-gray-600 mt-2">Create a new order and reserve inventory</p>
      </div>

      <OrderForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={createOrder.isPending}
      />
    </div>
  );
}
