import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';

export const UnauthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 pt-safe-top">
      <div className="max-w-md w-full p-8 text-center">
        <div className="rounded-full bg-red-500/20 p-4 inline-block mb-4">
          <svg
            className="w-12 h-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-6">
          You don't have permission to access this page.
        </p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    </div>
  );
};
