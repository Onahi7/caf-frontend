import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface HeaderProps {
  title: string;
  showNav?: boolean;
}

export const Header = ({ title, showNav = false }: HeaderProps) => {
  const { user, logout } = useAuth();
  const { showError } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      showError('Logout failed. Please try again.');
      setIsLoggingOut(false);
    }
  };

  const getRoleDisplay = (role: string) => {
    return role
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const navLinks = [
    { path: '/admin/dashboard', label: 'Dashboard', roles: ['super_admin', 'branch_manager', 'auditor'] },
    { path: '/pos', label: 'POS', roles: ['cashier', 'branch_manager', 'super_admin', 'auditor'] },
    { path: '/admin/branches', label: 'Branches', roles: ['super_admin'] },
    { path: '/admin/users', label: 'Users', roles: ['super_admin', 'branch_manager'] },
    { path: '/admin/products', label: 'Products', roles: ['super_admin', 'branch_manager'] },
  ];

  const filteredNavLinks = navLinks.filter(link => 
    link.roles.includes(user?.role || '')
  );

  return (
    <header className="bg-slate-900/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-20 pt-safe-top">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          </div>
          
          <div className="flex items-center gap-6">
            {user && (
              <div className="text-right hidden sm:block">
                <p className="text-white font-medium text-sm">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-emerald-500 font-medium tracking-wide uppercase">
                  {getRoleDisplay(user.role)}
                </p>
              </div>
            )}
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
              isLoading={isLoggingOut}
              disabled={isLoggingOut}
              className="!border-white/10 hover:!border-white/20 hover:!bg-white/5 !text-slate-300 hover:!text-white"
            >
              Logout
            </Button>
          </div>
        </div>
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

      {/* Navigation */}
      {showNav && filteredNavLinks.length > 0 && (
        <nav className="px-6 py-2 border-t border-white/5 bg-black/20">
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {filteredNavLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  location.pathname === link.path
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

