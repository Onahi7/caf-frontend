import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Boxes,
  Package,
  TrendingUp,
  ShoppingCart,
  Users,
  CreditCard,
  BarChart3,
  Building2,
  UserCog,
  FileText,
  Receipt,
  Truck,
  UserCheck,
  DollarSign,
  Scale,
  Wallet,
  Banknote,
  PiggyBank,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useBranchStore } from '../stores/branch-store';
import apiClient from '../lib/api-client';
import { useToast } from '../hooks/useToast';
import { BranchSelector } from './BranchSelector';
import { NotificationBell } from './NotificationBell';
import { PasskeySetupBanner } from './account';
import { ConnectionStatus } from './ui/ConnectionStatus';
import { OfflineNotification } from './ui/OfflineNotification';
import { PWAUpdatePrompt } from './ui/PWAUpdatePrompt';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  showMobileBranchSelector?: boolean;
}

interface NavItem {
  name: string;
  path: string;
  icon: ReactNode;
  section: string;
  roles?: string[];
  hqManagerOnly?: boolean;
}

export const AdminLayout = ({
  children,
  title = 'Admin',
  showMobileBranchSelector = true,
}: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { selectedBranch } = useBranchStore();
  const { showError } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
      showError('Logout failed. Please try again.');
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: user?.role === 'super_admin' ? '/admin/hq-dashboard' : '/admin/dashboard',
      section: 'Main',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      name: 'My Security',
      path: '/settings/security',
      section: 'Main',
      icon: <ShieldCheck className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'cashier', 'auditor', 'marketer', 'finance_manager'],
    },
    {
      name: 'Inventory',
      path: '/admin/inventory',
      section: 'Inventory',
      icon: <Boxes className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      name: 'Products',
      path: '/admin/products',
      section: 'Inventory',
      icon: <Package className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager'],
    },
    {
      name: 'Sales',
      path: '/admin/sales',
      section: 'Sales & POS',
      icon: <TrendingUp className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'cashier', 'auditor', 'finance_manager'],
    },
    {
      name: 'POS Terminal',
      path: '/pos',
      section: 'Sales & POS',
      icon: <ShoppingCart className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'cashier', 'auditor'],
    },
    {
      name: 'Customers',
      path: '/admin/customers',
      section: 'Sales & POS',
      icon: <Users className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'cashier'],
    },
    {
      name: 'Credit Sales',
      path: '/admin/sales/credit',
      section: 'Sales & POS',
      icon: <CreditCard className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier'],
    },
    {
      name: 'Reports',
      path: '/admin/reports',
      section: 'Reports',
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'auditor', 'finance_manager', 'cashier'],
    },
    {
      name: 'Branches',
      path: '/admin/branches',
      section: 'Administration',
      icon: <Building2 className="w-5 h-5" />,
      roles: ['super_admin'],
    },
    {
      name: 'Users',
      path: '/admin/users',
      section: 'Administration',
      icon: <UserCog className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager'],
    },
    {
      name: 'Customer Orders',
      path: '/admin/customer-orders',
      section: 'Sales & POS',
      icon: <FileText className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'cashier'],
    },
    {
      name: 'Proforma Invoices',
      path: '/admin/proforma-invoices',
      section: 'Sales & POS',
      icon: <Receipt className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager'],
    },
    {
      name: 'Delivery Notes',
      path: '/admin/delivery-notes',
      section: 'Sales & POS',
      icon: <Truck className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'cashier'],
    },
    {
      name: 'Marketer Assignments',
      path: '/admin/marketer-assignments',
      section: 'Inventory',
      icon: <UserCheck className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager'],
    },
    {
      name: 'Finance Dashboard',
      path: '/admin/finance-dashboard',
      section: 'Finance',
      hqManagerOnly: true,
      icon: <DollarSign className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor'],
    },
    {
      name: 'Finance Transactions',
      path: '/admin/finance',
      section: 'Finance',
      hqManagerOnly: true,
      icon: <Wallet className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor'],
    },
    {
      name: 'Reconciliations',
      path: '/admin/reconciliations',
      section: 'Finance',
      hqManagerOnly: true,
      icon: <Scale className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor'],
    },
    {
      name: 'Salaries',
      path: '/admin/salaries',
      section: 'Finance',
      hqManagerOnly: true,
      icon: <Banknote className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor'],
    },
    {
      name: 'Cash Management',
      path: '/admin/cash-management',
      section: 'Finance',
      hqManagerOnly: true,
      icon: <PiggyBank className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor'],
    },
    {
      name: 'Finance Reports',
      path: '/admin/finance-reports',
      section: 'Finance',
      hqManagerOnly: true,
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor'],
    },
  ];

  const cashierNavItems = new Set(['Credit Sales', 'Reports']);

  const filteredNavItems = navItems.filter((item) => {
    if (user?.role === 'cashier') {
      return cashierNavItems.has(item.name);
    }

    if (!item.roles) {
      return true;
    }

    if (
      item.hqManagerOnly &&
      user?.role === 'branch_manager' &&
      !selectedBranch?.isHeadquarters
    ) {
      return false;
    }

    return item.roles.includes(user?.role || '');
  });

  const navSections = filteredNavItems.reduce<Array<{ name: string; items: NavItem[] }>>((sections, item) => {
    const existingSection = sections.find((section) => section.name === item.section);
    if (existingSection) {

      existingSection.items.push(item);
    } else {
      sections.push({ name: item.section, items: [item] });
    }
    return sections;
  }, []);

  const isActiveRoute = (path: string) => {
    if (location.pathname === path) {
      return true;
    }

    return path.startsWith('/admin') && location.pathname.startsWith(`${path}/`);
  };

  const renderNavigation = (onNavigate?: () => void) => (
    <div className="space-y-6">
      {navSections.map((section) => (
        <div key={section.name}>
          <p className="px-3.5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {section.name}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const isActive = isActiveRoute(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onNavigate}
                    className={`group flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 select-none ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 shadow-xs'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`transition-colors duration-150 ${
                        isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="font-medium truncate">{item.name}</span>
                    {isActive ? (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-dvh overflow-hidden bg-primary-darker flex">
      <ConnectionStatus />
      <OfflineNotification />
      <PWAUpdatePrompt />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 bg-slate-900/95 border-r border-white/[0.08] flex-col pt-safe-top backdrop-blur-xl">
        <div className="p-5 border-b border-white/[0.08] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-950/30 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-slate-100 tracking-tight leading-none">CAREFARM</div>
            <p className="text-xs text-slate-400 mt-1 truncate">{selectedBranch?.name || 'All Branches'}</p>
          </div>
        </div>

        <nav className="flex-1 p-3.5 overflow-y-auto">{renderNavigation()}</nav>

        <div className="p-4 border-t border-white/[0.08] bg-slate-950/40">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 bg-white/[0.04] hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 rounded-xl transition-all duration-150 border border-white/[0.06] hover:border-rose-500/20 text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-white/[0.08] flex flex-col transform transition-transform duration-200 lg:hidden pt-safe-top shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-100 leading-none">CAREFARM</div>
              {selectedBranch ? (
                <p className="text-xs text-slate-400 mt-1 truncate">{selectedBranch.name}</p>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3.5 overflow-y-auto">
          {renderNavigation(() => setIsMobileMenuOpen(false))}
        </nav>

        <div className="p-4 border-t border-white/[0.08] bg-slate-950/40">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 bg-white/[0.04] hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 rounded-xl transition-all duration-150 border border-white/[0.06] hover:border-rose-500/20 text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out? You will need to sign in again to access the terminal."
        confirmLabel="Sign out"
        variant="danger"
      />

      {/* Main Content Area */}
      <div className="flex flex-1 min-w-0 flex-col bg-primary-darker lg:ml-64">
        <header className="bg-slate-900/60 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3.5 sm:px-6 lg:px-8 sticky top-0 z-20 pt-safe-top">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight truncate">{title}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <NotificationBell />
              <div className="hidden sm:block w-60">
                <BranchSelector />
              </div>
            </div>
          </div>
          {showMobileBranchSelector ? (
            <div className="mt-3 sm:hidden">
              <BranchSelector />
            </div>
          ) : null}
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-5">
            <PasskeySetupBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
