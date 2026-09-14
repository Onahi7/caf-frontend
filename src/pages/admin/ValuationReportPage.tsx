import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { SaveReportButton } from '../../components/finance/SaveReportButton';

const METHODS = ['FIFO', 'LIFO', 'AVERAGE'] as const;
type ValuationMethod = typeof METHODS[number];

interface ValuationProductEntry {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

interface ValuationReport {
  branchId: string;
  method: ValuationMethod;
  totalValue: number;
  products: ValuationProductEntry[];
}

export function ValuationReportPage() {
  const [method, setMethod] = useState<ValuationMethod>('AVERAGE');
  const [showAllBranches, setShowAllBranches] = useState(true);
  const { selectedBranch } = useBranchStore();
  const { user } = useAuthStore();
  const { format } = useCurrency();

  const isSuperAdmin = user?.role === 'super_admin';
  const branchId = getBranchId(selectedBranch);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.valuation.report(
      isSuperAdmin && showAllBranches ? undefined : branchId,
      `${method}:${showAllBranches}`,
    ),
    queryFn: async () => {
      const params: Record<string, string> = { method };
      if (!isSuperAdmin || !showAllBranches) {
        params.branchId = branchId!;
      }
      const response = await apiClient.get('/reports/valuation', { params });
      return unwrapResponse(response.data, {} as ValuationReport);
    },
    enabled: isSuperAdmin ? (showAllBranches || !!branchId) : !!branchId,
  });

  const exportCsv = () => {
    if (!data?.products) return;
    const headers = ['Product Name', 'SKU', 'Quantity', 'Unit Cost', 'Total Value'];
    const rows = data.products.map((p) => [
      `"${p.productName}"`,
      p.sku,
      p.quantity,
      p.unitCost.toFixed(2),
      p.totalValue.toFixed(2),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valuation-${method.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const missingBranch = !isSuperAdmin && !branchId;

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">Inventory Valuation Report</h1>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={showAllBranches}
                  onChange={(e) => setShowAllBranches(e.target.checked)}
                  className="rounded border-gray-600 text-accent-green focus:ring-accent-green/50"
                />
                Company-wide
              </label>
            )}
            <div className="flex border border-gray-700 rounded-md overflow-hidden">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    method === m
                      ? 'bg-accent-green text-primary-dark'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <SaveReportButton
              reportKey="valuation"
              route="/admin/reports/valuation"
              params={{ branchId, method, showAllBranches }}
              defaultName="Valuation Report"
            />
            <Button variant="secondary" onClick={exportCsv} disabled={!data?.products?.length}>
              Export CSV
            </Button>
          </div>
        </div>

        {missingBranch && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm mb-4">
            Select a branch to generate the valuation report.
          </div>
        )}

        {/* Total value card */}
        {data && (
          <div className="bg-primary-dark/50 border border-white/10 rounded-2xl p-6 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 uppercase font-semibold">Total Inventory Value</p>
              <p className="text-4xl font-bold text-accent-green mt-1">{format(data.totalValue)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Method: <span className="font-semibold">{data.method}</span>
                {data.products?.length != null && ` - ${data.products.length} products`}
              </p>
            </div>
            <div className="w-16 h-16 bg-accent-green/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        )}

        {isLoading && <Loading />}
        {error && <Error message="Failed to load valuation report" />}

        {data?.products && data.products.length === 0 && (
          <div className="text-gray-400 text-sm text-center py-12">
            No inventory data available.
          </div>
        )}

        {data?.products && data.products.length > 0 && (
          <div className="bg-primary-dark/50 rounded-2xl border border-white/10 overflow-hidden">
            <Table
              columns={[
                {
                  key: 'productName',
                  header: 'Product',
                  render: (row: ValuationProductEntry) => (
                    <div className="max-w-xs">
                      <p className="font-medium text-white whitespace-normal break-words">{row.productName}</p>
                      <p className="text-xs text-gray-400">SKU: {row.sku}</p>
                    </div>
                  ),
                },
                {
                  key: 'quantity',
                  header: 'Quantity',
                  render: (row: ValuationProductEntry) => (
                    <span className="text-gray-300">{row.quantity.toLocaleString()}</span>
                  ),
                },
                {
                  key: 'unitCost',
                  header: 'Unit Cost',
                  render: (row: ValuationProductEntry) => format(row.unitCost),
                },
                {
                  key: 'totalValue',
                  header: 'Total Value',
                  render: (row: ValuationProductEntry) => (
                    <span className="font-semibold text-white">{format(row.totalValue)}</span>
                  ),
                },
              ]}
              data={data.products}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
