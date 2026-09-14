import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { Button } from '../../components/ui/Button';
import { SaveReportButton } from '../../components/finance/SaveReportButton';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { Link } from 'react-router-dom';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  CreditCard, Wallet, ArrowRightLeft, Package, Users,
  Receipt, FileText, BarChart3, ShieldCheck,
} from 'lucide-react';
import type { UnifiedDashboard } from '../../types/finance';
import { useCurrency } from '../../hooks/useCurrency';

interface ReconciliationStats {
  pending: number;
  approved: number;
  rejected: number;
  totalDiscrepancy: number;
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  link?: string;
  sublabel?: string;
  delta?: { value: number; pct: number; comparisonLabel: string } | null;
}

function StatCard({ label, value, icon, color, link, sublabel, delta }: StatCardProps) {
  const inner = (
    <div className={`rounded-xl border p-4 ${color} ${link ? 'hover:scale-[1.02] transition-transform cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {delta ? (
        <div className="flex items-center gap-1 mt-1">
          {delta.value === 0 ? (
            <span className="text-[10px] text-gray-500">- no change</span>
          ) : (
            <>
              <span className={`text-[10px] font-semibold ${delta.value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {delta.value > 0 ? 'up' : 'down'} {Math.abs(delta.pct).toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-500">vs {delta.comparisonLabel}</span>
            </>
          )}
        </div>
      ) : sublabel ? (
        <p className="text-xs text-gray-500 mt-1">{sublabel}</p>
      ) : null}
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

type ComparisonMode = 'none' | 'previous' | 'yoy';

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getComparisonRange(
  start: string,
  end: string,
  mode: ComparisonMode,
): { start: string; end: string; label: string } | null {
  if (mode === 'none') return null;
  const startD = new Date(start);
  const endD = new Date(end);
  const days = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
  if (mode === 'previous') {
    return {
      start: shiftDate(start, -(days + 1)),
      end: shiftDate(start, -1),
      label: 'previous period',
    };
  }
  // yoy
  const lastYearStart = new Date(startD);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
  const lastYearEnd = new Date(endD);
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);
  return {
    start: lastYearStart.toISOString().slice(0, 10),
    end: lastYearEnd.toISOString().slice(0, 10),
    label: 'same period last year',
  };
}

function pctChange(current: number, prior: number): { value: number; pct: number } {
  if (prior === 0) {
    return { value: current, pct: current === 0 ? 0 : 100 };
  }
  const change = current - prior;
  return { value: change, pct: (change / Math.abs(prior)) * 100 };
}

export function FinanceHubPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('none');
  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = user?.role === 'super_admin' ? undefined : branchId;
  const { format } = useCurrency();

  const { data: dashboard, isLoading: cashLoading, error: cashError } = useQuery({
    queryKey: ['finance', 'unified-dashboard', effectiveBranchId, startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(
        buildApiUrl('/finance-manager/unified-dashboard', {
          branchId: effectiveBranchId,
          startDate,
          endDate,
        }),
      );
      return (res.data?.data ?? res.data) as UnifiedDashboard;
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  const comparisonRange = getComparisonRange(startDate, endDate, comparisonMode);
  const { data: comparisonDashboard } = useQuery({
    queryKey: ['finance', 'unified-dashboard', 'compare', effectiveBranchId, comparisonRange?.start, comparisonRange?.end],
    queryFn: async () => {
      if (!comparisonRange) return null;
      const res = await apiClient.get(
        buildApiUrl('/finance-manager/unified-dashboard', {
          branchId: effectiveBranchId,
          startDate: comparisonRange.start,
          endDate: comparisonRange.end,
        }),
      );
      return (res.data?.data ?? res.data) as UnifiedDashboard;
    },
    enabled: !!comparisonRange && (user?.role === 'super_admin' || !!effectiveBranchId),
    staleTime: 60_000,
  });

  const cash = dashboard?.cashPosition;
  const profitLoss = dashboard?.profitLoss;
  const receivables = dashboard?.creditOutstanding;
  const purchases = dashboard?.purchases;
  const revenue = dashboard?.revenue;
  const compCash = comparisonDashboard?.cashPosition;
  const compRevenue = comparisonDashboard?.revenue;
  const compProfit = comparisonDashboard?.profitLoss;

  const deltaFor = (current: number, prior: number | undefined) => {
    if (!comparisonRange || prior === undefined) return null;
    const { value, pct } = pctChange(current, prior);
    return { value, pct, comparisonLabel: comparisonRange.label };
  };

  const { data: reconStats } = useQuery({
    queryKey: queryKeys.financeManager.reconciliations.stats(effectiveBranchId),
    queryFn: async () => {
      const res = await apiClient.get(
        buildApiUrl('/finance-manager/reconciliations/stats/summary', { branchId: effectiveBranchId }),
      );
      return (res.data?.data ?? res.data) as ReconciliationStats;
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  const { data: salaryStats } = useQuery({
    queryKey: queryKeys.financeManager.salaries.stats(effectiveBranchId),
    queryFn: async () => {
      const res = await apiClient.get(
        buildApiUrl('/finance-manager/salaries/stats/summary', { branchId: effectiveBranchId }),
      );
      return (res.data?.data ?? res.data) as {
        totalEmployees: number;
        totalNet: number;
        pendingCount: number;
        paidCount: number;
      };
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  if (cashLoading) {
    return (
      <FinanceLayout title="Finance Hub">
        <Loading variant="centered" text="Loading finance hub..." />
      </FinanceLayout>
    );
  }

  if (cashError) {
    return (
      <FinanceLayout title="Finance Hub">
        <Error message="Failed to load finance data" />
      </FinanceLayout>
    );
  }

  return (
    <FinanceLayout title="Finance Hub">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-gray-400 text-sm">
            Real-time financial position for {selectedBranch?.name || 'all branches'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm"
          />
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 ml-2">
            {(['none', 'previous', 'yoy'] as ComparisonMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setComparisonMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  comparisonMode === mode
                    ? 'bg-accent-green text-primary-dark'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
                title={mode === 'none' ? 'No comparison' : mode === 'previous' ? 'Compare with previous period' : 'Compare with same period last year'}
              >
                {mode === 'none' ? 'No compare' : mode === 'previous' ? 'vs Prev' : 'vs YoY'}
              </button>
            ))}
          </div>
          <SaveReportButton
            reportKey="unified-dashboard"
            route="/finance"
            params={{ startDate, endDate, comparisonMode, branchId: effectiveBranchId ?? '' }}
            defaultName={`Finance ${startDate} -> ${endDate}`}
          />
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cash Position</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Income"
            value={format(cash?.totalIncome ?? 0)}
            icon={<TrendingUp className="w-4 h-4 text-green-400" />}
            color="bg-green-500/10 border-green-500/20"
            delta={deltaFor(cash?.totalIncome ?? 0, compCash?.totalIncome)}
          />
          <StatCard
            label="Expenses"
            value={format(cash?.totalExpense ?? 0)}
            icon={<TrendingDown className="w-4 h-4 text-red-400" />}
            color="bg-red-500/10 border-red-500/20"
            delta={deltaFor(cash?.totalExpense ?? 0, compCash?.totalExpense)}
          />
          <StatCard
            label="Salaries"
            value={format(cash?.totalSalary ?? 0)}
            icon={<Users className="w-4 h-4 text-purple-400" />}
            color="bg-purple-500/10 border-purple-500/20"
            delta={deltaFor(cash?.totalSalary ?? 0, compCash?.totalSalary)}
          />
          <StatCard
            label="Loans"
            value={format(cash?.totalLoan ?? 0)}
            icon={<DollarSign className="w-4 h-4 text-amber-400" />}
            color="bg-amber-500/10 border-amber-500/20"
            delta={deltaFor(cash?.totalLoan ?? 0, compCash?.totalLoan)}
          />
          <StatCard
            label="Transfers"
            value={format(cash?.totalTransfer ?? 0)}
            icon={<ArrowRightLeft className="w-4 h-4 text-blue-400" />}
            color="bg-blue-500/10 border-blue-500/20"
            delta={deltaFor(cash?.totalTransfer ?? 0, compCash?.totalTransfer)}
          />
          <StatCard
            label="Net Cash"
            value={format(cash?.netCash ?? 0)}
            icon={<Wallet className="w-4 h-4 text-cyan-400" />}
            color={
              (cash?.netCash ?? 0) >= 0
                ? 'bg-cyan-500/10 border-cyan-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }
            delta={deltaFor(cash?.netCash ?? 0, compCash?.netCash)}
          />
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Money Flow</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Receivables Outstanding"
            value={format(receivables?.totalBalanceDue ?? 0)}
            icon={<CreditCard className="w-5 h-5 text-amber-400" />}
            color="bg-amber-500/10 border-amber-500/20"
            link="/finance/receivables"
            sublabel={`${receivables?.overdueCount ?? 0} overdue`}
          />
          <StatCard
            label="Pending POs"
            value={format(purchases?.pendingValue ?? 0)}
            icon={<Package className="w-5 h-5 text-orange-400" />}
            color="bg-orange-500/10 border-orange-500/20"
            sublabel={`${format(purchases?.totalPurchaseValue ?? 0)} total PO value`}
          />
          <StatCard
            label="Pending Salaries"
            value={format(salaryStats?.totalNet ?? 0)}
            icon={<Users className="w-5 h-5 text-purple-400" />}
            color="bg-purple-500/10 border-purple-500/20"
            link="/finance/salaries"
            sublabel={`${salaryStats?.pendingCount ?? 0} pending`}
          />
          <StatCard
            label="Reconciliation Variance"
            value={format(Math.abs(reconStats?.totalDiscrepancy ?? 0))}
            icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
            color={
              Math.abs(reconStats?.totalDiscrepancy ?? 0) < 1
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
            }
            link="/finance/reconciliations"
            sublabel={`${reconStats?.pending ?? 0} pending review`}
          />
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Profit &amp; Loss</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Gross Revenue"
            value={format(profitLoss?.grossRevenue ?? 0)}
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            color="bg-emerald-500/10 border-emerald-500/20"
            delta={deltaFor(profitLoss?.grossRevenue ?? 0, compProfit?.grossRevenue)}
            sublabel={comparisonMode === 'none' ? `${revenue?.salesCount ?? 0} transactions` : undefined}
          />
          <StatCard
            label="Cost of Goods"
            value={format(profitLoss?.costOfGoods ?? 0)}
            icon={<Package className="w-4 h-4 text-orange-400" />}
            color="bg-orange-500/10 border-orange-500/20"
            delta={deltaFor(profitLoss?.costOfGoods ?? 0, compProfit?.costOfGoods)}
          />
          <StatCard
            label="Gross Profit"
            value={format(profitLoss?.grossProfit ?? 0)}
            icon={<BarChart3 className="w-4 h-4 text-cyan-400" />}
            color="bg-cyan-500/10 border-cyan-500/20"
            delta={deltaFor(profitLoss?.grossProfit ?? 0, compProfit?.grossProfit)}
          />
          <StatCard
            label="Net Profit"
            value={format(profitLoss?.netProfit ?? 0)}
            icon={<DollarSign className="w-4 h-4 text-white" />}
            color={
              (profitLoss?.netProfit ?? 0) >= 0
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }
            delta={deltaFor(profitLoss?.netProfit ?? 0, compProfit?.netProfit)}
            sublabel={`${(profitLoss?.margin ?? 0).toFixed(1)}% margin`}
          />
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/finance/cash-book">
            <Button variant="secondary" className="w-full justify-start">
              <Receipt className="w-4 h-4 mr-2" />
              Record Cash Entry
            </Button>
          </Link>
          <Link to="/finance/advances">
            <Button variant="secondary" className="w-full justify-start">
              <DollarSign className="w-4 h-4 mr-2" />
              Issue Staff Advance
            </Button>
          </Link>
          <Link to="/finance/loans">
            <Button variant="secondary" className="w-full justify-start">
              <FileText className="w-4 h-4 mr-2" />
              Manage Loans
            </Button>
          </Link>
          <Link to="/finance/reports">
            <Button variant="secondary" className="w-full justify-start">
              <BarChart3 className="w-4 h-4 mr-2" />
              View Reports
            </Button>
          </Link>
          <Link to="/finance/cross-check">
            <Button variant="secondary" className="w-full justify-start">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Cross-Check Reconciliation
            </Button>
          </Link>
        </div>
      </div>
    </FinanceLayout>
  );
}
