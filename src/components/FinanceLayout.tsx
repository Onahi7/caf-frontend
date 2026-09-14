import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Receipt,
  Banknote,
  DollarSign,
  Scale,
  PiggyBank,
  FileCheck,
  BarChart3,
  ShieldCheck,
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

interface FinanceLayoutProps {
  children: ReactNode;
  title?: string;
}

interface NavItem {
  name: string;
  path: string;
  icon: ReactNode;
  section: string;
  roles?: string[];
}

const ICONS = {
  dashboard: <LayoutDashboard className="w-4 h-4" />,
  cash: <Wallet className="w-4 h-4" />,
  receivables: <CreditCard className="w-4 h-4" />,
  payables: <Receipt className="w-4 h-4" />,
  salaries: <Banknote className="w-4 h-4" />,
  advances: <DollarSign className="w-4 h-4" />,
  settlement: <Scale className="w-4 h-4" />,
  loans: <PiggyBank className="w-4 h-4" />,
  reconciliation: <FileCheck className="w-4 h-4" />,
  reports: <BarChart3 className="w-4 h-4" />,
  security: <ShieldCheck className="w-4 h-4" />,
};

export const FinanceLayout = ({ children, title = 'Finance Hub' }: FinanceLayoutProps) => {
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
    { name: 'Hub', path: '/finance', icon: ICONS.dashboard, section: 'Overview', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Cash Book', path: '/finance/cash-book', icon: ICONS.cash, section: 'Money', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Receivables', path: '/finance/receivables', icon: ICONS.receivables, section: 'Money', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Payables', path: '/finance/payables', icon: ICONS.payables, section: 'Money', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Salaries', path: '/finance/salaries', icon: ICONS.salaries, section: 'People', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Staff Advances', path: '/finance/advances', icon: ICONS.advances, section: 'People', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Final Settlement', path: '/finance/settlement', icon: ICONS.settlement, section: 'People', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Loans', path: '/finance/loans', icon: ICONS.loans, section: 'Capital', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Recurring Invoices', path: '/finance/recurring-invoices', icon: ICONS.payables, section: 'Capital', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Reconciliations', path: '/finance/reconciliations', icon: ICONS.reconciliation, section: 'Controls', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'Reports', path: '/finance/reports', icon: ICONS.reports, section: 'Controls', roles: ['super_admin', 'branch_manager', 'finance_manager'] },
    { name: 'My Security', path: '/settings/security', icon: ICONS.security, section: 'Account', roles: ['super_admin', 'branch_manager', 'cashier', 'auditor', 'marketer', 'finance_manager'] },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
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
    if (path === '/finance') {
      return location.pathname === '/finance';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const renderNavigation = (onNavigate?: () => void) => (
    <div className="space-y-4">
      {navSections.map((section) => (
        <div key={section.name}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                    className={`group flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 shadow-xs'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`transition-colors duration-150 ${
                        isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.name}</span>
                    {isActive ? (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50" />
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
    <div className="h-dvh overflow-hidden bg-slate-950">
      <ConnectionStatus />
      <OfflineNotification />
      <PWAUpdatePrompt />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 bg-slate-900/95 border-r border-white/[0.08] backdrop-blur-xl flex-col pt-safe-top shadow-2xl">
        <div className="p-4 border-b border-white/[0.08]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950 font-bold">
              <Wallet className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-slate-100 font-bold text-sm tracking-tight truncate">CAREFARM FINANCE</h2>
              <p className="text-xs text-slate-400 truncate">{selectedBranch?.name || 'All Branches'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">{renderNavigation()}</nav>

        <div className="p-3 border-t border-white/[0.08] pb-safe-bottom">
          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-bold text-xs shadow-xs">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-xs font-medium truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-slate-400 truncate capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="mt-2 w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-200 lg:hidden ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900/98 border-r border-white/[0.08] backdrop-blur-xl flex flex-col transform transition-transform duration-200 lg:hidden pt-safe-top shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 shadow-md">
              <Wallet className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-slate-100 font-bold text-sm tracking-tight truncate">CAREFARM FINANCE</h2>
              <p className="text-[11px] text-slate-400 truncate">{selectedBranch?.name || 'All Branches'}</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {renderNavigation(() => setIsMobileMenuOpen(false))}
        </nav>

        <div className="p-3 border-t border-white/[0.08] pb-safe-bottom">
          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-bold text-xs shadow-xs">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-xs font-medium truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-slate-400 truncate capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="mt-2 w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout? You will need to sign in again."
        confirmLabel="Logout"
        variant="danger"
      />

      {/* Main Content Area */}
      <div className="flex h-dvh min-w-0 flex-col bg-slate-950 lg:ml-64">
        <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 sm:px-6 lg:px-8 sticky top-0 z-20 pt-safe-top">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="hidden sm:block w-56">
                <BranchSelector />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-4">
            <PasskeySetupBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
