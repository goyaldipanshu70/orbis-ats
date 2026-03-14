import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { subDays } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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

/* ── Glass Design System ───────────────────────────────── */
const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};
const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

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
  Technical:      { badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', border: 'border-l-blue-500' },
  Behavioral:     { badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',       border: 'border-l-blue-500' },
  'Culture Fit':  { badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', border: 'border-l-emerald-500' },
  Cultural:       { badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', border: 'border-l-emerald-500' },
  'System Design':{ badge: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',       border: 'border-l-cyan-500' },
  'Hiring Manager':{ badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',   border: 'border-l-amber-500' },
};

const DEFAULT_ROUND_CONFIG = { badge: 'bg-white/5 text-slate-400 border border-white/10', border: 'border-l-slate-500' };

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
      gradient: 'linear-gradient(135deg, #3b82f6, #1676c0)',
      iconColor: 'text-blue-400',
      iconBg: 'rgba(59,130,246,0.15)',
    },
    {
      label: 'Pending Feedback',
      value: pendingFeedbackCount,
      icon: AlertTriangle,
      gradient: pendingFeedbackCount > 0
        ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
        : 'linear-gradient(135deg, #64748b, #475569)',
      iconColor: pendingFeedbackCount > 0 ? 'text-amber-400' : 'text-slate-400',
      iconBg: pendingFeedbackCount > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
      highlight: pendingFeedbackCount > 0,
    },
    {
      label: 'Completed This Month',
      value: stats?.completed_this_month ?? 0,
      icon: CheckCircle,
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      iconColor: 'text-emerald-400',
      iconBg: 'rgba(16,185,129,0.15)',
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
            <h1 className="text-2xl font-bold tracking-tight text-white">My Interviews</h1>
            <p className="text-sm text-slate-400 mt-1">Your upcoming and past interview schedule</p>
          </div>
          <p className="text-sm text-slate-500">{getTodayFormatted()}</p>
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
            <div key={i} className="rounded-xl p-5" style={glassCard}>
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-full animate-pulse bg-white/10" />
                <div className="space-y-2">
                  <div className="h-7 w-12 rounded animate-pulse bg-white/10" />
                  <div className="h-3 w-28 rounded animate-pulse bg-white/10" />
                </div>
              </div>
            </div>
          ))
        ) : (
          kpis.map(kpi => (
            <motion.div key={kpi.label} variants={fadeInUp}>
              <div
                className={`relative overflow-hidden rounded-xl transition-all hover:scale-[1.02] ${kpi.highlight ? 'ring-2 ring-amber-400/40' : ''}`}
                style={glassCard}
              >
                {/* Gradient top bar */}
                <div className="h-1 w-full" style={{ background: kpi.gradient }} />
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex items-center justify-center h-11 w-11 rounded-full"
                      style={{ background: kpi.iconBg }}
                    >
                      <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-white">{kpi.value}</p>
                      <p className="text-xs font-medium text-slate-400">{kpi.label}</p>
                    </div>
                  </div>
                </div>
              </div>
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
          <Calendar className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Upcoming Interviews</h2>
          {!loading && (
            <span className="text-xs font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              {upcomingInterviews.length + overdueInterviews.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl p-5" style={glassCard}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full animate-pulse bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded animate-pulse bg-white/10" />
                    <div className="h-3 w-48 rounded animate-pulse bg-white/10" />
                    <div className="h-3 w-40 rounded animate-pulse bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Overdue alert */}
            {overdueInterviews.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">Overdue ({overdueInterviews.length})</span>
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
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center" style={{ background: 'var(--orbis-subtle)' }}>
                <Calendar className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                <h3 className="text-sm font-medium text-slate-400">No upcoming interviews</h3>
                <p className="text-xs text-slate-500 mt-1">You have no interviews scheduled at the moment.</p>
              </div>
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
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Past Interviews</h2>
          {!loading && (
            <span className="text-xs font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              {completedInterviews.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl" style={glassCard}>
            <div className="divide-y divide-white/[0.06]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="h-8 w-8 rounded-full animate-pulse bg-white/10" />
                  <div className="h-4 w-28 rounded animate-pulse bg-white/10" />
                  <div className="h-4 w-36 rounded animate-pulse bg-white/10 hidden sm:block" />
                  <div className="h-4 w-20 rounded animate-pulse bg-white/10 hidden md:block" />
                  <div className="h-5 w-16 rounded animate-pulse bg-white/10 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : completedInterviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-10 text-center" style={{ background: 'var(--orbis-subtle)' }}>
            <CheckCircle className="h-10 w-10 mx-auto text-slate-400 mb-3" />
            <h3 className="text-sm font-medium text-slate-400">No completed interviews this month</h3>
            <p className="text-xs text-slate-500 mt-1">Check back later for updates.</p>
          </div>
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
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center" style={{ background: 'var(--orbis-subtle)' }}>
                <CheckCircle className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                <h3 className="text-sm font-medium text-slate-400">No interviews match your filters</h3>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your search or date range.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={glassCard}>
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-[2fr_2fr_1.2fr_1fr_1.2fr_1fr] gap-3 px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ background: 'var(--orbis-card)', borderBottom: '1px solid var(--orbis-border)' }}>
                  <span>Candidate</span>
                  <span>Job</span>
                  <span>Date</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span className="text-right">Action</span>
                </div>

                {/* Table Rows */}
                <AnimatePresence>
                  <div className="divide-y divide-white/[0.06]">
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
                            isPending ? 'bg-amber-500/[0.04]' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          {/* Candidate */}
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold shrink-0" style={{ background: 'var(--orbis-hover)', color: '#94a3b8' }}>
                              {getInitials(interview.candidate_name)}
                            </div>
                            <span className="text-sm font-medium text-white truncate">{interview.candidate_name}</span>
                          </div>

                          {/* Job */}
                          <div className="flex items-center gap-1.5 text-sm text-slate-400">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 hidden sm:block" />
                            <span className="truncate">{interview.job_title}</span>
                          </div>

                          {/* Date */}
                          <span className="text-sm text-slate-400">{formatDate(interview.scheduled_date)}</span>

                          {/* Type */}
                          <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md w-fit ${roundConfig.badge}`}>
                            {interview.round_type}
                          </span>

                          {/* Status */}
                          {isPending ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-400" />
                              <span className="text-xs font-medium text-amber-400">Pending</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-xs font-medium text-emerald-400">Feedback Submitted</span>
                            </div>
                          )}

                          {/* Action */}
                          <div className="text-right">
                            {isPending ? (
                              <button
                                className="inline-flex items-center text-amber-400 hover:text-amber-300 h-7 text-xs font-medium px-2 rounded-md transition-colors hover:bg-amber-500/10"
                                onClick={() => navigate(`/interviews/${interview.schedule_id}/feedback`)}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Submit Feedback
                              </button>
                            ) : (
                              <button
                                className="inline-flex items-center text-emerald-400 hover:text-emerald-300 h-7 text-xs font-medium px-2 rounded-md transition-colors hover:bg-emerald-500/10"
                                onClick={() => navigate(`/interviews/${interview.schedule_id}/feedback`)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Feedback
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              </div>
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
        <DialogContent className="sm:max-w-md border-white/10" style={{ background: 'var(--orbis-dropdown)', backdropFilter: 'blur(24px)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Reschedule Interview</DialogTitle>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-400">
                Rescheduling interview with <span className="font-medium text-white">{rescheduleTarget.candidate_name}</span> for {rescheduleTarget.job_title} — Round {rescheduleTarget.round_number}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reschedule-date" className="text-slate-300">New Date</Label>
                  <input
                    id="reschedule-date"
                    type="date"
                    className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-colors focus:ring-1 focus:ring-blue-500/50"
                    style={glassInput}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reschedule-time" className="text-slate-300">New Time</Label>
                  <input
                    id="reschedule-time"
                    type="time"
                    className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-colors focus:ring-1 focus:ring-blue-500/50"
                    style={glassInput}
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reschedule-reason" className="text-slate-300">Reason (optional)</Label>
                <Textarea
                  id="reschedule-reason"
                  placeholder="e.g., Scheduling conflict, candidate requested change..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-blue-500/50"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              className="h-9 px-4 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={() => setRescheduleTarget(null)}
              disabled={rescheduleSubmitting}
            >
              Cancel
            </button>
            <button
              className="h-9 px-4 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 16px rgba(27,142,229,0.25)' }}
              onClick={handleReschedule}
              disabled={rescheduleSubmitting || !rescheduleDate || !rescheduleTime}
            >
              {rescheduleSubmitting ? 'Rescheduling...' : 'Reschedule'}
            </button>
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
    <div
      className={`rounded-xl border-l-4 ${roundConfig.border} transition-all hover:scale-[1.01] ${isOverdue ? 'ring-2 ring-amber-400/30' : ''}`}
      style={glassCard}
    >
      <div className="p-5">
        <div className="space-y-3.5">
          {/* Top row: avatar + name + badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full text-sm font-semibold shrink-0" style={{ background: 'var(--orbis-hover)', color: '#94a3b8' }}>
                {getInitials(interview.candidate_name)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{interview.candidate_name}</h3>
                <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  {interview.job_title} — Round {interview.round_number}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isOverdue && (
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Overdue
                </span>
              )}
              <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md ${roundConfig.badge}`}>
                {interview.round_type}
              </span>
            </div>
          </div>

          {/* Date / time / duration */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(interview.scheduled_date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(interview.scheduled_time)}
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              {interview.duration_minutes} min
            </span>
            <span className="flex items-center gap-1.5 capitalize">
              <Video className="h-3.5 w-3.5" />
              {interview.interview_type.replace('_', ' ')}
            </span>
          </div>

          {/* Co-interviewers */}
          {interview.interviewer_names.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>Panel: {interview.interviewer_names.join(', ')}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {interview.status === 'scheduled' && interview.meeting_link && (
              <button
                className="inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium text-white transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}
                onClick={() => window.open(interview.meeting_link, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Join
              </button>
            )}
            {interview.status === 'scheduled' && (
              <button
                className="inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.06]"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                onClick={() => onReschedule(interview)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reschedule
              </button>
            )}
            <button
              className="inline-flex items-center h-8 px-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors hover:bg-white/[0.04] ml-auto"
              onClick={() => onNavigate(`/jobs/${interview.jd_id}/candidates/${interview.candidate_id}`)}
            >
              <User className="h-3.5 w-3.5 mr-1" />
              View Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
