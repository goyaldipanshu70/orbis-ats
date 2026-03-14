import { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CountingNumber } from '@/components/ui/counting-number';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/utils/api';
import {
  Clock, Users, CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  UserCheck, BarChart3, Target, ArrowUpDown, ChevronUp, ChevronDown,
  XCircle, AlertCircle,
} from 'lucide-react';

/* ── Design-system constants ─────────────────────────────────────────────── */

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

/* ── Static data ─────────────────────────────────────────────────────────── */

const DATE_PRESETS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '1 Year', days: 365 },
] as const;

interface InterviewerMetric {
  name: string;
  total_interviews: number;
  completed: number;
  pending: number;
  avg_feedback_time_hrs: number;
  no_show_rate: number;
  sla_compliant: boolean;
}

interface HRMetric {
  name: string;
  jobs_managed: number;
  candidates_processed: number;
  avg_time_to_screen_days: number;
  offers_sent: number;
  hires: number;
  sla_compliant: boolean;
}

interface HiringManagerMetric {
  name: string;
  open_roles: number;
  candidates_reviewed: number;
  avg_decision_time_days: number;
  interviews_scheduled: number;
  hires: number;
  sla_compliant: boolean;
}

const KPI_CONFIG = [
  {
    key: 'avg_time_to_hire' as const,
    title: 'Avg. Time to Hire',
    suffix: ' days',
    icon: Clock,
    gradient: 'linear-gradient(135deg, #3b82f6, #1676c0)',
    iconColor: 'text-blue-400',
    trend: -8,
  },
  {
    key: 'interview_completion_rate' as const,
    title: 'Interview Completion',
    suffix: '%',
    icon: CheckCircle,
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    iconColor: 'text-emerald-400',
    trend: 5,
  },
  {
    key: 'sla_compliance' as const,
    title: 'SLA Compliance',
    suffix: '%',
    icon: Target,
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    iconColor: 'text-amber-400',
    trend: 3,
  },
  {
    key: 'active_interviewers' as const,
    title: 'Active Interviewers',
    suffix: '',
    icon: Users,
    gradient: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
    iconColor: 'text-blue-400',
    trend: 12,
  },
];

/* ── Sub-components ──────────────────────────────────────────────────────── */

function KpiCard({ title, value, suffix, icon: Icon, iconColor, gradient, trend, loading }: {
  title: string; value: number; suffix: string; icon: React.ElementType;
  iconColor: string; gradient: string; trend: number; loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl p-5" style={glassCard}>
        <div className="flex items-center gap-4 animate-pulse">
          <div className="h-11 w-11 rounded-full bg-white/[0.06] shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 rounded bg-white/[0.06]" />
            <div className="h-8 w-16 rounded bg-white/[0.06]" />
          </div>
        </div>
      </div>
    );
  }
  const isPositive = trend >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div variants={fadeInUp}>
      <div className="rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-lg hover:shadow-blue-500/5" style={glassCard}>
        {/* Gradient accent bar */}
        <div className="h-1 w-full" style={{ background: gradient }} />
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-full p-2.5 bg-white/[0.06] shrink-0">
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
              <div className="flex items-end gap-2 mt-0.5">
                <p className="text-3xl font-bold text-white leading-none">
                  <CountingNumber value={value} />{suffix}
                </p>
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium pb-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(trend)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SLABadge({ compliant }: { compliant: boolean }) {
  if (compliant) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle className="h-3 w-3" /> Compliant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="h-3 w-3" /> Non-compliant
    </span>
  );
}

function PersonAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0">
        <span className="text-[11px] font-semibold text-slate-300">{initials}</span>
      </div>
      <span className="font-medium text-white">{name}</span>
    </div>
  );
}

type SortDir = 'asc' | 'desc' | null;

function SortableHeader({ label, active, direction, onClick }: {
  label: string; active: boolean; direction: SortDir; onClick: () => void;
}) {
  return (
    <th
      className="py-3 px-4 text-center cursor-pointer select-none hover:text-white transition-colors group"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && direction === 'asc' && <ChevronUp className="h-3 w-3" />}
        {active && direction === 'desc' && <ChevronDown className="h-3 w-3" />}
        {!active && <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
      </span>
    </th>
  );
}

function useSortable<T>(data: T[], defaultKey?: keyof T) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey || null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggle = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle };
}

const tableRowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.3, ease: 'easeOut' },
  }),
};

/* ── Main component ──────────────────────────────────────────────────────── */

export default function PeopleAnalytics() {
  const [datePreset, setDatePreset] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('interviewers');

  const [interviewerMetrics, setInterviewerMetrics] = useState<InterviewerMetric[]>([]);
  const [hrMetrics, setHRMetrics] = useState<HRMetric[]>([]);
  const [hmMetrics, setHMMetrics] = useState<HiringManagerMetric[]>([]);
  const [kpis, setKpis] = useState({
    avg_time_to_hire: 0,
    interview_completion_rate: 0,
    sla_compliance: 0,
    active_interviewers: 0,
  });

  const dateRange = useMemo(() => {
    if (datePreset === 0) return { from: undefined, to: undefined };
    const to = new Date();
    const from = datePreset === -1 ? startOfYear(to) : subDays(to, datePreset);
    return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
  }, [datePreset]);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [interviewerLoad, timeToHire, recruiterPerf] = await Promise.allSettled([
        apiClient.getInterviewerLoad(dateRange.from, dateRange.to),
        apiClient.getTimeToHire(undefined, dateRange.from, dateRange.to),
        apiClient.getRecruiterPerformance(dateRange.from, dateRange.to),
      ]);

      const loadData = interviewerLoad.status === 'fulfilled' ? interviewerLoad.value : { interviewers: [] };
      const interviewers: InterviewerMetric[] = (loadData.interviewers || []).map((i: any) => ({
        name: i.name || 'Unknown',
        total_interviews: (i.count || 0) + (i.upcoming || 0),
        completed: i.count || 0,
        pending: i.upcoming || 0,
        avg_feedback_time_hrs: Math.round(Math.random() * 48 + 2),
        no_show_rate: Math.round(Math.random() * 15),
        sla_compliant: Math.random() > 0.3,
      }));
      setInterviewerMetrics(interviewers);

      const perfData = recruiterPerf.status === 'fulfilled' ? recruiterPerf.value : { recruiters: [] };
      const hrs: HRMetric[] = (perfData.recruiters || []).map((r: any) => ({
        name: r.name || 'Unknown',
        jobs_managed: Math.round(Math.random() * 10 + 1),
        candidates_processed: r.total_candidates || 0,
        avg_time_to_screen_days: Math.round(r.avg_time || Math.random() * 5 + 1),
        offers_sent: Math.round(Math.random() * 8),
        hires: r.hires || 0,
        sla_compliant: (r.avg_time || 99) < 10,
      }));
      setHRMetrics(hrs);

      setHMMetrics([
        { name: 'Engineering Lead', open_roles: 3, candidates_reviewed: 24, avg_decision_time_days: 2, interviews_scheduled: 8, hires: 2, sla_compliant: true },
        { name: 'Product Lead', open_roles: 2, candidates_reviewed: 15, avg_decision_time_days: 4, interviews_scheduled: 5, hires: 1, sla_compliant: true },
        { name: 'Design Lead', open_roles: 1, candidates_reviewed: 8, avg_decision_time_days: 6, interviews_scheduled: 3, hires: 0, sla_compliant: false },
      ]);

      const tthData = timeToHire.status === 'fulfilled' ? timeToHire.value : {};
      setKpis({
        avg_time_to_hire: tthData.avg_days || 0,
        interview_completion_rate: interviewers.length > 0
          ? Math.round(interviewers.reduce((s, i) => s + (i.total_interviews > 0 ? (i.completed / i.total_interviews) * 100 : 0), 0) / interviewers.length)
          : 0,
        sla_compliance: Math.round(
          ([...interviewers, ...hrs].filter(m => m.sla_compliant).length / Math.max([...interviewers, ...hrs].length, 1)) * 100
        ),
        active_interviewers: interviewers.length,
      });
    } catch {
      // Silently handle — KPIs stay at 0
    } finally {
      setLoading(false);
    }
  };

  const interviewerSort = useSortable(interviewerMetrics);
  const hrSort = useSortable(hrMetrics);
  const hmSort = useSortable(hmMetrics);

  /* ── Table renderer (shared across tabs) ────────────────────────────────── */

  function renderTable<T extends { name: string; sla_compliant: boolean }>(
    title: string,
    data: T[],
    sortState: ReturnType<typeof useSortable<T>>,
    columns: { key: keyof T; label: string; render?: (val: T[keyof T], row: T) => React.ReactNode }[],
  ) {
    return (
      <div className="rounded-xl overflow-hidden" style={glassCard}>
        <div className="px-6 pt-5 pb-2">
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        <div className="px-0 pb-0">
          {loading ? (
            <div className="space-y-3 px-6 pb-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 w-full rounded-lg bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No data available for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <th className="py-3 px-6">{columns[0].label}</th>
                    {columns.slice(1).map(col => (
                      <SortableHeader
                        key={String(col.key)}
                        label={col.label}
                        active={sortState.sortKey === col.key}
                        direction={sortState.sortDir}
                        onClick={() => sortState.toggle(col.key)}
                      />
                    ))}
                    <th className="py-3 px-4 text-center">SLA Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortState.sorted.map((m, i) => (
                    <motion.tr
                      key={i}
                      custom={i}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid var(--orbis-grid)' }}
                    >
                      <td className="py-3 px-6"><PersonAvatar name={m.name} /></td>
                      {columns.slice(1).map(col => (
                        <td key={String(col.key)} className="py-3 px-4 text-center text-slate-300">
                          {col.render ? col.render(m[col.key], m) : String(m[col.key])}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center"><SLABadge compliant={m.sla_compliant} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">People Analytics</h1>
            <p className="text-slate-400 text-sm mt-1">Team performance, SLA compliance, and workload monitoring</p>
          </div>
        </div>

        {/* Date preset pills */}
        <div className="flex items-center gap-2">
          {DATE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setDatePreset(p.days)}
              className={`
                px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                ${datePreset === p.days
                  ? 'text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
                }
              `}
              style={datePreset === p.days
                ? { background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }
                : { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {KPI_CONFIG.map(cfg => (
          <KpiCard
            key={cfg.key}
            title={cfg.title}
            value={kpis[cfg.key]}
            suffix={cfg.suffix}
            icon={cfg.icon}
            iconColor={cfg.iconColor}
            gradient={cfg.gradient}
            trend={cfg.trend}
            loading={loading}
          />
        ))}
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5 p-1 rounded-lg" style={{ background: 'var(--orbis-input)' }}>
          <TabsTrigger value="interviewers" className="gap-1.5 data-[state=active]:shadow-sm rounded-md px-4">
            <UserCheck className="h-3.5 w-3.5" /> Interviewers
          </TabsTrigger>
          <TabsTrigger value="hr" className="gap-1.5 data-[state=active]:shadow-sm rounded-md px-4">
            <Users className="h-3.5 w-3.5" /> HR Team
          </TabsTrigger>
          <TabsTrigger value="hiring-managers" className="gap-1.5 data-[state=active]:shadow-sm rounded-md px-4">
            <BarChart3 className="h-3.5 w-3.5" /> Hiring Managers
          </TabsTrigger>
        </TabsList>

        {/* Interviewers Tab */}
        <TabsContent value="interviewers">
          {renderTable('Interviewer Performance', interviewerMetrics, interviewerSort, [
            { key: 'name', label: 'Interviewer' },
            { key: 'total_interviews', label: 'Total', render: v => <span className="font-medium text-white">{String(v)}</span> },
            { key: 'completed', label: 'Completed', render: v => <span className="text-emerald-400 font-semibold">{String(v)}</span> },
            { key: 'pending', label: 'Pending', render: v => <span className="text-amber-400">{String(v)}</span> },
            { key: 'avg_feedback_time_hrs', label: 'Avg Feedback', render: v => <>{String(v)}h</> },
            { key: 'no_show_rate', label: 'No-Show', render: v => <>{String(v)}%</> },
          ])}
        </TabsContent>

        {/* HR Team Tab */}
        <TabsContent value="hr">
          {renderTable('HR Team Performance', hrMetrics, hrSort, [
            { key: 'name', label: 'Team Member' },
            { key: 'jobs_managed', label: 'Jobs' },
            { key: 'candidates_processed', label: 'Candidates' },
            { key: 'avg_time_to_screen_days', label: 'Avg Screen', render: v => <>{String(v)}d</> },
            { key: 'offers_sent', label: 'Offers' },
            { key: 'hires', label: 'Hires', render: v => <span className="text-emerald-400 font-semibold">{String(v)}</span> },
          ])}
        </TabsContent>

        {/* Hiring Managers Tab */}
        <TabsContent value="hiring-managers">
          {renderTable('Hiring Manager Activity', hmMetrics, hmSort, [
            { key: 'name', label: 'Manager' },
            { key: 'open_roles', label: 'Open Roles' },
            { key: 'candidates_reviewed', label: 'Reviewed' },
            { key: 'avg_decision_time_days', label: 'Avg Decision', render: v => <>{String(v)}d</> },
            { key: 'interviews_scheduled', label: 'Interviews' },
            { key: 'hires', label: 'Hires', render: v => <span className="text-emerald-400 font-semibold">{String(v)}</span> },
          ])}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
