'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Loader2, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { ImportResult } from '@/lib/types/price';
import * as XLSX from 'xlsx';

export function BulkPriceImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Client-side extension validation — no fetch if invalid
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Invalid file format. Only .xlsx and .xls files are supported.');
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/prices/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      setResult(data.data as ImportResult);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadErrorCsv = () => {
    if (!result?.errors.length) return;

    const rows = result.errors.map((msg, idx) => `${idx + 1},"${msg.replace(/"/g, '""')}"`);
    const csv = ['Row,Error', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price-import-errors.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['part_number', 'new_price', 'description'],
      ['PART-001', 99.99, 'Example product description'],
      ['PART-002', 149.00, ''],
    ]);
    // Set column widths
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Price Import');
    XLSX.writeFile(wb, 'price-import-template.xlsx');
  };

  const allSkipped = result && result.updated === 0 && result.failed === 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Bulk Price Import</h3>
            <p className="mt-1 text-sm text-gray-600">
              Upload an Excel file (.xlsx or .xls) with columns: <code>part_number</code>, <code>new_price</code>, and optional <code>description</code>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
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
            {isLoading ? 'Uploading…' : 'Select File'}
          </Button>
          <p className="mt-2 text-sm text-gray-500">Accepts .xlsx and .xls files</p>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing file, please wait…
          </div>
        )}

        {/* HTTP / validation error */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Import Error</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Import result summary */}
        {result && (
          <div className="space-y-4">
            {/* Success / skipped message */}
            {allSkipped ? (
              <div className="rounded-md bg-yellow-50 p-4 flex gap-3">
                <CheckCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">All rows were skipped — no prices changed.</p>
              </div>
            ) : result.updated > 0 ? (
              <div className="rounded-md bg-green-50 p-4 flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Successfully updated {result.updated} product price{result.updated !== 1 ? 's' : ''}.
                </p>
              </div>
            ) : null}

            {/* Skipped count (when there were also updates or failures) */}
            {!allSkipped && result.skipped > 0 && (
              <p className="text-sm text-gray-600">
                {result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped (price unchanged).
              </p>
            )}

            {/* Row-level errors */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {result.errors.length} row error{result.errors.length !== 1 ? 's' : ''}
                  </h4>
                  <Button size="sm" variant="outline" onClick={downloadErrorCsv}>
                    <Download className="h-4 w-4 mr-2" />
                    Download error CSV
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3">
                  <ul className="space-y-1 text-sm text-red-700">
                    {result.errors.slice(0, 10).map((msg, idx) => (
                      <li key={idx}>• {msg}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-gray-600">… and {result.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
