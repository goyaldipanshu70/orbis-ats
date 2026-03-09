import { ReactNode, createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, X, AlertTriangle, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppSidebar from './AppSidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { NotificationBell } from '@/components/NotificationBell';
import { apiClient } from '@/utils/api';

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  autoHide: boolean;
  setAutoHide: (v: boolean) => void;
  pinned: boolean;
  navGuardActive: boolean;
  setPinned: (v: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  autoHide: true,
  setAutoHide: () => {},
  pinned: false,
  navGuardActive: false,
  setPinned: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface AppLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
}

const pageVariants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
};

export default function AppLayout({ children, fullWidth = false, noPadding = false }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [autoHide, setAutoHide] = useState(() => {
    const stored = localStorage.getItem('sidebar_auto_hide');
    return stored !== null ? JSON.parse(stored) : false;
  });
  const [pinned, setPinned] = useState(() => {
    const stored = localStorage.getItem('sidebar_pinned');
    return stored !== null ? JSON.parse(stored) : true;
  });
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [navGuardActive, setNavGuardActive] = useState(false);

  // Persist auto-hide and pinned preferences
  useEffect(() => {
    localStorage.setItem('sidebar_auto_hide', JSON.stringify(autoHide));
  }, [autoHide]);
  useEffect(() => {
    localStorage.setItem('sidebar_pinned', JSON.stringify(pinned));
  }, [pinned]);

  // When pinned changes, sync collapsed state
  useEffect(() => {
    if (pinned) setCollapsed(false);
  }, [pinned]);

  const SIDEBAR_EXPANDED_WIDTH = 240;
  const HOVER_ZONE = 48; // invisible trigger strip on the left edge when collapsed

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!autoHide || pinned) return;

    const x = e.clientX;

    if (collapsed && x <= HOVER_ZONE) {
      // Mouse near left edge — expand
      if (collapseTimerRef.current) { clearTimeout(collapseTimerRef.current); collapseTimerRef.current = null; }
      if (!expandTimerRef.current) {
        expandTimerRef.current = setTimeout(() => {
          setCollapsed(false);
          // Prevent stray clicks on sidebar buttons during expand animation
          setNavGuardActive(true);
          if (navGuardTimerRef.current) clearTimeout(navGuardTimerRef.current);
          navGuardTimerRef.current = setTimeout(() => { setNavGuardActive(false); navGuardTimerRef.current = null; }, 800);
          expandTimerRef.current = null;
        }, 150);
      }
    } else if (!collapsed && x > SIDEBAR_EXPANDED_WIDTH + 40) {
      // Mouse moved well past sidebar — collapse
      if (expandTimerRef.current) { clearTimeout(expandTimerRef.current); expandTimerRef.current = null; }
      if (!collapseTimerRef.current) {
        collapseTimerRef.current = setTimeout(() => {
          setCollapsed(true);
          collapseTimerRef.current = null;
        }, 400);
      }
    } else {
      // Mouse is in the sidebar area — cancel any pending collapse
      if (collapseTimerRef.current) { clearTimeout(collapseTimerRef.current); collapseTimerRef.current = null; }
    }
  }, [autoHide, pinned, collapsed]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      if (navGuardTimerRef.current) clearTimeout(navGuardTimerRef.current);
    };
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  // All root/sidebar/header-linked pages where back+home bar is unnecessary
  const rootPaths = [
    '/dashboard', '/jobs', '/interviews', '/my-applications',
    '/hiring-assistant', '/analytics', '/talent-pool',
    '/interviewers', '/referrals', '/outreach', '/ai-toolkit',
    '/templates', '/compliance', '/announcements', '/onboarding',
    '/admin', '/admin/orchestrator', '/account-settings', '/job-portals',
    '/people-analytics',
    '/chat', '/rag-chat', '/finance',
  ];
  const isHome = rootPaths.includes(location.pathname);

  // Urgent/pinned announcement banner
  const { data: urgentAnnouncement } = useQuery({
    queryKey: ['urgent-announcement-banner'],
    queryFn: async () => {
      try {
        const data = await apiClient.getAnnouncements(1, 10);
        const items = data?.items || [];
        return items.find((a: any) => a.priority === 'urgent' || a.pinned) || null;
      } catch { return null; }
    },
    staleTime: 120_000,
  });

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    const dismissed = sessionStorage.getItem('dismissed_announcement_banner');
    return dismissed ? JSON.parse(dismissed) : null;
  });

  const showBanner = urgentAnnouncement && bannerDismissed !== urgentAnnouncement?.id;

  const dismissBanner = () => {
    if (urgentAnnouncement) {
      sessionStorage.setItem('dismissed_announcement_banner', JSON.stringify(urgentAnnouncement.id));
      setBannerDismissed(urgentAnnouncement.id);
    }
  };

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, autoHide, setAutoHide, pinned, setPinned, navGuardActive }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-card focus:text-blue-600 focus:rounded"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen bg-background" onMouseMove={handleMouseMove}>
        <AppSidebar />
        <motion.main
          initial={false}
          animate={{ marginLeft: collapsed ? 68 : 240 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35, mass: 0.8 }}
          className="flex-1 will-change-[margin-left]"
        >
          {/* Top navigation bar */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-2 flex items-center gap-2">
            {!isHome && (
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
              >
                <Home className="h-3.5 w-3.5" />
                Home
              </button>
            )}
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </div>
          {/* Urgent/pinned announcement banner */}
          {showBanner && (
            <div className={`flex items-center gap-3 px-6 py-2.5 text-sm ${
              urgentAnnouncement.priority === 'urgent'
                ? 'bg-red-50 border-b border-red-200 text-red-800'
                : 'bg-blue-50 border-b border-blue-200 text-blue-800'
            }`}>
              {urgentAnnouncement.priority === 'urgent' ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Megaphone className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium truncate flex-1">
                {urgentAnnouncement.title}
                {urgentAnnouncement.content && (
                  <span className="font-normal text-xs ml-2 opacity-75">— {urgentAnnouncement.content.slice(0, 80)}{urgentAnnouncement.content.length > 80 ? '...' : ''}</span>
                )}
              </span>
              <button
                onClick={() => navigate('/announcements')}
                className="text-xs font-medium underline underline-offset-2 hover:no-underline shrink-0"
              >
                View
              </button>
              <button onClick={dismissBanner} className="p-0.5 hover:bg-black/5 rounded shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              id="main-content"
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 260, damping: 25 }}
              className={noPadding ? '' : 'p-6'}
            >
              <div className={fullWidth ? '' : 'mx-auto max-w-7xl'}>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.main>
      </div>
    </SidebarContext.Provider>
  );
}
