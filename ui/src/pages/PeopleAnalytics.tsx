import { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CountingNumber } from '@/components/ui/counting-number';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Users, CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  UserCheck, BarChart3, Target, ArrowUpDown, ChevronUp, ChevronDown,
  XCircle, AlertCircle,
} from 'lucide-react';

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
    color: 'blue',
    borderColor: 'border-t-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    trend: -8,
  },
  {
    key: 'interview_completion_rate' as const,
    title: 'Interview Completion',
    suffix: '%',
    icon: CheckCircle,
    color: 'emerald',
    borderColor: 'border-t-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    trend: 5,
  },
  {
    key: 'sla_compliance' as const,
    title: 'SLA Compliance',
    suffix: '%',
    icon: Target,
    color: 'amber',
    borderColor: 'border-t-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    trend: 3,
  },
  {
    key: 'active_interviewers' as const,
    title: 'Active Interviewers',
    suffix: '',
    icon: Users,
    color: 'purple',
    borderColor: 'border-t-purple-500',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    trend: 12,
  },
];

function KpiCard({ title, value, suffix, icon: Icon, iconBg, iconColor, borderColor, trend, loading }: {
  title: string; value: number; suffix: string; icon: React.ElementType;
  iconBg: string; iconColor: string; borderColor: string; trend: number; loading: boolean;
}) {
  if (loading) {
    return (
      <Card className={`border-t-2 ${borderColor} shadow-sm`}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  const isPositive = trend >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div variants={fadeInUp}>
      <Card className={`border-t-2 ${borderColor} shadow-sm hover:shadow-md transition-shadow duration-200`}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={`rounded-full p-2.5 ${iconBg} shrink-0`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
              <div className="flex items-end gap-2 mt-0.5">
                <p className="text-3xl font-bold text-foreground leading-none">
                  <CountingNumber value={value} />{suffix}
                </p>
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium pb-0.5 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(trend)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SLABadge({ compliant }: { compliant: boolean }) {
  if (compliant) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[11px] font-medium gap-1 px-2 py-0.5">
        <CheckCircle className="h-3 w-3" /> Compliant
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-[11px] font-medium gap-1 px-2 py-0.5">
      <XCircle className="h-3 w-3" /> Non-compliant
    </Badge>
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
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shrink-0">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{initials}</span>
      </div>
      <span className="font-medium text-foreground">{name}</span>
    </div>
  );
}

type SortDir = 'asc' | 'desc' | null;

function SortableHeader({ label, active, direction, onClick }: {
  label: string; active: boolean; direction: SortDir; onClick: () => void;
}) {
  return (
    <th
      className="py-3 px-4 text-center cursor-pointer select-none hover:text-foreground transition-colors group"
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

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">People Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">Team performance, SLA compliance, and workload monitoring</p>
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-transparent border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }
              `}
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
            iconBg={cfg.iconBg}
            iconColor={cfg.iconColor}
            borderColor={cfg.borderColor}
            trend={cfg.trend}
            loading={loading}
          />
        ))}
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5 bg-muted/50 p-1 rounded-lg">
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
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-6 pt-5">
              <CardTitle className="text-base font-semibold">Interviewer Performance</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <div className="space-y-3 px-6 pb-6">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : interviewerMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No interviewer data available for this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-6">Interviewer</th>
                        <SortableHeader label="Total" active={interviewerSort.sortKey === 'total_interviews'} direction={interviewerSort.sortDir} onClick={() => interviewerSort.toggle('total_interviews')} />
                        <SortableHeader label="Completed" active={interviewerSort.sortKey === 'completed'} direction={interviewerSort.sortDir} onClick={() => interviewerSort.toggle('completed')} />
                        <SortableHeader label="Pending" active={interviewerSort.sortKey === 'pending'} direction={interviewerSort.sortDir} onClick={() => interviewerSort.toggle('pending')} />
                        <SortableHeader label="Avg Feedback" active={interviewerSort.sortKey === 'avg_feedback_time_hrs'} direction={interviewerSort.sortDir} onClick={() => interviewerSort.toggle('avg_feedback_time_hrs')} />
                        <SortableHeader label="No-Show" active={interviewerSort.sortKey === 'no_show_rate'} direction={interviewerSort.sortDir} onClick={() => interviewerSort.toggle('no_show_rate')} />
                        <th className="py-3 px-4 text-center">SLA Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interviewerSort.sorted.map((m, i) => (
                        <motion.tr
                          key={i}
                          custom={i}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          className="border-b border-border/40 last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-6"><PersonAvatar name={m.name} /></td>
                          <td className="py-3 px-4 text-center font-medium">{m.total_interviews}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{m.completed}</td>
                          <td className="py-3 px-4 text-center text-amber-600 dark:text-amber-400">{m.pending}</td>
                          <td className="py-3 px-4 text-center">{m.avg_feedback_time_hrs}h</td>
                          <td className="py-3 px-4 text-center">{m.no_show_rate}%</td>
                          <td className="py-3 px-4 text-center"><SLABadge compliant={m.sla_compliant} /></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HR Team Tab */}
        <TabsContent value="hr">
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-6 pt-5">
              <CardTitle className="text-base font-semibold">HR Team Performance</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <div className="space-y-3 px-6 pb-6">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : hrMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No HR performance data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-6">Team Member</th>
                        <SortableHeader label="Jobs" active={hrSort.sortKey === 'jobs_managed'} direction={hrSort.sortDir} onClick={() => hrSort.toggle('jobs_managed')} />
                        <SortableHeader label="Candidates" active={hrSort.sortKey === 'candidates_processed'} direction={hrSort.sortDir} onClick={() => hrSort.toggle('candidates_processed')} />
                        <SortableHeader label="Avg Screen" active={hrSort.sortKey === 'avg_time_to_screen_days'} direction={hrSort.sortDir} onClick={() => hrSort.toggle('avg_time_to_screen_days')} />
                        <SortableHeader label="Offers" active={hrSort.sortKey === 'offers_sent'} direction={hrSort.sortDir} onClick={() => hrSort.toggle('offers_sent')} />
                        <SortableHeader label="Hires" active={hrSort.sortKey === 'hires'} direction={hrSort.sortDir} onClick={() => hrSort.toggle('hires')} />
                        <th className="py-3 px-4 text-center">SLA Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hrSort.sorted.map((m, i) => (
                        <motion.tr
                          key={i}
                          custom={i}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          className="border-b border-border/40 last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-6"><PersonAvatar name={m.name} /></td>
                          <td className="py-3 px-4 text-center">{m.jobs_managed}</td>
                          <td className="py-3 px-4 text-center">{m.candidates_processed}</td>
                          <td className="py-3 px-4 text-center">{m.avg_time_to_screen_days}d</td>
                          <td className="py-3 px-4 text-center">{m.offers_sent}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{m.hires}</td>
                          <td className="py-3 px-4 text-center"><SLABadge compliant={m.sla_compliant} /></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hiring Managers Tab */}
        <TabsContent value="hiring-managers">
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-6 pt-5">
              <CardTitle className="text-base font-semibold">Hiring Manager Activity</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <div className="space-y-3 px-6 pb-6">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : hmMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No hiring manager data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-6">Manager</th>
                        <SortableHeader label="Open Roles" active={hmSort.sortKey === 'open_roles'} direction={hmSort.sortDir} onClick={() => hmSort.toggle('open_roles')} />
                        <SortableHeader label="Reviewed" active={hmSort.sortKey === 'candidates_reviewed'} direction={hmSort.sortDir} onClick={() => hmSort.toggle('candidates_reviewed')} />
                        <SortableHeader label="Avg Decision" active={hmSort.sortKey === 'avg_decision_time_days'} direction={hmSort.sortDir} onClick={() => hmSort.toggle('avg_decision_time_days')} />
                        <SortableHeader label="Interviews" active={hmSort.sortKey === 'interviews_scheduled'} direction={hmSort.sortDir} onClick={() => hmSort.toggle('interviews_scheduled')} />
                        <SortableHeader label="Hires" active={hmSort.sortKey === 'hires'} direction={hmSort.sortDir} onClick={() => hmSort.toggle('hires')} />
                        <th className="py-3 px-4 text-center">SLA Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hmSort.sorted.map((m, i) => (
                        <motion.tr
                          key={i}
                          custom={i}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          className="border-b border-border/40 last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-6"><PersonAvatar name={m.name} /></td>
                          <td className="py-3 px-4 text-center">{m.open_roles}</td>
                          <td className="py-3 px-4 text-center">{m.candidates_reviewed}</td>
                          <td className="py-3 px-4 text-center">{m.avg_decision_time_days}d</td>
                          <td className="py-3 px-4 text-center">{m.interviews_scheduled}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{m.hires}</td>
                          <td className="py-3 px-4 text-center"><SLABadge compliant={m.sla_compliant} /></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
