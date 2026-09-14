import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  ShieldCheck,
  LogOut,
  Megaphone,
} from 'lucide-react';
import apiClient from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { useBranchStore } from '../stores/branch-store';
import { PasskeySetupBanner } from './account';
import { PWAUpdatePrompt } from './ui/PWAUpdatePrompt';
import { NotificationBell } from './NotificationBell';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface MarketerLayoutProps {
  children: ReactNode;
  title?: string;
}

export const MarketerLayout = ({ children, title = 'Marketer Dashboard' }: MarketerLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { selectedBranch } = useBranchStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: '/marketer/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      name: 'Review',
      path: '/marketer/review',
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      name: 'Sell',
      path: '/marketer/sales',
      icon: <ShoppingCart className="w-4 h-4" />,
    },
    {
      name: 'Settings',
      path: '/settings/security',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <PWAUpdatePrompt />

      {/* Modern Top Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.08] sticky top-0 z-30 pt-safe-top">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20 shrink-0">
              <Megaphone className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-100 tracking-tight truncate">CAREFARM FIELD</h1>
              <p className="text-[11px] text-slate-400 truncate">
                {selectedBranch?.name || 'All Branches'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />

            <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-bold text-xs shadow-xs shrink-0">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="hidden sm:block text-left min-w-0 pr-1">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] text-slate-400 capitalize truncate">Marketer</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        {/* Sleek Segmented Pill Navigation */}
        <nav className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-900/90 backdrop-blur-md border border-white/[0.08] rounded-2xl shadow-lg">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <main className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">{title}</h2>
          </div>

          <PasskeySetupBanner />

          {children}
        </main>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout? You will need to sign in again."
        confirmLabel="Logout"
        variant="danger"
      />
    </div>
  );
};
