import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Zap, FileText, User, Briefcase, Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { createContext, useContext, useState } from 'react';

interface CandidateLayoutProps {
  children: ReactNode;
}

const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}>({ collapsed: false, setCollapsed: () => {} });

const navItems = [
  { icon: FileText, label: 'My Applications', path: '/my-applications' },
  { icon: Briefcase, label: 'Browse Jobs', path: '/careers' },
  { icon: Settings, label: 'Account', path: '/account-settings' },
];

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex min-h-screen bg-muted">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-800 bg-[#0B1120] text-white transition-all duration-300',
            collapsed ? 'w-[68px]' : 'w-[240px]'
          )}
        >
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm font-bold tracking-tight text-white">Orbis</p>
                  <p className="text-[10px] text-slate-400">Candidate Portal</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Menu
              </p>
            )}
            {navItems.map(item => {
              const active = isActive(item.path);
              const btn = (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mb-1',
                    active
                      ? 'text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="candidate-nav-indicator"
                      className="absolute inset-0 rounded-lg bg-blue-600/15"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn('relative z-10 h-4.5 w-4.5 shrink-0', active ? 'text-blue-400' : 'text-slate-500 group-hover:text-white')} />
                  {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
                </button>
              );
              if (collapsed) {
                return (
                  <Tooltip key={item.path} delayDuration={0}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return btn;
            })}
          </nav>

          {/* User profile */}
          <div className="border-t border-slate-800 p-3">
            <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium text-white">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">Candidate</p>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={logout}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-[#0B1120] text-slate-400 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </aside>

        {/* Main Content */}
        <main
          className="flex-1 transition-all duration-300"
          style={{ marginLeft: collapsed ? 68 : 240 }}
        >
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
    </SidebarContext.Provider>
  );
}
