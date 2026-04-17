import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

interface ExcelRow {
  part_number?: string;
  model?: string;
  model_code?: string;
  description?: string;
  color?: string;
  qty?: number | string;
  cost_price?: number | string;
  sell_price?: number | string;
  [key: string]: any;
}

interface ProductToInsert {
  part_number: string;
  model: string;
  model_code: string;
  description: string;
  color: string | null;
  qty: number;
  cost_price: number;
  sell_price: number;
  booked_qty: number;
}

/**
 * POST /api/products/import
 * Import products from Excel file
 */
export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        createErrorResponse('No file provided'),
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        createErrorResponse('Invalid file format. Only .xlsx and .xls files are supported'),
        { status: 400 }
      );
    }

    // Read file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!worksheet) {
      return NextResponse.json(
        createErrorResponse('Excel file is empty'),
        { status: 400 }
      );
    }

    // Parse rows
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    if (rows.length === 0) {
      return NextResponse.json(
        createErrorResponse('Excel file contains no data rows'),
        { status: 400 }
      );
    }

    // Validate and transform rows
    const validProducts: ProductToInsert[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)

      try {
        // Validate required fields
        if (!row.part_number || typeof row.part_number !== 'string' || !row.part_number.trim()) {
          throw new Error('part_number is required and must be a non-empty string');
        }
        if (!row.model || typeof row.model !== 'string' || !row.model.trim()) {
          throw new Error('model is required and must be a non-empty string');
        }
        if (!row.model_code || typeof row.model_code !== 'string' || !row.model_code.trim()) {
          throw new Error('model_code is required and must be a non-empty string');
        }
        if (!row.description || typeof row.description !== 'string' || !row.description.trim()) {
          throw new Error('description is required and must be a non-empty string');
        }

        // Validate numeric fields
        const qty = row.qty !== undefined && row.qty !== '' ? Number(row.qty) : 0;
        const costPrice = row.cost_price !== undefined && row.cost_price !== '' ? Number(row.cost_price) : 0;
        const sellPrice = row.sell_price !== undefined && row.sell_price !== '' ? Number(row.sell_price) : 0;

        if (isNaN(qty) || qty < 0) {
          throw new Error('qty must be a non-negative number');
        }
        if (isNaN(costPrice) || costPrice < 0) {
          throw new Error('cost_price must be a non-negative number');
        }
        if (isNaN(sellPrice) || sellPrice < 0) {
          throw new Error('sell_price must be a non-negative number');
        }

        // Add to valid products
        validProducts.push({
          part_number: row.part_number.trim(),
          model: row.model.trim(),
          model_code: row.model_code.trim(),
          description: row.description.trim(),
          color: row.color ? String(row.color).trim() : null,
          qty: qty,
          cost_price: costPrice,
          sell_price: sellPrice,
          booked_qty: 0,
        });
      } catch (error) {
        errors.push(
          `Row ${rowNum}: ${error instanceof Error ? error.message : 'Invalid data'}`
        );
      }
    }

    // If no valid products, return error
    if (validProducts.length === 0) {
      return NextResponse.json(
        createSuccessResponse({
          imported: 0,
          errors,
        })
      );
    }

    // Check for existing products by part_number
    const partNumbers = validProducts.map(p => p.part_number);
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('part_number')
      .in('part_number', partNumbers);

    if (fetchError) {
      return NextResponse.json(
        createErrorResponse('Failed to check for existing products'),
        { status: 500 }
      );
    }

    const existingPartNumbers = new Set(existingProducts?.map(p => p.part_number) || []);

    // Separate new products from duplicates
    const newProducts: ProductToInsert[] = [];
    const duplicates: string[] = [];

    for (const product of validProducts) {
      if (existingPartNumbers.has(product.part_number)) {
        duplicates.push(`Part Number: ${product.part_number} (${product.model}) - Already exists in database`);
      } else {
        newProducts.push(product);
      }
    }

    // If no new products to insert, return info about duplicates
    if (newProducts.length === 0) {
      return NextResponse.json(
        createSuccessResponse({
          imported: 0,
          errors: [...errors, ...duplicates],
          message: 'All products already exist in the database',
        })
      );
    }

    // Bulk insert only new products
    const { data, error: insertError } = await supabase
      .from('products')
      .insert(newProducts)
      .select();

    if (insertError) {
      return NextResponse.json(
        createErrorResponse(insertError.message),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        imported: data?.length || 0,
        skipped: duplicates.length,
        errors: [...errors, ...duplicates],
      })
    );
  } catch (error) {
    console.error('Error importing products:', error);
    return NextResponse.json(
      createErrorResponse('Failed to import products'),
      { status: 500 }
    );
  }
}
