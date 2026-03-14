import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, AlertTriangle, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TopNavbar from './TopNavbar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';

// Keep the SidebarContext export for backward compatibility (some components may import it)
import { createContext, useContext } from 'react';
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
  collapsed: false, setCollapsed: () => {},
  autoHide: false, setAutoHide: () => {},
  pinned: true, navGuardActive: false, setPinned: () => {},
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
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isHR } = useAuth();

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
    enabled: isAdmin() || isHR(),
  });

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      const dismissed = sessionStorage.getItem('dismissed_announcement_banner');
      return dismissed ? JSON.parse(dismissed) : null;
    } catch { return null; }
  });

  const showBanner = urgentAnnouncement && bannerDismissed !== urgentAnnouncement?.id;

  const dismissBanner = () => {
    if (urgentAnnouncement) {
      sessionStorage.setItem('dismissed_announcement_banner', JSON.stringify(urgentAnnouncement.id));
      setBannerDismissed(urgentAnnouncement.id);
    }
  };

  return (
    <SidebarContext.Provider value={{
      collapsed: false, setCollapsed: () => {},
      autoHide: false, setAutoHide: () => {},
      pinned: true, navGuardActive: false, setPinned: () => {},
    }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded"
        style={{ background: '#1B8EE5', color: '#ffffff' }}
      >
        Skip to main content
      </a>
      <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
        <TopNavbar />
        <main id="main-content" tabIndex={-1} className="pt-14">
          {/* Urgent/pinned announcement banner */}
          {showBanner && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-center gap-3 px-6 py-2.5 text-sm"
              style={{
                background: urgentAnnouncement.priority === 'urgent'
                  ? 'rgba(244,63,94,0.08)'
                  : 'rgba(27,142,229,0.08)',
                borderBottom: urgentAnnouncement.priority === 'urgent'
                  ? '1px solid rgba(244,63,94,0.2)'
                  : '1px solid rgba(27,142,229,0.2)',
                color: urgentAnnouncement.priority === 'urgent' ? '#fb7185' : '#1B8EE5',
              }}
            >
              {urgentAnnouncement.priority === 'urgent' ? (
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <Megaphone aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium truncate flex-1">
                {urgentAnnouncement.title.length > 120 ? urgentAnnouncement.title.slice(0, 120) + '…' : urgentAnnouncement.title}
                {urgentAnnouncement.content && (
                  <span className="font-normal text-xs ml-2 opacity-75">— {urgentAnnouncement.content.slice(0, 80)}{urgentAnnouncement.content.length > 80 ? '...' : ''}</span>
                )}
              </span>
              <button
                onClick={() => navigate('/announcements')}
                aria-label="View announcement"
                className="text-xs font-medium underline underline-offset-2 hover:no-underline shrink-0"
              >
                View
              </button>
              <button
                onClick={dismissBanner}
                aria-label="Dismiss announcement"
                className="p-0.5 rounded shrink-0 transition-colors hover:bg-white/5"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
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
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
