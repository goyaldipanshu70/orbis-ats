import { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  TrendingUp, TrendingDown, Minus, Clock, CheckCircle, Zap, Users,
  BarChart3, Download, Printer, CalendarIcon, Briefcase, Send, UserCheck, AlertTriangle, DollarSign, Bot,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, PieChart, Pie, FunnelChart, Funnel, LabelList,
} from 'recharts';
import type { Job, AnalyticsSummary } from '@/types/api';
import { useAuth } from '@/contexts/AuthContext';

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
/*  Design-system constants                                                   */
/* -------------------------------------------------------------------------- */

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

const tooltipStyle = {
  contentStyle: { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)', borderRadius: 12, color: 'hsl(var(--foreground))' },
  labelStyle: { color: '#94a3b8' },
};

/* -------------------------------------------------------------------------- */
/*  Chart / funnel constants                                                  */
/* -------------------------------------------------------------------------- */

const FUNNEL_COLORS: Record<string, string> = {
  applied: '#1676c0', screening: '#f59e0b', interview: '#a855f7',
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
/*  Shared Chart Tooltip (dark)                                               */
/* -------------------------------------------------------------------------- */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)', borderRadius: 12 }} className="px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-white mb-1">{label}</p>
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
    <div style={glassCard} className={`rounded-xl ${className}`}>
      <div className="pb-2 px-6 pt-5">
        <p className="text-sm font-semibold tracking-tight text-white">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 pb-5">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton placeholder                                                      */
/* -------------------------------------------------------------------------- */

function Skel({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
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
  gradientFrom: string;
  gradientTo: string;
  loading: boolean;
  invertTrend?: boolean;
}

function KpiCard({ title, value, suffix = '', changePct, trend, icon: Icon, gradientFrom, gradientTo, loading, invertTrend }: KpiCardProps) {
  if (loading) {
    return (
      <div style={glassCard} className="rounded-xl overflow-hidden">
        <div style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }} className="h-[3px]" />
        <div className="p-5 space-y-3">
          <Skel className="h-10 w-10 rounded-full" />
          <Skel className="h-8 w-20" />
          <Skel className="h-3 w-24" />
          <Skel className="h-3 w-20" />
        </div>
      </div>
    );
  }

  const isPositive = invertTrend ? trend === 'down' : trend === 'up';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'flat' ? 'text-slate-500' : isPositive ? 'text-emerald-400' : 'text-red-400';
  const trendBg = trend === 'flat' ? 'bg-white/5' : isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10';

  return (
    <div style={glassCard} className="rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300 group">
      <div style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }} className="h-[3px]" />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-full p-2.5 bg-white/5 shrink-0">
            <Icon className="h-5 w-5" style={{ color: gradientFrom }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-bold tracking-tight text-white leading-none">
              {value.toLocaleString()}{suffix}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1.5">{title}</p>
            {changePct !== undefined && (
              <div className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2 px-1.5 py-0.5 rounded-full ${trendColor} ${trendBg}`}>
                <TrendIcon className="h-3 w-3" />
                {Math.abs(changePct).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                            */
/* -------------------------------------------------------------------------- */

export default function Analytics() {
  const { hasPermission } = useAuth();
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
  const [aiInterviewData, setAiInterviewData] = useState<any>(null);

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
      apiClient.getAIInterviewAnalytics(jdId, df, dt),
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
    setAiInterviewData(val(results[13]));

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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Analytics</h1>
            <p className="text-sm text-slate-400 mt-1">
              Track hiring performance, pipeline metrics, and team efficiency
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasPermission('reports.export') && (
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg text-slate-300 transition-colors hover:text-white"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg text-slate-300 transition-colors hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>

        {/* ---- Filter Row ---- */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Date preset pills */}
          <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: 'var(--orbis-input)' }}>
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setDatePreset(p.days)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  datePreset === p.days
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
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
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarIcon className="h-3 w-3" />
                  Custom
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                <Calendar
                  mode="range"
                  selected={customRange as any}
                  onSelect={(range: any) => {
                    setCustomRange({ from: range?.from, to: range?.to });
                    setDatePreset(-2);
                  }}
                  numberOfMonths={2}
                  className="[&_button]:text-white [&_button:hover]:bg-white/10 [&_button[aria-selected]]:bg-blue-600 [&_.rdp-head_cell]:text-slate-500 [&_.rdp-caption]:text-white [&_.rdp-nav_button]:text-slate-400 [&_.rdp-day_today]:text-blue-400"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Job filter */}
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="w-[200px] h-8 text-xs rounded-lg text-white" style={glassInput}>
              <Briefcase className="h-3 w-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="All Jobs" />
            </SelectTrigger>
            <SelectContent style={selectDrop} className="text-white">
              <SelectItem value="all">All Jobs</SelectItem>
              {jobs.map(j => (
                <SelectItem key={j.job_id} value={j.job_id}>{j.job_title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ---- KPI Cards ---- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard
            title="Applications" value={s?.total_applications?.value ?? 0}
            changePct={s?.total_applications?.change_pct} trend={s?.total_applications?.trend}
            icon={Users} gradientFrom="#1676c0" gradientTo="#1B8EE5" loading={loading}
          />
          <KpiCard
            title="Active Jobs" value={s?.active_jobs?.value ?? 0}
            changePct={s?.active_jobs?.change_pct} trend={s?.active_jobs?.trend}
            icon={Briefcase} gradientFrom="#1B8EE5" gradientTo="#a855f7" loading={loading}
          />
          <KpiCard
            title="Interviews" value={s?.interviews_scheduled?.value ?? 0}
            changePct={s?.interviews_scheduled?.change_pct} trend={s?.interviews_scheduled?.trend}
            icon={CalendarIcon} gradientFrom="#a855f7" gradientTo="#c084fc" loading={loading}
          />
          <KpiCard
            title="Offers" value={s?.offers_sent?.value ?? 0}
            changePct={s?.offers_sent?.change_pct} trend={s?.offers_sent?.trend}
            icon={Send} gradientFrom="#f59e0b" gradientTo="#fbbf24" loading={loading}
          />
          <KpiCard
            title="Hires" value={s?.hires?.value ?? 0}
            changePct={s?.hires?.change_pct} trend={s?.hires?.trend}
            icon={UserCheck} gradientFrom="#10b981" gradientTo="#34d399" loading={loading}
          />
          <KpiCard
            title="Avg Time to Hire" value={s?.avg_time_to_hire?.value ?? 0} suffix=" days"
            changePct={s?.avg_time_to_hire?.change_pct} trend={s?.avg_time_to_hire?.trend}
            icon={Clock} gradientFrom="#f97316" gradientTo="#fb923c" loading={loading} invertTrend
          />
          <KpiCard
            title="Offer Accept %" value={s?.offer_acceptance_rate?.value ?? 0} suffix="%"
            changePct={s?.offer_acceptance_rate?.change_pct} trend={s?.offer_acceptance_rate?.trend}
            icon={CheckCircle} gradientFrom="#14b8a6" gradientTo="#2dd4bf" loading={loading}
          />
        </div>

        {/* ---- Bottleneck Banner ---- */}
        {bottleneck && (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div className="rounded-full p-2 shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-sm">
              <span className="font-semibold text-amber-700 dark:text-amber-400">Pipeline Bottleneck: </span>
              <span className="text-amber-800/80 dark:text-amber-300/80">
                Candidates spend an average of <strong className="text-amber-700 dark:text-amber-300">{bottleneck.avg_days} days</strong> in the{' '}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize text-amber-700 dark:text-amber-300" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>{bottleneck.stage}</span> stage
              </span>
            </div>
          </div>
        )}

        {/* ---- Tabbed Chart Sections ---- */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }} className="p-1 rounded-lg h-auto">
            <TabsTrigger value="pipeline" className="text-xs rounded-md px-4 py-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">Pipeline</TabsTrigger>
            <TabsTrigger value="efficiency" className="text-xs rounded-md px-4 py-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">Efficiency</TabsTrigger>
            <TabsTrigger value="sourcing" className="text-xs rounded-md px-4 py-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">Sourcing</TabsTrigger>
            <TabsTrigger value="people" className="text-xs rounded-md px-4 py-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">People</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs rounded-md px-4 py-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 flex items-center gap-1.5">
              <Bot className="h-3 w-3" />AI Interviews
            </TabsTrigger>
          </TabsList>

          {/* ============ PIPELINE TAB ============ */}
          <TabsContent value="pipeline" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Funnel Chart */}
              <ChartCard title="Pipeline Funnel" subtitle="Candidate distribution across stages">
                <div className="h-72">
                  {loading ? <Skel className="h-full w-full" /> : funnelData?.stages?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData.stages} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={80} className="capitalize" />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Candidates" radius={[0, 4, 4, 0]}>
                          {funnelData.stages.map(s => (
                            <Cell key={s.stage} fill={funnelColor(s.stage)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
                </div>
              </ChartCard>

              {/* Stage Dwell Time */}
              <ChartCard title="Stage Dwell Time" subtitle="Average days candidates spend in each stage">
                <div className="h-72">
                  {loading ? <Skel className="h-full w-full" /> : timeInStageData?.stages?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeInStageData.stages}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748b' }} className="capitalize" />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="avg_days" name="Avg Days" fill="#a855f7" radius={[4, 4, 0, 0]}>
                          {timeInStageData.stages.map(s => (
                            <Cell key={s.stage} fill={s.stage === bottleneck?.stage ? '#f59e0b' : '#a855f7'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Daily Applications Line Chart */}
            <ChartCard title="Hiring Velocity Trend" subtitle="Monthly hire count over time">
              <div className="h-64">
                {loading ? <Skel className="h-full w-full" /> : velocityData?.data?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={velocityData.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="count" name="Hires" stroke="#1B8EE5" strokeWidth={2} dot={{ r: 3, fill: '#1B8EE5' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
              </div>
            </ChartCard>
          </TabsContent>

          {/* ============ EFFICIENCY TAB ============ */}
          <TabsContent value="efficiency" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Time to Hire Distribution */}
              <ChartCard title="Time to Hire by Stage" subtitle="Average days per hiring stage">
                <div className="h-72">
                  {loading ? <Skel className="h-full w-full" /> : timeToHireData?.by_stage?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeToHireData.by_stage}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748b' }} className="capitalize" />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="avg_days" name="Avg Days" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
                </div>
              </ChartCard>

              {/* Scheduling Lag */}
              <ChartCard title="Stage Transition Lag" subtitle="Average days between stage transitions">
                <div>
                  {loading ? <Skel className="h-48 w-full" /> : schedulingLag?.transitions?.length ? (
                    <div className="space-y-2">
                      {schedulingLag.transitions.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize text-slate-300" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}>{t.from_stage}</span>
                            <span className="text-slate-500">{'\u2192'}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize text-slate-300" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}>{t.to_stage}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                              <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${Math.min(100, (t.avg_days / 10) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium w-16 text-right text-white">{t.avg_days.toFixed(1)} days</span>
                            <span className="text-[10px] text-slate-500">({t.count})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 text-center py-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Cost-per-Hire Analytics */}
            <ChartCard title="Cost-per-Hire Analytics" subtitle="Breakdown of hiring costs and efficiency">
              <div>
                {loading ? <Skel className="h-48 w-full" /> : costData ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl text-center" style={{ background: 'var(--orbis-input)' }}>
                        <p className="text-xl font-bold text-white">${costData.total_cost?.toLocaleString() ?? 0}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Total Hiring Cost</p>
                      </div>
                      <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                        <p className="text-xl font-bold text-emerald-400">${costData.cost_per_hire?.toLocaleString() ?? 0}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Cost per Hire</p>
                      </div>
                      <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(22,118,192,0.1)' }}>
                        <p className="text-xl font-bold text-blue-400">${costData.cost_per_candidate?.toLocaleString() ?? 0}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Cost per Candidate</p>
                      </div>
                      <div className="p-4 rounded-xl text-center" style={{ background: 'var(--orbis-input)' }}>
                        <p className="text-xl font-bold text-white">{costData.total_hires ?? 0} / {costData.total_candidates ?? 0}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Hires / Candidates</p>
                      </div>
                    </div>
                    {Object.keys(costData.cost_by_type || {}).length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost Breakdown by Source</p>
                        {Object.entries(costData.cost_by_type).map(([type, amount]: [string, any]) => (
                          <div key={type} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                            <span className="text-sm capitalize text-slate-300">{type.replace(/_/g, ' ')}</span>
                            <span className="text-sm font-semibold text-white">${Number(amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-2">No cost entries recorded yet. Add costs from job detail pages.</p>
                    )}
                  </div>
                ) : <p className="text-sm text-slate-500 text-center py-12">No data</p>}
              </div>
            </ChartCard>

            {/* Offer Stats */}
            <ChartCard title="Offer Acceptance Breakdown" subtitle="Accepted, declined, and pending offers">
              <div className="h-56">
                {loading ? <Skel className="h-full w-full" /> : offerRateData ? (
                  <div className="flex items-center gap-8 h-full">
                    <ResponsiveContainer width="40%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Accepted', value: offerRateData.accepted, fill: '#10b981' },
                            { name: 'Declined', value: offerRateData.declined, fill: '#ef4444' },
                            { name: 'Pending', value: offerRateData.pending, fill: '#f59e0b' },
                          ].filter(d => d.value > 0)}
                          cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                          dataKey="value" nameKey="name"
                          stroke="var(--orbis-input)"
                        >
                          {[
                            { name: 'Accepted', value: offerRateData.accepted, fill: '#10b981' },
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
                        <div className="flex items-center gap-2 text-sm text-slate-300"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Accepted</div>
                        <span className="font-bold text-white">{offerRateData.accepted}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-300"><span className="w-3 h-3 rounded-full bg-red-500" /> Declined</div>
                        <span className="font-bold text-white">{offerRateData.declined}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-300"><span className="w-3 h-3 rounded-full bg-amber-500" /> Pending</div>
                        <span className="font-bold text-white">{offerRateData.pending}</span>
                      </div>
                      <div className="pt-3 text-sm text-slate-400" style={{ borderTop: '1px solid var(--orbis-hover)' }}>
                        Total: <span className="font-bold text-white">{offerRateData.total_offers}</span> | Rate: <span className="font-bold text-emerald-400">{Math.round(offerRateData.rate)}%</span>
                      </div>
                    </div>
                  </div>
                ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
              </div>
            </ChartCard>
          </TabsContent>

          {/* ============ SOURCING TAB ============ */}
          <TabsContent value="sourcing" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Source Effectiveness */}
              <ChartCard title="Source Effectiveness" subtitle="Applications vs hires by source">
                <div className="h-72">
                  {loading ? <Skel className="h-full w-full" /> : sourceData?.sources?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sourceData.sources}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                        <XAxis dataKey="source" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="total" name="Applications" fill="#1676c0" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="hired" name="Hired" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
                </div>
              </ChartCard>

              {/* Job Board Performance */}
              <ChartCard title="Job Board Performance" subtitle="Conversion rates by job board">
                <div>
                  {loading ? <Skel className="h-48 w-full" /> : boardPerf?.boards?.length ? (
                    <div className="space-y-2">
                      {boardPerf.boards.map((b: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors" style={{ border: '1px solid var(--orbis-border)' }}>
                          <div>
                            <p className="text-sm font-medium capitalize text-white">{b.board || 'Unknown'}</p>
                            <p className="text-[11px] text-slate-400">{b.applications} applications</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-400">{b.conversion_rate.toFixed(1)}%</p>
                            <p className="text-[10px] text-slate-500">{b.hired} hired</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 text-center py-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Source Conversion Funnel */}
            {sourceData?.sources?.length ? (
              <ChartCard title="Source Conversion Funnel" subtitle="Full funnel breakdown by source">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--orbis-hover)' }}>
                        <th className="text-left py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Source</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Total</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Screened</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Interviewed</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Offered</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Hired</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Conv %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceData.sources.map((s, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid var(--orbis-grid)' }}>
                          <td className="py-2.5 px-3 font-medium capitalize text-slate-300">{s.source || 'Unknown'}</td>
                          <td className="text-right py-2.5 px-3 text-slate-400">{s.total}</td>
                          <td className="text-right py-2.5 px-3 text-slate-400">{s.screened}</td>
                          <td className="text-right py-2.5 px-3 text-slate-400">{s.interviewed}</td>
                          <td className="text-right py-2.5 px-3 text-slate-400">{s.offered}</td>
                          <td className="text-right py-2.5 px-3 font-medium text-white">{s.hired}</td>
                          <td className="text-right py-2.5 px-3 font-bold text-emerald-400">{s.conversion_rate.toFixed(1)}%</td>
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
                  {loading ? <Skel className="h-48 w-full" /> : recruiterPerformanceData?.recruiters?.length ? (
                    <div className="space-y-2">
                      {recruiterPerformanceData.recruiters.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors" style={{ border: '1px solid var(--orbis-border)' }}>
                          <div>
                            <p className="text-sm font-medium text-white">{r.name}</p>
                            <p className="text-[11px] text-slate-400">{r.total_candidates} candidates</p>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-sm font-bold text-emerald-400">{r.hires}</p>
                              <p className="text-[10px] text-slate-500">hires</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{r.avg_time}</p>
                              <p className="text-[10px] text-slate-500">avg days</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 text-center py-12">No data</p>}
                </div>
              </ChartCard>

              {/* Interviewer Load */}
              <ChartCard title="Interviewer Load" subtitle="Interview distribution across team members">
                <div className="h-72">
                  {loading ? <Skel className="h-full w-full" /> : interviewerLoadData?.interviewers?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={interviewerLoadData.interviewers.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={100} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Total" fill="#1676c0" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="upcoming" name="Upcoming" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Rejection Reasons */}
            <ChartCard title="Rejection Reasons" subtitle="Most common reasons for candidate rejection">
              <div className="h-64">
                {loading ? <Skel className="h-full w-full" /> : rejectionReasonsData?.reasons?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rejectionReasonsData.reasons.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                      <XAxis dataKey="reason" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
              </div>
            </ChartCard>
          </TabsContent>

          {/* ============ AI INTERVIEWS TAB ============ */}
          <TabsContent value="ai" className="space-y-5">
            {/* KPI cards row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total AI Interviews', value: aiInterviewData?.total ?? 0, color: '#a855f7' },
                { label: 'Completed', value: aiInterviewData?.completed ?? 0, color: '#10b981' },
                { label: 'Completion Rate', value: `${aiInterviewData?.completion_rate ?? 0}%`, color: '#1B8EE5' },
                { label: 'Avg Score', value: aiInterviewData?.avg_score ?? 0, color: '#f59e0b' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="p-4 rounded-xl"
                  style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                >
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Score Distribution */}
              <ChartCard title="Score Distribution" subtitle="AI interview score ranges">
                <div className="h-72">
                  {loading ? <Skel className="h-full w-full" /> : aiInterviewData?.score_distribution?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiInterviewData.score_distribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-grid)" />
                        <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Candidates" radius={[4, 4, 0, 0]}>
                          {aiInterviewData.score_distribution.map((b: any, i: number) => (
                            <Cell key={b.range} fill={['#ef4444', '#f59e0b', '#eab308', '#1B8EE5', '#10b981'][i] || '#6b7280'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
                </div>
              </ChartCard>

              {/* Recommendation Breakdown */}
              <ChartCard title="AI Recommendations" subtitle="Distribution of AI interview recommendations">
                <div className="h-72">
                  {loading ? <Skel className="h-full w-full" /> : aiInterviewData?.recommendations?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={aiInterviewData.recommendations}
                          dataKey="count"
                          nameKey="recommendation"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ recommendation, count }: any) => `${(recommendation || '').replace(/_/g, ' ')} (${count})`}
                          labelLine={{ stroke: '#475569' }}
                        >
                          {aiInterviewData.recommendations.map((r: any, i: number) => {
                            const colors: Record<string, string> = {
                              strong_hire: '#10b981', hire: '#22c55e', consider: '#f59e0b',
                              no_hire: '#ef4444', reject: '#dc2626',
                            };
                            return <Cell key={r.recommendation} fill={colors[r.recommendation] || ['#a855f7', '#1B8EE5', '#06b6d4', '#f97316'][i % 4]} />;
                          })}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500 text-center pt-12">No data</p>}
                </div>
              </ChartCard>
            </div>

            {/* Top Jobs by AI Interview */}
            {aiInterviewData?.top_jobs?.length ? (
              <ChartCard title="AI Interviews by Job" subtitle="Jobs with the most AI interviews conducted">
                <div className="space-y-2">
                  {aiInterviewData.top_jobs.map((job: any) => (
                    <div key={job.jd_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors" style={{ border: '1px solid var(--orbis-border)' }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{job.title}</p>
                        <p className="text-[11px] text-slate-400">{job.completed}/{job.total} completed</p>
                      </div>
                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div>
                          <p className="text-sm font-bold text-purple-400">{job.avg_score}</p>
                          <p className="text-[10px] text-slate-500">avg score</p>
                        </div>
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${job.total > 0 ? (job.completed / job.total) * 100 : 0}%`,
                              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            ) : null}

            {/* Status breakdown table */}
            {aiInterviewData?.status_counts && Object.keys(aiInterviewData.status_counts).length > 0 && (
              <ChartCard title="Interview Status Breakdown" subtitle="Current status of all AI interviews">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(aiInterviewData.status_counts).map(([status, count]: [string, any]) => {
                    const statusColors: Record<string, string> = {
                      completed: '#10b981', in_progress: '#1B8EE5', pending: '#f59e0b',
                      expired: '#6b7280', cancelled: '#ef4444',
                    };
                    return (
                      <div key={status} className="p-3 rounded-lg text-center" style={{ background: `${statusColors[status] || '#6b7280'}10`, border: `1px solid ${statusColors[status] || '#6b7280'}25` }}>
                        <p className="text-lg font-bold" style={{ color: statusColors[status] || '#6b7280' }}>{count}</p>
                        <p className="text-[11px] text-slate-400 capitalize">{status.replace(/_/g, ' ')}</p>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
