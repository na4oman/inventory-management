import { PriceImportRow } from "@/lib/types/price";

/**
 * Checks for presence of required columns in the headers array.
 * @returns Array of missing column names (empty if all present)
 */
export function validatePriceImportFile(headers: string[]): string[] {
  const required = ["part_number", "new_price"];
  return required.filter((col) => !headers.includes(col));
}

/**
 * Validates a single import row and returns a typed PriceImportRow.
 * Throws an Error with a descriptive message on validation failure.
 * @param row - Raw row data (unknown shape from Excel parse)
 * @param rowNum - Excel row number (header = 1, first data row = 2)
 */
export function validatePriceImportRow(
  row: unknown,
  rowNum: number
): PriceImportRow {
  const r = row as Record<string, unknown>;

  // Validate part_number
  const partNumber = r["part_number"];
  if (partNumber === undefined || partNumber === null || String(partNumber).trim() === "") {
    throw new Error(`Row ${rowNum}: part_number is required`);
  }

  // Validate new_price
  const rawPrice = r["new_price"];

  if (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === "") {
    throw new Error(`Row ${rowNum}: new_price is required`);
  }

  const price = Number(rawPrice);

  if (isNaN(price)) {
    throw new Error(`Row ${rowNum}: new_price must be a valid number`);
  }

  if (price < 0) {
    throw new Error(`Row ${rowNum}: new_price must be 0 or greater`);
  }

  const result: PriceImportRow = {
    part_number: String(partNumber).trim(),
    new_price: price,
  };

  const desc = r["description"];
  if (desc !== undefined && desc !== null && String(desc).trim() !== "") {
    result.description = String(desc).trim();
  }

  return result;
}
