'use client';

import { useMutation } from '@tanstack/react-query';

export function useFixOrderStatus() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/orders/fix-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fix order statuses');
      }
      return response.json();
    },
  });
}
