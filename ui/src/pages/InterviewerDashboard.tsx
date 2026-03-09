import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { subDays } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { ListToolbar } from '@/components/ListToolbar';
import { useClientPagination } from '@/hooks/useClientPagination';
import { DataPagination } from '@/components/DataPagination';
import {
  Calendar, CheckCircle, AlertTriangle, Clock, Video,
  Users, ExternalLink, MessageSquare, Eye, Briefcase, AlertCircle,
  RefreshCw, User,
} from 'lucide-react';

interface InterviewStats {
  upcoming_count: number;
  completed_this_month: number;
  pending_feedback: number;
  avg_rating_given: number;
  total_interviews: number;
}

interface InterviewItem {
  schedule_id: number;
  candidate_id: number;
  candidate_name: string;
  jd_id: string;
  job_title: string;
  round_number: number;
  round_type: string;
  interview_type: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  meeting_link?: string;
  interviewer_names: string[];
  feedback_submitted: boolean;
}

const ROUND_TYPE_CONFIG: Record<string, { badge: string; border: string; label?: string }> = {
  Technical: { badge: 'bg-purple-100 text-purple-700 border-purple-200', border: 'border-l-purple-500' },
  Behavioral: { badge: 'bg-blue-100 text-blue-700 border-blue-200', border: 'border-l-blue-500' },
  'Culture Fit': { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-l-emerald-500' },
  Cultural: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-l-emerald-500' },
  'System Design': { badge: 'bg-cyan-100 text-cyan-700 border-cyan-200', border: 'border-l-cyan-500' },
  'Hiring Manager': { badge: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-l-amber-500' },
};

const DEFAULT_ROUND_CONFIG = { badge: 'bg-slate-100 text-slate-700 border-slate-200', border: 'border-l-slate-400' };

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function InterviewerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<InterviewStats | null>(null);
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [rescheduleTarget, setRescheduleTarget] = useState<InterviewItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, interviewsRes] = await Promise.all([
        apiClient.getMyInterviewStats(),
        apiClient.getMyInterviews(),
      ]);
      setStats(statsRes);
      setInterviews(interviewsRes || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load interview data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openRescheduleDialog = (interview: InterviewItem) => {
    setRescheduleTarget(interview);
    setRescheduleDate(interview.scheduled_date);
    setRescheduleTime(interview.scheduled_time.slice(0, 5));
    setRescheduleReason('');
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    setRescheduleSubmitting(true);
    try {
      await apiClient.rescheduleInterview(rescheduleTarget.schedule_id, {
        new_date: rescheduleDate,
        new_time: rescheduleTime,
        reason: rescheduleReason || undefined,
      });
      toast({ title: 'Rescheduled', description: 'Interview has been rescheduled successfully.' });
      setRescheduleTarget(null);
      loadData();
    } catch {
      toast({ title: 'Error', description: 'Failed to reschedule interview', variant: 'destructive' });
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const isPast = (interview: InterviewItem) => {
    const dateTimeStr = `${interview.scheduled_date}T${interview.scheduled_time}`;
    const scheduledAt = new Date(dateTimeStr);
    return scheduledAt.getTime() < Date.now();
  };

  const upcomingInterviews = interviews
    .filter(i => i.status === 'scheduled' && !isPast(i))
    .sort((a, b) => {
      const da = new Date(`${a.scheduled_date}T${a.scheduled_time}`).getTime();
      const db = new Date(`${b.scheduled_date}T${b.scheduled_time}`).getTime();
      return da - db;
    });
  const overdueInterviews = interviews.filter(i => i.status === 'scheduled' && isPast(i));
  const completedInterviews = interviews.filter(i => i.status === 'completed');
  const pendingFeedbackCount = stats?.pending_feedback ?? 0;

  // ── Completed interviews: search, sort, date filter, pagination ──
  const [completedSearch, setCompletedSearch] = useState('');
  const [completedSort, setCompletedSort] = useState('newest');
  const [completedDateDays, setCompletedDateDays] = useState(0);

  const COMPLETED_SORT_OPTIONS = useMemo(() => [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' },
    { label: 'Candidate A-Z', value: 'name_asc' },
  ], []);

  const filteredCompleted = useMemo(() => {
    let items = completedInterviews;

    // Search filter
    if (completedSearch) {
      const q = completedSearch.toLowerCase();
      items = items.filter(
        i => i.candidate_name.toLowerCase().includes(q) || i.job_title.toLowerCase().includes(q)
      );
    }

    // Date filter
    if (completedDateDays > 0) {
      const cutoff = subDays(new Date(), completedDateDays);
      items = items.filter(i => new Date(i.scheduled_date + 'T00:00:00') >= cutoff);
    }

    // Sort
    items = [...items].sort((a, b) => {
      if (completedSort === 'newest') {
        return new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime();
      }
      if (completedSort === 'oldest') {
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      }
      // name_asc
      return a.candidate_name.localeCompare(b.candidate_name);
    });

    return items;
  }, [completedInterviews, completedSearch, completedSort, completedDateDays]);

  const completedPagination = useClientPagination(filteredCompleted, { pageSize: 10 });

  const kpis = [
    {
      label: 'Upcoming Interviews',
      value: upcomingInterviews.length,
      icon: Calendar,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      tint: 'bg-blue-50/40',
    },
    {
      label: 'Pending Feedback',
      value: pendingFeedbackCount,
      icon: AlertTriangle,
      iconBg: pendingFeedbackCount > 0 ? 'bg-amber-100' : 'bg-slate-100',
      iconColor: pendingFeedbackCount > 0 ? 'text-amber-600' : 'text-slate-500',
      tint: pendingFeedbackCount > 0 ? 'bg-amber-50/50' : 'bg-slate-50/40',
      highlight: pendingFeedbackCount > 0,
    },
    {
      label: 'Completed This Month',
      value: stats?.completed_this_month ?? 0,
      icon: CheckCircle,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      tint: 'bg-emerald-50/40',
    },
  ];

  return (
    <AppLayout>
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Interviews</h1>
            <p className="text-sm text-muted-foreground mt-1">Your upcoming and past interview schedule</p>
          </div>
          <p className="text-sm text-muted-foreground">{getTodayFormatted()}</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
      >
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-12" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          kpis.map(kpi => (
            <motion.div key={kpi.label} variants={fadeInUp}>
              <Card className={`relative overflow-hidden transition-shadow hover:shadow-md ${kpi.highlight ? 'ring-2 ring-amber-400/70 ring-offset-1' : ''}`}>
                <div className={`absolute inset-0 ${kpi.tint}`} />
                <CardContent className="relative p-5">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center h-11 w-11 rounded-full ${kpi.iconBg}`}>
                      <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
                      <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Upcoming Interviews Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-foreground">Upcoming Interviews</h2>
          {!loading && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {upcomingInterviews.length + overdueInterviews.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Overdue alert */}
            {overdueInterviews.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700">Overdue ({overdueInterviews.length})</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {overdueInterviews.map((interview, index) => (
                    <motion.div
                      key={interview.schedule_id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <UpcomingInterviewCard
                        interview={interview}
                        onNavigate={navigate}
                        onReschedule={openRescheduleDialog}
                        isOverdue
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {upcomingInterviews.length > 0 ? (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid gap-4 md:grid-cols-2"
              >
                {upcomingInterviews.map((interview) => (
                  <motion.div key={interview.schedule_id} variants={fadeInUp}>
                    <UpcomingInterviewCard
                      interview={interview}
                      onNavigate={navigate}
                      onReschedule={openRescheduleDialog}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : overdueInterviews.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-10 text-center">
                  <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="text-sm font-medium text-muted-foreground">No upcoming interviews</h3>
                  <p className="text-xs text-muted-foreground/70 mt-1">You have no interviews scheduled at the moment.</p>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </motion.div>

      {/* Past Interviews Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-foreground">Past Interviews</h2>
          {!loading && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {completedInterviews.length}
            </span>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-36 hidden sm:block" />
                    <Skeleton className="h-4 w-20 hidden md:block" />
                    <Skeleton className="h-5 w-16 ml-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : completedInterviews.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-sm font-medium text-muted-foreground">No completed interviews this month</h3>
              <p className="text-xs text-muted-foreground/70 mt-1">Check back later for updates.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ListToolbar
              searchPlaceholder="Search by candidate or job title..."
              searchValue={completedSearch}
              onSearchChange={(v) => { setCompletedSearch(v); completedPagination.setPage(1); }}
              sortOptions={COMPLETED_SORT_OPTIONS}
              sortValue={completedSort}
              onSortChange={(v) => { setCompletedSort(v); completedPagination.setPage(1); }}
              showDateFilter
              dateValue={completedDateDays}
              onDateChange={(d) => { setCompletedDateDays(d); completedPagination.setPage(1); }}
              showPageSize
              pageSize={completedPagination.pageSize}
              onPageSizeChange={completedPagination.setPageSize}
            />

            {filteredCompleted.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-10 text-center">
                  <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="text-sm font-medium text-muted-foreground">No interviews match your filters</h3>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your search or date range.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Table Header */}
                  <div className="hidden sm:grid grid-cols-[2fr_2fr_1.2fr_1fr_1.2fr_1fr] gap-3 px-5 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <span>Candidate</span>
                    <span>Job</span>
                    <span>Date</span>
                    <span>Type</span>
                    <span>Status</span>
                    <span className="text-right">Action</span>
                  </div>

                  {/* Table Rows */}
                  <AnimatePresence>
                    <div className="divide-y">
                      {completedPagination.pageItems.map((interview, index) => {
                        const roundConfig = ROUND_TYPE_CONFIG[interview.round_type] || DEFAULT_ROUND_CONFIG;
                        const isPending = !interview.feedback_submitted;

                        return (
                          <motion.div
                            key={interview.schedule_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={`grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.2fr_1fr_1.2fr_1fr] gap-2 sm:gap-3 px-5 py-3.5 items-center transition-colors ${
                              isPending ? 'bg-amber-50/60 dark:bg-amber-950/10' : 'hover:bg-muted/30'
                            }`}
                          >
                            {/* Candidate */}
                            <div className="flex items-center gap-2.5">
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold shrink-0">
                                {getInitials(interview.candidate_name)}
                              </div>
                              <span className="text-sm font-medium text-foreground truncate">{interview.candidate_name}</span>
                            </div>

                            {/* Job */}
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Briefcase className="h-3.5 w-3.5 shrink-0 hidden sm:block" />
                              <span className="truncate">{interview.job_title}</span>
                            </div>

                            {/* Date */}
                            <span className="text-sm text-muted-foreground">{formatDate(interview.scheduled_date)}</span>

                            {/* Type */}
                            <Badge variant="outline" className={`text-[11px] px-2 py-0 w-fit ${roundConfig.badge}`}>
                              {interview.round_type}
                            </Badge>

                            {/* Status */}
                            {isPending ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                <span className="text-xs font-medium text-amber-700">Pending</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-xs font-medium text-emerald-700">Feedback Submitted</span>
                              </div>
                            )}

                            {/* Action */}
                            <div className="text-right">
                              {isPending ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-amber-700 hover:text-amber-800 hover:bg-amber-100 h-7 text-xs font-medium"
                                  onClick={() => navigate(`/interviews/${interview.schedule_id}/feedback`)}
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Submit Feedback
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 h-7 text-xs font-medium"
                                  onClick={() => navigate(`/interviews/${interview.schedule_id}/feedback`)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View Feedback
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </AnimatePresence>
                </CardContent>
              </Card>
            )}

            <DataPagination
              page={completedPagination.page}
              totalPages={completedPagination.totalPages}
              total={completedPagination.total}
              pageSize={completedPagination.pageSize}
              onPageChange={completedPagination.setPage}
            />
          </>
        )}
      </motion.div>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => { if (!open) setRescheduleTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Interview</DialogTitle>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Rescheduling interview with <span className="font-medium text-foreground">{rescheduleTarget.candidate_name}</span> for {rescheduleTarget.job_title} — Round {rescheduleTarget.round_number}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reschedule-date">New Date</Label>
                  <Input
                    id="reschedule-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reschedule-time">New Time</Label>
                  <Input
                    id="reschedule-time"
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reschedule-reason">Reason (optional)</Label>
                <Textarea
                  id="reschedule-reason"
                  placeholder="e.g., Scheduling conflict, candidate requested change..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)} disabled={rescheduleSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={rescheduleSubmitting || !rescheduleDate || !rescheduleTime}>
              {rescheduleSubmitting ? 'Rescheduling...' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

/* ─── Upcoming Interview Card ─────────────────────────────────────────────── */

function UpcomingInterviewCard({
  interview,
  onNavigate,
  onReschedule,
  isOverdue = false,
}: {
  interview: InterviewItem;
  onNavigate: (path: string) => void;
  onReschedule: (interview: InterviewItem) => void;
  isOverdue?: boolean;
}) {
  const roundConfig = ROUND_TYPE_CONFIG[interview.round_type] || DEFAULT_ROUND_CONFIG;

  return (
    <Card className={`hover:shadow-md transition-all border-l-4 ${roundConfig.border} ${isOverdue ? 'ring-2 ring-amber-400/70 ring-offset-1' : ''}`}>
      <CardContent className="p-5">
        <div className="space-y-3.5">
          {/* Top row: avatar + name + badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold shrink-0">
                {getInitials(interview.candidate_name)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{interview.candidate_name}</h3>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  {interview.job_title} — Round {interview.round_number}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isOverdue && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
                  Overdue
                </Badge>
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roundConfig.badge}`}>
                {interview.round_type}
              </Badge>
            </div>
          </div>

          {/* Date / time / duration */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(interview.scheduled_date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(interview.scheduled_time)}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground/70">
              {interview.duration_minutes} min
            </span>
            <span className="flex items-center gap-1.5 capitalize">
              <Video className="h-3.5 w-3.5" />
              {interview.interview_type.replace('_', ' ')}
            </span>
          </div>

          {/* Co-interviewers */}
          {interview.interviewer_names.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>Panel: {interview.interviewer_names.join(', ')}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {interview.status === 'scheduled' && interview.meeting_link && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                onClick={() => window.open(interview.meeting_link, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Join
              </Button>
            )}
            {interview.status === 'scheduled' && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => onReschedule(interview)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reschedule
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground ml-auto"
              onClick={() => onNavigate(`/jobs/${interview.jd_id}/candidates/${interview.candidate_id}`)}
            >
              <User className="h-3.5 w-3.5 mr-1" />
              View Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
