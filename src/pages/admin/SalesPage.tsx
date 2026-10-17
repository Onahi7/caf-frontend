import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { useAuthStore } from '../../stores/auth-store';
import { 
  DollarSign, 
  FileText, 
  TrendingUp, 
  Users,
  CreditCard,
  Percent,
  WalletCards,
  Upload,
  ClipboardList,
  Truck
} from 'lucide-react';

export function SalesPage() {
  const user = useAuthStore((state) => state.user);
  const salesModules = [
    {
      title: 'POS Terminal',
      description: 'Process sales transactions at the point of sale',
      icon: CreditCard,
      path: '/pos',
      color: 'bg-emerald-500/15 text-emerald-300',
      roles: ['cashier', 'branch_manager', 'super_admin', 'auditor']
    },
    {
      title: 'Sales Reports',
      description: 'Analyze sales performance and trends',
      icon: TrendingUp,
      path: '/admin/reports/sales',
      color: 'bg-blue-500/15 text-blue-300',
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier']
    },
    {
      title: 'Transactions',
      description: 'View transaction history and details',
      icon: FileText,
      path: '/pos/transactions',
      color: 'bg-purple-500/15 text-purple-300',
      roles: ['cashier', 'branch_manager', 'super_admin', 'auditor']
    },
    {
      title: 'Credit Sales',
      description: 'Track balances due and receive follow-up payments',
      icon: WalletCards,
      path: '/admin/sales/credit',
      color: 'bg-amber-500/15 text-amber-300',
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier']
    },
    {
      title: 'Request Uploads',
      description: 'Upload client request sheets and match them to stock',
      icon: Upload,
      path: '/admin/sales/request-analysis',
      color: 'bg-cyan-500/15 text-cyan-300',
      roles: ['super_admin', 'branch_manager']
    },
    {
      title: 'Customer Reports',
      description: 'Track customer purchase patterns',
      icon: Users,
      path: '/admin/reports/customers',
      color: 'bg-orange-500/15 text-orange-300',
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier']
    },
    {
      title: 'Promotions',
      description: 'Manage discounts and promotional campaigns',
      icon: Percent,
      path: '/admin/promotions',
      color: 'bg-pink-500/15 text-pink-300',
      roles: ['super_admin', 'branch_manager']
    },
    {
      title: 'Shift Management',
      description: 'Monitor cashier shifts and daily summaries',
      icon: DollarSign,
      path: '/pos/shifts',
      color: 'bg-teal-500/15 text-teal-300',
      roles: ['cashier', 'branch_manager', 'super_admin', 'auditor']
    },
    {
      title: 'Customer Orders',
      description: 'Upload customer POs and process items with AI',
      icon: ClipboardList,
      path: '/admin/customer-orders',
      color: 'bg-indigo-500/15 text-indigo-300',
      roles: ['super_admin', 'branch_manager', 'cashier']
    },
    {
      title: 'Proforma Invoices',
      description: 'Create, approve, and convert proforma invoices to sales',
      icon: FileText,
      path: '/admin/proforma-invoices',
      color: 'bg-violet-500/15 text-violet-300',
      roles: ['super_admin', 'branch_manager']
    },
    {
      title: 'Delivery Notes',
      description: 'Track deliveries for customer orders',
      icon: Truck,
      path: '/admin/delivery-notes',
      color: 'bg-rose-500/15 text-rose-300',
      roles: ['super_admin', 'branch_manager', 'cashier']
    }
  ];
  const visibleSalesModules = salesModules.filter((module) =>
    module.roles.includes(user?.role || ''),
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Sales Management</h1>
            <p className="mt-2 text-slate-400">
              Process transactions, analyze sales performance, manage customer balances, and respond to uploaded requests.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Cashiers, branch managers, and super admins can all create credit sales from POS. Admin tools are for oversight and follow-up.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/pos"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Open POS
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleSalesModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                to={module.path}
                className="block group"
              >
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-6 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.12)] transition-all duration-300 h-full">
                  <div className="flex items-start space-x-4">
                    <div className={`${module.color} rounded-xl p-3 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-500 transition-colors">
                        {module.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                        {module.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
            Sales Best Practices
          </h3>
          <ul className="space-y-3 text-sm text-emerald-200/80">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Start and end shifts properly to maintain accurate cash records
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Verify customer information for loyalty program benefits
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Apply promotions correctly to ensure customer satisfaction
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Review daily sales reports to track performance goals
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}

