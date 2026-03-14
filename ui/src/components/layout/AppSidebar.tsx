import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from './AppLayout';
import { apiClient } from '@/utils/api';
import {
  LayoutDashboard, Bot, Settings, Shield, BarChart3,
  LogOut, Zap, Plus, FileText, UserCheck, Workflow, Calendar, Users, Briefcase,
  Megaphone, ClipboardCheck, Share2, Mail, ShieldCheck,
  GitPullRequest, FileStack, Globe2, Target, Inbox, Activity,
  Pin, PinOff, Blocks,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
  adminOnly?: boolean;
  section: string;
  hrOnly?: boolean;
}

const navItems: NavItem[] = [
  // ── Overview ──
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', section: 'Overview' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', section: 'Overview' },
  { icon: Activity, label: 'People Analytics', path: '/people-analytics', section: 'Overview', hrOnly: true },

  // ── Recruitment ──
  { icon: Briefcase, label: 'Jobs', path: '/jobs', section: 'Recruitment' },
  { icon: UserCheck, label: 'Talent Pool', path: '/talent-pool', section: 'Recruitment' },
  { icon: Calendar, label: 'My Interviews', path: '/interviews', section: 'Recruitment' },
  { icon: Users, label: 'Interviewers', path: '/interviewers', section: 'Recruitment', hrOnly: true },
  { icon: GitPullRequest, label: 'Job Requests', path: '/job-requests', section: 'Recruitment' },
  { icon: Share2, label: 'Referrals', path: '/referrals', section: 'Recruitment' },

  // ── Sourcing ──
  { icon: Mail, label: 'Outreach', path: '/outreach', section: 'Sourcing', hrOnly: true },
  { icon: Target, label: 'Lead Generation', path: '/lead-generation', section: 'Sourcing', hrOnly: true },
  { icon: Inbox, label: 'Inbox Capture', path: '/inbox-capture', section: 'Sourcing', hrOnly: true },
  { icon: Globe2, label: 'Job Portals', path: '/job-portals', section: 'Sourcing', adminOnly: true },

  // ── AI & Tools ──
  { icon: Bot, label: 'Hiring Assistant', path: '/hiring-assistant', section: 'AI & Tools' },
  { icon: Workflow, label: 'AI Workflows', path: '/workflows', section: 'AI & Tools', hrOnly: true },
  { icon: Blocks, label: 'Node Library', path: '/workflows/nodes', section: 'AI & Tools', hrOnly: true },
  { icon: FileStack, label: 'JD Templates', path: '/jd-templates', section: 'AI & Tools', hrOnly: true },
  { icon: FileText, label: 'Templates', path: '/templates', section: 'AI & Tools', hrOnly: true },

  // ── Company ──
  { icon: Megaphone, label: 'Announcements', path: '/announcements', section: 'Company', hrOnly: true },
  { icon: ClipboardCheck, label: 'Onboarding', path: '/onboarding', section: 'Company', hrOnly: true },
  { icon: ShieldCheck, label: 'Compliance', path: '/compliance', section: 'Company', hrOnly: true },

  // ── Settings ──
  { icon: Workflow, label: 'AI Orchestrator', path: '/admin/orchestrator', adminOnly: true, section: 'Settings' },
  { icon: Shield, label: 'Admin Panel', path: '/admin', adminOnly: true, section: 'Settings' },
  { icon: Shield, label: 'Roles & Permissions', path: '/admin/roles', adminOnly: true, section: 'Settings' },
  { icon: Settings, label: 'Settings', path: '/account-settings', section: 'Settings' },
];

// Smooth spring config for sidebar width animation
const sidebarTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 35,
  mass: 0.8,
};

// Fade transition for text labels
const labelTransition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1] as const,
};

export default function AppSidebar() {
  const { collapsed, setCollapsed, autoHide, setAutoHide, pinned, setPinned, navGuardActive } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isHR } = useAuth();

  // Announcement badge count — track "last seen" via localStorage
  const { data: announcementCount = 0 } = useQuery({
    queryKey: ['sidebar-announcement-count'],
    queryFn: async () => {
      try {
        const data = await apiClient.getAnnouncements(1, 50);
        const items = data?.items || [];
        const lastSeen = localStorage.getItem('last_seen_announcement_at');
        if (!lastSeen) return items.length;
        return items.filter((a: any) => new Date(a.created_at) > new Date(lastSeen)).length;
      } catch { return 0; }
    },
    staleTime: 60_000,
    enabled: (isAdmin() || isHR()),
  });

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/jobs') return location.pathname === '/jobs' || location.pathname.startsWith('/jobs/');
    return location.pathname.startsWith(path);
  };

  // Hide sidebar for candidates
  if (user?.role === 'candidate') return null;

  const filteredItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin()) return false;
    if (item.hrOnly && !isAdmin() && !isHR()) return false;
    if (user?.role === 'interviewer' && ['Recruitment', 'Sourcing', 'AI & Tools'].includes(item.section) && item.path !== '/interviews') return false;
    if (user?.role === 'interviewer' && item.section === 'Company') return false;
    return true;
  });
  const itemsWithBadges = filteredItems.map(item => {
    if (item.path === '/announcements' && announcementCount > 0) {
      return { ...item, badge: announcementCount };
    }
    return item;
  });
  const sections = [...new Set(itemsWithBadges.map(i => i.section))];

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 68 : 240 }}
      transition={sidebarTransition}
      className="fixed left-0 top-0 z-50 flex h-screen flex-col text-white will-change-[width]"
      style={{ overflow: 'hidden', background: 'var(--orbis-page)', borderRight: '1px solid var(--orbis-border)' }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
        <motion.div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <Zap className="h-5 w-5 text-white" />
        </motion.div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="logo-text"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={labelTransition}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-sm font-bold tracking-tight text-white">Orbis</p>
              <p className="text-[10px] text-slate-500">Applicant Tracking</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions */}
      <AnimatePresence>
        {!collapsed && user?.role !== 'interviewer' && (
          <motion.div
            key="quick-actions"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="px-3 pt-4 pb-2 overflow-hidden"
          >
            <button
              onClick={() => navigate('/jobs/create')}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-slate-400 transition-colors"
              style={{ borderColor: 'var(--orbis-border)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B8EE5'; e.currentTarget.style.color = '#4db5f0'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <Plus className="h-3.5 w-3.5" /> New Job Posting
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-thin">
        {sections.map(section => (
          <div key={section} className="mb-4">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  key={`section-${section}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={labelTransition}
                  className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap"
                >
                  {section}
                </motion.p>
              )}
            </AnimatePresence>
            {itemsWithBadges
              .filter(item => item.section === section)
              .map(item => {
                const active = isActive(item.path);
                const btn = (
                  <motion.button
                    key={item.path + item.label}
                    onClick={() => { if (!navGuardActive) navigate(item.path); }}
                    whileHover={navGuardActive ? undefined : { x: 2 }}
                    whileTap={navGuardActive ? undefined : { scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={navGuardActive ? { pointerEvents: 'none' } : undefined}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 overflow-hidden',
                      active
                        ? 'text-blue-400'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-lg"
                        style={{ background: 'rgba(27,142,229,0.12)' }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    {!active && (
                      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--orbis-card)' }} />
                    )}
                    <item.icon className={cn('relative z-10 h-4.5 w-4.5 shrink-0 transition-colors duration-150', active ? 'text-blue-400' : 'text-slate-500 group-hover:text-white')} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          key={`label-${item.path}`}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={labelTransition}
                          className="relative z-10 truncate whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {!collapsed && item.badge !== undefined && (
                        <motion.span
                          key={`badge-${item.path}`}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="relative z-10 ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: 'rgba(27,142,229,0.15)', color: '#4db5f0' }}
                        >
                          {item.badge}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
                return (
                    <Tooltip key={item.path + item.label} delayDuration={300}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      {collapsed && (
                        <TooltipContent side="right" sideOffset={8} className="text-white text-xs px-2 py-1" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
              })}
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="p-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                key="user-info"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={labelTransition}
                className="flex-1 overflow-hidden whitespace-nowrap"
              >
                <p className="truncate text-xs font-medium text-white">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="truncate text-[10px] text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                key="logout-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={labelTransition}
                onClick={logout}
                className="rounded-md p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pin / Auto-hide toggle */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <motion.button
            onClick={() => {
              if (autoHide) {
                setPinned(true);
                setAutoHide(false);
                setCollapsed(false);
              } else {
                setPinned(false);
                setAutoHide(true);
              }
            }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className={cn(
              'absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
              pinned
                ? 'text-blue-400'
                : 'text-slate-400 hover:text-white'
            )}
            style={pinned
              ? { background: 'var(--orbis-page)', borderColor: 'rgba(27,142,229,0.5)', boxShadow: '0 0 8px rgba(27,142,229,0.3)' }
              : { background: 'var(--orbis-page)', borderColor: 'var(--orbis-border)' }
            }
          >
            {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-white text-xs" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          {pinned ? 'Unpin sidebar (enable auto-hide)' : 'Pin sidebar (disable auto-hide)'}
        </TooltipContent>
      </Tooltip>
    </motion.aside>
  );
}
