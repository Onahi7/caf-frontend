import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { type User } from '../stores/auth-store';
import { Loading } from './ui/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: User['role'][];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user, accessToken, hasHydrated } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 pt-safe-top">
        <Loading />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user || !accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
