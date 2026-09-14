import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { usePagination } from '../../hooks/usePagination';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useSearchWithDebounce } from '../../hooks/useSearchWithDebounce';

interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  loyaltyPoints: number;
  totalPurchases: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomerFormData {
  name: string;
  email?: string;
  phone: string;
  address?: string;
}

export const CustomerManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const {
    value: searchQuery,
    setValue: setSearchQuery,
    debouncedValue: debouncedSearchQuery,
  } = useSearchWithDebounce('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const { showSuccess, showError } = useToast();
  const pagination = usePagination({ initialLimit: 20 });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormData>();

  // Fetch customers
  const { data: customersData, isLoading, error } = useQuery({
    queryKey: queryKeys.customers.list({ search: debouncedSearchQuery, page: pagination.state.page, limit: pagination.state.limit }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/customers', {
        search: debouncedSearchQuery,
        page: pagination.state.page,
        limit: pagination.state.limit,
      }));
      return response.data;
    },
  });

  const customers = customersData?.data as Customer[] | undefined;
  const totalCount = customersData?.count ?? 0;

  // Create customer mutation
  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      return apiClient.post('/customers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Customer created');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to create customer'),
  });

  // Update customer mutation
  const updateMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!editingCustomer) return;
      return apiClient.patch(`/customers/${editingCustomer._id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all(), exact: false });
      setIsModalOpen(false);
      setEditingCustomer(null);
      reset();
      showSuccess('Customer updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update customer'),
  });

  // Toggle customer status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return apiClient.patch(`/customers/${customerId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all(), exact: false });
      showSuccess('Customer status updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update status'),
  });

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      reset({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone,
        address: customer.address || '',
      });
    } else {
      setEditingCustomer(null);
      reset({
        name: '',
        email: '',
        phone: '',
        address: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    reset();
  };

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load customers" /></AdminLayout>;

  const columns = [
    { key: 'name', header: 'Customer Name' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    {
      key: 'loyaltyPoints',
      header: 'Loyalty Points',
      render: (customer: Customer) => (
        <span className="font-bold text-blue-400">
          {customer.loyaltyPoints}
        </span>
      ),
    },
    {
      key: 'totalPurchases',
      header: 'Total Purchases',
      render: (customer: Customer) => (
        <span className="font-medium text-white">
          {format(customer.totalPurchases)}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (customer: Customer) => (
        customer.isActive ? (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
            Active
          </span>
        ) : (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
            Inactive
          </span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (customer: Customer) => (
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal(customer)}
            className="py-1!"
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedCustomer(customer)}
            className="py-1!"
          >
            View
          </Button>
          <Button
            variant={customer.isActive ? 'danger' : 'primary'}
            size="sm"
            onClick={() => toggleStatusMutation.mutate(customer._id)}
            className="py-1!"
          >
            {customer.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Customers</h2>
            <p className="text-gray-400 mt-1">Manage customer database and loyalty program</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-accent-green/20">
            Add Customer
          </Button>
        </div>

        {/* Search Bar */}
        <div className="bg-primary-dark/50 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Customers Table */}
        <Table
          data={customers || []}
          columns={columns}
          emptyMessage="No customers found"
          pagination={totalCount > 0 ? {
            page: pagination.state.page,
            limit: pagination.state.limit,
            total: totalCount,
            pages: Math.ceil(totalCount / pagination.state.limit),
            hasNext: pagination.state.page < Math.ceil(totalCount / pagination.state.limit),
            hasPrev: pagination.state.page > 1,
          } : undefined}
          onPageChange={pagination.setPage}
          onLimitChange={pagination.setLimit}
        />

        {/* Customer Form Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="Customer Name"
              {...register('name', { required: 'Customer name is required' })}
              error={errors.name?.message}
            />

            <Input
              label="Phone Number"
              {...register('phone', {
                required: 'Phone number is required',
                pattern: {
                  value: /^[0-9+\-() ]+$/,
                  message: 'Invalid phone number',
                },
              })}
              error={errors.phone?.message}
            />

            <Input
              label="Email"
              type="email"
              {...register('email', {
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              error={errors.email?.message}
            />

            <Input
              label="Address"
              {...register('address')}
              error={errors.address?.message}
            />

            <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
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
                  : editingCustomer
                  ? 'Update Customer'
                  : 'Add Customer'}
              </Button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <Error message="Failed to save customer. Please try again." />
            )}
          </form>
        </Modal>

        {/* Customer Details Modal */}
        {selectedCustomer && (
          <Modal
            isOpen={!!selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            title="Customer Details"
          >
            <div className="space-y-6">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <h3 className="text-xl font-bold text-white">{selectedCustomer.name}</h3>
                <p className="text-sm text-gray-400 mt-1">ID: <span className="font-mono text-xs">{selectedCustomer._id}</span></p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-400">Phone</p>
                  <p className="text-base text-white">{selectedCustomer.phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-400">Email</p>
                  <p className="text-base text-white">{selectedCustomer.email || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Address</p>
                <p className="text-base text-white">{selectedCustomer.address || 'N/A'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-primary-darker/50 p-4 rounded-xl border border-white/5">
                <div>
                  <p className="text-sm font-medium text-gray-400">Loyalty Points</p>
                  <p className="text-2xl font-bold text-blue-400">{selectedCustomer.loyaltyPoints}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Total Purchases</p>
                  <p className="text-2xl font-bold text-accent-green">{format(selectedCustomer.totalPurchases)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-400">Status</p>
                  <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                    selectedCustomer.isActive
                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    {selectedCustomer.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    handleOpenModal(selectedCustomer);
                    setSelectedCustomer(null);
                  }}
                >
                  Edit Customer
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};
