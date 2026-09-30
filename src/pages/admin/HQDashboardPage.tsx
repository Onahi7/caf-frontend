import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useCurrency } from '../../hooks/useCurrency';
import { queryKeys } from '../../lib/query-keys';

interface BranchInventory {
  branchId: string;
  branchName: string;
  currencyCode: string;
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  totalValueFormatted?: string;
  lowStockItems: number;
}

interface BranchSales {
  branchId: string;
  branchName: string;
  currencyCode: string;
  totalSales: number;
  totalRevenue: number;
  totalRevenueFormatted?: string;
  averageOrderValue: number;
  averageOrderValueFormatted?: string;
}

interface CurrencyTotal {
  currencyCode: string;
  totalValue?: number;
  totalQuantity?: number;
  totalRevenue?: number;
  totalSales?: number;
  totalValueFormatted?: string;
  totalRevenueFormatted?: string;
}

interface PendingTransfer {
  _id: string;
  sourceBranchName: string;
  destinationBranchName: string;
  productName: string;
  quantity: number;
  requestedByName: string;
  createdAt: string;
}

interface LowStockAlert {
  id: string;
  branchName: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
}

interface ExpiryAlert {
  batchId: string;
  branchName: string;
  productName: string;
  lotNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantityAvailable: number;
}

interface HQDashboardData {
  inventory: BranchInventory[];
  sales: BranchSales[];
  inventoryTotalsByCurrency?: CurrencyTotal[];
  salesTotalsByCurrency?: CurrencyTotal[];
  pendingTransfers: PendingTransfer[];
  lowStockAlerts: LowStockAlert[];
  expiryAlerts: ExpiryAlert[];
}

type TabKey = 'overview' | 'inventory' | 'sales' | 'alerts';

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: typeof Building2;
}> = [
  { key: 'overview', label: 'Overview', icon: ChartNoAxesCombined },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'sales', label: 'Sales', icon: ShoppingCart },
  { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
];

const Metric = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
}) => (
  <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-slate-900/80 backdrop-blur-md hover:border-emerald-500/30 transition-all p-3.5 sm:p-4 shadow-lg shadow-black/20 min-h-24 sm:min-h-28 group">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs leading-tight text-slate-400 font-medium sm:text-sm">{label}</p>
      <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
        <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
      </div>
    </div>
    <div className="mt-2 min-w-0">
      <p
        className="text-base font-bold text-white tracking-tight tabular-nums sm:text-lg xl:text-xl break-words whitespace-normal leading-snug"
        title={String(value)}
      >
        {value}
      </p>
    </div>
  </div>
);

const SectionHeader = ({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <h2 className="text-base font-bold text-white tracking-tight sm:text-lg">{title}</h2>
    {action && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
      >
        {action}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    ) : null}
  </div>
);

export default function HQDashboardPage() {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data: dashboard, isLoading, error, refetch } = useQuery<HQDashboardData>({
    queryKey: queryKeys.dashboard.hq(),
    queryFn: async () => {
      const response = await apiClient.get('/reports/hq-summary');
      return unwrapResponse(response.data, {} as HQDashboardData);
    },
  });

  if (isLoading) {
    return (
      <AdminLayout title="CAREFARM">
        <Loading variant="centered" text="Loading company overview…" />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="CAREFARM">
        <Error
          message="Failed to load HQ dashboard data. Please try again."
          onRetry={() => refetch()}
        />
      </AdminLayout>
    );
  }

  const inventory = dashboard?.inventory ?? [];
  const sales = dashboard?.sales ?? [];
  const pendingTransfers = dashboard?.pendingTransfers ?? [];
  const lowStockAlerts = dashboard?.lowStockAlerts ?? [];
  const expiryAlerts = dashboard?.expiryAlerts ?? [];
  const inventoryTotalsByCurrency = dashboard?.inventoryTotalsByCurrency ?? [];
  const salesTotalsByCurrency = dashboard?.salesTotalsByCurrency ?? [];
  const alertCount = pendingTransfers.length + lowStockAlerts.length + expiryAlerts.length;
  const totalStock = inventory.reduce((sum, item) => sum + item.totalQuantity, 0);
  const totalProducts = inventory.reduce((sum, item) => sum + item.totalProducts, 0);
  const totalSales = sales.reduce((sum, item) => sum + item.totalSales, 0);
  const primaryRevenue = salesTotalsByCurrency[0];
  const primaryInventoryValue = inventoryTotalsByCurrency[0];

  const inventoryColumns = [
    { key: 'branchName', header: 'Branch', mobilePrimary: true },
    { key: 'totalProducts', header: 'Products', mobileVisible: true },
    { key: 'totalQuantity', header: 'Total Stock', mobileVisible: true },
    {
      key: 'totalValue',
      header: 'Total Value',
      mobileVisible: false,
      render: (item: BranchInventory) => item.totalValueFormatted || format(item.totalValue),
    },
    {
      key: 'lowStockItems',
      header: 'Low Stock',
      mobileVisible: true,
      render: (item: BranchInventory) => (
        <span className={item.lowStockItems > 0 ? 'font-semibold text-amber-300' : 'text-emerald-400'}>
          {item.lowStockItems}
        </span>
      ),
    },
  ];

  const salesColumns = [
    { key: 'branchName', header: 'Branch', mobilePrimary: true },
    { key: 'totalSales', header: 'Sales Count', mobileVisible: true },
    {
      key: 'totalRevenue',
      header: 'Revenue',
      mobileVisible: true,
      render: (item: BranchSales) => (
        <span className="font-semibold text-emerald-400 tabular-nums font-mono">
          {item.totalRevenueFormatted || format(item.totalRevenue)}
        </span>
      ),
    },
    {
      key: 'averageOrderValue',
      header: 'Avg Order',
      mobileVisible: false,
      render: (item: BranchSales) => item.averageOrderValueFormatted || format(item.averageOrderValue),
    },
  ];

  const transferColumns = [
    {
      key: 'createdAt',
      header: 'Date',
      mobileVisible: false,
      render: (item: PendingTransfer) => new Date(item.createdAt).toLocaleDateString(),
    },
    { key: 'sourceBranchName', header: 'From', mobilePrimary: true },
    { key: 'destinationBranchName', header: 'To', mobileVisible: true },
    { key: 'productName', header: 'Product', mobileVisible: true },
    { key: 'quantity', header: 'Qty', mobileVisible: true },
  ];

  const lowStockColumns = [
    { key: 'branchName', header: 'Branch', mobilePrimary: true },
    { key: 'productName', header: 'Product', mobileVisible: true },
    { key: 'sku', header: 'SKU', mobileVisible: false },
    {
      key: 'currentStock',
      header: 'Current',
      mobileVisible: true,
      render: (item: LowStockAlert) => <span className="font-semibold text-red-400">{item.currentStock}</span>,
    },
    { key: 'reorderLevel', header: 'Reorder At', mobileVisible: true },
  ];

  const expiryColumns = [
    { key: 'branchName', header: 'Branch', mobileVisible: true },
    { key: 'productName', header: 'Product', mobilePrimary: true },
    { key: 'lotNumber', header: 'Lot', mobileVisible: false },
    {
      key: 'expiryDate',
      header: 'Expires',
      mobileVisible: true,
      render: (item: ExpiryAlert) => new Date(item.expiryDate).toLocaleDateString(),
    },
    {
      key: 'daysUntilExpiry',
      header: 'Days Left',
      mobileVisible: true,
      render: (item: ExpiryAlert) => (
        <span className={item.daysUntilExpiry <= 7 ? 'font-bold text-red-400' : 'font-semibold text-orange-300'}>
          {item.daysUntilExpiry}
        </span>
      ),
    },
    { key: 'quantityAvailable', header: 'Qty', mobileVisible: true },
  ];

  return (
    <AdminLayout title="CAREFARM">
      <div className="space-y-6 pb-24 lg:pb-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Company Overview</h1>
            <p className="mt-1 text-sm text-gray-400">Multi-branch performance at a glance</p>
          </div>
          <div className="flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-300 shadow-sm">
            <CalendarDays className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Last 30 days
          </div>
        </div>

        <div className="hidden items-center gap-2 border-b border-white/[0.08] lg:flex">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-all ${
                activeTab === key
                  ? 'border-emerald-500 text-white font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {key === 'alerts' && alertCount > 0 ? (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white font-bold shadow-xs shadow-rose-500/30">{alertCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr] xl:grid-cols-[1.3fr_1fr]">
              <div className="flex min-h-52 flex-col justify-between rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/20 p-5 sm:p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Revenue</p>
                    <p className="mt-3 break-words text-3xl font-extrabold tracking-tight text-white tabular-nums font-mono sm:text-4xl">
                      {primaryRevenue?.totalRevenueFormatted || format(primaryRevenue?.totalRevenue || 0)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      <span className="text-slate-200 font-semibold">{totalSales.toLocaleString()}</span> transactions recorded in the last 30 days
                    </p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 shadow-md">
                    <TrendingUp className="h-6 w-6" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-400">
                  {salesTotalsByCurrency.map((total) => (
                    <span key={total.currencyCode} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 tabular-nums">
                      {total.currencyCode}: <span className="font-semibold text-slate-200">{total.totalRevenueFormatted || format(total.totalRevenue || 0)}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Metric icon={Building2} label="Total Branches" value={inventory.length} />
                <Metric
                  icon={CircleDollarSign}
                  label="Inventory Value"
                  value={primaryInventoryValue?.totalValueFormatted || format(primaryInventoryValue?.totalValue || 0)}
                />
                <Metric icon={ShoppingCart} label="Sales" value={totalSales.toLocaleString()} />
                <Metric icon={Boxes} label="Stock Units" value={totalStock.toLocaleString()} />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <SectionHeader title="Attention needed" />
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/70 shadow-lg backdrop-blur-md">
                  {[
                    { label: 'Low stock items', count: lowStockAlerts.length, icon: AlertTriangle, tone: 'text-amber-300 bg-amber-500/15 border-amber-500/25' },
                    { label: 'Expiring batches', count: expiryAlerts.length, icon: CalendarDays, tone: 'text-rose-300 bg-rose-500/15 border-rose-500/25' },
                    { label: 'Transfer approvals', count: pendingTransfers.length, icon: ArrowRightLeft, tone: 'text-sky-300 bg-sky-500/15 border-sky-500/25' },
                  ].map(({ label, count, icon: Icon, tone }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActiveTab('alerts')}
                      className="flex min-h-16 w-full items-center gap-3 border-b border-white/[0.06] px-4 text-left last:border-b-0 hover:bg-white/[0.04] transition-colors"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="flex-1 font-medium text-slate-200 text-sm">{label}</span>
                      <span className="rounded-full bg-white/[0.08] border border-white/[0.06] px-3 py-0.5 text-xs font-bold text-white tabular-nums">{count}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Review alerts
                </button>
              </div>

              <div className="space-y-3">
                <SectionHeader title="Branch performance" action="View all" onAction={() => setActiveTab('sales')} />
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/70 shadow-lg backdrop-blur-md">
                  {sales.slice(0, 3).map((branch) => (
                    <button
                      key={branch.branchId}
                      type="button"
                      onClick={() => setActiveTab('sales')}
                      className="flex min-h-20 w-full items-center gap-3 border-b border-white/[0.06] px-4 text-left last:border-b-0 hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-100 text-sm">{branch.branchName}</span>
                        <span className="mt-1 block text-xs text-slate-400">{branch.totalSales.toLocaleString()} sales</span>
                      </span>
                      <span
                        className="text-right text-sm font-bold text-emerald-400 tabular-nums font-mono shrink-0 break-words"
                        title={branch.totalRevenueFormatted || format(branch.totalRevenue)}
                      >
                        {branch.totalRevenueFormatted || format(branch.totalRevenue)}
                      </span>
                    </button>
                  ))}
                  {sales.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">No branch sales data available</p> : null}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4 sm:p-5 shadow-lg backdrop-blur-md">
              <SectionHeader title="Company totals by currency" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {inventoryTotalsByCurrency.map((total) => (
                  <div key={`inventory-${total.currencyCode}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] p-3.5">
                    <span className="text-xs text-slate-400 font-medium">Inventory · {total.currencyCode}</span>
                    <span
                      className="font-bold text-white tabular-nums shrink-0 text-right break-words"
                      title={total.totalValueFormatted || format(total.totalValue || 0)}
                    >
                      {total.totalValueFormatted || format(total.totalValue || 0)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] p-3.5">
                  <span className="text-xs text-slate-400 font-medium">Total Products</span>
                  <span className="font-bold text-white tabular-nums">{totalProducts.toLocaleString()}</span>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'inventory' ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Inventory by branch</h2>
                <p className="mt-1 text-sm text-slate-400">Stock position and value across every location</p>
              </div>
              <Button variant="secondary" onClick={() => navigate('/admin/inventory')}>Manage Inventory</Button>
            </div>
            <Table data={inventory} columns={inventoryColumns} rowKey={(item) => item.branchId} emptyMessage="No inventory data available" />
          </section>
        ) : null}

        {activeTab === 'sales' ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Sales by branch</h2>
                <p className="mt-1 text-sm text-slate-400">Last 30 days performance</p>
              </div>
              <Button variant="secondary" onClick={() => navigate('/admin/reports')}>View Reports</Button>
            </div>
            <Table data={sales} columns={salesColumns} rowKey={(item) => item.branchId} emptyMessage="No sales data available" />
          </section>
        ) : null}

        {activeTab === 'alerts' ? (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
                    <ArrowRightLeft className="h-5 w-5 text-sky-400" aria-hidden="true" />
                    Pending transfer approvals
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">Requires HQ review</p>
                </div>
                <Button variant="secondary" onClick={() => navigate('/admin/transfers')}>Review All</Button>
              </div>
              <Table data={pendingTransfers} columns={transferColumns} rowKey={(item) => item._id} emptyMessage="No pending transfers" />
            </section>

            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
                <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
                Low stock alerts
              </h2>
              <Table data={lowStockAlerts} columns={lowStockColumns} rowKey={(item) => item.id} emptyMessage="No low stock alerts" />
            </section>

            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
                <CalendarDays className="h-5 w-5 text-rose-400" aria-hidden="true" />
                Expiry alerts
              </h2>
              <Table data={expiryAlerts} columns={expiryColumns} rowKey={(item) => item.batchId} emptyMessage="No expiry alerts" />
            </section>
          </div>
        ) : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/[0.08] bg-slate-950/90 pb-safe-bottom backdrop-blur-xl lg:hidden" aria-label="Dashboard sections">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              activeTab === key ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {activeTab === key ? <span className="absolute inset-x-6 top-0 h-0.5 bg-emerald-500 rounded-full" /> : null}
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
            {key === 'alerts' && alertCount > 0 ? (
              <span className="absolute right-[24%] top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs shadow-rose-500/30">
                {alertCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
    </AdminLayout>
  );
}
