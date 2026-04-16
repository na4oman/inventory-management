'use client';

import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/products/ProductForm';
import { useCreateProduct } from '@/lib/hooks/useProducts';
import { useToast } from '@/components/shared/Toast';
import { CreateProductInput } from '@/lib/validations/product';

export default function NewProductPage() {
  const router = useRouter();
  const toast = useToast();
  const createProduct = useCreateProduct();

  const handleSubmit = async (data: CreateProductInput) => {
    try {
      await createProduct.mutateAsync(data);
      toast.showSuccess('Product created successfully', 'Redirecting to products list...');
      setTimeout(() => {
        router.push('/dashboard/products');
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create product';
      toast.showError('Error', message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Product</h1>
        <p className="mt-2 text-gray-600">Add a new product to your inventory</p>
      </div>

      <ProductForm
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        isLoading={createProduct.isPending}
      />
    </div>
  );
}
