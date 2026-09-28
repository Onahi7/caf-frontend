import { Link, useLocation } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { POSLayout } from '../../components/pos';
import { useAuthStore } from '../../stores/auth-store';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Users,
  ShoppingCart,
  ArrowLeftRight,
  FileText,
  DollarSign,
  Receipt,
  BarChart3,
  Clock,
  Activity,
  ShieldCheck,
} from 'lucide-react';

export function ReportsPage() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isPosContext = location.pathname.startsWith('/pos') || user?.role === 'cashier';

  const getReportUrl = (path: string) => {
    if (isPosContext && path.startsWith('/admin/reports/')) {
      return path.replace('/admin/reports/', '/pos/reports/');
    }
    return path;
  };
  const reportModules = [
    {
      title: 'Sales Reports',
      description: 'Daily, weekly, and monthly sales analysis',
      icon: DollarSign,
      path: '/admin/reports/sales',
      color: 'bg-emerald-500',
      stats: 'Revenue & Profit',
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier']
    },
    {
      title: 'Inventory Reports',
      description: 'Stock levels and movement tracking',
      icon: Package,
      path: '/admin/reports/inventory',
      color: 'bg-blue-500',
      stats: 'Stock Analysis',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Expiry Reports',
      description: 'Expiring and expired product monitoring',
      icon: AlertTriangle,
      path: '/admin/reports/expiry',
      color: 'bg-rose-500',
      stats: 'Expiry Tracking',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Customer Reports',
      description: 'Customer purchase patterns and loyalty',
      icon: Users,
      path: '/admin/reports/customers',
      color: 'bg-purple-500',
      stats: 'Customer Insights',
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier']
    },
    {
      title: 'Purchase Reports',
      description: 'Supplier orders and purchase analysis',
      icon: ShoppingCart,
      path: '/admin/reports/purchases',
      color: 'bg-indigo-500',
      stats: 'Procurement Insights',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Transfer Reports',
      description: 'Inter-branch transfer history and status',
      icon: ArrowLeftRight,
      path: '/admin/reports/transfers',
      color: 'bg-teal-500',
      stats: 'Branch Transfers',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Audit Trail',
      description: 'System activities and changes log',
      icon: FileText,
      path: '/admin/audit/trail',
      color: 'bg-gray-600',
      stats: 'Security & Compliance',
      roles: ['super_admin', 'auditor']
    },
    {
      title: 'User Activity',
      description: 'User actions and access logs',
      icon: TrendingUp,
      path: '/admin/audit/user-activity',
      color: 'bg-indigo-500',
      stats: 'Activity Monitoring',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Profit & Loss',
      description: 'Revenue, costs, and profit margins',
      icon: BarChart3,
      path: '/admin/reports/profit-loss',
      color: 'bg-emerald-600',
      stats: 'P&L Statement',
      roles: ['super_admin', 'branch_manager', 'auditor', 'finance_manager']
    },
    {
      title: 'Expense Report',
      description: 'Expense breakdown by category and period',
      icon: Receipt,
      path: '/admin/reports/expenses',
      color: 'bg-rose-500',
      stats: 'Cost Analysis',
      roles: ['super_admin', 'branch_manager', 'auditor', 'finance_manager']
    },
    {
      title: 'Dead Stock',
      description: 'Slow-moving and unsold inventory',
      icon: Clock,
      path: '/admin/reports/dead-stock',
      color: 'bg-amber-600',
      stats: 'Inventory Efficiency',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Shift Reports',
      description: 'Cashier shift logs and cash reconciliations',
      icon: Clock,
      path: '/pos/shifts/logs',
      color: 'bg-amber-500',
      stats: 'Register Audits',
      roles: ['super_admin', 'branch_manager', 'cashier', 'auditor']
    },
    {
      title: 'Stock Movements',
      description: 'Inbound and outbound stock history',
      icon: Activity,
      path: '/admin/reports/stock-movements',
      color: 'bg-cyan-600',
      stats: 'Movement Tracking',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Reconciliation',
      description: 'Financial reconciliation and variance tracking',
      icon: ShieldCheck,
      path: '/finance/reconciliations',
      color: 'bg-amber-500',
      stats: 'Variance Tracking',
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor']
    },
  ];
  const visibleReportModules = reportModules.filter((module) =>
    module.roles.includes(user?.role || ''),
  );

  const pageContent = (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Reports & Analytics</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Access comprehensive reports and analytics for business operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {visibleReportModules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.path}
              to={getReportUrl(module.path)}
              className="block group"
            >
              <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-white/10 p-5 hover:border-emerald-500/50 hover:bg-slate-900 transition-all backdrop-blur-md group-hover:scale-[1.01]">
                <div className="flex flex-col space-y-3.5">
                  <div className="flex items-start justify-between">
                    <div className={`${module.color} rounded-xl p-3 text-white group-hover:scale-110 transition-transform shadow-md`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {module.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {module.description}
                    </p>
                    <p className="mt-2 text-[11px] text-emerald-400/90 font-medium">
                      {module.stats}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
        <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/[0.08] backdrop-blur-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Report Features</h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>• Export reports to PDF and Excel formats</li>
            <li>• Customize date ranges for detailed analysis</li>
            <li>• Filter by branch, product, or category</li>
            <li>• Schedule automated report delivery</li>
          </ul>
        </div>

        <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/[0.08] backdrop-blur-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Analytics Tips</h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>• Review sales reports daily for real-time insights</li>
            <li>• Monitor expiry reports weekly to reduce shrinkage</li>
            <li>• Check inventory levels before placing orders</li>
            <li>• Analyze customer purchase trends for repeat business</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return isPosContext ? (
    <POSLayout title="Reports">{pageContent}</POSLayout>
  ) : (
    <AdminLayout title="Reports">{pageContent}</AdminLayout>
  );
}
