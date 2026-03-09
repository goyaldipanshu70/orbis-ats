
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'hr' | 'hiring_manager' | 'interviewer' | 'candidate';
  avatar_url?: string;
  picture?: string;
  phone?: string;
  location?: string;
  current_role?: string;
  resume_url?: string;
  profile_complete?: boolean;
  created_at: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithLinkedIn: () => Promise<void>;
  signup: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  signupAsCandidate: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void> | void;
  isAdmin: () => boolean;
  isCandidate: () => boolean;
  isHR: () => boolean;
  isHiringManager: () => boolean;
  isInterviewer: () => boolean;
  canAccessHiring: () => boolean;
  canAccessInterviews: () => boolean;
  setTokenAndFetchUser: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const fetchUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        if (userData.picture) {
          userData.avatar_url = userData.picture;
        }
        setUser(userData);
      } else {
        console.error('Failed to fetch user, logging out.');
        logout();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    }
  };

  const checkUser = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('access_token');
    if (token) {
      await fetchUser();
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    await fetchUser();
  };

  const loginWithGoogle = async () => {
    window.location.href = `${API_BASE_URL}/api/auth/google/login`;
  };

  const loginWithLinkedIn = async () => {
    window.location.href = `${API_BASE_URL}/api/auth/linkedin/login`;
  };

  const signup = async (firstName: string, lastName: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        role: 'hr'
      }),
    });

    if (!response.ok) {
      throw new Error('Signup failed');
    }
  };

  const signupAsCandidate = async (firstName: string, lastName: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup/candidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Candidate signup failed');
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    await fetchUser();
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch { /* ignore */ }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAdmin = () => user?.role === 'admin';
  const isCandidate = () => user?.role === 'candidate';
  const isHR = () => user?.role === 'hr';
  const isHiringManager = () => user?.role === 'hiring_manager';
  const isInterviewer = () => user?.role === 'interviewer';
  const canAccessHiring = () => !!user && ['admin', 'hr', 'hiring_manager'].includes(user.role);
  const canAccessInterviews = () => !!user && ['admin', 'hr', 'hiring_manager', 'interviewer'].includes(user.role);

  const setTokenAndFetchUser = async (token: string) => {
    localStorage.setItem('access_token', token);
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      loginWithGoogle,
      loginWithLinkedIn,
      signup,
      signupAsCandidate,
      logout,
      isAdmin,
      isCandidate,
      isHR,
      isHiringManager,
      isInterviewer,
      canAccessHiring,
      canAccessInterviews,
      setTokenAndFetchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
