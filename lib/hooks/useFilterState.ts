'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

interface UseFilterStateOptions {
  prefix?: string;
}

export function useFilterState<T extends Record<string, any>>(
  defaultFilters: T,
  options: UseFilterStateOptions = {}
) {
  const { prefix = '' } = options;
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse filters from URL
  const filters = useMemo(() => {
    const result = { ...defaultFilters };
    
    Object.keys(defaultFilters).forEach((key) => {
      const paramKey = prefix ? `${prefix}_${key}` : key;
      const value = searchParams.get(paramKey);
      
      if (value !== null) {
        // Try to parse as number
        if (!isNaN(Number(value)) && value !== '') {
          result[key] = Number(value);
        } else if (value === 'true') {
          result[key] = true;
        } else if (value === 'false') {
          result[key] = false;
        } else {
          result[key] = value;
        }
      }
    });
    
    return result;
  }, [searchParams, defaultFilters, prefix]);

  // Update filters and URL
  const setFilters = useCallback(
    (newFilters: Partial<T>) => {
      const params = new URLSearchParams(searchParams);
      
      Object.entries(newFilters).forEach(([key, value]) => {
        const paramKey = prefix ? `${prefix}_${key}` : key;
        
        if (value === undefined || value === null || value === '') {
          params.delete(paramKey);
        } else {
          params.set(paramKey, String(value));
        }
      });
      
      router.push(`?${params.toString()}`);
    },
    [searchParams, router, prefix]
  );

  // Reset filters
  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    
    Object.keys(defaultFilters).forEach((key) => {
      const paramKey = prefix ? `${prefix}_${key}` : key;
      params.delete(paramKey);
    });
    
    router.push(`?${params.toString()}`);
  }, [searchParams, router, defaultFilters, prefix]);

  return {
    filters: filters as T,
    setFilters,
    resetFilters,
  };
}
