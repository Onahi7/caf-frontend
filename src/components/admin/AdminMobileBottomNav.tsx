import { Bell, LayoutDashboard, Package, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

interface AdminMobileBottomNavProps {
  active: 'overview' | 'inventory' | 'sales';
}

export function AdminMobileBottomNav({ active }: AdminMobileBottomNavProps) {
  const userRole = useAuthStore((state) => state.user?.role);
  const dashboardPath = userRole === 'super_admin' ? '/admin/hq-dashboard' : '/admin/dashboard';

  const itemClass = (isActive: boolean) =>
    `flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent-green/60 ${
      isActive
        ? 'bg-accent-green/10 font-semibold text-accent-green'
        : 'font-medium text-gray-400 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-primary-darker/95 px-2 pb-safe-bottom pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:hidden"
    >
      <Link
        to={dashboardPath}
        aria-current={active === 'overview' ? 'page' : undefined}
        className={itemClass(active === 'overview')}
      >
        <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
        Overview
      </Link>
      <Link
        to="/admin/inventory"
        aria-current={active === 'inventory' ? 'page' : undefined}
        className={itemClass(active === 'inventory')}
      >
        <Package className="h-5 w-5" aria-hidden="true" />
        Inventory
      </Link>
      <Link
        to="/admin/sales"
        aria-current={active === 'sales' ? 'page' : undefined}
        className={itemClass(active === 'sales')}
      >
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        Sales
      </Link>
      <button
        type="button"
        onClick={() => document.getElementById('notification-bell-button')?.click()}
        className={itemClass(false)}
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        Alerts
      </button>
    </nav>
  );
}
