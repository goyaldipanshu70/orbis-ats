import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/utils/api';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItem {
  id: number;
  type: string;
  subject: string;
  body: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.getNotifications({ page: 1, page_size: 20 });
      setNotifications(res.items || []);
      setUnreadCount(res.unread_count || 0);
    } catch {
      // silently fail
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.getUnreadNotificationCount();
      setUnreadCount(res.unread_count || 0);
    } catch {
      // silently fail
    }
  }, []);

  // Listen for real-time notifications
  useRealtimeEvents(
    useCallback(
      (eventType: string, data: any) => {
        if (eventType === 'new_notification') {
          setNotifications((prev) => [data, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + 1);
        }
      },
      []
    ),
    { eventTypes: ['new_notification'], enabled: true }
  );

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds as backup
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount]);

  // Refetch when popover opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkRead = async (id: number) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  const typeIcons: Record<string, string> = {
    candidate_applied: '\uD83D\uDCCB',
    interview_scheduled: '\uD83D\uDCC5',
    offer_sent: '\uD83D\uDCE8',
    offer_accepted: '\uD83C\uDF89',
    stage_changed: '\uD83D\uDD04',
    new_job_request: '\uD83D\uDCDD',
    interview_rescheduled: '\uD83D\uDCC6',
    ai_interview_invited: '\uD83E\uDD16',
    ai_interview_started: '\uD83D\uDE80',
    ai_interview_completed: '\u2705',
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative rounded-full h-8 w-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:bg-white/10">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-[#1B8EE5] px-1 text-[10px] leading-none text-white font-semibold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 rounded-xl shadow-2xl"
        align="end"
        style={{
          background: 'var(--orbis-dropdown)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--orbis-border)',
        }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid var(--orbis-border)' }}
        >
          <h4 className="font-semibold text-sm text-white">Notifications</h4>
          {unreadCount > 0 && (
            <button
              className="text-xs h-7 px-2 rounded text-slate-400 hover:text-white transition-colors hover:bg-white/10"
              onClick={handleMarkAllRead}
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No notifications yet
            </div>
          ) : (
            <div
              className="divide-y"
              style={{ '--tw-divide-opacity': '1', borderColor: 'var(--orbis-border)' } as React.CSSProperties}
            >
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 cursor-pointer transition-colors hover:bg-white/5`}
                  style={!n.is_read ? { background: 'rgba(27,142,229,0.08)' } : undefined}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                >
                  <div className="flex gap-3">
                    <span className="text-lg mt-0.5">
                      {typeIcons[n.type] || '\uD83D\uDD14'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate text-white">
                          {n.subject}
                        </p>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-[#1B8EE5] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {n.created_at
                          ? formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                            })
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
