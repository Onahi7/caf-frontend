import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
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
  const user = useAuthStore((state) => state.user);
  const reportModules = [
    {
      title: 'Sales Reports',
      description: 'Daily, weekly, and monthly sales analysis',
      icon: DollarSign,
      path: '/admin/reports/sales',
      color: 'bg-green-500',
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
      color: 'bg-red-500',
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
      color: 'bg-orange-500',
      stats: 'Purchase Analysis',
      roles: ['super_admin', 'branch_manager', 'auditor']
    },
    {
      title: 'Transfer Reports',
      description: 'Inter-branch transfer tracking',
      icon: ArrowLeftRight,
      path: '/admin/reports/transfers',
      color: 'bg-teal-500',
      stats: 'Transfer History',
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

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="mt-2 text-gray-400">
            Access comprehensive reports and analytics for all business operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleReportModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                to={module.path}
                className="block group"
              >
                <div className="bg-primary-dark rounded-lg shadow-md border border-gray-700 p-6 hover:shadow-xl hover:border-accent-green transition-all">
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`${module.color} rounded-lg p-3 text-white group-hover:scale-110 transition-transform`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-accent-green transition-colors">
                        {module.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        {module.description}
                      </p>
                      <p className="mt-2 text-xs text-gray-500 font-medium">
                        {module.stats}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-900/20 rounded-lg p-6 border border-blue-700">
            <h3 className="text-lg font-semibold text-blue-300 mb-2">Report Features</h3>
            <ul className="space-y-2 text-sm text-blue-200">
              <li>- Export reports to PDF and Excel formats</li>
              <li>- Customize date ranges for detailed analysis</li>
              <li>- Filter by branch, product, or category</li>
              <li>- Schedule automated report delivery</li>
            </ul>
          </div>

          <div className="bg-purple-900/20 rounded-lg p-6 border border-purple-700">
            <h3 className="text-lg font-semibold text-purple-300 mb-2">Analytics Tips</h3>
            <ul className="space-y-2 text-sm text-purple-200">
              <li>- Review sales reports daily for insights</li>
              <li>- Monitor expiry reports weekly</li>
              <li>- Check inventory levels before ordering</li>
              <li>- Analyze customer trends for targeted marketing</li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
