import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, ChevronRight, ClipboardList, PackageSearch, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader, AdminStatCard, AdminStatusBadge } from '../../components/admin';
import { EmptyState } from '../../components/ui/EmptyState';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import apiClient from '../../lib/api-client';
import { useCurrency } from '../../hooks/useCurrency';
import { queryKeys } from '../../lib/query-keys';
import HQDashboardPage from './HQDashboardPage';

interface DashboardStats {
  todaySales: number;
  todaySalesCount: number;
  monthlySales: number;
  monthlySalesCount: number;
  totalProducts: number;
  totalInventoryValue: number;
  totalCustomers: number;
  lowStockProducts: number;
  expiringSoon: number;
  lowStockItems: Array<{ _id: string; productName: string; quantity: number }>;
}

const quickActions = [
  {
    to: '/pos',
    label: 'Open POS',
    description: 'Start selling from the active branch.',
    icon: ShoppingCart,
    tone: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
  },
  {
    to: '/admin/products',
    label: 'Manage Products',
    description: 'Update prices, packs, barcodes, and stock rules.',
    icon: PackageSearch,
    tone: 'text-sky-300 bg-sky-500/15 border-sky-500/25',
  },
  {
    to: '/admin/reports',
    label: 'View Reports',
    description: 'Review sales, inventory, expiry, and transfers.',
    icon: ClipboardList,
    tone: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
  },
];

const LoadingStatGrid = () => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-5 shadow-lg">
        <div className="h-3 w-20 rounded-md bg-white/10 shimmer-effect" />
        <div className="mt-3.5 h-7 w-28 rounded-lg bg-white/10 shimmer-effect" />
        <div className="mt-2.5 h-3 w-24 rounded-md bg-white/5 shimmer-effect" />
      </div>
    ))}
  </div>
);

const QuickActionLink = ({ action }: { action: (typeof quickActions)[number] }) => {
  const Icon = action.icon;

  return (
    <Link
      to={action.to}
      className="group flex min-h-20 items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 transition-all duration-200 hover:border-emerald-500/30 hover:bg-slate-800/80 shadow-md shadow-black/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-xs ${action.tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-white tracking-tight">{action.label}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{action.description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-emerald-400" aria-hidden="true" />
    </Link>
  );
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { selectedBranch } = useBranchStore();
  const { user } = useAuthStore();
  const { format } = useCurrency();
  const branchId = getBranchId(selectedBranch);

  const { data: stats, isLoading, error, refetch } = useQuery<DashboardStats>({
    queryKey: queryKeys.dashboard.branch(branchId),
    queryFn: async () => {
      const response = await apiClient.get('/reports/dashboard-stats', {
        params: branchId ? { branchId } : {},
      });

      const raw = response.data;
      return {
        todaySales: raw?.todaysSales?.amount ?? raw?.todaySales ?? 0,
        todaySalesCount: raw?.todaysSales?.count ?? raw?.todaySalesCount ?? 0,
        monthlySales: raw?.monthlySales?.amount ?? 0,
        monthlySalesCount: raw?.monthlySales?.count ?? 0,
        totalProducts: raw?.totalProducts ?? 0,
        totalInventoryValue: raw?.totalInventoryValue ?? 0,
        totalCustomers: raw?.totalCustomers ?? 0,
        lowStockProducts: raw?.lowStockProducts ?? raw?.lowStockCount ?? 0,
        expiringSoon: raw?.expiringSoon ?? 0,
        lowStockItems: Array.isArray(raw?.lowStockItems) ? raw.lowStockItems : [],
      };
    },
    enabled: user?.role !== 'super_admin' && !!branchId,
  });

  if (user?.role === 'super_admin') {
    return <HQDashboardPage />;
  }

  const lowStockItems = stats?.lowStockItems ?? [];
  const lowStockProducts = stats?.lowStockProducts ?? 0;
  const expiringSoon = stats?.expiringSoon ?? 0;

  if (!branchId) {
    return (
      <AdminLayout title="Dashboard">
        <div className="space-y-5">
          <AdminPageHeader
            title="Dashboard"
            subtitle="Branch dashboards need an active branch so sales, stock, and alerts stay scoped."
          />
          <div className="rounded-xl border border-white/10 bg-primary-dark/60">
            <EmptyState
              icon={<Boxes className="h-12 w-12" aria-hidden="true" />}
              title="Select a branch to continue"
              message="Use the branch selector above, or manage branch access from administration."
              action={{
                label: 'Manage branches',
                onClick: () => navigate('/admin/branches'),
              }}
            />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-5">
        <AdminPageHeader
          title={`Today at ${selectedBranch?.name ?? 'this branch'}`}
          subtitle={`Welcome back, ${user?.firstName ?? 'there'}. Track sales, stock risk, and daily branch work from one place.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge tone={lowStockProducts > 0 ? 'warning' : 'success'}>
                {lowStockProducts > 0 ? `${lowStockProducts} low stock` : 'Stock stable'}
              </AdminStatusBadge>
              <AdminStatusBadge tone={expiringSoon > 0 ? 'warning' : 'success'}>
                {expiringSoon > 0 ? `${expiringSoon} expiring soon` : 'Expiry stable'}
              </AdminStatusBadge>
            </div>
          }
        />

        {error ? (
          <Error message="Failed to load dashboard data" onRetry={() => refetch()} />
        ) : isLoading ? (
          <LoadingStatGrid />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <AdminStatCard
                label="Today sales"
                value={format(stats?.todaySales ?? 0)}
                helper={`${stats?.todaySalesCount ?? 0} transactions`}
                tone="accent"
                icon={<ShoppingCart className="h-5 w-5" aria-hidden="true" />}
              />
              <AdminStatCard
                label="Month sales"
                value={format(stats?.monthlySales ?? 0)}
                helper={`${stats?.monthlySalesCount ?? 0} sales`}
                tone="info"
                icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
              />
              <AdminStatCard
                label="Inventory value"
                value={format(stats?.totalInventoryValue ?? 0)}
                helper={`${stats?.totalProducts ?? 0} SKUs`}
                tone={lowStockProducts > 0 ? 'warning' : 'neutral'}
                icon={<Boxes className="h-5 w-5" aria-hidden="true" />}
              />
              <AdminStatCard
                label="Customers"
                value={stats?.totalCustomers ?? 0}
                helper="Active customer base"
                tone="neutral"
                icon={<Users className="h-5 w-5" aria-hidden="true" />}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
              <section className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-5 shadow-lg backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Priority actions</h2>
                    <p className="mt-0.5 text-xs text-slate-400">Fast routes for branch work that happens every day.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  {quickActions.map((action) => (
                    <QuickActionLink key={action.to} action={action} />
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-5 shadow-lg backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Stock attention</h2>
                    <p className="mt-0.5 text-xs text-slate-400">Products most likely to block sales today.</p>
                  </div>
                  {lowStockProducts > 0 ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </div>
                  ) : null}
                </div>

                {lowStockItems.length > 0 ? (
                  <div className="space-y-2">
                    {lowStockItems.slice(0, 5).map((item) => (
                      <Link
                        key={item._id}
                        to="/admin/inventory"
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-slate-950/40 p-3 transition-colors hover:border-amber-400/30 hover:bg-slate-900/80"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">
                          {item.productName}
                        </span>
                        <span className="shrink-0 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300 tabular-nums font-mono">
                          {item.quantity} left
                        </span>
                      </Link>
                    ))}
                    <Link
                      to="/admin/inventory"
                      className="inline-flex min-h-9 items-center text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors pt-2"
                    >
                      Review inventory
                      <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-4 text-xs text-slate-400 text-center">
                    All tracked products are above their low-stock threshold.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};
