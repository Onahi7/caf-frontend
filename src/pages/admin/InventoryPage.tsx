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
      <div className="mx-auto w-full max-w-6xl pb-24 sm:pb-0">
        <header className="mb-4 sm:mb-8">
          <p className="mb-2 hidden text-xs font-semibold uppercase tracking-[0.2em] text-accent-green sm:block">
            Stock control
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Inventory Management
          </h1>
          <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-gray-400 sm:block sm:text-base">
            Manage products, incoming stock, adjustments, transfers, and inventory reporting.
          </p>
        </header>

        {visibleActions.length > 0 ? (
          <section aria-labelledby="inventory-actions-heading">
            <div className="mb-4 hidden items-center justify-between sm:flex">
              <h2 id="inventory-actions-heading" className="text-sm font-semibold text-gray-300">
                Inventory tools
              </h2>
              <span className="text-xs text-gray-500">Choose an action</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {visibleActions.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.path}
                    to={module.path}
                    className={`group flex min-h-44 flex-col items-center justify-center rounded-2xl border px-3 py-4 text-center transition duration-200 focus:outline-none focus:ring-2 focus:ring-accent-green/60 focus:ring-offset-2 focus:ring-offset-primary-darker sm:min-h-56 sm:px-6 sm:py-6 ${
                      module.featured
                        ? 'border-amber-400/80 bg-amber-400/10 hover:border-amber-300 hover:bg-amber-400/15'
                        : 'border-emerald-400/30 bg-primary-dark/70 hover:border-accent-green/70 hover:bg-primary-dark'
                    }`}
                  >
                    <span
                      className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full border transition-transform duration-200 group-hover:scale-105 sm:mb-5 sm:h-20 sm:w-20 ${
                        module.featured
                          ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                          : 'border-accent-green/25 bg-accent-green/5 text-emerald-300'
                      }`}
                    >
                      <Icon className="h-7 w-7 sm:h-10 sm:w-10" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <h3
                      className={`text-base font-bold leading-tight sm:text-lg ${
                        module.featured ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {module.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-gray-400 sm:text-sm">
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
            className={`${visibleActions.length > 0 ? 'mt-6 sm:mt-8' : ''} rounded-2xl border border-emerald-400/25 bg-primary-dark/55 p-3 sm:p-5`}
          >
            <h2 id="inventory-reports-heading" className="mb-2 text-lg font-bold text-emerald-300 sm:mb-3">
              Reports
            </h2>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/10">
              {visibleReports.map((module, index) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.path}
                    to={module.path}
                    className={`group flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-green/60 sm:min-h-20 sm:gap-4 sm:px-5 sm:py-3 ${
                      index > 0 ? 'border-t border-white/10' : ''
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-green/10 text-emerald-300 sm:h-11 sm:w-11">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">{module.title}</span>
                      <span className="mt-0.5 hidden text-sm text-gray-400 sm:block">
                        {module.description}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-accent-green"
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <details className="group mt-4 rounded-2xl border border-emerald-400/25 bg-primary-dark/55 open:border-accent-green/40">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-green/60 sm:min-h-20 sm:gap-4 sm:px-5 sm:py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-green/10 text-emerald-300">
              <Lightbulb className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white">Quick Tips</span>
              <span className="mt-0.5 block text-xs text-gray-400 sm:text-sm">
                Best practices and helpful guidance
              </span>
            </span>
            <ChevronDown className="h-5 w-5 text-emerald-300 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="space-y-3 border-t border-white/10 px-5 py-4 text-sm leading-6 text-gray-300">
            {quickTips.map((tip) => (
              <li key={tip} className="flex gap-3">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green" />
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
