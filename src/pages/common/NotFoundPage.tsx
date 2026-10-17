import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { getDefaultRouteForRole } from '../../lib/role-routes';

export const NotFoundPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const homePath = getDefaultRouteForRole(user?.role);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 pt-safe-top">
      <div className="max-w-md w-full p-8 text-center">
        <h1 className="text-6xl font-bold text-emerald-500 mb-2">404</h1>
        <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-slate-400 mb-6">
          The page you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate(homePath)}>Go Home</Button>
      </div>
    </div>
  );
};
