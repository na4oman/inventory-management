/**
 * API Response Types
 * Standardized response formats for all API endpoints
 */

/**
 * Generic API response wrapper
 * @template T - The data type being returned
 */
export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  success: boolean;
};

/**
 * Paginated response wrapper
 * @template T - The data type being returned in the array
 */
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Table filter and query parameters
 */
export type TableFilters = {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  [key: string]: any;
};

/**
 * Helper function to create a successful API response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    data,
    error: null,
    success: true,
  };
}

/**
 * Helper function to create an error API response
 */
export function createErrorResponse<T>(error: string): ApiResponse<T> {
  return {
    data: null,
    error,
    success: false,
  };
}

/**
 * Helper function to create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
