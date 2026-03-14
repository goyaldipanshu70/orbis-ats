import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Zap, FileText, Briefcase, Users, Settings, LogOut, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

const dropdownStyle: React.CSSProperties = {
  background: 'var(--orbis-dropdown)',
  backdropFilter: 'blur(16px)',
  border: '1px solid var(--orbis-border)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};

interface ManagerLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: FileText, label: 'My Requisitions', path: '/manager/requisitions' },
  { icon: Briefcase, label: 'Browse Jobs', path: '/manager/jobs' },
  { icon: Users, label: 'My Team', path: '/manager/team' },
];

export default function ManagerLayout({ children }: ManagerLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14"
        style={{ background: 'var(--orbis-overlay)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--orbis-border)' }}
      >
        <div className="flex items-center h-full px-4 gap-1">
          <button
            onClick={() => navigate('/manager/requisitions')}
            className="flex items-center gap-2.5 mr-8 shrink-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              <Zap className="h-[18px] w-[18px] text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight">Orbis</span>
              <span className="text-[10px] text-slate-500 ml-2">Manager Portal</span>
            </div>
          </button>

          <nav className="flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  isActive(item.path) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <span className="text-sm text-slate-300 hidden sm:block">{user?.first_name}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform duration-200', userMenuOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 w-52 rounded-xl overflow-hidden z-50"
                  style={dropdownStyle}
                >
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--orbis-hover)' }}>
                    <p className="text-sm font-semibold text-white">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-slate-500">Department Manager</p>
                  </div>
                  <div className="p-1.5">
                    <button onClick={() => { navigate('/account-settings'); setUserMenuOpen(false); }} className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5 transition-colors">
                      <Settings className="h-4 w-4 text-slate-400" /> Settings
                    </button>
                    <button onClick={() => { logout(); setUserMenuOpen(false); }} className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="pt-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="p-6 lg:p-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
