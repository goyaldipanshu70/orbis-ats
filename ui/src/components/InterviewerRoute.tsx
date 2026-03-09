import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function InterviewerRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, canAccessInterviews } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessInterviews()) return <Navigate to="/" replace />;

  return <>{children}</>;
}
