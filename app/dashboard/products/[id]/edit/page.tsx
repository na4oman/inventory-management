'use client';

import { useRouter, useParams } from 'next/navigation';
import { ProductForm } from '@/components/products/ProductForm';
import { ProductLotsTable } from '@/components/products/ProductLotsTable';
import { useProduct, useUpdateProduct } from '@/lib/hooks/useProducts';
import { useToast } from '@/components/shared/Toast';
import { CreateProductInput } from '@/lib/validations/product';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const productId = params.id as string;

  const { data: response, isLoading: isLoadingProduct } = useProduct(productId);
  const product = response?.data;
  const updateProduct = useUpdateProduct(productId);

  const handleSubmit = async (data: CreateProductInput) => {
    try {
      await updateProduct.mutateAsync(data);
      toast.showSuccess('Product updated successfully', 'Redirecting to products list...');
      setTimeout(() => {
        router.push('/dashboard/products');
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update product';
      toast.showError('Error', message);
    }
  };

  if (isLoadingProduct) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <div className="text-center text-gray-500">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <div className="text-center text-red-500">Product not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="mt-2 text-gray-600">Update product information</p>
      </div>

      <ProductForm
        product={product}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        isLoading={updateProduct.isPending}
      />

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Inventory Lots</h2>
        <ProductLotsTable productId={productId} />
      </div>
    </div>
  );
}
