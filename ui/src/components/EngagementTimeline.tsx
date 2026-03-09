import { motion } from 'framer-motion';
import { staggerContainer, slideInRight } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  event_type: string;
  description: string;
  date: string;
  actor: string | null;
}

interface EngagementTimelineProps {
  events: TimelineEvent[];
}

const EVENT_COLORS: Record<string, { dot: string; line: string; bg: string }> = {
  stage_change: {
    dot: 'bg-blue-500',
    line: 'border-blue-300 dark:border-blue-800',
    bg: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  },
  interview: {
    dot: 'bg-purple-500',
    line: 'border-purple-300 dark:border-purple-800',
    bg: 'bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  },
  feedback: {
    dot: 'bg-green-500',
    line: 'border-green-300 dark:border-green-800',
    bg: 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  },
  applied: {
    dot: 'bg-indigo-500',
    line: 'border-indigo-300 dark:border-indigo-800',
    bg: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  offer: {
    dot: 'bg-amber-500',
    line: 'border-amber-300 dark:border-amber-800',
    bg: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  hired: {
    dot: 'bg-emerald-500',
    line: 'border-emerald-300 dark:border-emerald-800',
    bg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  rejected: {
    dot: 'bg-red-500',
    line: 'border-red-300 dark:border-red-800',
    bg: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  },
};

const DEFAULT_COLORS = {
  dot: 'bg-muted-foreground',
  line: 'border-border',
  bg: 'bg-muted text-foreground',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatEventType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EngagementTimeline({ events }: EngagementTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No timeline events yet
      </div>
    );
  }

  // Sort events by date descending (most recent first)
  const sorted = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="relative space-y-0">
      {sorted.map((event, idx) => {
        const colors = EVENT_COLORS[event.event_type] || DEFAULT_COLORS;
        const isLast = idx === sorted.length - 1;

        return (
          <motion.div key={idx} variants={slideInRight} className="flex gap-4 group">
            {/* Left: Date */}
            <div className="w-24 shrink-0 text-right pt-1">
              <p className="text-xs font-medium text-muted-foreground">
                {formatDate(event.date)}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {formatTime(event.date)}
              </p>
            </div>

            {/* Center: Line + Dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-3 w-3 rounded-full ring-4 ring-background shrink-0 mt-1.5 z-10',
                  colors.dot
                )}
              />
              {!isLast && (
                <div
                  className={cn(
                    'w-px flex-1 border-l-2 border-dashed',
                    colors.line
                  )}
                />
              )}
            </div>

            {/* Right: Content */}
            <div className={cn('flex-1 pb-6', isLast ? 'pb-0' : '')}>
              <div className="rounded-lg border bg-card p-3 shadow-sm transition-shadow group-hover:shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                      colors.bg
                    )}
                  >
                    {formatEventType(event.event_type)}
                  </span>
                </div>
                <p className="text-sm text-foreground">{event.description}</p>
                {event.actor && (
                  <p className="text-xs text-muted-foreground mt-1">
                    by {event.actor}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
