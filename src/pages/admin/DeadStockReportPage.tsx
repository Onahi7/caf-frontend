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

interface Branch {
  _id: string;
  name: string;
}

interface DeadStockItem {
  productId: string;
  productName: string;
  sku: string;
  branchId: string;
  branchName: string;
  currentStock: number;
  totalValue: number;
  lastSaleDate: string | null;
  daysSinceLastSale: number;
}

interface DeadStockData {
  summary: { totalItems: number; totalValue: number; avgDaysWithoutSale: number };
  items: DeadStockItem[];
  currencyCode: string;
}

const THRESHOLD_OPTIONS = [
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days', value: 90 },
  { label: '120 Days', value: 120 },
  { label: '180 Days', value: 180 },
];

export function DeadStockReportPage() {
  const { format } = useCurrency();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const selectedBranchId = getBranchId(selectedBranch);
  const [filterBranchId, setFilterBranchId] = useState('');
  const effectiveBranchId = isSuperAdmin ? filterBranchId : selectedBranchId;
  const [daysWithoutSale, setDaysWithoutSale] = useState(90);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.reports.deadStock({ branchId: effectiveBranchId, daysWithoutSale }),
    queryFn: async () => {
      const response = await apiClient.get(
        buildApiUrl('/reports/dead-stock', {
          branchId: effectiveBranchId || undefined,
          daysWithoutSale,
        }),
      );
      return response.data as DeadStockData;
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

  const handleExport = async () => {
    try {
      const response = await apiClient.get(
        buildApiUrl('/reports/dead-stock/export', {
          branchId: effectiveBranchId || undefined,
          daysWithoutSale,
        }),
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dead-stock-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const columns = [
    {
      key: 'productName',
      header: 'Product',
      render: (item: DeadStockItem) => (
        <div>
          <p className="font-medium text-white">{item.productName}</p>
          <p className="text-xs text-gray-400">SKU: {item.sku}</p>
        </div>
      ),
    },
    { key: 'branchName', header: 'Branch' },
    { key: 'currentStock', header: 'Stock' },
    {
      key: 'totalValue',
      header: 'Value',
      render: (item: DeadStockItem) => <span className="text-orange-400 font-semibold">{format(item.totalValue)}</span>,
    },
    {
      key: 'lastSaleDate',
      header: 'Last Sale',
      render: (item: DeadStockItem) =>
        item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString() : <span className="text-gray-500">Never</span>,
    },
    {
      key: 'daysSinceLastSale',
      header: 'Days Idle',
      render: (item: DeadStockItem) => {
        const color = item.daysSinceLastSale > 180 ? 'text-red-400' : item.daysSinceLastSale > 90 ? 'text-orange-400' : 'text-yellow-400';
        return <span className={`${color} font-semibold`}>{item.daysSinceLastSale}d</span>;
      },
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">Dead Stock Report</h1>
          <div className="flex items-center gap-2">
            <SaveReportButton
              reportKey="dead-stock"
              route="/admin/reports/dead-stock"
              params={{ branchId: filterBranchId || undefined, daysWithoutSale }}
              defaultName="Dead Stock Report"
            />
            <Button variant="secondary" onClick={handleExport} disabled={!data?.items?.length}>
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
              <label className="block text-sm font-medium text-gray-300 mb-1">No Sales In</label>
              <div className="flex border border-gray-700 rounded-md overflow-hidden">
                {THRESHOLD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDaysWithoutSale(opt.value)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      daysWithoutSale === opt.value
                        ? 'bg-accent-green text-primary-dark'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="primary" onClick={() => refetch()}>Apply</Button>
          </div>
        </div>

        {isLoading && <Loading />}
        {error && <Error message="Failed to load dead stock report" onRetry={() => refetch()} />}

        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                <p className="text-sm text-red-200">Dead Stock Items</p>
                <p className="text-2xl font-bold text-red-400">{data.summary.totalItems}</p>
              </div>
              <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/20">
                <p className="text-sm text-orange-200">Tied-up Value</p>
                <p className="text-2xl font-bold text-orange-400">{format(data.summary.totalValue)}</p>
              </div>
              <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                <p className="text-sm text-yellow-200">Avg Days Without Sale</p>
                <p className="text-2xl font-bold text-yellow-400">{data.summary.avgDaysWithoutSale?.toFixed(0) || 0}d</p>
              </div>
            </div>

            {data.items.length > 0 ? (
              <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5">
                <Table data={data.items} columns={columns} />
              </div>
            ) : (
              <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-12 text-center">
                <p className="text-gray-400 text-lg">No dead stock items found.</p>
                <p className="text-gray-500 text-sm mt-1">All products have had sales within {daysWithoutSale} days.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
