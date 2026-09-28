import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { POSSidebar } from './POSSidebar';
import { NotificationBell } from '../NotificationBell';
import { useBranchStore } from '../../stores/branch-store';
import apiClient from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { PWAUpdatePrompt } from '../ui/PWAUpdatePrompt';

import { usePOSSidebarStore } from '../../stores/pos-sidebar-store';
import { AdminLayoutContext } from '../AdminLayout';

interface POSLayoutContextType {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  isInPOSLayout: boolean;
}

export const POSLayoutContext = createContext<POSLayoutContextType>({
  isMobileMenuOpen: false,
  setIsMobileMenuOpen: () => {},
  toggleMobileMenu: () => {},
  isInPOSLayout: false,
});

export const usePOSLayout = () => useContext(POSLayoutContext);

interface POSLayoutProps {
  children?: ReactNode;
  title?: string;
  hideHeader?: boolean;
}

export const POSLayout = ({ children, title, hideHeader = false }: POSLayoutProps) => {
  const location = useLocation();
  const adminContext = useContext(AdminLayoutContext);
  const parentPOS = useContext(POSLayoutContext);

  const { isOpen: isMobileMenuOpen, setIsOpen: setIsMobileMenuOpen, toggleSidebar: toggleMobileMenu } = usePOSSidebarStore();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);

  // If inside AdminLayout or an /admin/ route, step aside completely and render contents directly!
  if (adminContext.isInAdminLayout || location.pathname.startsWith('/admin/')) {
    return <>{children || <Outlet />}</>;
  }

  // If already inside an outer POSLayout, don't duplicate layout
  if (parentPOS.isInPOSLayout) {
    return <>{children || <Outlet />}</>;
  }

  // Re-fetch branch from API to ensure currencyCode is up-to-date
  // (handles stale localStorage from before currencyCode was added)
  const { data: freshBranch } = useQuery({
    queryKey: queryKeys.branches.detail(selectedBranch?._id ?? ''),
    queryFn: async () => {
      if (!selectedBranch?._id) return null;
      const response = await apiClient.get(`/branches/${selectedBranch._id}`);
      return response.data?.data ?? response.data;
    },
    enabled: !!selectedBranch?._id,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (freshBranch?.currencyCode && freshBranch.currencyCode !== selectedBranch?.currencyCode) {
      setSelectedBranch({ ...selectedBranch, ...freshBranch });
    }
  }, [freshBranch, selectedBranch, setSelectedBranch]);

  if (!selectedBranch) {
    return (
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center pt-safe-top">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">No Branch Selected</h2>
          <p className="text-gray-400">Please select a branch to use the POS terminal</p>
        </div>
      </div>
    );
  }

  return (
    <POSLayoutContext.Provider value={{ isMobileMenuOpen, setIsMobileMenuOpen, toggleMobileMenu, isInPOSLayout: true }}>
      <div className="h-dvh overflow-hidden bg-slate-950 flex flex-col">
        <PWAUpdatePrompt />
        <POSSidebar isMobileOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden lg:ml-64">
          {/* Mobile In-flow Header for Subpages */}
          {!hideHeader && (
            <header className="lg:hidden shrink-0 bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 flex items-center justify-between gap-3 pt-safe-top z-20">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors active:scale-95"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-slate-100 tracking-tight truncate">
                    {title || selectedBranch?.name || 'Carefarm POS'}
                  </h1>
                  <p className="text-[11px] text-slate-400 truncate">
                    {selectedBranch?.name ? `${selectedBranch.name} · Terminal` : 'POS Terminal'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <NotificationBell />
              </div>
            </header>
          )}

          <main className={`flex-1 min-h-0 overflow-auto ${hideHeader ? 'pt-safe-top' : ''}`}>
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </POSLayoutContext.Provider>
  );
};
