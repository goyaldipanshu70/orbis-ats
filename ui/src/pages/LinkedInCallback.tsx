
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const LinkedInCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokenAndFetchUser, user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      setTokenAndFetchUser(token)
        .catch(() => {
          toast({
            title: 'Error',
            description: 'Failed to log in with LinkedIn. Please try again.',
            variant: 'destructive',
          });
          navigate('/login');
        })
        .finally(() => {
          setIsProcessing(false);
        });
    } else {
      toast({
        title: 'Error',
        description: 'LinkedIn login failed. No token received.',
        variant: 'destructive',
      });
      navigate('/login');
      setIsProcessing(false);
    }
  }, [searchParams, navigate, setTokenAndFetchUser, toast]);

  useEffect(() => {
    if (!isProcessing && user) {
      toast({
        title: 'Success',
        description: 'Logged in successfully with LinkedIn.',
      });
      navigate('/', { replace: true });
    }
  }, [isProcessing, user, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-blue-50 to-sky-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-lg text-foreground font-medium">
          Finalizing your LinkedIn login...
        </p>
      </div>
    </div>
  );
};

export default LinkedInCallback;
