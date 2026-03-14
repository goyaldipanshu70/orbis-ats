
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
  Clock, UserCheck, Sparkles, Rocket,
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
  iconColor: string;
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
    iconColor: 'text-[#1B8EE5]',
    trendUp: true,
    trendPercent: 12,
    getValue: (s) => s.total_jobs,
    href: '/jobs',
  },
  {
    key: 'active_jobs',
    label: 'Active Roles',
    icon: Rocket,
    iconColor: 'text-blue-400',
    trendUp: true,
    trendPercent: 8,
    getValue: (s) => s.active_jobs,
  },
  {
    key: 'total_candidates',
    label: 'Total Candidates',
    icon: Users,
    iconColor: 'text-blue-400',
    trendUp: true,
    trendPercent: 24,
    getValue: (s) => s.total_candidates,
    href: '/talent-pool',
  },
  {
    key: 'recommended_candidates',
    label: 'Recommended',
    icon: Sparkles,
    iconColor: 'text-amber-400',
    trendUp: true,
    trendPercent: 15,
    getValue: (s) => s.recommended_candidates,
  },
  {
    key: 'closed_jobs',
    label: 'Closed Jobs',
    icon: CheckCircle,
    iconColor: 'text-rose-400',
    trendUp: false,
    trendPercent: 3,
    getValue: (s) => s.closed_jobs,
  },
  {
    key: 'pending_interviews',
    label: 'Pending',
    icon: Calendar,
    iconColor: 'text-cyan-400',
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
  iconColor: string;
  iconBg: string;
}

const QUICK_LINKS: QuickLinkConfig[] = [
  {
    title: 'View All Jobs',
    description: 'Manage your current job listings.',
    href: '/jobs',
    icon: Briefcase,
    iconColor: 'text-[#1B8EE5]',
    iconBg: 'bg-[#1B8EE5]/20',
  },
  {
    title: 'Talent Pool',
    description: 'Search through global talent database.',
    href: '/talent-pool',
    icon: Users,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  {
    title: 'Analytics',
    description: 'Detailed hiring performance reports.',
    href: '/analytics',
    icon: TrendingUp,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  {
    title: 'Hiring Assistant',
    description: 'AI-powered recruitment support.',
    href: '/hiring-assistant',
    icon: Zap,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20',
  },
];

/* -------------------------------------------------------------------------- */
/*  Glassmorphism style helper                                                */
/* -------------------------------------------------------------------------- */

const glassStyle: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
  boxShadow: 'var(--orbis-card-shadow)',
};

const glassHoverStyle = 'hover:bg-accent hover:border-border';

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

    const nearingDeadline = jobs.filter((j) => {
      if (j.status !== 'Open' || !j.hiring_close_date) return false;
      const closeDate = new Date(j.hiring_close_date);
      return closeDate >= now && closeDate <= sevenDaysFromNow;
    });

    const lowApplicants = jobs.filter(
      (j) => j.status === 'Open' && (j.statistics?.total_candidates ?? 0) < 5,
    );

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
      <div className="max-w-[1400px] mx-auto w-full space-y-8">
        {/* ── Header Section ─────────────────────────────────────────── */}
        <Fade direction="down" distance={12} duration={0.4} inView={false}>
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                Dashboard
              </h1>
              <p className="text-base font-medium text-muted-foreground">
                Hiring overview and key metrics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="hidden sm:block px-4 py-2 rounded-lg text-sm font-medium text-slate-300"
                style={glassStyle}
              >
                Welcome back, {firstName} &bull; {formatDate()}
              </div>
              <button
                onClick={() => navigate('/jobs/create')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-bold transition-opacity hover:opacity-90"
                style={{
                  background: 'linear-gradient(to right, #1B8EE5, #1676c0)',
                  boxShadow: '0 8px 24px rgba(27,142,229,0.2)',
                }}
              >
                <Plus className="w-4 h-4" />
                Create Job
              </button>
            </div>
          </div>
        </Fade>

        {/* ── Stats Row ──────────────────────────────────────────────── */}
        <StaggerGrid inView={false} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;

            if (isStatsLoading) {
              return (
                <div
                  key={card.key}
                  className="rounded-xl overflow-hidden h-32"
                  style={glassStyle}
                >
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-4 w-20 bg-muted" />
                    <Skeleton className="h-9 w-16 bg-muted" />
                    <Skeleton className="h-3 w-20 bg-muted" />
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
                className={`group rounded-xl p-5 flex flex-col justify-between h-32 transition-all duration-300 hover:-translate-y-1 ${card.href ? 'cursor-pointer' : ''}`}
                style={glassStyle}
              >
                <div className="flex justify-between items-start">
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${card.trendUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                    {card.trendUp ? '+' : '-'}{card.trendPercent}%
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{card.label}</p>
                  <CountingNumber value={value} className="text-2xl font-bold text-foreground" />
                </div>
              </motion.div>
            );
          })}
        </StaggerGrid>

        {/* ── Alert Metrics ──────────────────────────────────────────── */}
        {!isLoading && jobs.length > 0 && (alertMetrics.nearingDeadline.length > 0 || alertMetrics.lowApplicants.length > 0 || alertMetrics.recentHires > 0) && (
          <Fade duration={0.4}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {alertMetrics.nearingDeadline.length > 0 && (
                <div
                  className="flex items-center gap-4 p-5 rounded-xl border-l-4 border-l-amber-500"
                  style={glassStyle}
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-bold text-sm">
                      {alertMetrics.nearingDeadline.length} {alertMetrics.nearingDeadline.length === 1 ? 'job' : 'jobs'} nearing deadline
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">Action required within 48h</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {alertMetrics.nearingDeadline.slice(0, 3).map((j) => (
                        <span
                          key={j.job_id}
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${j.job_id}`); }}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 cursor-pointer hover:bg-amber-500/25 transition-colors truncate max-w-[160px]"
                        >
                          {j.job_title}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-1 rounded">Urgent</span>
                </div>
              )}

              {alertMetrics.lowApplicants.length > 0 && (
                <div
                  className="flex items-center gap-4 p-5 rounded-xl border-l-4 border-l-rose-500"
                  style={glassStyle}
                >
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-bold text-sm">
                      {alertMetrics.lowApplicants.length} {alertMetrics.lowApplicants.length === 1 ? 'job needs' : 'jobs need'} applicants
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">Low volume detected</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {alertMetrics.lowApplicants.slice(0, 3).map((j) => (
                        <span
                          key={j.job_id}
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${j.job_id}`); }}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 cursor-pointer hover:bg-rose-500/25 transition-colors truncate max-w-[160px]"
                        >
                          {j.job_title} ({j.statistics?.total_candidates ?? 0})
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 bg-rose-500/20 text-rose-300 text-xs font-bold px-2 py-1 rounded">Boost</span>
                </div>
              )}

              {alertMetrics.recentHires > 0 && (
                <div
                  className="flex items-center gap-4 p-5 rounded-xl border-l-4 border-l-emerald-500"
                  style={glassStyle}
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-bold text-sm">
                      {alertMetrics.recentHires} {alertMetrics.recentHires === 1 ? 'candidate' : 'candidates'} hired
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">Target reached across all jobs</p>
                  </div>
                  <span className="shrink-0 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2 py-1 rounded">Growth</span>
                </div>
              )}
            </div>
          </Fade>
        )}

        {/* ── Main Content Grid (Quick Links + Approvals | Announcements) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Quick Links */}
            <Fade duration={0.4} delay={0.15}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {QUICK_LINKS.map((link) => {
                  const LinkIcon = link.icon;
                  return (
                    <div
                      key={link.href}
                      onClick={() => navigate(link.href)}
                      className={`group p-4 rounded-xl cursor-pointer transition-all duration-200 ${glassHoverStyle}`}
                      style={glassStyle}
                    >
                      <div className={`w-10 h-10 rounded-full ${link.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <LinkIcon className={`w-[18px] h-[18px] ${link.iconColor}`} />
                      </div>
                      <h3 className="text-foreground font-semibold text-sm">{link.title}</h3>
                      <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{link.description}</p>
                    </div>
                  );
                })}
              </div>
            </Fade>

            {/* Pending Approvals */}
            {(isAdmin() || isHR()) && pendingApprovals.length > 0 && (
              <Fade duration={0.4}>
                <div className="rounded-xl overflow-hidden" style={glassStyle}>
                  <div className="px-6 py-4 border-b border-border flex justify-between items-center" style={{ background: 'rgba(245,158,11,0.05)' }}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-amber-500" />
                      <h2 className="text-foreground font-bold">Pending Approvals ({pendingApprovals.length})</h2>
                    </div>
                    <button
                      onClick={() => navigate('/job-requests')}
                      className="text-[#1B8EE5] text-xs font-bold hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <StaggerGrid className="divide-y divide-border" inView={false}>
                    {pendingApprovals.map((approval: any) => {
                      const isProcessing = approvingIds.has(approval.job_id);
                      return (
                        <motion.div
                          key={approval.job_id}
                          variants={fadeInUp}
                          className="p-4 flex items-center justify-between hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Briefcase className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-foreground font-semibold text-sm truncate cursor-pointer hover:text-[#1B8EE5] transition-colors"
                                onClick={() => navigate(`/jobs/${approval.job_id}`)}
                              >
                                {approval.job_title || 'Untitled Job'}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Requested by {approval.requested_by_name || 'Unknown'}
                              </p>
                            </div>
                            <ApprovalBadge status="pending" />
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              disabled={isProcessing}
                              onClick={() => handleApproveJob(approval.job_id)}
                              className="px-3 py-1.5 rounded-lg border border-emerald-500/50 text-emerald-500 text-xs font-bold hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3 h-3 mr-1 inline" />
                              Approve
                            </button>
                            <button
                              disabled={isProcessing}
                              onClick={() => handleRejectJob(approval.job_id)}
                              className="px-3 py-1.5 rounded-lg border border-rose-500/50 text-rose-500 text-xs font-bold hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3 mr-1 inline" />
                              Reject
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </StaggerGrid>
                </div>
              </Fade>
            )}
          </div>

          {/* Right Column — Announcements */}
          {latestAnnouncements.length > 0 && (
            <div className="lg:col-span-4">
              <Fade duration={0.4} delay={0.2}>
                <div className="rounded-xl h-full" style={glassStyle}>
                  <div className="p-5 border-b border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1B8EE5]/10 flex items-center justify-center">
                      <Megaphone className="w-4 h-4 text-[#1B8EE5]" />
                    </div>
                    <h2 className="text-foreground font-bold">Recent Announcements</h2>
                  </div>
                  <div className="p-5 space-y-6">
                    {latestAnnouncements.map((a: any, idx: number) => {
                      const priorityColors: Record<string, string> = {
                        urgent: 'border-rose-500/30',
                        high: 'border-amber-500/30',
                        normal: 'border-[#1B8EE5]/30',
                        low: 'border-slate-700',
                      };
                      const dotColors: Record<string, string> = {
                        urgent: 'bg-rose-500',
                        high: 'bg-amber-500',
                        normal: 'bg-[#1B8EE5]',
                        low: 'bg-slate-500',
                      };
                      return (
                        <div
                          key={a.id}
                          className={`relative pl-6 border-l-2 ${priorityColors[a.priority] || priorityColors.low} cursor-pointer`}
                          onClick={() => navigate('/announcements')}
                        >
                          <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${dotColors[a.priority] || dotColors.low}`} />
                          <div className="flex items-center gap-2">
                            {a.pinned && <Pin className="w-3 h-3 text-blue-400 shrink-0" />}
                            <p className="text-foreground text-sm font-semibold truncate">{a.title}</p>
                          </div>
                          <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{a.content}</p>
                          <span className="text-[10px] text-muted-foreground uppercase mt-2 block font-bold">
                            {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-5">
                    <button
                      onClick={() => navigate('/announcements')}
                      className="w-full py-2.5 rounded-lg border border-border text-muted-foreground text-xs font-bold hover:bg-accent transition-colors"
                    >
                      View Full Archive
                    </button>
                  </div>
                </div>
              </Fade>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
