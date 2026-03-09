import { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountingNumber } from '@/components/ui/counting-number';
import { Fade } from '@/components/ui/fade';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import {
  TrendingUp, TrendingDown, Minus, Clock, CheckCircle, Zap, Users,
  BarChart3, Download, Printer, CalendarIcon, Briefcase, Send, UserCheck, AlertTriangle, DollarSign,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, PieChart, Pie, FunnelChart, Funnel, LabelList,
} from 'recharts';
import type { Job, AnalyticsSummary } from '@/types/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface FunnelStage { stage: string; count: number }
interface FunnelData { stages: FunnelStage[]; total: number; conversion_rates: { from: string; to: string; rate: number }[] }
interface TimeToHireStage { stage: string; avg_days: number }
interface TimeToHireData { avg_days: number; min_days: number; max_days: number; total_hired: number; by_stage: TimeToHireStage[] }
interface SourceRow { source: string; total: number; screened: number; interviewed: number; offered: number; hired: number; conversion_rate: number }
interface SourceData { sources: SourceRow[] }
interface VelocityData { velocity: number; period: string; data: { date: string; count: number }[] }
interface OfferRateData { total_offers: number; accepted: number; declined: number; pending: number; rate: number }
interface InterviewerRow { name: string; count: number; upcoming: number }
interface InterviewerLoadData { interviewers: InterviewerRow[] }
interface TimeInStageRow { stage: string; avg_days: number; min_days: number; max_days: number; count: number }

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const FUNNEL_COLORS: Record<string, string> = {
  applied: '#3b82f6', screening: '#f59e0b', interview: '#8b5cf6',
  offered: '#10b981', hired: '#22c55e', rejected: '#ef4444',
};
function funnelColor(stage: string): string {
  return FUNNEL_COLORS[stage.toLowerCase()] || '#6b7280';
}

const DATE_PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: -1 },
  { label: 'All', days: 0 },
] as const;

/* -------------------------------------------------------------------------- */
/*  Shared Chart Tooltip                                                      */
/* -------------------------------------------------------------------------- */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => {
        const color = entry.color || entry.fill || '#6b7280';
        return (
          <p key={i} style={{ color }} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {entry.name}: <span className="font-semibold">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
          </p>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart Card wrapper                                                        */
/* -------------------------------------------------------------------------- */

function ChartCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <Fade>
      <Card className={`bg-white dark:bg-card border border-border/60 rounded-xl shadow-sm ${className}`}>
        <CardHeader className="pb-2 px-6 pt-5">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">{title}</CardTitle>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          {children}
        </CardContent>
      </Card>
    </Fade>
  );
}

/* -------------------------------------------------------------------------- */
/*  KPI Card with trend                                                       */
/* -------------------------------------------------------------------------- */

interface KpiCardProps {
  title: string;
  value: number;
  suffix?: string;
  changePct?: number;
  trend?: 'up' | 'down' | 'flat';
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  loading: boolean;
  invertTrend?: boolean; // true = "down is good" (e.g. time-to-hire)
}

function KpiCard({ title, value, suffix = '', changePct, trend, icon: Icon, iconBg, iconColor, borderColor, loading, invertTrend }: KpiCardProps) {
  if (loading) {
    return (
      <Card className="border border-border/60 shadow-sm rounded-xl overflow-hidden">
        <div className={`h-[2px] ${borderColor}`} />
        <CardContent className="p-5">
          <div className="space-y-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = invertTrend ? trend === 'down' : trend === 'up';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'flat' ? 'text-muted-foreground' : isPositive ? 'text-emerald-600' : 'text-red-500';
  const trendBg = trend === 'flat' ? 'bg-muted/50' : isPositive ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30';

  return (
    <motion.div variants={fadeInUp}>
      <Card className="border border-border/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden group">
        <div className={`h-[2px] ${borderColor}`} />
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`rounded-full p-2.5 ${iconBg} shrink-0`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-bold tracking-tight text-foreground leading-none">
                <CountingNumber value={value} />{suffix}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1.5">{title}</p>
              {changePct !== undefined && (
                <div className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2 px-1.5 py-0.5 rounded-full ${trendColor} ${trendBg}`}>
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(changePct).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                            */
/* -------------------------------------------------------------------------- */

export default function Analytics() {
  // ---- filters ----
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<number>(30);
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  // ---- data ----
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [timeToHireData, setTimeToHireData] = useState<TimeToHireData | null>(null);
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [velocityData, setVelocityData] = useState<VelocityData | null>(null);
  const [offerRateData, setOfferRateData] = useState<OfferRateData | null>(null);
  const [interviewerLoadData, setInterviewerLoadData] = useState<InterviewerLoadData | null>(null);
  const [rejectionReasonsData, setRejectionReasonsData] = useState<{ reasons: { reason: string; count: number }[] } | null>(null);
  const [recruiterPerformanceData, setRecruiterPerformanceData] = useState<{ recruiters: { name: string; hires: number; avg_time: number; total_candidates: number }[] } | null>(null);
  const [timeInStageData, setTimeInStageData] = useState<{ stages: TimeInStageRow[] } | null>(null);
  const [boardPerf, setBoardPerf] = useState<any>(null);
  const [schedulingLag, setSchedulingLag] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline');

  // ---- computed date range ----
  const dateRange = useMemo(() => {
    if (datePreset === -2 && customRange.from && customRange.to) {
      return { from: format(customRange.from, 'yyyy-MM-dd'), to: format(customRange.to, 'yyyy-MM-dd') };
    }
    if (datePreset === 0) return { from: undefined, to: undefined }; // All time
    const to = new Date();
    const from = datePreset === -1 ? startOfYear(to) : subDays(to, datePreset);
    return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
  }, [datePreset, customRange]);

  // ---- load jobs ----
  useEffect(() => {
    apiClient.getJobs(1, 100).then(d => setJobs(d.items || [])).catch(() => {});
  }, []);

  // ---- load all analytics data ----
  useEffect(() => { loadAnalytics(); }, [selectedJobId, dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    const jdId = selectedJobId !== 'all' ? selectedJobId : undefined;
    const { from: df, to: dt } = dateRange;

    const results = await Promise.allSettled([
      apiClient.getAnalyticsSummary(df, dt),
      apiClient.getAnalyticsFunnel(jdId, df, dt),
      apiClient.getAnalyticsTimeToHire(jdId, df, dt),
      apiClient.getAnalyticsSourceEffectiveness(jdId, df, dt),
      apiClient.getAnalyticsVelocity('month', jdId, df, dt),
      apiClient.getAnalyticsOfferRate(jdId, df, dt),
      apiClient.getAnalyticsInterviewerLoad(jdId, df, dt),
      apiClient.getAnalyticsRejectionReasons(jdId, df, dt),
      apiClient.getAnalyticsRecruiterPerformance(jdId, df, dt),
      apiClient.getAnalyticsTimeInStage(jdId, df, dt),
      apiClient.getJobBoardPerformance(df, dt),
      apiClient.getSchedulingLag(df, dt),
      apiClient.getCostPerHire(jdId ? Number(jdId) : undefined),
    ]);

    const val = <T,>(r: PromiseSettledResult<T>) => r.status === 'fulfilled' ? r.value : null;
    setSummary(val(results[0]));
    setFunnelData(val(results[1]));
    setTimeToHireData(val(results[2]));
    setSourceData(val(results[3]));
    setVelocityData(val(results[4]));
    setOfferRateData(val(results[5]));
    setInterviewerLoadData(val(results[6]));
    setRejectionReasonsData(val(results[7]));
    setRecruiterPerformanceData(val(results[8]));
    setTimeInStageData(val(results[9]));
    setBoardPerf(val(results[10]));
    setSchedulingLag(val(results[11]));
    setCostData(val(results[12]));

    setLoading(false);
  };

  // ---- bottleneck detection ----
  const bottleneck = useMemo(() => {
    if (!timeInStageData?.stages?.length) return null;
    const nonTerminal = timeInStageData.stages.filter(s => s.stage !== 'hired' && s.stage !== 'rejected' && s.avg_days > 0);
    if (!nonTerminal.length) return null;
    return nonTerminal.reduce((max, s) => s.avg_days > max.avg_days ? s : max, nonTerminal[0]);
  }, [timeInStageData]);

  /* ---- Export CSV ---- */
  const exportCSV = () => {
    const rows: string[][] = [];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    rows.push(['Section', 'Metric', 'Value']);
    if (summary) {
      Object.entries(summary).forEach(([key, kpi]: [string, any]) => {
        rows.push(['KPI', key.replace(/_/g, ' '), String(kpi?.value ?? '')]);
      });
    }
    rows.push([]);
    if (funnelData?.stages?.length) {
      rows.push(['Pipeline Funnel']);
      rows.push(['Stage', 'Count']);
      funnelData.stages.forEach(s => rows.push([s.stage, String(s.count)]));
      rows.push([]);
    }
    if (timeToHireData?.by_stage?.length) {
      rows.push(['Time to Hire by Stage']);
      rows.push(['Stage', 'Avg Days']);
      timeToHireData.by_stage.forEach(s => rows.push([s.stage, String(s.avg_days)]));
      rows.push([]);
    }
    if (sourceData?.sources?.length) {
      rows.push(['Source Effectiveness']);
      rows.push(['Source', 'Total', 'Hired', 'Conv Rate (%)']);
      sourceData.sources.forEach(s => rows.push([s.source, String(s.total), String(s.hired), String(s.conversion_rate)]));
      rows.push([]);
    }
    if (interviewerLoadData?.interviewers?.length) {
      rows.push(['Interviewer Load']);
      rows.push(['Name', 'Total', 'Upcoming']);
      interviewerLoadData.interviewers.forEach(i => rows.push([i.name, String(i.count), String(i.upcoming)]));
      rows.push([]);
    }
    if (rejectionReasonsData?.reasons?.length) {
      rows.push(['Rejection Reasons']);
      rows.push(['Reason', 'Count']);
      rejectionReasonsData.reasons.forEach(r => rows.push([r.reason, String(r.count)]));
      rows.push([]);
    }
    if (recruiterPerformanceData?.recruiters?.length) {
      rows.push(['Recruiter Performance']);
      rows.push(['Recruiter', 'Hires', 'Avg Time (days)']);
      recruiterPerformanceData.recruiters.forEach(r => rows.push([r.name, String(r.hires), String(r.avg_time)]));
    }

    const csvContent = rows.map(r => r.map(c => esc(c)).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hiring-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ==================================================================== */
  /*  Render                                                               */
  /* ==================================================================== */

  const s = summary;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ---- Header ---- */}
        <Fade distance={12} duration={0.4}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track hiring performance, pipeline metrics, and team efficiency
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
          </div>
        </Fade>

        {/* ---- Filter Row ---- */}
        <Fade distance={10} delay={0.05}>
          <div className="flex flex-wrap items-center gap-4">
            {/* Date preset pills */}
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-full">
              {DATE_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setDatePreset(p.days)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    datePreset === p.days
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => setDatePreset(-2)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                      datePreset === -2
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    Custom
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={customRange as any}
                    onSelect={(range: any) => {
                      setCustomRange({ from: range?.from, to: range?.to });
                      setDatePreset(-2);
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Job filter */}
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-[200px] h-8 text-xs rounded-lg border-border/60">
                <Briefcase className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs.map(j => (
                  <SelectItem key={j.job_id} value={j.job_id}>{j.job_title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Fade>

        {/* ---- KPI Cards ---- */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3"
        >
          <KpiCard
            title="Applications" value={s?.total_applications?.value ?? 0}
            changePct={s?.total_applications?.change_pct} trend={s?.total_applications?.trend}
            icon={Users} iconBg="bg-blue-100 dark:bg-blue-950/40" iconColor="text-blue-600" borderColor="bg-blue-500" loading={loading}
          />
          <KpiCard
            title="Active Jobs" value={s?.active_jobs?.value ?? 0}
            changePct={s?.active_jobs?.change_pct} trend={s?.active_jobs?.trend}
            icon={Briefcase} iconBg="bg-indigo-100 dark:bg-indigo-950/40" iconColor="text-indigo-600" borderColor="bg-indigo-500" loading={loading}
          />
          <KpiCard
            title="Interviews" value={s?.interviews_scheduled?.value ?? 0}
            changePct={s?.interviews_scheduled?.change_pct} trend={s?.interviews_scheduled?.trend}
            icon={CalendarIcon} iconBg="bg-purple-100 dark:bg-purple-950/40" iconColor="text-purple-600" borderColor="bg-purple-500" loading={loading}
          />
          <KpiCard
            title="Offers" value={s?.offers_sent?.value ?? 0}
            changePct={s?.offers_sent?.change_pct} trend={s?.offers_sent?.trend}
            icon={Send} iconBg="bg-amber-100 dark:bg-amber-950/40" iconColor="text-amber-600" borderColor="bg-amber-500" loading={loading}
          />
          <KpiCard
            title="Hires" value={s?.hires?.value ?? 0}
            changePct={s?.hires?.change_pct} trend={s?.hires?.trend}
            icon={UserCheck} iconBg="bg-emerald-100 dark:bg-emerald-950/40" iconColor="text-emerald-600" borderColor="bg-emerald-500" loading={loading}
          />
          <KpiCard
            title="Avg Time to Hire" value={s?.avg_time_to_hire?.value ?? 0} suffix=" days"
            changePct={s?.avg_time_to_hire?.change_pct} trend={s?.avg_time_to_hire?.trend}
            icon={Clock} iconBg="bg-orange-100 dark:bg-orange-950/40" iconColor="text-orange-600" borderColor="bg-orange-500" loading={loading} invertTrend
          />
          <KpiCard
            title="Offer Accept %" value={s?.offer_acceptance_rate?.value ?? 0} suffix="%"
            changePct={s?.offer_acceptance_rate?.change_pct} trend={s?.offer_acceptance_rate?.trend}
            icon={CheckCircle} iconBg="bg-teal-100 dark:bg-teal-950/40" iconColor="text-teal-600" borderColor="bg-teal-500" loading={loading}
          />
        </motion.div>

        {/* ---- Bottleneck Banner ---- */}
        {bottleneck && (
          <Fade>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 flex items-center gap-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2 shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-sm">
                <span className="font-semibold text-amber-800 dark:text-amber-400">Pipeline Bottleneck: </span>
                <span className="text-amber-700 dark:text-amber-300">
                  Candidates spend an average of <strong>{bottleneck.avg_days} days</strong> in the{' '}
                  <Badge variant="outline" className="capitalize text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 mx-0.5">{bottleneck.stage}</Badge> stage
                </span>
              </div>
            </div>
          </Fade>
        )}

        {/* ---- Tabbed Chart Sections ---- */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="bg-muted/50 p-1 rounded-lg h-auto">
            <TabsTrigger value="pipeline" className="text-xs rounded-md px-4 py-1.5 data-[state=active]:shadow-sm">Pipeline</TabsTrigger>
            <TabsTrigger value="efficiency" className="text-xs rounded-md px-4 py-1.5 data-[state=active]:shadow-sm">Efficiency</TabsTrigger>
            <TabsTrigger value="sourcing" className="text-xs rounded-md px-4 py-1.5 data-[state=active]:shadow-sm">Sourcing</TabsTrigger>
            <TabsTrigger value="people" className="text-xs rounded-md px-4 py-1.5 data-[state=active]:shadow-sm">People</TabsTrigger>
          </TabsList>

          {/* ============ PIPELINE TAB ============ */}
          <TabsContent value="pipeline" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Funnel Chart */}
              <ChartCard title="Pipeline Funnel" subtitle="Candidate distribution across stages">
                <div className="h-72">
                  {loading ? <Skeleton className="h-full w-full rounded-lg" /> : funnelData?.stages?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData.stages} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={80} className="capitalize" />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Candidates" radius={[0, 4, 4, 0]}>
                          {funnelData.stages.map(s => (
                            <Cell key={s.stage} fill={funnelColor(s.stage)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
                </div>
              </ChartCard>

              {/* Stage Dwell Time */}
              <ChartCard title="Stage Dwell Time" subtitle="Average days candidates spend in each stage">
                <div className="h-72">
                  {loading ? <Skeleton className="h-full w-full rounded-lg" /> : timeInStageData?.stages?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeInStageData.stages}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="stage" tick={{ fontSize: 11 }} className="capitalize" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="avg_days" name="Avg Days" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                          {timeInStageData.stages.map(s => (
                            <Cell key={s.stage} fill={s.stage === bottleneck?.stage ? '#f59e0b' : '#8b5cf6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Daily Applications Line Chart */}
            <ChartCard title="Hiring Velocity Trend" subtitle="Monthly hire count over time">
              <div className="h-64">
                {loading ? <Skeleton className="h-full w-full rounded-lg" /> : velocityData?.data?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={velocityData.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="count" name="Hires" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
              </div>
            </ChartCard>
          </TabsContent>

          {/* ============ EFFICIENCY TAB ============ */}
          <TabsContent value="efficiency" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Time to Hire Distribution */}
              <ChartCard title="Time to Hire by Stage" subtitle="Average days per hiring stage">
                <div className="h-72">
                  {loading ? <Skeleton className="h-full w-full rounded-lg" /> : timeToHireData?.by_stage?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeToHireData.by_stage}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="stage" tick={{ fontSize: 11 }} className="capitalize" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="avg_days" name="Avg Days" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
                </div>
              </ChartCard>

              {/* Scheduling Lag */}
              <ChartCard title="Stage Transition Lag" subtitle="Average days between stage transitions">
                <div>
                  {loading ? <Skeleton className="h-48 w-full rounded-lg" /> : schedulingLag?.transitions?.length ? (
                    <div className="space-y-2">
                      {schedulingLag.transitions.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="capitalize text-[10px]">{t.from_stage}</Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="capitalize text-[10px]">{t.to_stage}</Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${Math.min(100, (t.avg_days / 10) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium w-16 text-right">{t.avg_days.toFixed(1)} days</span>
                            <span className="text-[10px] text-muted-foreground">({t.count})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Cost-per-Hire Analytics */}
            <ChartCard title="Cost-per-Hire Analytics" subtitle="Breakdown of hiring costs and efficiency">
              <div>
                {loading ? <Skeleton className="h-48 w-full rounded-lg" /> : costData ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl bg-muted/40 text-center">
                        <p className="text-xl font-bold text-foreground">${costData.total_cost?.toLocaleString() ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Total Hiring Cost</p>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-center">
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">${costData.cost_per_hire?.toLocaleString() ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Cost per Hire</p>
                      </div>
                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-center">
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-400">${costData.cost_per_candidate?.toLocaleString() ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Cost per Candidate</p>
                      </div>
                      <div className="p-4 rounded-xl bg-muted/40 text-center">
                        <p className="text-xl font-bold text-foreground">{costData.total_hires ?? 0} / {costData.total_candidates ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Hires / Candidates</p>
                      </div>
                    </div>
                    {Object.keys(costData.cost_by_type || {}).length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost Breakdown by Source</p>
                        {Object.entries(costData.cost_by_type).map(([type, amount]: [string, any]) => (
                          <div key={type} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                            <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                            <span className="text-sm font-semibold">${Number(amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">No cost entries recorded yet. Add costs from job detail pages.</p>
                    )}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
              </div>
            </ChartCard>

            {/* Offer Stats */}
            <ChartCard title="Offer Acceptance Breakdown" subtitle="Accepted, declined, and pending offers">
              <div className="h-56">
                {loading ? <Skeleton className="h-full w-full rounded-lg" /> : offerRateData ? (
                  <div className="flex items-center gap-8 h-full">
                    <ResponsiveContainer width="40%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Accepted', value: offerRateData.accepted, fill: '#22c55e' },
                            { name: 'Declined', value: offerRateData.declined, fill: '#ef4444' },
                            { name: 'Pending', value: offerRateData.pending, fill: '#f59e0b' },
                          ].filter(d => d.value > 0)}
                          cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                          dataKey="value" nameKey="name"
                        >
                          {[
                            { name: 'Accepted', value: offerRateData.accepted, fill: '#22c55e' },
                            { name: 'Declined', value: offerRateData.declined, fill: '#ef4444' },
                            { name: 'Pending', value: offerRateData.pending, fill: '#f59e0b' },
                          ].filter(d => d.value > 0).map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Accepted</div>
                        <span className="font-bold">{offerRateData.accepted}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-red-500" /> Declined</div>
                        <span className="font-bold">{offerRateData.declined}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-amber-500" /> Pending</div>
                        <span className="font-bold">{offerRateData.pending}</span>
                      </div>
                      <div className="pt-3 border-t text-sm">
                        Total: <span className="font-bold">{offerRateData.total_offers}</span> | Rate: <span className="font-bold text-emerald-600">{Math.round(offerRateData.rate)}%</span>
                      </div>
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
              </div>
            </ChartCard>
          </TabsContent>

          {/* ============ SOURCING TAB ============ */}
          <TabsContent value="sourcing" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Source Effectiveness */}
              <ChartCard title="Source Effectiveness" subtitle="Applications vs hires by source">
                <div className="h-72">
                  {loading ? <Skeleton className="h-full w-full rounded-lg" /> : sourceData?.sources?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sourceData.sources}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="source" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="total" name="Applications" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="hired" name="Hired" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
                </div>
              </ChartCard>

              {/* Job Board Performance */}
              <ChartCard title="Job Board Performance" subtitle="Conversion rates by job board">
                <div>
                  {loading ? <Skeleton className="h-48 w-full rounded-lg" /> : boardPerf?.boards?.length ? (
                    <div className="space-y-2">
                      {boardPerf.boards.map((b: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                          <div>
                            <p className="text-sm font-medium capitalize">{b.board || 'Unknown'}</p>
                            <p className="text-[11px] text-muted-foreground">{b.applications} applications</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-600">{b.conversion_rate.toFixed(1)}%</p>
                            <p className="text-[10px] text-muted-foreground">{b.hired} hired</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Source Conversion Funnel */}
            {sourceData?.sources?.length ? (
              <ChartCard title="Source Conversion Funnel" subtitle="Full funnel breakdown by source">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Source</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Total</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Screened</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Interviewed</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Offered</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Hired</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Conv %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceData.sources.map((s, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium capitalize">{s.source || 'Unknown'}</td>
                          <td className="text-right py-2.5 px-3">{s.total}</td>
                          <td className="text-right py-2.5 px-3">{s.screened}</td>
                          <td className="text-right py-2.5 px-3">{s.interviewed}</td>
                          <td className="text-right py-2.5 px-3">{s.offered}</td>
                          <td className="text-right py-2.5 px-3 font-medium">{s.hired}</td>
                          <td className="text-right py-2.5 px-3 font-bold text-emerald-600">{s.conversion_rate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            ) : null}
          </TabsContent>

          {/* ============ PEOPLE TAB ============ */}
          <TabsContent value="people" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recruiter Performance */}
              <ChartCard title="Recruiter Performance" subtitle="Hires and efficiency by recruiter">
                <div>
                  {loading ? <Skeleton className="h-48 w-full rounded-lg" /> : recruiterPerformanceData?.recruiters?.length ? (
                    <div className="space-y-2">
                      {recruiterPerformanceData.recruiters.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                          <div>
                            <p className="text-sm font-medium">{r.name}</p>
                            <p className="text-[11px] text-muted-foreground">{r.total_candidates} candidates</p>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-sm font-bold text-emerald-600">{r.hires}</p>
                              <p className="text-[10px] text-muted-foreground">hires</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{r.avg_time}</p>
                              <p className="text-[10px] text-muted-foreground">avg days</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
                </div>
              </ChartCard>

              {/* Interviewer Load */}
              <ChartCard title="Interviewer Load" subtitle="Interview distribution across team members">
                <div className="h-72">
                  {loading ? <Skeleton className="h-full w-full rounded-lg" /> : interviewerLoadData?.interviewers?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={interviewerLoadData.interviewers.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="upcoming" name="Upcoming" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Rejection Reasons */}
            <ChartCard title="Rejection Reasons" subtitle="Most common reasons for candidate rejection">
              <div className="h-64">
                {loading ? <Skeleton className="h-full w-full rounded-lg" /> : rejectionReasonsData?.reasons?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rejectionReasonsData.reasons.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="reason" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center pt-12">No data</p>}
              </div>
            </ChartCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
