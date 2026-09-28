import { type ComponentType, type SVGProps } from 'react';
import { Link } from 'react-router-dom';
import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Lightbulb,
  Package,
  SlidersHorizontal,
  Truck,
  Building2,
  Layers,
  Boxes,
  Tag,
  Sparkles,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminMobileBottomNav } from '../../components/admin/AdminMobileBottomNav';
import { useAuthStore } from '../../stores/auth-store';

type InventoryIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface InventoryModule {
  title: string;
  description: string;
  icon: InventoryIcon;
  path: string;
  roles: string[];
  featured?: boolean;
}

const actionModules: InventoryModule[] = [
  {
    title: 'Products',
    description: 'Manage and view all products',
    icon: Package,
    path: '/admin/products',
    roles: ['super_admin', 'branch_manager'],
  },
  {
    title: 'Purchase Orders',
    description: 'Create and manage purchase orders',
    icon: ClipboardList,
    path: '/admin/purchase-orders',
    roles: ['super_admin', 'branch_manager'],
    featured: true,
  },
  {
    title: 'Stock Adjustments',
    description: 'Adjust inventory quantities',
    icon: SlidersHorizontal,
    path: '/admin/stock-adjustments',
    roles: ['super_admin', 'branch_manager'],
  },
  {
    title: 'Stock Transfers',
    description: 'Transfer stock between branches',
    icon: Truck,
    path: '/admin/transfers',
    roles: ['super_admin', 'branch_manager'],
  },
  {
    title: 'Suppliers',
    description: 'Manage medicine and product vendors',
    icon: Building2,
    path: '/admin/suppliers',
    roles: ['super_admin', 'branch_manager'],
  },
  {
    title: 'Batches & Lots',
    description: 'Track batches, lot numbers, and expiration dates',
    icon: Layers,
    path: '/admin/batches',
    roles: ['super_admin', 'branch_manager', 'auditor'],
  },
  {
    title: 'Cycle Counts',
    description: 'Perform physical stock audits and line counts',
    icon: Boxes,
    path: '/admin/cycle-counts',
    roles: ['super_admin', 'branch_manager', 'auditor'],
  },
  {
    title: 'Pricing Rules',
    description: 'Manage base prices, pack sizes, and markups',
    icon: Tag,
    path: '/admin/pricing',
    roles: ['super_admin', 'branch_manager'],
  },
  {
    title: 'Promotions',
    description: 'Configure discounts, bundle deals, and campaigns',
    icon: Sparkles,
    path: '/admin/promotions',
    roles: ['super_admin', 'branch_manager'],
  },
];

const reportModules: InventoryModule[] = [
  {
    title: 'Expiry Reports',
    description: 'Monitor expiring and expired products',
    icon: Clock3,
    path: '/admin/reports/expiry',
    roles: ['super_admin', 'branch_manager', 'auditor'],
  },
  {
    title: 'Inventory Reports',
    description: 'Review inventory levels and movements',
    icon: ChartNoAxesColumnIncreasing,
    path: '/admin/reports/inventory',
    roles: ['super_admin', 'branch_manager', 'auditor'],
  },
];

const quickTips = [
  'Regular stock counts help maintain accurate inventory records.',
  'Monitor expiry dates to minimize waste and expired stock.',
  'Use stock adjustments to correct discrepancies found during audits.',
  'Plan transfers in advance to keep stock balanced across branches.',
];

function canAccess(module: InventoryModule, role?: string) {
  return module.roles.includes(role ?? '');
}

export function InventoryPage() {
  const userRole = useAuthStore((state) => state.user?.role);
  const visibleActions = actionModules.filter((module) => canAccess(module, userRole));
  const visibleReports = reportModules.filter((module) => canAccess(module, userRole));

  return (
    <AdminLayout title="Inventory" showMobileBranchSelector={false}>
      <div className="mx-auto w-full max-w-6xl pb-24 sm:pb-0 space-y-6 sm:space-y-8">
        <header className="mb-2 sm:mb-4">
          <p className="mb-2 hidden text-xs font-bold uppercase tracking-widest text-emerald-400 sm:block">
            Stock Control & Logistics
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            Inventory Hub
          </h1>
          <p className="mt-2 hidden max-w-2xl text-xs leading-relaxed text-slate-400 sm:block sm:text-sm">
            Manage product catalog, purchase orders, cycle audits, multi-branch stock transfers, and valuation reports.
          </p>
        </header>

        {visibleActions.length > 0 ? (
          <section aria-labelledby="inventory-actions-heading">
            <div className="mb-4 hidden items-center justify-between sm:flex">
              <h2 id="inventory-actions-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Core Operations
              </h2>
              <span className="text-xs text-slate-500">Select an action</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {visibleActions.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.path}
                    to={module.path}
                    className={`group flex min-h-44 flex-col items-center justify-center rounded-2xl border px-3 py-5 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 sm:min-h-56 sm:px-6 sm:py-6 shadow-lg shadow-black/20 ${
                      module.featured
                        ? 'border-amber-500/30 bg-amber-500/10 hover:border-amber-400 hover:bg-amber-500/15'
                        : 'border-white/[0.08] bg-slate-900/80 hover:border-emerald-500/40 hover:bg-slate-850'
                    }`}
                  >
                    <span
                      className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-110 sm:mb-5 sm:h-16 sm:w-16 ${
                        module.featured
                          ? 'border-amber-500/30 bg-amber-500/20 text-amber-300'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <h3
                      className={`text-sm font-bold tracking-tight sm:text-base ${
                        module.featured ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {module.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-400 leading-relaxed max-w-[200px]">
                      {module.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {visibleReports.length > 0 ? (
          <section
            aria-labelledby="inventory-reports-heading"
            className="rounded-2xl border border-white/[0.08] bg-slate-900/80 p-4 sm:p-6 shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 id="inventory-reports-heading" className="text-base font-bold text-white tracking-tight">
                  Inventory Reports & Audits
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Automated valuation, movement, and expiry telemetry</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-slate-950/40">
              {visibleReports.map((module, index) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.path}
                    to={module.path}
                    className={`group flex min-h-14 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/60 sm:min-h-16 sm:gap-4 sm:px-5 ${
                      index > 0 ? 'border-t border-white/[0.06]' : ''
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white text-sm">{module.title}</span>
                      <span className="mt-0.5 hidden text-xs text-slate-400 sm:block">
                        {module.description}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-emerald-400"
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <details className="group rounded-2xl border border-white/[0.08] bg-slate-900/60 open:border-emerald-500/30 transition-all">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5 px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/50 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Lightbulb className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white text-sm">Best Practices & Guidelines</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                Operating rules for high pharmacy inventory accuracy
              </span>
            </span>
            <ChevronDown className="h-5 w-5 text-emerald-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="space-y-2.5 border-t border-white/[0.06] px-5 py-4 text-xs leading-relaxed text-slate-300">
            {quickTips.map((tip) => (
              <li key={tip} className="flex gap-2.5 items-start">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <AdminMobileBottomNav active="inventory" />
    </AdminLayout>
  );
}
