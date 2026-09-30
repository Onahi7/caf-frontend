import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { Package, Clock, CheckCircle } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId?: { name: string };
  supplierName?: string;
  total: number;
  status: 'pending' | 'partial' | 'received' | 'cancelled';
  expectedDeliveryDate?: string;
  createdAt: string;
}

export function FinancePayablesPage() {
  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = user?.role === 'super_admin' ? undefined : branchId;
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'received'>('pending');
  const { format } = useCurrency();

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['finance', 'payables', effectiveBranchId, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get(
        buildApiUrl('/purchase-orders', {
          branchId: effectiveBranchId,
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: '500',
        }),
      );
      return (res.data?.data?.data ?? res.data?.data ?? []) as PurchaseOrder[];
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  const totalPayable = (orders || []).reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <FinanceLayout title="Payables">
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-300 text-xs uppercase mb-1">
            <Clock className="w-4 h-4" /> Pending POs
          </div>
          <p
            className="text-xl sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
            title={format(totalPayable)}
          >
            {format(totalPayable)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase mb-1">
            <Package className="w-4 h-4" /> PO Count
          </div>
          <p className="text-2xl font-bold text-white">{(orders || []).length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase mb-1">
            <CheckCircle className="w-4 h-4" /> Avg. Value
          </div>
          <p
            className="text-xl sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
            title={format((orders?.length ?? 0) > 0 ? totalPayable / orders!.length : 0)}
          >
            {format((orders?.length ?? 0) > 0 ? totalPayable / orders!.length : 0)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'pending', label: 'Pending' },
          { key: 'partial', label: 'Partial' },
          { key: 'received', label: 'Received' },
          { key: 'all', label: 'All' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key as typeof statusFilter)}
            className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
              statusFilter === opt.key
                ? 'border-accent-green bg-accent-green/15 text-accent-green'
                : 'border-white/10 bg-primary-dark/60 text-gray-300 hover:border-white/20 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading variant="centered" text="Loading payables..." />
      ) : error ? (
        <Error message="Failed to load payables" />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-primary-dark/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">PO #</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Supplier</th>
                  <th className="text-right text-gray-400 px-4 py-3 font-medium">Total</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Status</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {(orders || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  (orders || []).map((o) => (
                    <tr key={o._id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-white font-medium">{o.poNumber}</td>
                      <td className="px-4 py-3 text-gray-300">{o.supplierId?.name || o.supplierName || '-'}</td>
                      <td className="px-4 py-3 text-right text-white font-semibold">{format(o.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                          o.status === 'received' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          o.status === 'partial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          o.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FinanceLayout>
  );
}
