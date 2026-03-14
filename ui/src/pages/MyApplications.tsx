import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { apiClient } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import CandidateLayout from '@/components/layout/CandidateLayout';
import StatusTimeline from '@/components/StatusTimeline';
import { ListToolbar } from '@/components/ListToolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnimatedProgress } from '@/components/ui/animated-progress';
import {
  FileText, Clock, CheckCircle2, XCircle, AlertCircle, Briefcase,
  ChevronRight, Loader2, Send, Eye, Star, CalendarClock,
  TrendingUp, Activity, Award, Filter, Sparkles, MapPin, DollarSign,
  Calendar, ArrowRight,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────── */
/*  STATUS CONFIG                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  submitted:  { label: 'Applied',       color: 'text-blue-400',    bg: 'bg-blue-500/10',      border: 'border-blue-500/20',     icon: Send },
  screening:  { label: 'Screening',     color: 'text-amber-400',   bg: 'bg-amber-500/10',     border: 'border-amber-500/20',    icon: Eye },
  shortlisted:{ label: 'Shortlisted',   color: 'text-cyan-400',    bg: 'bg-cyan-500/10',      border: 'border-cyan-500/20',     icon: Star },
  interview:  { label: 'Interview',     color: 'text-blue-400',    bg: 'bg-blue-500/10',      border: 'border-blue-500/20',     icon: Clock },
  offered:    { label: 'Offered',       color: 'text-emerald-400', bg: 'bg-emerald-500/10',   border: 'border-emerald-500/20',  icon: Award },
  hired:      { label: 'Hired',         color: 'text-green-400',   bg: 'bg-green-500/10',     border: 'border-green-500/20',    icon: CheckCircle2 },
  rejected:   { label: 'Not Selected',  color: 'text-red-400',     bg: 'bg-red-500/10',       border: 'border-red-500/20',      icon: XCircle },
  withdrawn:  { label: 'Withdrawn',     color: 'text-slate-500',   bg: 'bg-white/5',          border: 'border-white/10',        icon: AlertCircle },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  PROGRESS STAGES                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const PROGRESS_STAGES = ['submitted', 'screening', 'shortlisted', 'interview', 'offered', 'hired'];

const PROGRESS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500',
  screening: 'bg-amber-500',
  shortlisted: 'bg-cyan-500',
  interview: 'bg-blue-500',
  offered: 'bg-emerald-500',
  hired: 'bg-green-500',
};

function getProgressPercent(status: string): number {
  const idx = PROGRESS_STAGES.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / PROGRESS_STAGES.length) * 100);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  ANIMATION VARIANTS                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const kpiVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cardFadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  SORT / FILTER OPTIONS                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Title A-Z', value: 'title_az' },
  { label: 'Highest Score', value: 'score_desc' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offered', label: 'Offered' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Not Selected' },
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  SHARED STYLES                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

const sItemCls = 'text-slate-200 focus:bg-white/10 focus:text-white';

/* ────────────────────────────────────────────────────────────────────────── */
/*  RECOMMENDED JOBS HELPER                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function formatSalaryRange(sr: any): string {
  if (!sr) return '';
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  };
  const currency = sr.currency || '';
  if (sr.min && sr.max) return `${currency} ${fmt(sr.min)} - ${fmt(sr.max)}`;
  if (sr.min) return `${currency} ${fmt(sr.min)}+`;
  if (sr.max) return `Up to ${currency} ${fmt(sr.max)}`;
  return '';
}

function deriveMatch(jobId: number | string): number {
  const hash = String(jobId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return 78 + (hash % 18);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  PROFILE COMPLETION RING                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function ProfileCompletionRing({ percent }: { percent: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const size = 88;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center gap-2">
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1B8EE5" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold text-white tabular-nums">{percent}%</span>
        <span className="text-[9px] text-slate-300 font-medium uppercase tracking-wider">Complete</span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  MATCH SCORE RING (small, for application cards)                         */
/* ────────────────────────────────────────────────────────────────────────── */

function MatchScoreRing({ score }: { score: number }) {
  const size = 38;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(27,142,229,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1B8EE5"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-blue-300 tabular-nums">{score}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  MAIN COMPONENT                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const MyApplications = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

  useEffect(() => {
    apiClient.request('/api/careers/jobs?page=1&page_size=3')
      .then((data: any) => {
        const jobs = (data.items || data || []).slice(0, 3).map((j: any) => ({
          id: j.id,
          title: j.title,
          location: j.location || 'Remote',
          salary: formatSalaryRange(j.salary_range),
          match: deriveMatch(j.id),
          type: j.employment_type || 'Full-time',
        }));
        setRecommendedJobs(jobs);
      })
      .catch(() => {});
  }, []);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getMyApplications(page, 20);
      setApplications(data.items);
      setTotal(data.total);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApps(); }, [page]);

  /* ─── Derived stats ─── */

  const stats = {
    total: total,
    active: applications.filter(a => !['rejected', 'withdrawn', 'hired'].includes(a.status)).length,
    interviews: applications.filter(a => a.status === 'interview').length,
  };

  const avgAiScore = useMemo(() => {
    const scored = applications.filter(a => a.ai_score !== null && a.ai_score !== undefined);
    if (scored.length === 0) return null;
    const sum = scored.reduce((acc, a) => acc + (a.ai_score as number), 0);
    return Math.round(sum / scored.length);
  }, [applications]);

  const upcomingInterviews = useMemo(() => {
    return applications.filter(a => a.status === 'interview');
  }, [applications]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  /* ─── KPI cards data ─── */

  const kpis = [
    {
      label: 'Total Applied',
      value: stats.total,
      icon: Briefcase,
      gradient: 'linear-gradient(90deg, #1676c0, #818cf8)',
      iconBg: 'rgba(22,118,192,0.1)',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Active',
      value: stats.active,
      icon: Activity,
      gradient: 'linear-gradient(90deg, #10b981, #14b8a6)',
      iconBg: 'rgba(16,185,129,0.1)',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Interviews',
      value: stats.interviews,
      icon: TrendingUp,
      gradient: 'linear-gradient(90deg, #a855f7, #1B8EE5)',
      iconBg: 'rgba(168,85,247,0.1)',
      iconColor: 'text-blue-400',
    },
    {
      label: 'AI Score',
      value: avgAiScore !== null ? `${avgAiScore}%` : '--',
      icon: Star,
      gradient: 'linear-gradient(90deg, #f59e0b, #f97316)',
      iconBg: 'rgba(245,158,11,0.1)',
      iconColor: 'text-amber-400',
    },
  ];

  /* ─── Filtered & sorted applications ─── */

  const filteredApplications = useMemo(() => {
    let result = [...applications];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => a.job_title?.toLowerCase().includes(q));
    }

    if (statusFilter) {
      result = result.filter(a => a.status === statusFilter);
    }

    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime());
        break;
      case 'title_az':
        result.sort((a, b) => (a.job_title || '').localeCompare(b.job_title || ''));
        break;
      case 'score_desc':
        result.sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());
        break;
    }

    return result;
  }, [applications, search, statusFilter, sortBy]);

  /* ─── Render ─── */

  return (
    <CandidateLayout>
      <div className="max-w-7xl mx-auto">

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  WELCOME BANNER                                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 mb-8"
          style={{
            background: 'linear-gradient(135deg, rgba(27,142,229,0.15) 0%, rgba(22,118,192,0.08) 100%)',
            border: '1px solid rgba(27,142,229,0.2)',
          }}
        >
          {/* Decorative blur orb */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(27,142,229,0.25) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
          <div
            className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(22,118,192,0.15) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Left content */}
            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
              >
                Welcome back, {user?.first_name || 'there'}!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="text-sm text-slate-300 mt-2 max-w-lg"
              >
                Here&apos;s what&apos;s happening with your applications
              </motion.p>
            </div>

            {/* Right: Profile completion ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-2 shrink-0"
            >
              <ProfileCompletionRing percent={75} />
              <button
                onClick={() => navigate('/candidate/onboarding')}
                className="text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors flex items-center gap-1"
              >
                Complete your profile
                <ArrowRight className="h-3 w-3" />
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  STATS ROW - 4 KPI CARDS                                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={kpi.label}
                custom={i}
                variants={kpiVariants}
                initial="hidden"
                animate="visible"
                className="relative overflow-hidden rounded-xl p-5 transition-all duration-300"
                style={{
                  background: 'var(--orbis-card)',
                  border: '1px solid var(--orbis-border)',
                }}
              >
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: kpi.gradient }} />

                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {kpi.label}
                    </p>
                    <p className="text-3xl font-bold text-white mt-2 tabular-nums">
                      {kpi.value}
                    </p>
                  </div>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: kpi.iconBg }}
                  >
                    <Icon className={`h-5 w-5 ${kpi.iconColor}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  TWO-COLUMN LAYOUT                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ───────────────────────────────────────────────────────────────── */}
          {/*  LEFT COLUMN (65%) - Applications                               */}
          {/* ───────────────────────────────────────────────────────────────── */}

          <div className="flex-1 lg:w-[65%] min-w-0">

            {/* Section header + Toolbar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mb-4"
            >
              <h2 className="text-lg font-semibold text-white mb-4">Your Applications</h2>

              <ListToolbar
                searchPlaceholder="Search by job title..."
                searchValue={search}
                onSearchChange={setSearch}
                sortOptions={SORT_OPTIONS}
                sortValue={sortBy}
                onSortChange={setSortBy}
              >
                {/* Status filter */}
                <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-[160px] h-9 text-xs rounded-lg border-0 text-slate-300" style={glassInput}>
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>
                    {STATUS_FILTER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'} className={`text-xs ${sItemCls}`}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Spacer + count + Browse Jobs */}
                <div className="flex items-center gap-3 ml-auto">
                  <p className="text-xs text-slate-500 tabular-nums">
                    {filteredApplications.length} of {applications.length} shown
                  </p>
                  <button
                    onClick={() => navigate('/careers')}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-all"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(27,142,229,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(27,142,229,0.25)';
                      e.currentTarget.style.color = '#4db5f0';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--orbis-input)';
                      e.currentTarget.style.borderColor = 'var(--orbis-border)';
                      e.currentTarget.style.color = '#cbd5e1';
                    }}
                  >
                    <Briefcase className="h-4 w-4" /> Browse Jobs
                  </button>
                </div>
              </ListToolbar>
            </motion.div>

            {/* Application List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <p className="text-sm text-slate-500">Loading applications...</p>
              </div>
            ) : filteredApplications.length === 0 && applications.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl p-16 text-center"
                style={{ background: 'var(--orbis-card)', border: '1px dashed var(--orbis-border)' }}
              >
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--orbis-input)' }}>
                  <Filter className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-lg font-semibold text-white">No matching applications</p>
                <p className="text-sm text-slate-400 mt-2 mb-6 max-w-sm mx-auto">
                  Try adjusting your search or filter criteria.
                </p>
                <button
                  onClick={() => { setSearch(''); setStatusFilter(''); setSortBy('newest'); }}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-300 transition-all"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-input)'; }}
                >
                  Clear Filters
                </button>
              </motion.div>
            ) : applications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl p-16 text-center"
                style={{ background: 'var(--orbis-card)', border: '1px dashed var(--orbis-border)' }}
              >
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(22,118,192,0.1)' }}>
                  <FileText className="h-8 w-8 text-blue-400" />
                </div>
                <p className="text-lg font-semibold text-white">No applications yet</p>
                <p className="text-sm text-slate-400 mt-2 mb-6 max-w-sm mx-auto">
                  Browse open positions and submit your first application to get started.
                </p>
                <button
                  onClick={() => navigate('/careers')}
                  className="rounded-xl text-white px-6 py-2.5 text-sm font-semibold transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
                    boxShadow: '0 4px 20px rgba(27,142,229,0.25)',
                  }}
                >
                  Browse Jobs
                </button>
              </motion.div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {filteredApplications.map(app => {
                  const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted;
                  const StatusIcon = sc.icon;
                  const progressPct = getProgressPercent(app.status);
                  const barColor = PROGRESS_COLORS[app.status] || 'bg-blue-500';
                  const matchScore = app.ai_score !== null && app.ai_score !== undefined
                    ? Math.round(app.ai_score)
                    : null;

                  return (
                    <motion.div key={app.id} variants={cardFadeIn}>
                      <button
                        onClick={() => navigate(`/my-applications/${app.id}`)}
                        className="group w-full text-left rounded-xl p-6 transition-all duration-300"
                        style={{
                          background: 'var(--orbis-card)',
                          border: '1px solid var(--orbis-border)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--orbis-input)';
                          e.currentTarget.style.borderColor = 'rgba(27,142,229,0.25)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--orbis-card)';
                          e.currentTarget.style.borderColor = 'var(--orbis-border)';
                        }}
                      >
                        {/* Top row: icon + title + badges */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Match score ring or default briefcase icon */}
                            {matchScore !== null ? (
                              <MatchScoreRing score={matchScore} />
                            ) : (
                              <div
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shrink-0"
                                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                              >
                                <Briefcase className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors truncate text-[15px]">
                                {app.job_title}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Applied {formatDate(app.applied_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {matchScore !== null && (
                              <div
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1"
                                style={{ background: 'rgba(245,158,11,0.1)' }}
                              >
                                <Star className="h-3.5 w-3.5 text-amber-400" />
                                <span className="text-sm font-semibold text-white tabular-nums">
                                  {matchScore}%
                                </span>
                              </div>
                            )}
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${sc.color} ${sc.bg} ${sc.border}`}>
                              <StatusIcon className="h-3 w-3" />
                              {sc.label}
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>

                        {/* Progress bar */}
                        {!['rejected', 'withdrawn'].includes(app.status) && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Progress</span>
                              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{progressPct}%</span>
                            </div>
                            <AnimatedProgress value={progressPct} className="h-1.5 rounded-full" barClassName={barColor} />
                          </div>
                        )}

                        {/* Status message & estimated next step */}
                        {(app.status_message || app.estimated_next_step_date) && (
                          <div className="mt-3 flex items-center gap-3 flex-wrap">
                            {app.status_message && (
                              <p
                                className="text-xs text-slate-400 italic rounded-lg px-2.5 py-1"
                                style={{ background: 'var(--orbis-card)' }}
                              >
                                {app.status_message}
                              </p>
                            )}
                            {app.estimated_next_step_date && (
                              <span
                                className="inline-flex items-center gap-1.5 text-xs text-slate-500 rounded-lg px-2.5 py-1"
                                style={{ background: 'var(--orbis-card)' }}
                              >
                                <CalendarClock className="h-3 w-3" />
                                Next step: {formatDate(app.estimated_next_step_date)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Inline StatusTimeline (compact) */}
                        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--orbis-grid)' }} onClick={e => e.stopPropagation()}>
                          <StatusTimeline currentStatus={app.status} lastUpdated={app.updated_at} />
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/*  RIGHT COLUMN (35%) - Recommendations + Upcoming Interviews     */}
          {/* ───────────────────────────────────────────────────────────────── */}

          <div className="w-full lg:w-[35%] space-y-6">

            {/* ─── Recommended Jobs ─── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--orbis-card)',
                border: '1px solid var(--orbis-border)',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(168,85,247,0.1)' }}
                >
                  <Sparkles className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Jobs For You</h3>
                  <p className="text-[11px] text-slate-500">Personalized recommendations</p>
                </div>
              </div>

              {/* Job cards */}
              <div className="px-4 pb-2">
                {recommendedJobs.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    <Briefcase className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                    <p>Loading recommendations...</p>
                  </div>
                )}
                {recommendedJobs.map((job, i) => (
                  <motion.div
                    key={job.id}
                    variants={fadeSlideUp}
                    className="p-3 rounded-lg mb-2 transition-all duration-200 group/job cursor-pointer"
                    style={{ background: 'var(--orbis-input)', border: '1px solid transparent' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(27,142,229,0.2)';
                      e.currentTarget.style.background = 'rgba(27,142,229,0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.background = 'var(--orbis-input)';
                    }}
                    onClick={() => navigate(`/careers/${job.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-white group-hover/job:text-blue-300 transition-colors leading-snug">
                        {job.title}
                      </h4>
                      {/* Match badge */}
                      <span
                        className="shrink-0 text-[11px] font-bold text-white px-2 py-0.5 rounded-full tabular-nums"
                        style={{
                          background: 'linear-gradient(135deg, #1B8EE5, #a855f7)',
                        }}
                      >
                        {job.match}% Match
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                      <span
                        className="text-[11px] text-slate-400 px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        {job.type}
                      </span>
                      {job.salary && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <DollarSign className="h-3 w-3" />
                          {job.salary}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/careers/${job.id}`);
                        }}
                        className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 px-2.5 py-1 rounded-md"
                        style={{ background: 'rgba(27,142,229,0.1)' }}
                      >
                        Apply
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Browse All */}
              <div
                className="px-5 py-3"
                style={{ borderTop: '1px solid var(--orbis-border)' }}
              >
                <button
                  onClick={() => navigate('/careers')}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 w-full justify-center"
                >
                  Browse All Jobs
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </motion.div>

            {/* ─── Upcoming Interviews ─── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--orbis-card)',
                border: '1px solid var(--orbis-border)',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(27,142,229,0.1)' }}
                >
                  <Calendar className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Upcoming Interviews</h3>
                  <p className="text-[11px] text-slate-500">
                    {upcomingInterviews.length > 0
                      ? `${upcomingInterviews.length} scheduled`
                      : 'None scheduled'}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4">
                {upcomingInterviews.length === 0 ? (
                  <motion.div
                    variants={fadeSlideUp}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl mb-3"
                      style={{ background: 'var(--orbis-input)' }}
                    >
                      <Calendar className="h-6 w-6 text-slate-500" />
                    </div>
                    <p className="text-sm text-slate-400">No upcoming interviews</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
                      When you advance to the interview stage, your sessions will appear here.
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {upcomingInterviews.map((app) => (
                      <motion.div
                        key={app.id}
                        variants={fadeSlideUp}
                        className="p-3 rounded-lg transition-all duration-200 group/int"
                        style={{ background: 'var(--orbis-input)', border: '1px solid transparent' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'rgba(27,142,229,0.2)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate group-hover/int:text-blue-300 transition-colors">
                              {app.job_title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {/* Date badge */}
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-slate-300 px-2 py-0.5 rounded"
                                style={{ background: 'rgba(27,142,229,0.1)' }}
                              >
                                <CalendarClock className="h-3 w-3 text-blue-400" />
                                {app.estimated_next_step_date
                                  ? formatShortDate(app.estimated_next_step_date)
                                  : 'Date TBD'}
                              </span>
                              {/* AI Interview badge */}
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-purple-300 px-2 py-0.5 rounded"
                                style={{ background: 'rgba(168,85,247,0.1)' }}
                              >
                                <Sparkles className="h-3 w-3" />
                                AI Interview
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-end">
                          <button
                            onClick={() => navigate(`/my-applications/${app.id}`)}
                            className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 px-2.5 py-1 rounded-md"
                            style={{ background: 'rgba(27,142,229,0.1)' }}
                          >
                            Prepare
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </CandidateLayout>
  );
};

export default MyApplications;
