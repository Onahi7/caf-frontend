import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Clock,
  Receipt,
  RotateCcw,
  Users,
  CreditCard,
  BarChart3,
  Package,
  ShieldCheck,
  Menu,
  X,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NotificationBell } from '../NotificationBell';

interface Shift {
  _id: string;
  status: 'open' | 'closed';
  openedAt: string;
  openingCash: number;
  totalSales?: number;
}

export const POSSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { showError } = useToast();
  const dashboardPath =
    user?.role === 'branch_manager' || user?.role === 'super_admin' || user?.role === 'auditor'
      ? '/admin/dashboard'
      : '/pos';

  // Get current shift
  const { data: currentShift } = useQuery({
    queryKey: queryKeys.shifts.current({
      branchId: getBranchId(selectedBranch),
      cashierId: user?.id,
    }),
    queryFn: async () => {
      const response = await apiClient.get('/shifts/current', {
        params: { branchId: getBranchId(selectedBranch), cashierId: user?.id },
      });
      return unwrapResponse(response.data, {} as Shift);
    },
    enabled: !!getBranchId(selectedBranch) && !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const menuItems = [
    {
      id: 'pos',
      label: 'Point of Sale',
      icon: <ShoppingCart className="w-5 h-5" />,
      path: '/pos',
    },
    {
      id: 'shifts',
      label: 'Shift Management',
      icon: <Clock className="w-5 h-5" />,
      path: '/pos/shifts',
      badge: currentShift?.status === 'open' ? 'Active' : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: <Receipt className="w-5 h-5" />,
      path: '/pos/transactions',
    },
    {
      id: 'returns',
      label: 'Returns',
      icon: <RotateCcw className="w-5 h-5" />,
      path: '/pos/returns',
      roles: ['branch_manager', 'super_admin', 'auditor'],
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: <Users className="w-5 h-5" />,
      path: '/pos/customers',
    },
    {
      id: 'credit-sales',
      label: 'Credit Sales',
      icon: <CreditCard className="w-5 h-5" />,
      path: '/admin/sales/credit',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <BarChart3 className="w-5 h-5" />,
      path: '/admin/reports',
    },
    {
      id: 'catalog',
      label: 'Product Catalog',
      icon: <Package className="w-5 h-5" />,
      path: '/pos/catalog',
    },
    {
      id: 'settings',
      label: 'Security Settings',
      icon: <ShieldCheck className="w-5 h-5" />,
      path: '/settings/security',
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const cashierMenuItems = new Set([
    'pos',
    'shifts',
    'transactions',
    'customers',
    'credit-sales',
    'reports',
    'catalog',
    'settings',
  ]);

  const hasAccess = (item: typeof menuItems[0]) => {
    if (user?.role === 'cashier') {
      return cashierMenuItems.has(item.id);
    }

    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="lg:hidden fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50 w-12 h-12 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800 transition-all shadow-xl active:scale-95"
        aria-label="Toggle navigation menu"
      >
        {isExpanded ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>

      {/* Mobile floating notification bell */}
      <div className="lg:hidden fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50">
        <NotificationBell />
      </div>

      {/* Overlay for mobile */}
      {isExpanded && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 animate-fade-in"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 lg:z-30
          w-64 bg-slate-900/95 border-r border-white/[0.08] backdrop-blur-xl
          transform transition-transform duration-300 ease-in-out
          ${isExpanded ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col shadow-2xl
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] pt-safe-top">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950">
              <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-slate-100 font-bold text-sm tracking-tight truncate">CAREFARM POS</h2>
              <p className="text-xs text-slate-400 truncate">{selectedBranch?.name || 'Main Branch'}</p>
            </div>
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            if (!hasAccess(item)) return null;
            const active = isActive(item.path);

            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(item.path);
                  setIsExpanded(false);
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                  transition-all duration-150 group text-left
                  ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 shadow-xs'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                  }
                `}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={active ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200 transition-colors'}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-3 border-t border-white/[0.08] pb-safe-bottom">
          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-bold text-xs shadow-xs">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-xs font-medium truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-slate-400 capitalize truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate(dashboardPath)}
              className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          try {
            await apiClient.post('/auth/logout');
          } catch (error) {
            console.error('Logout error:', error);
            showError('Logout failed. Please try again.');
          } finally {
            useAuthStore.getState().clearAuth();
            navigate('/login');
          }
        }}
        title="Logout"
        message="Are you sure you want to logout? You will need to sign in again."
        confirmLabel="Logout"
        variant="danger"
      />
    </>
  );
};
