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
    line: 'border-blue-500/30',
    bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  interview: {
    dot: 'bg-blue-500',
    line: 'border-blue-500/30',
    bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  feedback: {
    dot: 'bg-emerald-500',
    line: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  applied: {
    dot: 'bg-blue-500',
    line: 'border-blue-500/30',
    bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  offer: {
    dot: 'bg-amber-500',
    line: 'border-amber-500/30',
    bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  hired: {
    dot: 'bg-emerald-500',
    line: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  rejected: {
    dot: 'bg-red-500',
    line: 'border-red-500/30',
    bg: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
};

const DEFAULT_COLORS = {
  dot: 'bg-slate-500',
  line: 'border-white/10',
  bg: 'bg-white/5 text-slate-400 border border-white/10',
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
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
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
              <p className="text-xs font-medium text-slate-400">
                {formatDate(event.date)}
              </p>
              <p className="text-[10px] text-slate-500/70">
                {formatTime(event.date)}
              </p>
            </div>

            {/* Center: Line + Dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-3 w-3 rounded-full shrink-0 mt-1.5 z-10 ring-4 ring-[var(--orbis-page)]',
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
              <div
                className="rounded-lg p-3 transition-shadow group-hover:shadow-md group-hover:shadow-black/20"
                style={{
                  background: 'var(--orbis-card)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--orbis-border)',
                }}
              >
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
                <p className="text-sm text-white">{event.description}</p>
                {event.actor && (
                  <p className="text-xs text-slate-500 mt-1">
                    by {/^\d+$/.test(event.actor) ? 'Team Member' : event.actor}
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
