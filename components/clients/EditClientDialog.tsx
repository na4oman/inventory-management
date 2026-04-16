'use client';

import { useState } from 'react';
import { useUpdateClient } from '@/lib/hooks/useClients';
import { Client } from '@/lib/types/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditClientDialogProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function EditClientDialog({
  client,
  onClose,
  onSuccess,
  onError,
}: EditClientDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: client.name,
    email: client.email ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
  });

  const updateClient = useUpdateClient(client.id);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      onError('Client name is required');
      return;
    }

    setIsEditing(true);
    try {
      await updateClient.mutateAsync({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
      });
      onSuccess();
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update client');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update the client information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="name">Client Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Enter client name"
              value={formData.name}
              onChange={handleChange}
              disabled={isEditing}
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter email address"
              value={formData.email}
              onChange={handleChange}
              disabled={isEditing}
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={handleChange}
              disabled={isEditing}
            />
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address">Address</Label>
            <textarea
              id="address"
              name="address"
              placeholder="Enter address"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              rows={3}
              value={formData.address}
              onChange={handleChange}
              disabled={isEditing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isEditing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isEditing}>
            {isEditing ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
