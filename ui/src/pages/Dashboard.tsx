
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import AppLayout from '@/components/layout/AppLayout';
import ApprovalBadge from '@/components/ApprovalBadge';
import type { Job, DashboardStats } from '@/types/api';
import type { PaginatedResponse } from '@/types/pagination';
import {
  Briefcase, Zap, Users, ThumbsUp, XCircle, Calendar,
  Plus, TrendingUp, ArrowRight, ArrowUpRight, ArrowDownRight,
  CheckCircle, ShieldCheck, Megaphone, Pin, AlertTriangle, Bell, Info,
  Clock, UserCheck,
} from 'lucide-react';
import { CountingNumber } from '@/components/ui/counting-number';
import { Fade } from '@/components/ui/fade';
import { Shine } from '@/components/ui/shine';
import { motion } from 'framer-motion';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { scaleIn, fadeInUp, slideInLeft } from '@/lib/animations';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/* -------------------------------------------------------------------------- */
/*  Greeting helper                                                           */
/* -------------------------------------------------------------------------- */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/* -------------------------------------------------------------------------- */
/*  Stat card config type                                                     */
/* -------------------------------------------------------------------------- */

interface StatCardConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  iconBg: string;
  iconClass: string;
  trendUp: boolean;
  trendPercent: number;
  getValue: (s: DashboardStats) => number;
  href?: string;
}

const STAT_CARDS: StatCardConfig[] = [
  {
    key: 'total_jobs',
    label: 'Total Jobs',
    icon: Briefcase,
    gradientFrom: 'from-blue-50',
    gradientTo: 'to-blue-100/50',
    iconBg: 'bg-blue-500',
    iconClass: 'text-white',
    trendUp: true,
    trendPercent: 12,
    getValue: (s) => s.total_jobs,
    href: '/jobs',
  },
  {
    key: 'active_jobs',
    label: 'Active Roles',
    icon: Zap,
    gradientFrom: 'from-green-50',
    gradientTo: 'to-emerald-100/50',
    iconBg: 'bg-emerald-500',
    iconClass: 'text-white',
    trendUp: true,
    trendPercent: 8,
    getValue: (s) => s.active_jobs,
  },
  {
    key: 'total_candidates',
    label: 'Total Candidates',
    icon: Users,
    gradientFrom: 'from-purple-50',
    gradientTo: 'to-violet-100/50',
    iconBg: 'bg-purple-500',
    iconClass: 'text-white',
    trendUp: true,
    trendPercent: 24,
    getValue: (s) => s.total_candidates,
    href: '/talent-pool',
  },
  {
    key: 'recommended_candidates',
    label: 'Recommended',
    icon: ThumbsUp,
    gradientFrom: 'from-emerald-50',
    gradientTo: 'to-teal-100/50',
    iconBg: 'bg-teal-500',
    iconClass: 'text-white',
    trendUp: true,
    trendPercent: 15,
    getValue: (s) => s.recommended_candidates,
  },
  {
    key: 'closed_jobs',
    label: 'Closed Jobs',
    icon: XCircle,
    gradientFrom: 'from-orange-50',
    gradientTo: 'to-amber-100/50',
    iconBg: 'bg-orange-500',
    iconClass: 'text-white',
    trendUp: false,
    trendPercent: 3,
    getValue: (s) => s.closed_jobs,
  },
  {
    key: 'pending_interviews',
    label: 'Pending Interviews',
    icon: Calendar,
    gradientFrom: 'from-amber-50',
    gradientTo: 'to-yellow-100/50',
    iconBg: 'bg-amber-500',
    iconClass: 'text-white',
    trendUp: false,
    trendPercent: 5,
    getValue: (s) => s.pending_interviews,
    href: '/interviewers',
  },
];

/* -------------------------------------------------------------------------- */
/*  Quick link config                                                         */
/* -------------------------------------------------------------------------- */

interface QuickLinkConfig {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  iconGradient: string;
  hoverBorder: string;
}

const QUICK_LINKS: QuickLinkConfig[] = [
  {
    title: 'View All Jobs',
    description: 'Browse and manage open positions',
    href: '/jobs',
    icon: Briefcase,
    iconGradient: 'from-blue-500 to-blue-600',
    hoverBorder: 'hover:border-blue-300',
  },
  {
    title: 'Talent Pool',
    description: 'Explore your candidate database',
    href: '/talent-pool',
    icon: Users,
    iconGradient: 'from-purple-500 to-violet-600',
    hoverBorder: 'hover:border-purple-300',
  },
  {
    title: 'Analytics',
    description: 'Track hiring performance metrics',
    href: '/analytics',
    icon: TrendingUp,
    iconGradient: 'from-emerald-500 to-teal-600',
    hoverBorder: 'hover:border-emerald-300',
  },
  {
    title: 'Hiring Assistant',
    description: 'Get AI-powered recruiting help',
    href: '/hiring-assistant',
    icon: Zap,
    iconGradient: 'from-amber-500 to-orange-600',
    hoverBorder: 'hover:border-amber-300',
  },
];

/* -------------------------------------------------------------------------- */
/*  Dashboard Component                                                       */
/* -------------------------------------------------------------------------- */

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, isHR } = useAuth();
  const { toast } = useToast();

  // ---- approval processing state (local UI only) ----
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  // ---- fetch jobs for alert metrics ----
  const {
    data: jobsData,
    isLoading,
  } = useQuery({
    queryKey: ['jobs', 1],
    queryFn: async () => {
      const data: PaginatedResponse<Job> = await apiClient.getJobs(1, 20);
      return data;
    },
  });

  const jobs = jobsData?.items ?? [];

  const DEFAULT_STATS: DashboardStats = {
    total_jobs: 0,
    active_jobs: 0,
    closed_jobs: 0,
    total_candidates: 0,
    recommended_candidates: 0,
    pending_interviews: 0,
  };

  const {
    data: stats = DEFAULT_STATS,
    isLoading: isStatsLoading,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.getDashboardStats(),
    staleTime: 30_000,
    retry: 2,
    refetchOnMount: 'always',
  });

  const showApprovals = isAdmin() || isHR();

  const {
    data: pendingApprovals = [],
  } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const data = await apiClient.getPendingApprovals();
      return data || [];
    },
    enabled: showApprovals,
  });

  // Announcements for dashboard card
  const { data: announcementsData } = useQuery({
    queryKey: ['dashboard-announcements'],
    queryFn: async () => {
      const data = await apiClient.getAnnouncements(1, 3);
      return data?.items || [];
    },
    staleTime: 60_000,
  });
  const latestAnnouncements = announcementsData ?? [];

  // Real-time dashboard updates via SSE
  const handleRealtimeEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
  }, [queryClient]);

  useRealtimeEvents(handleRealtimeEvent, {
    eventTypes: ['candidate_evaluation_complete', 'pipeline_stage_changed', 'offer_sent', 'offer_status_changed', 'interview_scheduled'],
  });

  // ---- helper to invalidate all dashboard queries ----
  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
  };

  const handleApproveJob = async (jobId: string) => {
    setApprovingIds((prev) => new Set(prev).add(jobId));
    try {
      await apiClient.approveJob(jobId);
      toast({ title: 'Approved', description: 'Job has been approved.' });
      invalidateDashboard();
    } catch {
      toast({ title: 'Error', description: 'Failed to approve job.', variant: 'destructive' });
    } finally {
      setApprovingIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  };

  const handleRejectJob = async (jobId: string) => {
    setApprovingIds((prev) => new Set(prev).add(jobId));
    try {
      await apiClient.rejectJob(jobId);
      toast({ title: 'Rejected', description: 'Job has been rejected.' });
      invalidateDashboard();
    } catch {
      toast({ title: 'Error', description: 'Failed to reject job.', variant: 'destructive' });
    } finally {
      setApprovingIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  };

  // ---- dashboard alert metrics ----
  const alertMetrics = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Jobs with close_date within 7 days
    const nearingDeadline = jobs.filter((j) => {
      if (j.status !== 'Open' || !j.hiring_close_date) return false;
      const closeDate = new Date(j.hiring_close_date);
      return closeDate >= now && closeDate <= sevenDaysFromNow;
    });

    // Open jobs with fewer than 5 candidates
    const lowApplicants = jobs.filter(
      (j) => j.status === 'Open' && (j.statistics?.total_candidates ?? 0) < 5,
    );

    // Recent hires: sum hired_count across all job location vacancies
    const recentHires = jobs.reduce((sum, j) => {
      const hiredInJob = (j.location_vacancies || []).reduce(
        (locSum, loc) => locSum + (loc.hired_count || 0),
        0,
      );
      return sum + hiredInJob;
    }, 0);

    return { nearingDeadline, lowApplicants, recentHires };
  }, [jobs]);

  const firstName = user?.first_name || 'there';

  /* ======================================================================== */
  /*  RENDER                                                                  */
  /* ======================================================================== */

  return (
    <AppLayout>
      {/* ------------------------------------------------------------------ */}
      {/*  Header Section                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Fade direction="down" distance={12} duration={0.4} inView={false}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hiring overview and key metrics
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">
                Welcome back, <span className="text-foreground">{firstName}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate()}
              </p>
            </div>
            <Shine>
              <Button
                onClick={() => navigate('/jobs/create')}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-5 h-10 rounded-lg shadow-md shadow-blue-500/20 text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/30"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Job
              </Button>
            </Shine>
          </div>
        </div>
      </Fade>

      {/* ------------------------------------------------------------------ */}
      {/*  Stats Row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <StaggerGrid inView={false} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;

          if (isStatsLoading) {
            return (
              <div
                key={card.key}
                className="relative rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            );
          }

          const value = stats ? card.getValue(stats) : 0;

          return (
            <motion.div
              key={card.key}
              variants={slideInLeft}
              onClick={card.href ? () => navigate(card.href!) : undefined}
              className={`group relative rounded-xl border border-border/60 bg-gradient-to-br ${card.gradientFrom} ${card.gradientTo} dark:from-card dark:to-card shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-border hover:-translate-y-1 ${card.href ? 'cursor-pointer' : ''}`}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </span>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${card.iconBg} shadow-sm transition-transform duration-200 group-hover:scale-110`}
                  >
                    <Icon className={`w-[18px] h-[18px] ${card.iconClass}`} />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <CountingNumber value={value} className="text-3xl font-bold text-foreground" />
                  <div className={`flex items-center gap-0.5 text-[11px] font-medium ${card.trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {card.trendUp ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    <span>{card.trendPercent}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </StaggerGrid>

      {/* ------------------------------------------------------------------ */}
      {/*  Alert Metrics (Nearing Deadline / Low Applicants / Recent Hires)  */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && jobs.length > 0 && (alertMetrics.nearingDeadline.length > 0 || alertMetrics.lowApplicants.length > 0 || alertMetrics.recentHires > 0) && (
        <Fade duration={0.4}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* Nearing Deadline */}
            {alertMetrics.nearingDeadline.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border-l-4 border-l-amber-400 border border-border bg-card shadow-sm p-4 transition-all hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 shrink-0">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {alertMetrics.nearingDeadline.length} {alertMetrics.nearingDeadline.length === 1 ? 'job' : 'jobs'} nearing deadline
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Closing within the next 7 days
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {alertMetrics.nearingDeadline.slice(0, 3).map((j) => (
                      <span
                        key={j.job_id}
                        onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${j.job_id}`); }}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-200 transition-colors truncate max-w-[160px]"
                      >
                        {j.job_title}
                      </span>
                    ))}
                    {alertMetrics.nearingDeadline.length > 3 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300">
                        +{alertMetrics.nearingDeadline.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Low Applicants */}
            {alertMetrics.lowApplicants.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border-l-4 border-l-red-400 border border-border bg-card shadow-sm p-4 transition-all hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40 shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {alertMetrics.lowApplicants.length} {alertMetrics.lowApplicants.length === 1 ? 'job needs' : 'jobs need'} more applicants
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fewer than 5 candidates applied
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {alertMetrics.lowApplicants.slice(0, 3).map((j) => (
                      <span
                        key={j.job_id}
                        onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${j.job_id}`); }}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300 cursor-pointer hover:bg-red-200 transition-colors truncate max-w-[160px]"
                      >
                        {j.job_title} ({j.statistics?.total_candidates ?? 0})
                      </span>
                    ))}
                    {alertMetrics.lowApplicants.length > 3 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300">
                        +{alertMetrics.lowApplicants.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Hires */}
            {alertMetrics.recentHires > 0 && (
              <div className="flex items-start gap-3 rounded-xl border-l-4 border-l-emerald-400 border border-border bg-card shadow-sm p-4 transition-all hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {alertMetrics.recentHires} {alertMetrics.recentHires === 1 ? 'candidate' : 'candidates'} hired
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Moved to Hired stage across all jobs
                  </p>
                </div>
              </div>
            )}
          </div>
        </Fade>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Quick Links                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Fade duration={0.4} delay={0.15}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {QUICK_LINKS.map((link) => {
            const LinkIcon = link.icon;
            return (
              <div
                key={link.href}
                onClick={() => navigate(link.href)}
                className={`group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${link.hoverBorder}`}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${link.iconGradient} shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                  <LinkIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{link.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{link.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            );
          })}
        </div>
      </Fade>

      {/* ------------------------------------------------------------------ */}
      {/*  Announcements Card                                                 */}
      {/* ------------------------------------------------------------------ */}
      {latestAnnouncements.length > 0 && (
        <Fade duration={0.4} delay={0.2}>
          <div className="mb-8 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Megaphone className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Recent Announcements</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/announcements')}
              >
                View all
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="divide-y divide-border">
              {latestAnnouncements.map((a: any) => {
                const priorityDot: Record<string, string> = {
                  urgent: 'bg-red-500',
                  high: 'bg-amber-500',
                  normal: 'bg-blue-500',
                  low: 'bg-slate-300',
                };
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => navigate('/announcements')}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[a.priority] || priorityDot.low}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {a.pinned && <Pin className="w-3 h-3 text-blue-500 shrink-0" />}
                        <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Fade>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Pending Approvals (admin / HR only)                                */}
      {/* ------------------------------------------------------------------ */}
      {(isAdmin() || isHR()) && pendingApprovals.length > 0 && (
        <Fade duration={0.4}>
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-800 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-100/60 dark:bg-amber-900/20">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Pending Approvals ({pendingApprovals.length})
              </h2>
            </div>
            <StaggerGrid className="divide-y divide-amber-100 dark:divide-amber-800/50" inView={false}>
              {pendingApprovals.map((approval: any) => {
                const isProcessing = approvingIds.has(approval.job_id);
                return (
                  <motion.div
                    key={approval.job_id}
                    variants={fadeInUp}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-200/60 dark:bg-amber-800/40 flex items-center justify-center shrink-0">
                        <Briefcase className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => navigate(`/jobs/${approval.job_id}`)}
                        >
                          {approval.job_title || 'Untitled Job'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested by {approval.requested_by_name || 'Unknown'}
                        </p>
                      </div>
                      <ApprovalBadge status="pending" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleApproveJob(approval.job_id)}
                        className="h-7 px-3 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => handleRejectJob(approval.job_id)}
                        className="h-7 px-3 text-xs font-medium border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </StaggerGrid>
          </div>
        </Fade>
      )}
    </AppLayout>
  );
};

export default Dashboard;
