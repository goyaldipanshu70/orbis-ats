import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import { NotificationBell } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Bot, Settings, Shield, BarChart3,
  LogOut, Zap, Plus, FileText, UserCheck, Workflow, Calendar, Users, Briefcase,
  Megaphone, ClipboardCheck, Share2, Mail, ShieldCheck,
  GitPullRequest, FileStack, Globe2, Target, Inbox, Activity,
  ChevronDown, Blocks,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── dropdown glass styles ── */
const dropdownStyle: React.CSSProperties = {
  background: 'var(--orbis-dropdown)',
  backdropFilter: 'blur(16px)',
  border: '1px solid var(--orbis-border)',
  boxShadow: 'var(--orbis-dropdown-shadow)',
};
const iconBoxStyle: React.CSSProperties = {
  background: 'var(--orbis-input)',
};
const iconBoxHoverStyle: React.CSSProperties = {
  background: 'rgba(27,142,229,0.12)',
};

/* ── Types ── */
interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  description?: string;
  badge?: number;
  adminOnly?: boolean;
  hrOnly?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/* ── Navigation definition ── */
const navGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', description: 'Hiring metrics & overview' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics', description: 'Recruitment performance' },
      { icon: Activity, label: 'People Analytics', path: '/people-analytics', description: 'Workforce insights', hrOnly: true },
    ],
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    items: [
      { icon: Briefcase, label: 'Jobs', path: '/jobs', description: 'Manage job postings' },
      { icon: UserCheck, label: 'Talent Pool', path: '/talent-pool', description: 'Candidate database' },
      { icon: Calendar, label: 'My Interviews', path: '/interviews', description: 'Scheduled interviews' },
      { icon: Users, label: 'Interviewers', path: '/interviewers', description: 'Manage interviewers', hrOnly: true },
      { icon: GitPullRequest, label: 'Job Requests', path: '/job-requests', description: 'Hiring requisitions' },
      { icon: Share2, label: 'Referrals', path: '/referrals', description: 'Employee referral program' },
    ],
  },
  {
    id: 'sourcing',
    label: 'Sourcing',
    items: [
      { icon: Mail, label: 'Outreach', path: '/outreach', description: 'Email campaigns', hrOnly: true },
      { icon: Target, label: 'Lead Generation', path: '/lead-generation', description: 'Find candidates', hrOnly: true },
      { icon: Inbox, label: 'Inbox Capture', path: '/inbox-capture', description: 'Resume parsing', hrOnly: true },
      { icon: Globe2, label: 'Job Portals', path: '/job-portals', description: 'Portal integrations', adminOnly: true },
    ],
  },
  {
    id: 'ai-tools',
    label: 'AI & Tools',
    items: [
      { icon: Bot, label: 'Hiring Assistant', path: '/hiring-assistant', description: 'AI-powered help' },
      { icon: Workflow, label: 'AI Workflows', path: '/workflows', description: 'Automation pipelines', hrOnly: true },
      { icon: Blocks, label: 'Node Library', path: '/workflows/nodes', description: 'Custom workflow nodes', hrOnly: true },
      { icon: FileStack, label: 'JD Templates', path: '/jd-templates', description: 'Job description library', hrOnly: true },
      { icon: FileText, label: 'Templates', path: '/templates', description: 'Document templates', hrOnly: true },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    items: [
      { icon: Megaphone, label: 'Announcements', path: '/announcements', description: 'Team updates', hrOnly: true },
      { icon: ClipboardCheck, label: 'Onboarding', path: '/onboarding', description: 'New hire onboarding', hrOnly: true },
      { icon: ShieldCheck, label: 'Compliance', path: '/compliance', description: 'Policies & documents', hrOnly: true },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { icon: Workflow, label: 'AI Orchestrator', path: '/admin/orchestrator', description: 'AI model config', adminOnly: true },
      { icon: Shield, label: 'Admin Panel', path: '/admin', description: 'System administration', adminOnly: true },
      { icon: Settings, label: 'Settings', path: '/account-settings', description: 'Account preferences' },
    ],
  },
];

/* ── Dropdown component ── */
function NavDropdown({ group, isActive, onNavigate }: {
  group: NavGroup & { items: NavItem[] };
  isActive: boolean;
  onNavigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openedViaKeyboard = useRef(false);
  const skipNextEnterRef = useRef(false);

  const handleEnter = () => {
    if (skipNextEnterRef.current) { skipNextEnterRef.current = false; return; }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    openedViaKeyboard.current = false;
    setOpen(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handleClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    openedViaKeyboard.current = false;
    setOpen(prev => {
      if (prev) skipNextEnterRef.current = true;
      return !prev;
    });
  };

  const focusItem = (index: number) => {
    const items = itemRefs.current.slice(0, group.items.length).filter(Boolean);
    if (items.length === 0) return;
    const clamped = ((index % items.length) + items.length) % items.length;
    items[clamped]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { openedViaKeyboard.current = true; setOpen(true); return; }
      const items = itemRefs.current.slice(0, group.items.length).filter(Boolean);
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      focusItem(idx < 0 ? 0 : idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { openedViaKeyboard.current = true; setOpen(true); return; }
      const items = itemRefs.current.slice(0, group.items.length).filter(Boolean);
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      focusItem(idx < 0 ? items.length - 1 : idx - 1);
    } else if ((e.key === 'Enter' || e.key === ' ') && !open) {
      e.preventDefault();
      openedViaKeyboard.current = true;
      setOpen(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  // Reset itemRefs on render to avoid stale entries
  itemRefs.current = [];

  // Auto-focus first item when dropdown opens via keyboard
  useEffect(() => {
    if (open && openedViaKeyboard.current) {
      const id = setTimeout(() => {
        const items = itemRefs.current.slice(0, group.items.length).filter(Boolean);
        items[0]?.focus();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [open, group.items.length]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        onClick={handleClick}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
          isActive
            ? 'text-white bg-white/10'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        )}
      >
        {group.label}
        <ChevronDown aria-hidden="true" className={cn(
          'h-3.5 w-3.5 transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            role="menu"
            aria-label={group.label}
            className="absolute top-full left-0 mt-1 w-72 rounded-xl overflow-hidden z-50"
            style={dropdownStyle}
          >
            <div className="p-2">
              {group.items.map((item, i) => (
                <button
                  key={item.path}
                  ref={el => { itemRefs.current[i] = el; }}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => { onNavigate(item.path); setOpen(false); }}
                  className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-150 group hover:bg-white/5 focus:bg-white/5 focus:outline-none"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                    style={iconBoxStyle}
                    onMouseEnter={e => Object.assign(e.currentTarget.style, iconBoxHoverStyle)}
                    onMouseLeave={e => Object.assign(e.currentTarget.style, iconBoxStyle)}
                  >
                    <item.icon aria-hidden="true" className="h-[18px] w-[18px] text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(27,142,229,0.12)', color: '#1B8EE5' }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span className="text-xs text-slate-500 line-clamp-1">{item.description}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── User menu ── */
function UserMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openedViaKeyboard = useRef(false);
  const skipNextEnterRef = useRef(false);

  const handleEnter = () => {
    if (skipNextEnterRef.current) { skipNextEnterRef.current = false; return; }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    openedViaKeyboard.current = false;
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const focusMenuItem = (index: number) => {
    const items = menuItemRefs.current.filter(Boolean);
    if (items.length === 0) return;
    const clamped = ((index % items.length) + items.length) % items.length;
    items[clamped]?.focus();
  };

  // Auto-focus first menu item when opened via keyboard
  useEffect(() => {
    if (open && openedViaKeyboard.current) {
      const id = setTimeout(() => {
        menuItemRefs.current.filter(Boolean)[0]?.focus();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { openedViaKeyboard.current = true; setOpen(true); return; }
      const items = menuItemRefs.current.filter(Boolean);
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      focusMenuItem(idx < 0 ? 0 : idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { openedViaKeyboard.current = true; setOpen(true); return; }
      const items = menuItemRefs.current.filter(Boolean);
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      focusMenuItem(idx < 0 ? items.length - 1 : idx - 1);
    } else if ((e.key === 'Enter' || e.key === ' ') && !open) {
      e.preventDefault();
      openedViaKeyboard.current = true;
      setOpen(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  // Reset refs on render to avoid stale entries
  menuItemRefs.current = [];

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        onClick={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          openedViaKeyboard.current = false;
          setOpen(prev => { if (prev) skipNextEnterRef.current = true; return !prev; });
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="User menu"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <ChevronDown aria-hidden="true" className={cn(
          'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            role="menu"
            aria-label="User menu"
            className="absolute top-full right-0 mt-1 w-56 rounded-xl overflow-hidden z-50"
            style={dropdownStyle}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--orbis-hover)' }}>
              <p className="text-sm font-semibold text-white">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="p-1.5">
              <button
                ref={el => { menuItemRefs.current[0] = el; }}
                role="menuitem"
                tabIndex={-1}
                onClick={() => { navigate('/account-settings'); setOpen(false); }}
                className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5 focus:bg-white/5 focus:outline-none transition-colors"
              >
                <Settings aria-hidden="true" className="h-4 w-4 text-slate-400" />
                Settings
              </button>
              <button
                ref={el => { menuItemRefs.current[1] = el; }}
                role="menuitem"
                tabIndex={-1}
                onClick={() => { logout(); setOpen(false); }}
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
  );
}

/* ── Main TopNavbar ── */
export default function TopNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isHR } = useAuth();

  // Announcement badge
  const { data: announcementCount = 0 } = useQuery({
    queryKey: ['topnav-announcement-count'],
    queryFn: async () => {
      try {
        const data = await apiClient.getAnnouncements(1, 50);
        const items = data?.items || [];
        const lastSeen = localStorage.getItem('last_seen_announcement_at');
        if (!lastSeen) return items.length;
        const lastSeenDate = new Date(lastSeen);
        if (isNaN(lastSeenDate.getTime())) return items.length;
        return items.filter((a: any) => new Date(a.created_at) > lastSeenDate).length;
      } catch { return 0; }
    },
    staleTime: 60_000,
    enabled: !!user && user.role !== 'candidate' && (isAdmin() || isHR() || user.role === 'hiring_manager'),
  });

  // Hide for candidates
  if (user?.role === 'candidate') return null;

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (location.pathname.startsWith(path + '/')) {
      const allPaths = navGroups.flatMap(g => g.items.map(i => i.path));
      const moreSpecific = allPaths.some(p => p !== path && p.startsWith(path + '/') && (location.pathname === p || location.pathname.startsWith(p + '/')));
      return !moreSpecific;
    }
    return false;
  };

  // Filter groups by role
  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items
        .filter(item => {
          if (item.adminOnly && !isAdmin()) return false;
          if (item.hrOnly && !isAdmin() && !isHR()) return false;
          if (user?.role === 'interviewer') {
            if (['sourcing', 'company'].includes(group.id)) return false;
            if (group.id === 'overview' && item.path !== '/dashboard') return false;
            if (group.id === 'recruitment' && item.path !== '/interviews') return false;
            if (group.id === 'ai-tools' && item.path !== '/hiring-assistant') return false;
          }
          return true;
        })
        .map(item => {
          if (item.path === '/announcements' && announcementCount > 0) {
            return { ...item, badge: announcementCount };
          }
          return item;
        }),
    }))
    .filter(group => group.items.length > 0);

  // Check if any item in a group is active
  const isGroupActive = (group: NavGroup) =>
    group.items.some(item => isActive(item.path));

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-14"
      style={{ background: 'var(--orbis-overlay)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--orbis-border)' }}
    >
      <div className="flex items-center h-full px-4 gap-1">
        {/* Logo */}
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Go to dashboard"
          className="flex items-center gap-2.5 mr-6 shrink-0 group"
        >
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Zap aria-hidden="true" className="h-[18px] w-[18px] text-white" />
          </motion.div>
          <span className="text-base font-bold text-white tracking-tight transition-colors" style={{ transitionProperty: 'color' }}>
            Orbis
          </span>
        </button>

        {/* Navigation groups */}
        <nav aria-label="Main navigation" className="flex items-center gap-0.5">
          {filteredGroups.map(group => (
            <NavDropdown
              key={group.id}
              group={group}
              isActive={isGroupActive(group)}
              onNavigate={navigate}
            />
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* New Job button — hide for interviewers */}
          {user?.role !== 'interviewer' && (
            <button
              onClick={() => navigate('/jobs/create')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 16px rgba(27,142,229,0.25)' }}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              New Job
            </button>
          )}

          {/* Notification bell */}
          <div className="text-slate-300 [&_button]:text-slate-300 [&_button:hover]:text-white">
            <NotificationBell />
          </div>

          {/* User menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
