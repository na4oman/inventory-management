'use client';

import { useRouter } from 'next/navigation';
import { ExcelImport } from '@/components/products/ExcelImport';

export default function ImportProductsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Products</h1>
        <p className="mt-2 text-gray-600">Bulk import products from an Excel file</p>
      </div>

      <ExcelImport onImportComplete={() => router.push('/dashboard/products')} />
    </div>
  );
}
