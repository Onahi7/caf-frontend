import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Search, Plus, Trash2 } from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { unwrapArray } from '../../lib/unwrap-response';

interface Supplier {
  _id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
  isActive: boolean;
  createdAt: string;
}

interface SupplierFormData {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
}

export default function SupplierManagementPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierFormData>();

  // Fetch suppliers
  const { data: suppliers, isLoading, error } = useQuery({
    queryKey: queryKeys.suppliers.list(),
    queryFn: async () => {
      const response = await apiClient.get('/suppliers');
      return unwrapArray<Supplier>(response.data);
    },
  });

  // Create supplier mutation
  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      return apiClient.post('/suppliers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Supplier created');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to create supplier'),
  });

  // Update supplier mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SupplierFormData }) => {
      return apiClient.patch(`/suppliers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all(), exact: false });
      setIsModalOpen(false);
      setEditingSupplier(null);
      reset();
      showSuccess('Supplier updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update supplier'),
  });

  // Toggle supplier active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClient.patch(`/suppliers/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all(), exact: false });
      showSuccess('Supplier status updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update status'),
  });

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all(), exact: false });
      setSupplierToDelete(null);
      showSuccess('Supplier deleted');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to delete supplier'),
  });

  const filteredSuppliers = useMemo(() => {
    const list = suppliers || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      reset({
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        paymentTerms: supplier.paymentTerms,
      });
    } else {
      setEditingSupplier(null);
      reset({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        paymentTerms: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    reset();
  };

  const onSubmit = (data: SupplierFormData) => {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleToggleActive = (supplier: Supplier) => {
    toggleActiveMutation.mutate({
      id: supplier._id,
      isActive: !supplier.isActive,
    });
  };

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load suppliers" /></AdminLayout>;

  const columns = [
    { key: 'name', header: 'Supplier Name' },
    { key: 'contactPerson', header: 'Contact Person' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    { key: 'paymentTerms', header: 'Payment Terms' },
    {
      key: 'isActive',
      header: 'Status',
      render: (supplier: Supplier) => (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
          supplier.isActive ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {supplier.isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (supplier: Supplier) => (
        <div className="flex items-center justify-end gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal(supplier)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleActive(supplier)}
            className={supplier.isActive ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}
          >
            {supplier.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSupplierToDelete(supplier)}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
            title="Delete Supplier"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Suppliers">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Suppliers</h1>
            <p className="text-sm text-slate-400 mt-1">Manage pharmaceutical vendors, contacts, and supply contracts</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
            Add Supplier
          </Button>
        </div>

        {/* Suppliers Table */}
        <Table
          data={suppliers || []}
          columns={columns}
          emptyMessage="No suppliers registered"
        />

        {/* Supplier Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Supplier Name"
              {...register('name', { required: 'Supplier name is required' })}
              error={errors.name?.message}
            />

            <Input
              label="Contact Person"
              {...register('contactPerson', { required: 'Contact person is required' })}
              error={errors.contactPerson?.message}
            />

            <Input
              label="Phone"
              type="tel"
              {...register('phone', { required: 'Phone is required' })}
              error={errors.phone?.message}
            />

            <Input
              label="Email"
              type="email"
              {...register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
              error={errors.email?.message}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('address', { required: 'Address is required' })}
                className="w-full px-3 py-2 border border-gray-700 rounded-md bg-primary-darker text-white focus:outline-none focus:ring-2 focus:ring-accent-green/50 focus:border-accent-green"
                rows={3}
              />
              {errors.address && (
                <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
              )}
            </div>

            <Input
              label="Payment Terms"
              placeholder="e.g., Net 30, Net 60"
              {...register('paymentTerms', { required: 'Payment terms are required' })}
              error={errors.paymentTerms?.message}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingSupplier
                  ? 'Update Supplier'
                  : 'Add Supplier'}
              </Button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <Error message="Failed to save supplier. Please try again." />
            )}
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!supplierToDelete}
          onClose={() => setSupplierToDelete(null)}
          title="Delete Supplier"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you sure you want to delete supplier <strong className="text-white">{supplierToDelete?.name}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <Button
                variant="secondary"
                onClick={() => setSupplierToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="!bg-rose-600 hover:!bg-rose-500 !text-white shadow-lg shadow-rose-600/20"
                isLoading={deleteMutation.isPending}
                onClick={() => supplierToDelete && deleteMutation.mutate(supplierToDelete._id)}
              >
                Delete Supplier
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}


