import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CountingNumber } from '@/components/ui/counting-number';
import { Fade } from '@/components/ui/fade';
import { fadeInUp, scaleIn, staggerContainer, hoverLift } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import {
  ShieldCheck, BarChart3, Download, Search, Trash2, FileJson, FileSpreadsheet,
  AlertTriangle, Clock, Users, Briefcase, Loader2, CheckCircle2, XCircle,
  Activity, FileText, TrendingUp, Eye,
} from 'lucide-react';
import type { Job } from '@/types/api';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PIE_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
];

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  medium: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  high: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

function getSeverity(days: number): string {
  if (days > 10) return 'high';
  if (days >= 5) return 'medium';
  return 'low';
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface SourceBreakdown {
  source: string;
  total: number;
  screened: number;
  interviewed: number;
  offered: number;
  hired: number;
  conversion_pct: number;
}

interface DiversityStats {
  source_distribution: { name: string; value: number }[];
  conversion_by_source: { source: string; conversion: number }[];
  breakdown: SourceBreakdown[];
}

interface SLACandidate {
  id: number;
  name: string;
  email: string;
  current_stage: string;
  days_in_stage: number;
  jd_id?: number;
}

interface SLAStats {
  total_overdue: number;
  avg_days_in_stage: number;
  active_candidates: number;
  candidates: SLACandidate[];
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Compliance() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('diversity');

  /* -- Diversity state ---------------------------------------------------- */
  const [diversityLoading, setDiversityLoading] = useState(false);
  const [diversityData, setDiversityData] = useState<DiversityStats | null>(null);

  /* -- SLA state ---------------------------------------------------------- */
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaData, setSlaData] = useState<SLAStats | null>(null);
  const [slaJobId, setSlaJobId] = useState<string>('');
  const [jobs, setJobs] = useState<Job[]>([]);

  /* -- Export state -------------------------------------------------------- */
  const [exportEmail, setExportEmail] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [eraseDialogOpen, setEraseDialogOpen] = useState(false);
  const [eraseLoading, setEraseLoading] = useState(false);
  const [bulkJobId, setBulkJobId] = useState<string>('');
  const [bulkExportLoading, setBulkExportLoading] = useState(false);

  /* -- Fetch jobs for dropdowns ------------------------------------------- */
  useEffect(() => {
    apiClient.getJobs(1, 100).then(res => {
      setJobs(res.items ?? []);
    }).catch(() => {});
  }, []);

  /* -- Diversity fetch ---------------------------------------------------- */
  const fetchDiversity = useCallback(async () => {
    setDiversityLoading(true);
    try {
      const raw = await apiClient.getDiversityStats();

      const source_distribution = (raw.source_distribution ?? []).map(
        (item: { source: string; count: number }) => ({ name: item.source, value: item.count }),
      );

      const conversion_by_source = (raw.conversion_rates ?? []).map(
        (item: { source: string; rate: number }) => ({ source: item.source, conversion: item.rate * 100 }),
      );

      const stageBySource: Record<string, Record<string, number>> = raw.stage_by_source ?? {};
      const breakdown: SourceBreakdown[] = Object.entries(stageBySource).map(
        ([source, stages]) => {
          const total = Object.values(stages).reduce((sum, n) => sum + n, 0);
          const hired = stages['hired'] ?? 0;
          return {
            source,
            total,
            screened: stages['screening'] ?? 0,
            interviewed: stages['interview'] ?? 0,
            offered: stages['offered'] ?? stages['offer'] ?? 0,
            hired,
            conversion_pct: total > 0 ? (hired / total) * 100 : 0,
          };
        },
      );

      setDiversityData({ source_distribution, conversion_by_source, breakdown });
    } catch {
      toast({ title: 'Error', description: 'Failed to load diversity stats', variant: 'destructive' });
    } finally {
      setDiversityLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'diversity') fetchDiversity();
  }, [activeTab, fetchDiversity]);

  /* -- SLA fetch ---------------------------------------------------------- */
  const fetchSLA = useCallback(async () => {
    setSlaLoading(true);
    try {
      const jdId = slaJobId ? Number(slaJobId) : undefined;
      const raw = await apiClient.getSLAStats(jdId);

      setSlaData({
        total_overdue: raw.overdue_count ?? raw.total_overdue ?? 0,
        avg_days_in_stage: raw.avg_days_in_stage ?? 0,
        active_candidates: raw.total_candidates ?? raw.active_candidates ?? 0,
        candidates: (raw.candidates ?? []).map((c: Record<string, unknown>, idx: number) => ({
          id: c.candidate_id ?? c.id ?? idx,
          name: c.name ?? '',
          email: c.email ?? '',
          current_stage: c.current_stage ?? c.stage ?? '',
          days_in_stage: c.days_in_stage ?? 0,
          jd_id: c.jd_id,
        })),
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to load SLA stats', variant: 'destructive' });
    } finally {
      setSlaLoading(false);
    }
  }, [slaJobId, toast]);

  useEffect(() => {
    if (activeTab === 'sla') fetchSLA();
  }, [activeTab, fetchSLA]);

  /* -- Export: search candidates ------------------------------------------ */
  const handleSearch = async () => {
    if (!exportEmail.trim()) return;
    setSearchLoading(true);
    setSelectedCandidate(null);
    try {
      const results = await apiClient.searchCandidatesGlobal(exportEmail.trim(), '0', 20);
      setSearchResults(results);
      if (results.length === 0) {
        toast({ title: 'No results', description: 'No candidates found matching that query' });
      }
    } catch {
      toast({ title: 'Error', description: 'Search failed', variant: 'destructive' });
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  /* -- Export: trigger download blob -------------------------------------- */
  const triggerDownload = (data: any, filename: string, mimeType: string) => {
    let content: string;
    if (mimeType === 'application/json') {
      content = JSON.stringify(data, null, 2);
    } else {
      content = typeof data === 'string' ? data : JSON.stringify(data);
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCandidate = async (format: 'json' | 'csv') => {
    if (!selectedCandidate) return;
    setExportLoading(true);
    try {
      const data = await apiClient.exportCandidate(selectedCandidate.id, format);
      const ext = format === 'json' ? 'json' : 'csv';
      const mime = format === 'json' ? 'application/json' : 'text/csv';
      const name = selectedCandidate.full_name || selectedCandidate.name || 'candidate';
      triggerDownload(data, `${name.replace(/\s+/g, '_')}_export.${ext}`, mime);
      toast({ title: 'Export complete', description: `${name} data exported as ${format.toUpperCase()}` });
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleEraseCandidate = async () => {
    if (!selectedCandidate) return;
    setEraseLoading(true);
    try {
      await apiClient.eraseCandidate(selectedCandidate.id);
      toast({ title: 'Data erased', description: 'Candidate data has been permanently anonymized' });
      setSelectedCandidate(null);
      setSearchResults(prev => prev.filter(c => c.id !== selectedCandidate.id));
    } catch {
      toast({ title: 'Error', description: 'Erasure failed', variant: 'destructive' });
    } finally {
      setEraseLoading(false);
      setEraseDialogOpen(false);
    }
  };

  const handleBulkExport = async () => {
    if (!bulkJobId) return;
    setBulkExportLoading(true);
    try {
      const data = await apiClient.exportJobCandidates(Number(bulkJobId));
      const job = jobs.find(j => String(j.job_id) === bulkJobId);
      const filename = `${(job?.job_title || 'job').replace(/\s+/g, '_')}_candidates.csv`;
      triggerDownload(data, filename, 'text/csv');
      toast({ title: 'Export complete', description: `All candidates for job exported as CSV` });
    } catch {
      toast({ title: 'Error', description: 'Bulk export failed', variant: 'destructive' });
    } finally {
      setBulkExportLoading(false);
    }
  };

  /* -- Custom pie chart label --------------------------------------------- */
  const renderPieLabel = ({ name, percent }: { name: string; percent: number }) =>
    `${name} (${(percent * 100).toFixed(0)}%)`;

  /* -- Derived KPI values ------------------------------------------------- */
  const totalSources = diversityData?.source_distribution.length ?? 0;
  const totalCandidates = diversityData?.breakdown.reduce((s, r) => s + r.total, 0) ?? 0;
  const avgConversion = diversityData?.conversion_by_source.length
    ? diversityData.conversion_by_source.reduce((s, r) => s + r.conversion, 0) / diversityData.conversion_by_source.length
    : 0;

  /* -- Render ------------------------------------------------------------- */
  return (
    <AppLayout>
      {/* ================================================================== */}
      {/*  Page Header                                                        */}
      {/* ================================================================== */}
      <Fade duration={0.4}>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
              <p className="text-muted-foreground text-sm">
                Data privacy, audit trails, and regulatory compliance
              </p>
            </div>
          </div>
        </div>
      </Fade>

      {/* ================================================================== */}
      {/*  KPI Cards Row                                                      */}
      {/* ================================================================== */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Active Sources',
            value: totalSources,
            icon: Activity,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-100 dark:bg-blue-900/40',
          },
          {
            label: 'Total Candidates',
            value: totalCandidates,
            icon: Users,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/40',
          },
          {
            label: 'Avg Conversion',
            value: avgConversion,
            icon: TrendingUp,
            color: 'text-violet-600 dark:text-violet-400',
            bg: 'bg-violet-100 dark:bg-violet-900/40',
            suffix: '%',
            decimals: 1,
          },
          {
            label: 'Overdue SLA',
            value: slaData?.total_overdue ?? 0,
            icon: AlertTriangle,
            color: slaData && slaData.total_overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
            bg: slaData && slaData.total_overdue > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40',
          },
        ].map(kpi => (
          <motion.div key={kpi.label} variants={scaleIn} whileHover={hoverLift}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tracking-tight">
                    <CountingNumber
                      value={kpi.value}
                      suffix={kpi.suffix}
                      decimalPlaces={kpi.decimals}
                    />
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </StaggerGrid>

      {/* ================================================================== */}
      {/*  Tabs                                                               */}
      {/* ================================================================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="diversity" className="gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4" /> Diversity
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="h-4 w-4" /> SLA Tracking
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Download className="h-4 w-4" /> Data Export
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/*  Tab 1: Diversity                                                 */}
        {/* ================================================================ */}
        <TabsContent value="diversity">
          {diversityLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : diversityData ? (
            <Fade duration={0.4}>
              <div className="space-y-6">
                {/* Charts Row */}
                <motion.div
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Source Distribution Pie */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                          <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Source Distribution</CardTitle>
                          <CardDescription className="text-xs">Candidate origins breakdown</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {diversityData.source_distribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie
                              data={diversityData.source_distribution}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={renderPieLabel}
                              labelLine
                            >
                              {diversityData.source_distribution.map((_, idx) => (
                                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                          No source data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Conversion by Source Bar */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                          <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Conversion Rate by Source</CardTitle>
                          <CardDescription className="text-xs">Hire rate per channel</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {diversityData.conversion_by_source.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={diversityData.conversion_by_source}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} unit="%" />
                            <Tooltip
                              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Conversion']}
                              contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid hsl(var(--border))',
                                background: 'hsl(var(--card))',
                              }}
                            />
                            <Bar dataKey="conversion" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                          No conversion data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Breakdown Table */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Source Breakdown</CardTitle>
                        <CardDescription className="text-xs">Detailed funnel by source channel</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {diversityData.breakdown.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="font-semibold">Source</TableHead>
                              <TableHead className="text-right font-semibold">Total</TableHead>
                              <TableHead className="text-right font-semibold">Screened</TableHead>
                              <TableHead className="text-right font-semibold">Interviewed</TableHead>
                              <TableHead className="text-right font-semibold">Offered</TableHead>
                              <TableHead className="text-right font-semibold">Hired</TableHead>
                              <TableHead className="text-right font-semibold">Conversion %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {diversityData.breakdown.map(row => (
                              <TableRow key={row.source} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium capitalize">{row.source.replace(/_/g, ' ')}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.screened}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.interviewed}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.offered}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.hired}</TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs tabular-nums ${
                                      row.conversion_pct >= 20
                                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                        : row.conversion_pct >= 10
                                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                        : ''
                                    }`}
                                  >
                                    {row.conversion_pct.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No breakdown data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </Fade>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No diversity data</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Diversity stats will appear once candidates are added to your pipeline
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/*  Tab 2: SLA Tracking                                              */}
        {/* ================================================================ */}
        <TabsContent value="sla">
          <div className="space-y-6">
            {/* Job Filter */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <Select value={slaJobId} onValueChange={v => setSlaJobId(v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Filter by job..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {jobs.map(j => (
                        <SelectItem key={j.job_id} value={String(j.job_id)}>
                          {j.job_title || `Job ${j.job_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={fetchSLA} disabled={slaLoading} className="gap-1.5">
                    {slaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            {slaLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : slaData ? (
              <Fade duration={0.4}>
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        label: 'Total Overdue',
                        value: slaData.total_overdue,
                        icon: AlertTriangle,
                        color: 'text-red-600 dark:text-red-400',
                        bg: 'bg-red-100 dark:bg-red-900/40',
                        ring: slaData.total_overdue > 0 ? 'ring-2 ring-red-200 dark:ring-red-800' : '',
                      },
                      {
                        label: 'Avg Days in Stage',
                        value: slaData.avg_days_in_stage,
                        icon: Clock,
                        color: 'text-amber-600 dark:text-amber-400',
                        bg: 'bg-amber-100 dark:bg-amber-900/40',
                        decimals: 1,
                      },
                      {
                        label: 'Active Candidates',
                        value: slaData.active_candidates,
                        icon: Users,
                        color: 'text-blue-600 dark:text-blue-400',
                        bg: 'bg-blue-100 dark:bg-blue-900/40',
                      },
                    ].map(kpi => (
                      <motion.div key={kpi.label} variants={scaleIn} whileHover={hoverLift}>
                        <Card className={`border-0 shadow-sm hover:shadow-md transition-shadow ${'ring' in kpi ? kpi.ring : ''}`}>
                          <CardContent className="p-5 flex items-center gap-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                              <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                            </div>
                            <div>
                              <p className="text-2xl font-bold tracking-tight tabular-nums">
                                <CountingNumber value={kpi.value} decimalPlaces={kpi.decimals} />
                              </p>
                              <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </StaggerGrid>

                  {/* Overdue Candidates Table */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">Overdue Candidates</CardTitle>
                          {slaData.candidates.length > 0 && (
                            <Badge variant="secondary" className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                              {slaData.candidates.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {slaData.candidates.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="font-semibold">Name</TableHead>
                                <TableHead className="font-semibold">Email</TableHead>
                                <TableHead className="font-semibold">Current Stage</TableHead>
                                <TableHead className="text-right font-semibold">Days in Stage</TableHead>
                                <TableHead className="font-semibold">Severity</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {slaData.candidates.map(c => {
                                const severity = getSeverity(c.days_in_stage);
                                const pipelineTarget = c.jd_id ? `/jobs/${c.jd_id}/pipeline` : (slaJobId ? `/jobs/${slaJobId}/pipeline` : null);
                                return (
                                  <TableRow
                                    key={c.id}
                                    className={`transition-colors ${pipelineTarget ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/30'}`}
                                    onClick={pipelineTarget ? () => navigate(pipelineTarget) : undefined}
                                  >
                                    <TableCell>
                                      <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
                                          {c.name[0]?.toUpperCase() ?? '?'}
                                        </div>
                                        <span className="font-medium">{c.name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{c.email}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="capitalize text-xs">
                                        {c.current_stage}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">{c.days_in_stage}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={`text-xs capitalize border ${SEVERITY_STYLES[severity]}`}>
                                        {severity === 'high' && <XCircle className="h-3 w-3 mr-1" />}
                                        {severity === 'medium' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                        {severity === 'low' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                        {severity}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {pipelineTarget && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                          onClick={(e) => { e.stopPropagation(); navigate(pipelineTarget); }}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          Pipeline
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 mx-auto mb-3">
                            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <p className="text-sm font-medium">All clear</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            No overdue candidates. All candidates are within SLA thresholds.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </Fade>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">No SLA data</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    SLA tracking data will appear once candidates are progressing through stages
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/*  Tab 3: Data Export                                                */}
        {/* ================================================================ */}
        <TabsContent value="export">
          <div className="space-y-6">
            {/* Candidate Search */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Candidate Data Lookup</CardTitle>
                    <CardDescription className="text-xs">Search, export, or erase candidate records (GDPR)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      value={exportEmail}
                      onChange={e => setExportEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="pl-9 h-10"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={searchLoading || !exportEmail.trim()} className="h-10 gap-1.5">
                    {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </Button>
                </div>

                {/* Search Results */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="border rounded-xl divide-y max-h-64 overflow-y-auto">
                        {searchResults.map((c, idx) => (
                          <motion.button
                            key={c.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/50 transition-all ${
                              selectedCandidate?.id === c.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-3 border-l-blue-500'
                                : ''
                            }`}
                            onClick={() => setSelectedCandidate(c)}
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-sm">
                              {(c.full_name || c.name || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.full_name || c.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{c.email || 'No email'}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0 tabular-nums">ID: {c.id}</Badge>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Export Actions */}
                <AnimatePresence>
                  {selectedCandidate && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-muted/20">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-bold">
                            {(selectedCandidate.full_name || selectedCandidate.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {selectedCandidate.full_name || selectedCandidate.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {selectedCandidate.email || 'No email'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportCandidate('json')}
                            disabled={exportLoading}
                            className="gap-1.5 h-9"
                          >
                            <FileJson className="h-4 w-4" /> JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportCandidate('csv')}
                            disabled={exportLoading}
                            className="gap-1.5 h-9"
                          >
                            <FileSpreadsheet className="h-4 w-4" /> CSV
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setEraseDialogOpen(true)}
                            disabled={eraseLoading}
                            className="gap-1.5 h-9"
                          >
                            <Trash2 className="h-4 w-4" /> GDPR Erasure
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Bulk Job Export */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Bulk Job Export</CardTitle>
                    <CardDescription className="text-xs">Export all candidates for a specific job as CSV</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Select value={bulkJobId} onValueChange={setBulkJobId}>
                    <SelectTrigger className="w-[300px] h-10">
                      <SelectValue placeholder="Select a job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(j => (
                        <SelectItem key={j.job_id} value={String(j.job_id)}>
                          {j.job_title || `Job ${j.job_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleBulkExport} disabled={!bulkJobId || bulkExportLoading} className="h-10 gap-1.5">
                    {bulkExportLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export All Candidates
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* GDPR Erasure Confirmation Dialog */}
      <AlertDialog open={eraseDialogOpen} onOpenChange={setEraseDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                <AlertTriangle className="h-5 w-5" />
              </div>
              Confirm GDPR Erasure
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              This will permanently anonymize all data for{' '}
              <span className="font-semibold text-foreground">
                {selectedCandidate?.full_name || selectedCandidate?.name}
              </span>
              . This action cannot be undone. All personal information, resumes, evaluations,
              and associated records will be irreversibly erased.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eraseLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEraseCandidate}
              disabled={eraseLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {eraseLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Erasing...
                </span>
              ) : (
                'Permanently Erase'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
