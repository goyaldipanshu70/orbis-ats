import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp, hoverLift, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { AnimatedProgress } from '@/components/ui/animated-progress';
import { apiClient } from '@/utils/api';
import CandidateLayout from '@/components/layout/CandidateLayout';
import StatusTimeline from '@/components/StatusTimeline';
import { Button } from '@/components/ui/button';
import { ListToolbar } from '@/components/ListToolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Clock, CheckCircle2, XCircle, AlertCircle, Briefcase,
  ChevronRight, Loader2, Send, Eye, Star, CalendarClock,
  TrendingUp, Activity, Award, Filter,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  submitted:  { label: 'Applied',       color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50 dark:bg-blue-900/30',      border: 'border-blue-200 dark:border-blue-800',     icon: Send },
  screening:  { label: 'Screening',     color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-900/30',    border: 'border-amber-200 dark:border-amber-800',   icon: Eye },
  shortlisted:{ label: 'Shortlisted',   color: 'text-cyan-700 dark:text-cyan-300',    bg: 'bg-cyan-50 dark:bg-cyan-900/30',      border: 'border-cyan-200 dark:border-cyan-800',     icon: Star },
  interview:  { label: 'Interview',     color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30',  border: 'border-purple-200 dark:border-purple-800', icon: Clock },
  offered:    { label: 'Offered',       color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800', icon: Award },
  hired:      { label: 'Hired',         color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-50 dark:bg-green-900/30',    border: 'border-green-200 dark:border-green-800',   icon: CheckCircle2 },
  rejected:   { label: 'Not Selected',  color: 'text-red-700 dark:text-red-300',      bg: 'bg-red-50 dark:bg-red-900/30',        border: 'border-red-200 dark:border-red-800',       icon: XCircle },
  withdrawn:  { label: 'Withdrawn',     color: 'text-muted-foreground',               bg: 'bg-muted',                            border: 'border-border',                            icon: AlertCircle },
};

const PROGRESS_STAGES = ['submitted', 'screening', 'shortlisted', 'interview', 'offered', 'hired'];

const PROGRESS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500',
  screening: 'bg-amber-500',
  shortlisted: 'bg-cyan-500',
  interview: 'bg-purple-500',
  offered: 'bg-emerald-500',
  hired: 'bg-green-500',
};

function getProgressPercent(status: string): number {
  const idx = PROGRESS_STAGES.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / PROGRESS_STAGES.length) * 100);
}

const kpiVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

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

const MyApplications = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

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

  const stats = {
    total: total,
    active: applications.filter(a => !['rejected', 'withdrawn', 'hired'].includes(a.status)).length,
    interviews: applications.filter(a => a.status === 'interview').length,
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const kpis = [
    {
      label: 'Total Applied',
      value: stats.total,
      icon: Briefcase,
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Active',
      value: stats.active,
      icon: Activity,
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Interviews',
      value: stats.interviews,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-violet-600',
      iconBg: 'bg-purple-100 dark:bg-purple-900/40',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ];

  const filteredApplications = useMemo(() => {
    let result = [...applications];

    // Filter by search term (job title)
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => a.job_title?.toLowerCase().includes(q));
    }

    // Filter by status
    if (statusFilter) {
      result = result.filter(a => a.status === statusFilter);
    }

    // Sort
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

  return (
    <CandidateLayout>
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Track the progress of every role you have applied for, from submission through to offer.
          </p>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={kpi.label}
                custom={i}
                variants={kpiVariants}
                initial="hidden"
                animate="visible"
                className="relative overflow-hidden rounded-xl border border-border bg-card p-5 hover:shadow-lg transition-shadow duration-300"
              >
                {/* Subtle gradient accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.gradient} rounded-t-xl`} />

                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {kpi.label}
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                      {kpi.value}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                    <Icon className={`h-5 w-5 ${kpi.iconColor}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Toolbar row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
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
              <SelectTrigger className="w-[160px] h-9 text-xs rounded-lg bg-muted/40 border-border/60">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Spacer + count + Browse Jobs */}
            <div className="flex items-center gap-3 ml-auto">
              <p className="text-xs text-muted-foreground tabular-nums">
                {filteredApplications.length} of {applications.length} shown
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/careers')}
                className="rounded-lg gap-1.5 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
              >
                <Briefcase className="h-4 w-4" /> Browse Jobs
              </Button>
            </div>
          </ListToolbar>
        </motion.div>

        {/* Application List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Loading applications...</p>
          </div>
        ) : filteredApplications.length === 0 && applications.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-dashed border-border bg-card p-16 text-center"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Filter className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">No matching applications</p>
            <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
              Try adjusting your search or filter criteria.
            </p>
            <Button
              variant="outline"
              onClick={() => { setSearch(''); setStatusFilter(''); setSortBy('newest'); }}
              className="rounded-xl"
            >
              Clear Filters
            </Button>
          </motion.div>
        ) : applications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-dashed border-border bg-card p-16 text-center"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-lg font-semibold text-foreground">No applications yet</p>
            <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
              Browse open positions and submit your first application to get started.
            </p>
            <Button
              onClick={() => navigate('/careers')}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20"
            >
              Browse Jobs
            </Button>
          </motion.div>
        ) : (
          <StaggerGrid className="space-y-4">
            {filteredApplications.map(app => {
              const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted;
              const StatusIcon = sc.icon;
              const progressPct = getProgressPercent(app.status);
              const barColor = PROGRESS_COLORS[app.status] || 'bg-blue-500';

              return (
                <motion.div key={app.id} variants={fadeInUp} whileHover={hoverLift}>
                  <button
                    onClick={() => navigate(`/my-applications/${app.id}`)}
                    className="group w-full text-left rounded-xl border border-border bg-card p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300"
                  >
                    {/* Top row: icon + title + badges */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shrink-0 shadow-sm">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate text-[15px]">
                            {app.job_title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Applied {formatDate(app.applied_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {app.ai_score !== null && app.ai_score !== undefined && (
                          <div className="flex items-center gap-1 rounded-lg bg-muted/60 px-2.5 py-1">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {Math.round(app.ai_score)}%
                            </span>
                          </div>
                        )}
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${sc.color} ${sc.bg} ${sc.border}`}>
                          <StatusIcon className="h-3 w-3" />
                          {sc.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Progress bar */}
                    {!['rejected', 'withdrawn'].includes(app.status) && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Progress</span>
                          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{progressPct}%</span>
                        </div>
                        <AnimatedProgress value={progressPct} className="h-1.5 rounded-full" barClassName={barColor} />
                      </div>
                    )}

                    {/* Status message & estimated next step */}
                    {(app.status_message || app.estimated_next_step_date) && (
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        {app.status_message && (
                          <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-2.5 py-1">
                            {app.status_message}
                          </p>
                        )}
                        {app.estimated_next_step_date && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1">
                            <CalendarClock className="h-3 w-3" />
                            Next step: {formatDate(app.estimated_next_step_date)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Inline StatusTimeline (compact) */}
                    <div className="mt-4 pt-3 border-t border-border/50" onClick={e => e.stopPropagation()}>
                      <StatusTimeline currentStatus={app.status} lastUpdated={app.updated_at} />
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </StaggerGrid>
        )}
      </div>
    </CandidateLayout>
  );
};

export default MyApplications;
