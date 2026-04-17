'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useClients, useDeleteClient } from '@/lib/hooks/useClients';

import { useToast } from '@/components/shared/Toast';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EditClientDialog } from '@/components/clients/EditClientDialog';
import { Client } from '@/lib/types/database';
import { ColumnDef } from '@tanstack/react-table';
import { Edit, Trash2 } from 'lucide-react';

export default function ClientsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string>('');

  const filters = {
    page,
    pageSize: 10,
    search: search || undefined,
  };

  const { data, isLoading, error } = useClients(filters);
  const deleteClient = useDeleteClient(deletingClientId);

  const handleDelete = useCallback(async (clientId: string, clientName: string) => {
    if (!confirm(`Are you sure you want to delete ${clientName}?`)) return;
    try {
      setDeletingClientId(clientId);
      await deleteClient.mutateAsync();
      addToast({ type: 'success', title: 'Client deleted successfully' });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to delete client',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setDeletingClientId('');
    }
  }, [addToast, deleteClient]);

  const columns: ColumnDef<Client>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => row.original.email || '-',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => row.original.phone || '-',
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => {
        const address = row.original.address;
        return address ? (
          <span className="text-sm text-gray-600 line-clamp-1">{address}</span>
        ) : (
          '-'
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => {
        const { formatDate } = require('@/lib/utils/dateFormat');
        return formatDate(row.original.created_at);
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingClient(row.original)}
            title="Edit Client"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(row.original.id, row.original.name)}
            title="Delete Client"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], [handleDelete]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load clients" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Clients</h1>
        <Link href="/dashboard/clients/new">
          <Button>New Client</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          pagination={true}
          pageSize={10}
        />
      )}

      {editingClient && (
        <EditClientDialog
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSuccess={() => {
            addToast({ type: 'success', title: 'Client updated successfully' });
          }}
          onError={(message) => {
            addToast({ type: 'error', title: message });
          }}
        />
      )}
    </div>
  );
}
