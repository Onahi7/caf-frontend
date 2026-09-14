import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { Select } from '../../components/ui/Select';
import { useCurrency } from '../../hooks/useCurrency';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { SaveReportButton } from '../../components/finance/SaveReportButton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Branch {
  _id: string;
  name: string;
}

interface StockMovement {
  _id: string;
  productId: string;
  productName?: string;
  batchId?: string;
  branchId: string;
  movementType: string;
  quantity: number;
  previousQuantity?: number;
  newQuantity?: number;
  reason?: string;
  referenceId?: string;
  createdAt: string;
}

const MOVEMENT_TYPES = [
  { label: 'All Types', value: '' },
  { label: 'Purchase', value: 'PURCHASE' },
  { label: 'Sale', value: 'SALE' },
  { label: 'Return', value: 'RETURN' },
  { label: 'Adjustment', value: 'ADJUSTMENT' },
  { label: 'Transfer In', value: 'TRANSFER_IN' },
  { label: 'Transfer Out', value: 'TRANSFER_OUT' },
  { label: 'Disposal', value: 'DISPOSAL' },
];

const MOVEMENT_COLORS: Record<string, string> = {
  PURCHASE: '#22c55e',
  SALE: '#3b82f6',
  RETURN: '#eab308',
  ADJUSTMENT: '#f97316',
  TRANSFER_IN: '#14b8a6',
  TRANSFER_OUT: '#ec4899',
  DISPOSAL: '#ef4444',
};

export function StockMovementReportPage() {
  const { format } = useCurrency();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const selectedBranchId = getBranchId(selectedBranch);
  const [filterBranchId, setFilterBranchId] = useState('');
  const effectiveBranchId = isSuperAdmin ? filterBranchId : selectedBranchId;
  const [movementType, setMovementType] = useState('');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.adjustments.list({ branchId: effectiveBranchId, movementType }),
    queryFn: async () => {
      const response = await apiClient.get(
        buildApiUrl('/inventory/stock-movements', {
          branchId: effectiveBranchId || undefined,
          movementType: movementType || undefined,
          startDate: from,
          endDate: to,
          limit: 500,
        }),
      );
      return (Array.isArray(response.data) ? response.data : response.data?.data || []) as StockMovement[];
    },
    enabled: isSuperAdmin || !!selectedBranchId,
  });

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return (Array.isArray(response.data) ? response.data : response.data?.data || []) as Branch[];
    },
    enabled: isSuperAdmin,
  });

  const handleExport = () => {
    if (!data?.length) return;
    const headers = ['Date', 'Type', 'Product', 'Quantity', 'Reason'];
    const rows = data.map((m) => [
      new Date(m.createdAt).toLocaleString(),
      m.movementType,
      m.productName || m.productId,
      m.quantity,
      m.reason || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const chartData = data
    ? Object.entries(
        data.reduce((acc: Record<string, number>, m) => {
          acc[m.movementType] = (acc[m.movementType] || 0) + Math.abs(m.quantity);
          return acc;
        }, {}),
      ).map(([type, qty]) => ({ name: type.replace(/_/g, ' '), quantity: qty, fill: MOVEMENT_COLORS[type] || '#6b7280' }))
    : [];

  const columns = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (item: StockMovement) => new Date(item.createdAt).toLocaleString(),
    },
    {
      key: 'movementType',
      header: 'Type',
      render: (item: StockMovement) => {
        const color = MOVEMENT_COLORS[item.movementType] || '#6b7280';
        return (
          <span
            className="px-2 py-1 text-xs font-semibold rounded-full"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {item.movementType.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      key: 'productName',
      header: 'Product',
      render: (item: StockMovement) => item.productName || item.productId,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (item: StockMovement) => {
        const isInbound = ['PURCHASE', 'RETURN', 'TRANSFER_IN'].includes(item.movementType);
        return (
          <span className={isInbound ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
            {isInbound ? '+' : '-'}{Math.abs(item.quantity)}
          </span>
        );
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (item: StockMovement) => <span className="text-gray-400 text-sm">{item.reason || '-'}</span>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">Stock Movement History</h1>
          <div className="flex items-center gap-2">
            <SaveReportButton
              reportKey="stock-movements"
              route="/admin/reports/stock-movements"
              params={{ branchId: filterBranchId || undefined, movementType: movementType || undefined, from, to }}
              defaultName="Stock Movement Report"
            />
            <Button variant="secondary" onClick={handleExport} disabled={!data?.length}>
              Export CSV
            </Button>
          </div>
        </div>

        <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {isSuperAdmin && (
              <div className="flex-1">
                <Select label="Branch" value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value)}>
                  <option value="">All Branches</option>
                  {branches?.map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Movement Type</label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className="bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <Button variant="primary" onClick={() => refetch()}>Apply</Button>
          </div>
        </div>

        {isLoading && <Loading />}
        {error && <Error message="Failed to load stock movements" onRetry={() => refetch()} />}

        {data && data.length > 0 && (
          <div className="space-y-6">
            <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-4">
              <p className="text-sm text-gray-400 mb-2">{data.length} movements found</p>
            </div>

            {chartData.length > 0 && (
              <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Movement Summary</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                    <Bar dataKey="quantity" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5">
              <Table data={data} columns={columns} />
            </div>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-12 text-center">
            <p className="text-gray-400 text-lg">No stock movements found.</p>
            <p className="text-gray-500 text-sm mt-1">Try adjusting the filters or date range.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
