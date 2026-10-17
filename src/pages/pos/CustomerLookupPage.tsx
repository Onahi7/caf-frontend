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
import { useCartStore } from '../../stores/cart-store';
import { ArrowLeft, Search, UserPlus, Check, Phone, Mail, Award } from 'lucide-react';

interface Customer {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  loyaltyPoints?: number;
  creditBalance?: number;
}

export const CustomerLookupPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { showSuccess, showError } = useToast();
  const setCustomer = useCartStore((s) => s.setCustomer);
  const activeCustomer = useCartStore((s) => s.customer);
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
    onSuccess: (response: { data?: Customer; _id?: string; firstName?: string; lastName?: string; phone?: string; email?: string; loyaltyPoints?: number }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all(), exact: false });
      setShowAddModal(false);
      const created = response?.data ?? (response as Customer);
      if (created?._id) {
        setCustomer({
          id: created._id,
          name: `${created.firstName} ${created.lastName}`.trim(),
          phone: created.phone,
          email: created.email,
          loyaltyPoints: created.loyaltyPoints || 0,
        });
        showSuccess(`Customer ${created.firstName} ${created.lastName} created and attached to cart`);
        navigate(-1);
      } else {
        showSuccess('Customer created successfully');
      }
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
      'bg-emerald-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-amber-500',
      'bg-teal-500',
    ];
    const index = (name || 'A').charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleSelectCustomer = (customer: Customer) => {
    setCustomer({
      id: customer._id,
      name: `${customer.firstName} ${customer.lastName}`.trim(),
      phone: customer.phone,
      email: customer.email,
      loyaltyPoints: customer.loyaltyPoints || 0,
      creditBalance: customer.creditBalance || 0,
    });
    sessionStorage.setItem('selectedCustomer', JSON.stringify(customer));
    showSuccess(`Attached ${customer.firstName} ${customer.lastName} to active sale`);
    navigate(-1);
  };

  const handleSelectWalkIn = () => {
    setCustomer(null);
    sessionStorage.removeItem('selectedCustomer');
    showSuccess('Set to Walk-in Customer');
    navigate(-1);
  };

  return (
    <POSLayout title="Customer Lookup">
      <div className="min-h-full bg-slate-950 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-slate-900/60 backdrop-blur-md">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-300 hover:text-white flex items-center min-w-11 min-h-11 justify-center -ml-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white text-center">Customer Lookup</h1>
            <p className="text-[11px] text-slate-400 text-center">Attach customer for loyalty, credit, and receipts</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">New Customer</span>
          </button>
        </div>

        <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
          {/* Active selection banner */}
          <div className="flex items-center justify-between bg-slate-900/90 border border-white/[0.08] rounded-2xl p-4 shadow-sm">
            <div>
              <p className="text-xs text-slate-400 font-medium">Currently Attached to Cart:</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {activeCustomer ? activeCustomer.name : 'Walk-in Customer (Default)'}
              </p>
              {activeCustomer?.phone && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {activeCustomer.phone}
                </p>
              )}
            </div>
            {activeCustomer ? (
              <button
                onClick={handleSelectWalkIn}
                className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
              >
                Reset to Walk-in
              </button>
            ) : (
              <span className="px-2.5 py-1 bg-white/5 text-slate-400 rounded-lg text-xs font-medium">
                No customer attached
              </span>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone number, or email..."
              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              autoFocus
            />
          </div>

          {/* Walk-in selection button */}
          <button
            onClick={handleSelectWalkIn}
            className="w-full flex items-center justify-between p-3.5 bg-slate-900/50 hover:bg-slate-900 rounded-xl border border-white/[0.06] hover:border-white/15 transition-colors group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 font-bold text-sm">
                WI
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Walk-in Customer</p>
                <p className="text-slate-400 text-xs">Standard retail checkout without tracking customer balance</p>
              </div>
            </div>
            {!activeCustomer && (
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Check className="w-4 h-4" />
              </div>
            )}
          </button>

          {/* Customer List */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              Registered Customers
            </h2>

            {isLoading ? (
              <div className="text-center py-12 text-slate-400 text-sm">Loading customers...</div>
            ) : customers && customers.length > 0 ? (
              customers.map((customer) => {
                const isSelected = activeCustomer?.id === customer._id;
                return (
                  <button
                    key={customer._id}
                    onClick={() => handleSelectCustomer(customer)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-white/[0.06] hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 ${getAvatarColor(
                          customer.firstName
                        )} rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0`}
                      >
                        {getInitials(customer.firstName, customer.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm leading-snug truncate">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                          {customer.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {customer.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {(customer.loyaltyPoints ?? 0) > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                          <Award className="w-3 h-3" />
                          {customer.loyaltyPoints} pts
                        </span>
                      )}
                      {isSelected ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-400 font-medium hover:underline">
                          Select
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/[0.04]">
                <p className="text-slate-400 text-sm">
                  {searchQuery ? 'No customers matching your search' : 'No registered customers found'}
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Customer Now
                </button>
              </div>
            )}
          </div>
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
                Save & Attach to Sale
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </POSLayout>
  );
};
