'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/shared/Toast';
import { Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportResult {
  imported: number;
  errors: string[];
}

interface ExcelImportProps {
  onImportComplete: () => void;
}

export function ExcelImport({ onImportComplete }: ExcelImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      const message = 'Please select an Excel file (.xlsx or .xls)';
      setError(message);
      toast.showError('Invalid File Type', message);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const data = await response.json();
      setResult(data.data);

      if (data.data.imported > 0) {
        toast.showSuccess(
          'Import Successful',
          `${data.data.imported} product${data.data.imported !== 1 ? 's' : ''} imported`
        );
        onImportComplete();
      }

      if (data.data.errors.length > 0) {
        toast.showWarning(
          'Import Completed with Errors',
          `${data.data.errors.length} row${data.data.errors.length !== 1 ? 's' : ''} had errors`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      toast.showError('Import Error', message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadErrorReport = () => {
    if (!result?.errors.length) return;

    const csv = ['Row,Error', ...result.errors.map((e) => `"${e}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.showInfo('Download Started', 'Error report downloaded');
  };

  const downloadTemplate = () => {
    // Create a simple Excel template using CSV format
    const headers = ['part_number', 'model', 'model_code', 'description', 'color', 'qty', 'cost_price', 'sell_price'];
    const sampleData = [
      ['PN001', 'iPhone 13', 'A2631', 'Screen replacement', 'Black', '10', '25.50', '45.00'],
      ['PN002', 'iPhone 14', 'A2895', 'Battery pack', 'White', '5', '15.00', '35.00'],
    ];

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...sampleData.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.showInfo('Download Started', 'Template downloaded');
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Import Products from Excel</h3>
          <p className="mt-1 text-sm text-gray-600">
            Upload an Excel file (.xlsx or .xls) with product data
          </p>
          <Button
            onClick={downloadTemplate}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        {/* File Input */}
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-blue-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isLoading ? 'Uploading...' : 'Select File'}
          </Button>
          <p className="mt-2 text-sm text-gray-500">or drag and drop</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Import Error</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">Import Complete</p>
                <p className="text-sm text-green-800">
                  Successfully imported {result.imported} product{result.imported !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Error List */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {result.errors.length} Error{result.errors.length !== 1 ? 's' : ''}
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadErrorReport}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Error Report
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3">
                  <ul className="space-y-1 text-sm text-red-700">
                    {result.errors.slice(0, 10).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-gray-600">
                        ... and {result.errors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold">Excel Format Requirements:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Column headers: part_number, model, model_code, description, color, qty, cost_price, sell_price</li>
            <li>part_number, model, model_code, description are required</li>
            <li>qty, cost_price, sell_price must be numbers (non-negative)</li>
            <li>color is optional</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
