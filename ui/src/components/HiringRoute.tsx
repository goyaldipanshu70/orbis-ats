import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface HiringRouteProps {
  children: React.ReactNode;
}

export default function HiringRoute({ children }: HiringRouteProps) {
  const { user, isLoading, canAccessHiring } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-lg text-gray-700 font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessHiring()) return <Navigate to="/my-applications" replace />;

  return <>{children}</>;
}
