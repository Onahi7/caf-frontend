import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Building2, Plus } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader } from '../../components/admin';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';

interface Branch {
  id: string;
  _id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  currencyCode: 'SLE' | 'USD';
  isHeadquarters: boolean;
  config: {
    reorderThreshold: number;
    expiryAlertDays: number[];
    allowNegativeStock: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BranchFormData {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  currencyCode: 'SLE' | 'USD';
  isHeadquarters: boolean;
  reorderThreshold: number;
  expiryAlertDays: string;
  allowNegativeStock: boolean;
}

export const BranchManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BranchFormData>();

  // Fetch branches
  const { data: branches, isLoading, error } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get<Branch[]>('/branches');
      return response.data;
    },
  });

  // Create branch mutation
  const createMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      const expiryAlertDays = data.expiryAlertDays
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value));
      const payload = {
        ...data,
        currencyCode: data.currencyCode,
        config: {
          reorderThreshold: data.reorderThreshold,
          expiryAlertDays,
          allowNegativeStock: data.allowNegativeStock,
        },
      };
      const response = await apiClient.post('/branches', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Branch created');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to create branch'),
  });

  // Update branch mutation
  const updateMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      if (!editingBranch) return;
      const expiryAlertDays = data.expiryAlertDays
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value));
      const payload = {
        ...data,
        currencyCode: data.currencyCode,
        config: {
          reorderThreshold: data.reorderThreshold,
          expiryAlertDays,
          allowNegativeStock: data.allowNegativeStock,
        },
      };
      const response = await apiClient.patch(`/branches/${editingBranch._id || editingBranch.id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.all(), exact: false });
      setIsModalOpen(false);
      setEditingBranch(null);
      reset();
      showSuccess('Branch updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update branch'),
  });

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      reset({
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        currencyCode: branch.currencyCode || 'SLE',
        isHeadquarters: branch.isHeadquarters,
        reorderThreshold: branch.config.reorderThreshold,
        expiryAlertDays: branch.config.expiryAlertDays.join(', '),
        allowNegativeStock: branch.config.allowNegativeStock,
      });
    } else {
      setEditingBranch(null);
      reset({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        currencyCode: 'SLE',
        isHeadquarters: false,
        reorderThreshold: 10,
        expiryAlertDays: '30, 60, 90',
        allowNegativeStock: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
    reset();
  };

  const onSubmit = (data: BranchFormData) => {
    if (editingBranch) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <Loading />;
  if (error) return <Error message="Failed to load branches" />;

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (branch: Branch) => (
        <div>
          <div className="font-medium">{branch.name}</div>
          <div className="text-sm text-gray-400">{branch.code}</div>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Address',
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (branch: Branch) => (
        <div>
          <div className="text-sm">{branch.phone}</div>
          <div className="text-sm text-gray-400">{branch.email}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (branch: Branch) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            branch.isHeadquarters
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {branch.isHeadquarters ? 'HQ' : 'Branch'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (branch: Branch) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
            branch.isActive
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${branch.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span>{branch.isActive ? 'Active' : 'Inactive'}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (branch: Branch) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleOpenModal(branch)}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout title="Branch Management">
      <div className="space-y-5">
        <AdminPageHeader
          title="Branches"
          subtitle="Manage pharmacy branch outlets, headquarters, and operational parameters"
          actions={
            <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add Branch</span>
            </Button>
          }
        />

        {/* Table */}
        <Table
          data={branches || []}
          columns={columns}
          emptyMessage="No branches found"
        />

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingBranch ? 'Edit Branch' : 'Add Branch'}
          size="lg"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Branch Name"
                {...register('name', { required: 'Branch name is required' })}
                error={errors.name?.message}
                placeholder="Enter branch name"
              />
              <Input
                label="Branch Code"
                {...register('code', { required: 'Branch code is required' })}
                error={errors.code?.message}
                placeholder="Enter branch code (e.g., BR001)"
              />
            </div>

            <Input
              label="Address"
              {...register('address', { required: 'Address is required' })}
              error={errors.address?.message}
              placeholder="Enter branch address"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone"
                type="tel"
                {...register('phone', { required: 'Phone is required' })}
                error={errors.phone?.message}
                placeholder="+232-XX-XXX-XXX"
              />
              <Input
                label="Email"
                type="email"
                {...register('email', { required: 'Email is required' })}
                error={errors.email?.message}
                placeholder="branch.name@pharmacy.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Currency"
                {...register('currencyCode', { required: 'Currency is required' })}
                error={errors.currencyCode?.message}
                options={[
                  { value: 'SLE', label: 'SLE - Sierra Leone Leone' },
                  { value: 'USD', label: 'USD - US Dollar' },
                ]}
              />
            </div>

            {/* Configuration */}
            <div className="border-t border-white/[0.08] pt-4 mt-4">
              <h3 className="text-base font-semibold text-white mb-3">Configuration</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Reorder Threshold"
                  type="number"
                  {...register('reorderThreshold', { 
                    required: 'Reorder threshold is required',
                    min: { value: 0, message: 'Must be 0 or greater' },
                    valueAsNumber: true,
                  })}
                  error={errors.reorderThreshold?.message}
                  placeholder="Enter minimum stock level"
                />
                <Input
                  label="Expiry Alert Days (comma-separated)"
                  {...register('expiryAlertDays', { 
                    required: 'Expiry alert days are required' 
                  })}
                  error={errors.expiryAlertDays?.message}
                  placeholder="Enter days (e.g., 30, 60, 90)"
                  helperText="Days before expiry to trigger alerts"
                />
              </div>

              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('isHeadquarters')}
                    className="w-4 h-4 rounded border-gray-600 bg-primary-dark text-accent-green focus:ring-accent-green"
                  />
                  <span>Headquarters</span>
                </label>
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('allowNegativeStock')}
                    className="w-4 h-4 rounded border-gray-600 bg-primary-dark text-accent-green focus:ring-accent-green"
                  />
                  <span>Allow Negative Stock</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {editingBranch ? 'Update' : 'Create'} Branch
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};


