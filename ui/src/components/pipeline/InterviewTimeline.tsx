import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { InterviewSchedule } from '@/types/api';
import { apiClient } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Video, Phone, MapPin, Clock, Users } from 'lucide-react';

interface InterviewTimelineProps {
  candidateId: number;
}

const statusConfig: Record<
  InterviewSchedule['status'],
  { label: string; color: string; dotColor: string }
> = {
  scheduled: {
    label: 'Scheduled',
    color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
    dotColor: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
    dotColor: 'bg-green-500',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
  no_show: {
    label: 'No Show',
    color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
};

const typeConfig: Record<
  InterviewSchedule['interview_type'],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  phone: { label: 'Phone', icon: Phone },
  video: { label: 'Video', icon: Video },
  in_person: { label: 'In Person', icon: MapPin },
};

function formatDateTime(date: string, time: string): string {
  const d = new Date(`${date}T${time}`);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function InterviewTimeline({ candidateId }: InterviewTimelineProps) {
  const [interviews, setInterviews] = useState<InterviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchInterviews() {
      setLoading(true);
      try {
        const data = await apiClient.getInterviewsForCandidate(candidateId);
        if (!cancelled) {
          // Sort by date descending so the most recent interview appears first
          const sorted = [...data].sort((a, b) => {
            const dateA = `${a.scheduled_date}T${a.scheduled_time}`;
            const dateB = `${b.scheduled_date}T${b.scheduled_time}`;
            return dateB.localeCompare(dateA);
          });
          setInterviews(sorted);
        }
      } catch {
        if (!cancelled) {
          setInterviews([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInterviews();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <span className="ml-2 text-sm text-muted-foreground">Loading interviews...</span>
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Clock className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">No interviews scheduled</p>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="relative space-y-0">
      {interviews.map((interview, index) => {
        const status = statusConfig[interview.status];
        const type = typeConfig[interview.interview_type];
        const TypeIcon = type.icon;
        const isLast = index === interviews.length - 1;

        return (
          <motion.div key={interview.id} variants={fadeInUp} className="relative flex gap-4 pb-6">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'z-10 flex h-3 w-3 shrink-0 rounded-full ring-4 ring-background',
                  status.dotColor,
                )}
              />
              {!isLast && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="-mt-0.5 flex-1 space-y-1.5 pb-2">
              {/* Header row: type badge + status badge */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 text-xs font-medium">
                  <TypeIcon className="h-3 w-3" />
                  {type.label}
                </Badge>
                <Badge className={cn('border text-xs', status.color)}>
                  {status.label}
                </Badge>
              </div>

              {/* Date and time */}
              <p className="text-sm font-medium text-foreground">
                {formatDateTime(interview.scheduled_date, interview.scheduled_time)}
              </p>

              {/* Details */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {interview.duration_minutes} min
                </span>

                {interview.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {interview.location}
                  </span>
                )}

                {interview.interviewer_names.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {interview.interviewer_names.join(', ')}
                  </span>
                )}
              </div>

              {/* Notes */}
              {interview.notes && (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  {interview.notes}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
