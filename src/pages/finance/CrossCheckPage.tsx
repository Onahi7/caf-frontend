import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { useCurrency } from '../../hooks/useCurrency';
import { ShieldCheck, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface CrossCheckResult {
  date: string;
  caf: { revenue: number; expenses: number; netIncome: number; };
  emr: { revenue: number; expenses: number; netIncome: number; };
  lab: { revenue: number; expenses: number; netIncome: number; };
  variance: { cafVsEmr: number; cafVsLab: number; totalVariance: number; };
}

export function CrossCheckPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = user?.role === 'super_admin' ? undefined : branchId;
  const { format } = useCurrency();

  const { data, isLoading, error } = useQuery({
    queryKey: ['cross-check', effectiveBranchId, date],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/cross-check', {
        branchId: effectiveBranchId,
        date,
      }));
      return (res.data?.data ?? res.data) as CrossCheckResult;
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  if (isLoading) return <FinanceLayout title="Cross-Check Reconciliation"><Loading variant="centered" text="Loading..." /></FinanceLayout>;
  if (error || !data) return <FinanceLayout title="Cross-Check Reconciliation"><Error message="Failed to load" /></FinanceLayout>;

  const sources = [
    { key: 'caf', label: 'CAF', data: data.caf, color: 'bg-blue-500/10 border-blue-500/20' },
    { key: 'emr', label: 'EMR', data: data.emr, color: 'bg-green-500/10 border-green-500/20' },
    { key: 'lab', label: 'LAB', data: data.lab, color: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <FinanceLayout title="Cross-Check Reconciliation">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <span className="text-gray-300 text-sm">Compare revenue across CAF, EMR, and LAB systems</span>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {sources.map((s) => (
          <div key={s.key} className={`rounded-xl border p-5 ${s.color}`}>
            <h3 className="text-lg font-semibold text-white mb-4">{s.label}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Revenue</span>
                <span className="text-sm font-semibold text-green-400">{format(s.data.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Expenses</span>
                <span className="text-sm font-semibold text-red-400">{format(s.data.expenses)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-sm text-gray-400">Net Income</span>
                <span className={`text-sm font-bold ${s.data.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>{format(s.data.netIncome)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" /> Variance Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <span className="text-xs text-gray-400">CAF vs EMR</span>
            <p className={`text-xl font-bold mt-1 ${data.variance.cafVsEmr === 0 ? 'text-green-400' : 'text-red-400'}`}>
              {format(data.variance.cafVsEmr)}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <span className="text-xs text-gray-400">CAF vs LAB</span>
            <p className={`text-xl font-bold mt-1 ${data.variance.cafVsLab === 0 ? 'text-green-400' : 'text-red-400'}`}>
              {format(data.variance.cafVsLab)}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <span className="text-xs text-gray-400">Total Variance</span>
            <p className={`text-xl font-bold mt-1 ${data.variance.totalVariance === 0 ? 'text-green-400' : 'text-red-400'}`}>
              {format(data.variance.totalVariance)}
            </p>
          </div>
        </div>
      </div>
    </FinanceLayout>
  );
}
