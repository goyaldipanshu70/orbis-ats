import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ManagerRouteProps {
  children: ReactNode;
}

const ManagerRoute = ({ children }: ManagerRouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--orbis-page)' }}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-[#1B8EE5] border-t-transparent rounded-full animate-spin" />
          <div className="text-lg text-slate-400 font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'manager' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ManagerRoute;
