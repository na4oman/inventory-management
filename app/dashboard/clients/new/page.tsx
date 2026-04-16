'use client';

import { useRouter } from 'next/navigation';
import { ClientForm } from '@/components/clients/ClientForm';
import { useCreateClient } from '@/lib/hooks/useClients';
import { useToast } from '@/components/shared/Toast';

export default function NewClientPage() {
  const router = useRouter();
  const toast = useToast();
  const createClient = useCreateClient();

  const handleSubmit = async (data: any) => {
    try {
      await createClient.mutateAsync(data);
      toast.showSuccess('Client created successfully', 'Redirecting to clients list...');
      setTimeout(() => {
        router.push('/dashboard/clients');
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create client';
      toast.showError('Error', message);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/clients');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Client</h1>
        <p className="text-gray-600 mt-2">Create a new client record</p>
      </div>

      <ClientForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={createClient.isPending}
      />
    </div>
  );
}
