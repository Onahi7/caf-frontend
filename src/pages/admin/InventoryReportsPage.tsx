import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
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

interface InventoryReportItem {
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  totalQuantity: number;
  totalValue: number;
  isLowStock: boolean;
  reorderLevel?: number;
}

export const InventoryReportsPage = () => {
  const { format } = useCurrency();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const selectedBranchId = getBranchId(selectedBranch);
  const [filterBranchId, setFilterBranchId] = useState('');
  const effectiveBranchId = isSuperAdmin ? filterBranchId : selectedBranchId;
  const [includeExpired, setIncludeExpired] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [valuationMethod, setValuationMethod] = useState<'fifo' | 'moving_average'>('fifo');

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return unwrapArray<Branch>(response.data);
    },
    enabled: isSuperAdmin,
  });

  // Auto-fetch on mount and when filters change
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.inventory({ branchId: effectiveBranchId, includeExpired, lowStockOnly, valuationMethod }),
    queryFn: async () => {
      const response = await apiClient.get(
        buildApiUrl('/reports/inventory', {
          branchId: effectiveBranchId || undefined,
          includeExpired,
          lowStockOnly,
          valuationMethod,
        }),
      );
      return response.data?.items || [] as InventoryReportItem[];
    },
    enabled: isSuperAdmin || !!selectedBranchId,
  });

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const response = await apiClient.get(buildApiUrl('/reports/inventory', {
        branchId: effectiveBranchId || undefined,
        includeExpired,
        lowStockOnly,
        valuationMethod,
        export: format,
      }), {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory-report-${new Date().toISOString()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const columns = [
    { key: 'productName', header: 'Product' },
    { key: 'productId', header: 'Product ID' },
    { key: 'branchName', header: 'Branch' },
    { 
      key: 'totalQuantity', 
      header: 'Total Stock',
      render: (item: InventoryReportItem) => (
        <span className={item.isLowStock ? 'text-red-600 font-semibold' : ''}>
          {item.totalQuantity}
          {item.isLowStock && ' (!)'}
        </span>
      )
    },
    { 
      key: 'reorderLevel', 
      header: 'Reorder Level'
    },
    { 
      key: 'totalValue', 
      header: 'Total Value',
      render: (item: InventoryReportItem) => format(item.totalValue)
    },
  ];

  // Calculate totals
  const totals = data?.reduce(
    (acc: { totalQuantity: number; totalValue: number; lowStockItems: number }, item: InventoryReportItem) => ({
      totalQuantity: acc.totalQuantity + item.totalQuantity,
      totalValue: acc.totalValue + item.totalValue,
      lowStockItems: acc.lowStockItems + (item.isLowStock ? 1 : 0),
    }),
    { totalQuantity: 0, totalValue: 0, lowStockItems: 0 }
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Inventory Reports</h1>
          {data && data.length > 0 && (
            <div className="flex items-center space-x-2">
              <SaveReportButton
                reportKey="inventory"
                route="/admin/reports/inventory"
                params={{ branchId: effectiveBranchId, includeExpired, lowStockOnly, valuationMethod }}
                defaultName="Inventory Report"
              />
              <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')}>
                Export PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleExport('excel')}>
                Export Excel
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Report Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isSuperAdmin && (
              <Select
                label="Branch"
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches?.map(branch => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            )}

            <Select
              label="Valuation Method"
              value={valuationMethod}
              onChange={(e) => setValuationMethod(e.target.value as 'fifo' | 'moving_average')}
            >
              <option value="fifo">FIFO</option>
              <option value="moving_average">Moving Average</option>
            </Select>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="includeExpired"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="h-4 w-4 text-accent-green focus:ring-accent-green/50 border-gray-600 rounded"
              />
              <label htmlFor="includeExpired" className="ml-2 block text-sm text-white">
                Include Expired
              </label>
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="lowStockOnly"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="h-4 w-4 text-accent-green focus:ring-accent-green border-gray-600 rounded bg-primary-darker"
              />
              <label htmlFor="lowStockOnly" className="ml-2 block text-sm text-white">
                Low Stock Only
              </label>
            </div>
          </div>
        </div>

        {/* Report Results */}
        {isLoading && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
            <Loading />
          </div>
        )}

        {error && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
            <Error message="Failed to load report. Please try again." />
          </div>
        )}

        {data && data.length > 0 && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Report Results</h2>
            </div>

            {/* Summary Cards */}
            {totals && (
              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/5">
                <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                  <p className="text-sm text-blue-200">Total Items</p>
                  <p className="text-2xl font-bold text-blue-400">{data.length}</p>
                </div>
                <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                  <p className="text-sm text-green-200">Total Value</p>
                  <p className="text-2xl font-bold text-green-400">{format(totals.totalValue)}</p>
                </div>
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <p className="text-sm text-red-200">Low Stock Items</p>
                  <p className="text-2xl font-bold text-red-400">{totals.lowStockItems}</p>
                </div>
              </div>
            )}

            <Table
              data={data}
              columns={columns}
            />
          </div>
        )}

        {data && data.length === 0 && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6 text-center">
            <p className="text-gray-400">No inventory data found for the selected filters.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


