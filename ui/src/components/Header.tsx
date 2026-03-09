import { ArrowLeft, ChevronDown, Briefcase, MessageCircle, BookOpen, Settings, LogOut, User, DollarSign } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';

interface HeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

const verticals = [
  { label: 'Hiring', icon: Briefcase, path: '/dashboard', roles: ['admin', 'hr', 'hiring_manager'] as string[] },
  { label: 'Finance', icon: DollarSign, path: '/finance', roles: ['admin'] as string[], requiredDepartment: ['finance'] },
  { label: 'AI Chat', icon: MessageCircle, path: '/chat', roles: ['admin', 'hr', 'hiring_manager', 'interviewer'] as string[] },
  { label: 'Knowledge Chat', icon: BookOpen, path: '/rag-chat', roles: ['admin', 'hr', 'hiring_manager', 'interviewer'] as string[] },
];

const Header = ({ showBackButton = false, onBack }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, canAccessHiring } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname.startsWith('/jobs');
    return location.pathname.startsWith(path);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6 z-20">
      {/* Left: Logo + nav */}
      <div className="flex items-center gap-8">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {/* Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3fae] text-white shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2a10 10 0 0 1 7.39 16.74" />
              <path d="M12 2a10 10 0 0 0-7.39 16.74" />
              <path d="M12 22a10 10 0 0 1-7.39-16.74" />
              <path d="M12 22a10 10 0 0 0 7.39-16.74" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-foreground tracking-tight">Orbis</span>
            <span className="text-[10px] text-muted-foreground -mt-0.5">Org Intelligence</span>
          </div>
        </div>

        {/* Vertical navigation */}
        {user && (
          <nav className="hidden md:flex items-center h-14">
            {verticals.filter(v => {
              if (isAdmin()) return true;
              if (v.roles && !v.roles.includes(user.role)) return false;
              if (v.requiredDepartment) {
                if (!(user as any).department) return false;
                return v.requiredDepartment.includes((user as any).department);
              }
              return true;
            }).map(({ label, icon: Icon, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative flex h-14 items-center gap-1.5 px-4 text-sm font-medium transition-colors ${
                  isActive(path)
                    ? 'text-[#1e3fae] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#1e3fae]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Right: actions */}
      {user && (
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <NotificationBell />

          <div className="h-5 w-px bg-border" />

          {/* User chip with dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-muted/50 border border-transparent hover:border-border transition-all">
              <div className="h-7 w-7 rounded-full bg-[#1e3fae] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-xs font-semibold text-foreground leading-none">{user.first_name} {user.last_name}</span>
                <span className={`text-[10px] leading-none mt-0.5 font-medium ${{
                  admin: 'text-red-500',
                  hr: 'text-blue-500',
                  hiring_manager: 'text-purple-500',
                  interviewer: 'text-green-500',
                  candidate: 'text-amber-500',
                }[user.role] || 'text-muted-foreground'}`}>
                  {{
                    admin: 'Admin',
                    hr: 'HR',
                    hiring_manager: 'Hiring Manager',
                    interviewer: 'Interviewer',
                    candidate: 'Candidate',
                  }[user.role] || user.role}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {/* Dropdown menu */}
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-card rounded-xl border border-border shadow-lg py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => navigate('/account-settings')}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <User className="w-4 h-4 text-muted-foreground" />
                Account Settings
              </button>
              {isAdmin() && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Admin Panel
                </button>
              )}
              <div className="my-1 border-t border-border" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
