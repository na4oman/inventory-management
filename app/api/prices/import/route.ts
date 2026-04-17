import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { ImportResult } from '@/lib/types/price';
import { validatePriceImportFile, validatePriceImportRow } from '@/lib/validations/priceImport';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * POST /api/prices/import
 * Accepts a multipart/form-data request with an Excel file (.xlsx or .xls).
 * Validates file structure, processes each row, calls update_product_price RPC
 * for changed prices, and returns an ImportResult summary.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(createErrorResponse('No file provided'), { status: 400 });
    }

    // File extension validation
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        createErrorResponse('Invalid file format. Only .xlsx and .xls files are supported'),
        { status: 400 }
      );
    }

    // Parse workbook
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return NextResponse.json(createErrorResponse('Excel file is empty'), { status: 400 });
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) {
      return NextResponse.json(createErrorResponse('Excel file is empty'), { status: 400 });
    }

    // Parse rows with header:1 to get raw arrays
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

    if (allRows.length < 2) {
      return NextResponse.json(
        createErrorResponse('Excel file contains no data rows'),
        { status: 400 }
      );
    }

    const headerRow = allRows[0] as string[];
    const dataRows = allRows.slice(1);

    // Filter out completely empty rows
    const nonEmptyDataRows = dataRows.filter(
      (row) => Array.isArray(row) && (row as unknown[]).some((cell) => cell !== undefined && cell !== null && cell !== '')
    );

    if (nonEmptyDataRows.length === 0) {
      return NextResponse.json(
        createErrorResponse('Excel file contains no data rows'),
        { status: 400 }
      );
    }

    // Column validation
    const headers = headerRow.map((h) => (h != null ? String(h).trim() : ''));
    const missingColumns = validatePriceImportFile(headers);
    if (missingColumns.length > 0) {
      const message =
        missingColumns.length === 1
          ? `Missing required column: ${missingColumns[0]}`
          : `Missing required columns: ${missingColumns.join(', ')}`;
      return NextResponse.json(createErrorResponse(message), { status: 400 });
    }

    // Build column index map for fast lookup
    const colIndex: Record<string, number> = {};
    headers.forEach((h, i) => { colIndex[h] = i; });

    // Convert raw array rows to objects using headers
    const rowObjects = nonEmptyDataRows.map((row) => {
      const arr = row as unknown[];
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = arr[i];
      });
      return obj;
    });

    // Batch product lookup — fetch all products whose part_number appears in the file
    const partNumbers = rowObjects
      .map((r) => (r['part_number'] != null ? String(r['part_number']).trim() : ''))
      .filter(Boolean);

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, part_number, cost_price, description')
      .in('part_number', partNumbers);

    if (fetchError) {
      return NextResponse.json(createErrorResponse('Failed to fetch products'), { status: 500 });
    }

    const productMap = new Map<string, { id: string; cost_price: number; description: string | null }>();
    for (const p of products ?? []) {
      productMap.set(p.part_number, { id: p.id, cost_price: p.cost_price, description: p.description });
    }

    // Row processing loop
    const result: ImportResult = { updated: 0, skipped: 0, failed: 0, errors: [] };

    for (let i = 0; i < rowObjects.length; i++) {
      const rowNum = i + 2; // Excel row number (header = 1, first data row = 2)
      const rawRow = rowObjects[i];

      // Validate row
      let validRow;
      try {
        validRow = validatePriceImportRow(rawRow, rowNum);
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : `Row ${rowNum}: invalid data`);
        result.failed++;
        continue;
      }

      // Look up product
      const product = productMap.get(validRow.part_number);
      if (!product) {
        result.errors.push(`Row ${rowNum}: part number '${validRow.part_number}' not found`);
        result.failed++;
        continue;
      }

      // Skip if price unchanged
      if (validRow.new_price === product.cost_price) {
        result.skipped++;
        continue;
      }

      // Call update_product_price RPC
      const { error: rpcError } = await supabase.rpc('update_product_price', {
        p_product_id: product.id,
        p_field_name: 'cost_price',
        p_new_value: validRow.new_price,
        p_changed_by: userId,
      });

      if (rpcError) {
        result.errors.push(`Row ${rowNum}: failed to update price for '${validRow.part_number}'`);
        result.failed++;
        continue;
      }

      // Update description if provided and price changed
      if (validRow.description) {
        await supabase
          .from('products')
          .update({ description: validRow.description })
          .eq('id', product.id);
      }

      result.updated++;
    }

    return NextResponse.json({ data: result, error: null }, { status: 200 });
  } catch (error) {
    console.error('Error importing prices:', error);
    return NextResponse.json(createErrorResponse('Failed to import prices'), { status: 500 });
  }
}
