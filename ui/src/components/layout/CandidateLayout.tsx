import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Zap, LayoutDashboard, Briefcase, Settings, LogOut, ChevronDown,
  Sparkles, User, Bell,
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

interface CandidateLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/my-applications' },
  { icon: Briefcase, label: 'Browse Jobs', path: '/careers' },
  { icon: Sparkles, label: 'AI Assessment', path: '/ai-assessment' },
  { icon: User, label: 'My Profile', path: '/candidate/profile' },
];

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openedViaKeyboard = useRef(false);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Auto-focus first menu item when opened via keyboard
  useEffect(() => {
    if (userMenuOpen && openedViaKeyboard.current) {
      const id = setTimeout(() => {
        menuItemRefs.current.filter(Boolean)[0]?.focus();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [userMenuOpen]);

  // Close user menu on outside click
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

  // Reset refs on render to avoid stale entries
  menuItemRefs.current = [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded"
        style={{ background: '#1B8EE5', color: 'hsl(var(--foreground))' }}
      >
        Skip to main content
      </a>
      {/* Top navigation */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14"
        style={{ background: 'var(--orbis-overlay)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--orbis-border)' }}
      >
        <div className="flex items-center h-full px-4 gap-1">
          {/* Logo */}
          <button
            onClick={() => navigate('/my-applications')}
            aria-label="Go to my applications"
            className="flex items-center gap-2.5 mr-8 shrink-0 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              <Zap aria-hidden="true" className="h-[18px] w-[18px] text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight transition-colors">
                Orbis
              </span>
              <span className="text-[10px] text-slate-500 ml-2">Candidate Portal</span>
            </div>
          </button>

          {/* Nav items */}
          <nav aria-label="Main navigation" className="flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  isActive(item.path)
                    ? 'text-white bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {/* User menu */}
          <div
            ref={userMenuRef}
            className="relative"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && userMenuOpen) { setUserMenuOpen(false); triggerRef.current?.focus(); }
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!userMenuOpen) { openedViaKeyboard.current = true; setUserMenuOpen(true); return; }
                const items = menuItemRefs.current.filter(Boolean);
                const idx = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = ((idx < 0 ? 0 : idx + 1) % items.length + items.length) % items.length;
                items[next]?.focus();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!userMenuOpen) { openedViaKeyboard.current = true; setUserMenuOpen(true); return; }
                const items = menuItemRefs.current.filter(Boolean);
                const idx = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = ((idx < 0 ? items.length - 1 : idx - 1) % items.length + items.length) % items.length;
                items[next]?.focus();
              } else if ((e.key === 'Enter' || e.key === ' ') && !userMenuOpen) {
                e.preventDefault();
                openedViaKeyboard.current = true;
                setUserMenuOpen(true);
              } else if (e.key === 'Tab') {
                setUserMenuOpen(false);
              }
            }}
          >
            <button
              ref={triggerRef}
              onClick={() => {
                openedViaKeyboard.current = false;
                setUserMenuOpen(prev => !prev);
              }}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label="User menu"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <span className="text-sm text-slate-300 hidden sm:block">{user?.first_name}</span>
              <ChevronDown aria-hidden="true" className={cn(
                'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                userMenuOpen && 'rotate-180'
              )} />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                  role="menu"
                  aria-label="User menu"
                  className="absolute top-full right-0 mt-1 w-52 rounded-xl overflow-hidden z-50"
                  style={dropdownStyle}
                >
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--orbis-hover)' }}>
                    <p className="text-sm font-semibold text-white">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-slate-500">Candidate</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      ref={el => { menuItemRefs.current[0] = el; }}
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => { navigate('/account-settings'); setUserMenuOpen(false); }}
                      className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5 focus:bg-white/5 focus:outline-none transition-colors"
                    >
                      <Settings aria-hidden="true" className="h-4 w-4 text-slate-400" />
                      Settings
                    </button>
                    <button
                      ref={el => { menuItemRefs.current[1] = el; }}
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:outline-none transition-colors"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="pt-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
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
