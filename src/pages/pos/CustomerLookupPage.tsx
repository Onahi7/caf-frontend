import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { POSLayout } from '../../components/pos/POSLayout';

interface Customer {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  loyaltyPoints: number;
}

export const CustomerLookupPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { showError } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: queryKeys.customers.list({ search: debouncedSearchQuery }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (debouncedSearchQuery) params.search = debouncedSearchQuery;
      const response = await apiClient.get('/customers', { params });
      return unwrapArray<Customer>(response.data);
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomer) => {
      const response = await apiClient.post('/customers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all(), exact: false });
      setShowAddModal(false);
      setNewCustomer({ firstName: '', lastName: '', phone: '', email: '' });
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to create customer');
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-purple-500',
      'bg-blue-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-cyan-500',
      'bg-teal-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleSelectCustomer = (customer: Customer) => {
    // Store selected customer and go back
    sessionStorage.setItem('selectedCustomer', JSON.stringify(customer));
    navigate(-1);
  };

  return (
    <POSLayout title="Customer Lookup">
      <div className="min-h-screen bg-primary-darker flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <button onClick={() => navigate(-1)} className="text-white flex items-center min-w-11 min-h-11 justify-center -ml-2 rounded-lg hover:bg-white/5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">Customer Lookup</h1>
          <div className="w-6" />
        </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or customer ID..."
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
          />
        </div>

        {/* Customer List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : customers && customers.length > 0 ? (
            customers.map((customer) => (
              <button
                key={customer._id}
                onClick={() => handleSelectCustomer(customer)}
                className="w-full flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className={`w-12 h-12 ${getAvatarColor(customer.firstName)} rounded-full flex items-center justify-center mr-4`}>
                  <span className="text-white font-bold">
                    {getInitials(customer.firstName, customer.lastName)}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="text-gray-400 text-sm truncate">
                    {customer.phone || customer.email || `ID: ${customer._id.slice(-9)}`}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              {searchQuery ? 'No customers found' : 'Search for customers'}
            </div>
          )}
        </div>
      </div>

      {/* Add New Customer Button */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-4 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Customer
        </button>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Customer"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5">First Name *</label>
              <input
                type="text"
                value={newCustomer.firstName}
                onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
                placeholder="e.g. John"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5">Last Name *</label>
              <input
                type="text"
                value={newCustomer.lastName}
                onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
                placeholder="e.g. Doe"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="e.g. +232 76 123456"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-1.5">Email Address</label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              placeholder="e.g. customer@example.com"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createCustomerMutation.mutate(newCustomer)}
              disabled={!newCustomer.firstName.trim() || !newCustomer.lastName.trim() || createCustomerMutation.isPending}
              isLoading={createCustomerMutation.isPending}
            >
              Add Customer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
    </POSLayout>
  );
};
