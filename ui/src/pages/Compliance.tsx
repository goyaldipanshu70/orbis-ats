import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
/*  Dark-glass style constants                                                 */
/* -------------------------------------------------------------------------- */

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

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

const sItemCls = 'text-slate-200 focus:bg-white/10 focus:text-white';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PIE_COLORS = [
  '#3b82f6', '#1B8EE5', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#1676c0', '#14b8a6', '#f97316',
];

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Compliance</h1>
              <p className="text-slate-400 text-sm">
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
            color: 'text-blue-400',
            bg: 'bg-blue-900/40',
          },
          {
            label: 'Total Candidates',
            value: totalCandidates,
            icon: Users,
            color: 'text-emerald-400',
            bg: 'bg-emerald-900/40',
          },
          {
            label: 'Avg Conversion',
            value: avgConversion,
            icon: TrendingUp,
            color: 'text-blue-400',
            bg: 'bg-blue-900/40',
            suffix: '%',
            decimals: 1,
          },
          {
            label: 'Overdue SLA',
            value: slaData?.total_overdue ?? 0,
            icon: AlertTriangle,
            color: slaData && slaData.total_overdue > 0 ? 'text-red-400' : 'text-emerald-400',
            bg: slaData && slaData.total_overdue > 0 ? 'bg-red-900/40' : 'bg-emerald-900/40',
          },
        ].map(kpi => (
          <motion.div key={kpi.label} variants={scaleIn} whileHover={hoverLift}>
            <div className="rounded-xl p-5 flex items-center gap-4" style={glassCard}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tracking-tight text-white">
                  <CountingNumber
                    value={kpi.value}
                    suffix={kpi.suffix}
                    decimalPlaces={kpi.decimals}
                  />
                </p>
                <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </StaggerGrid>

      {/* ================================================================== */}
      {/*  Tabs                                                               */}
      {/* ================================================================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 p-1 rounded-lg" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
          <TabsTrigger value="diversity" className="gap-1.5 rounded-md text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
            <BarChart3 className="h-4 w-4" /> Diversity
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5 rounded-md text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
            <Clock className="h-4 w-4" /> SLA Tracking
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5 rounded-md text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
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
                <div className="animate-pulse rounded-xl bg-white/10 h-80" />
                <div className="animate-pulse rounded-xl bg-white/10 h-80" />
              </div>
              <div className="animate-pulse rounded-xl bg-white/10 h-64" />
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
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div className="px-6 pt-5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/40">
                          <BarChart3 className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white">Source Distribution</h3>
                          <p className="text-xs text-slate-500">Candidate origins breakdown</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 pb-6">
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
                            <Tooltip
                              contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid var(--orbis-border)',
                                background: 'var(--orbis-card)',
                                color: 'hsl(var(--foreground))',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">
                          No source data available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conversion by Source Bar */}
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div className="px-6 pt-5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/40">
                          <TrendingUp className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white">Conversion Rate by Source</h3>
                          <p className="text-xs text-slate-500">Hire rate per channel</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 pb-6">
                      {diversityData.conversion_by_source.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={diversityData.conversion_by_source}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-border)" />
                            <XAxis dataKey="source" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} unit="%" />
                            <Tooltip
                              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Conversion']}
                              contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid var(--orbis-border)',
                                background: 'var(--orbis-card)',
                                color: 'hsl(var(--foreground))',
                              }}
                            />
                            <Bar dataKey="conversion" fill="#1B8EE5" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">
                          No conversion data available
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Breakdown Table */}
                <div className="rounded-xl overflow-hidden" style={glassCard}>
                  <div className="px-6 pt-5 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900/40">
                        <FileText className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white">Source Breakdown</h3>
                        <p className="text-xs text-slate-500">Detailed funnel by source channel</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6">
                    {diversityData.breakdown.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--orbis-border)' }}>
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent" style={{ background: 'var(--orbis-subtle)' }}>
                              <TableHead className="font-semibold text-slate-500">Source</TableHead>
                              <TableHead className="text-right font-semibold text-slate-500">Total</TableHead>
                              <TableHead className="text-right font-semibold text-slate-500">Screened</TableHead>
                              <TableHead className="text-right font-semibold text-slate-500">Interviewed</TableHead>
                              <TableHead className="text-right font-semibold text-slate-500">Offered</TableHead>
                              <TableHead className="text-right font-semibold text-slate-500">Hired</TableHead>
                              <TableHead className="text-right font-semibold text-slate-500">Conversion %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {diversityData.breakdown.map(row => (
                              <TableRow key={row.source} className="hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--orbis-grid)' }}>
                                <TableCell className="font-medium capitalize text-white">{row.source.replace(/_/g, ' ')}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-300">{row.total}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-300">{row.screened}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-300">{row.interviewed}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-300">{row.offered}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-300">{row.hired}</TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums border ${
                                      row.conversion_pct >= 20
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : row.conversion_pct >= 10
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        : 'bg-white/5 text-slate-400 border-white/10'
                                    }`}
                                  >
                                    {row.conversion_pct.toFixed(1)}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">No breakdown data available</p>
                    )}
                  </div>
                </div>
              </div>
            </Fade>
          ) : (
            <div className="rounded-xl p-16 text-center" style={glassCard}>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">No diversity data</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Diversity stats will appear once candidates are added to your pipeline
              </p>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/*  Tab 2: SLA Tracking                                              */}
        {/* ================================================================ */}
        <TabsContent value="sla">
          <div className="space-y-6">
            {/* Job Filter */}
            <div className="rounded-xl p-4" style={glassCard}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-900/40">
                  <Briefcase className="h-4 w-4 text-amber-400" />
                </div>
                <Select value={slaJobId} onValueChange={v => setSlaJobId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[280px] text-sm rounded-xl text-white border-0" style={glassInput}>
                    <SelectValue placeholder="Filter by job..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>
                    <SelectItem className={sItemCls} value="all">All Jobs</SelectItem>
                    {jobs.map(j => (
                      <SelectItem className={sItemCls} key={j.job_id} value={String(j.job_id)}>
                        {j.job_title || `Job ${j.job_id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={fetchSLA}
                  disabled={slaLoading}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl text-white transition-all disabled:opacity-50"
                  style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
                >
                  {slaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  Refresh
                </button>
              </div>
            </div>

            {slaLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <div key={i} className="animate-pulse rounded-xl bg-white/10 h-28" />)}
                </div>
                <div className="animate-pulse rounded-xl bg-white/10 h-64" />
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
                        color: 'text-red-400',
                        bg: 'bg-red-900/40',
                        ring: slaData.total_overdue > 0 ? 'ring-2 ring-red-800' : '',
                      },
                      {
                        label: 'Avg Days in Stage',
                        value: slaData.avg_days_in_stage,
                        icon: Clock,
                        color: 'text-amber-400',
                        bg: 'bg-amber-900/40',
                        decimals: 1,
                      },
                      {
                        label: 'Active Candidates',
                        value: slaData.active_candidates,
                        icon: Users,
                        color: 'text-blue-400',
                        bg: 'bg-blue-900/40',
                      },
                    ].map(kpi => (
                      <motion.div key={kpi.label} variants={scaleIn} whileHover={hoverLift}>
                        <div className={`rounded-xl p-5 flex items-center gap-4 ${'ring' in kpi ? kpi.ring : ''}`} style={glassCard}>
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                            <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold tracking-tight tabular-nums text-white">
                              <CountingNumber value={kpi.value} decimalPlaces={kpi.decimals} />
                            </p>
                            <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </StaggerGrid>

                  {/* Overdue Candidates Table */}
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div className="px-6 pt-5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-900/40">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                        </div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-white">Overdue Candidates</h3>
                          {slaData.candidates.length > 0 && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                              {slaData.candidates.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-6 pb-6">
                      {slaData.candidates.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--orbis-border)' }}>
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent" style={{ background: 'var(--orbis-subtle)' }}>
                                <TableHead className="font-semibold text-slate-500">Name</TableHead>
                                <TableHead className="font-semibold text-slate-500">Email</TableHead>
                                <TableHead className="font-semibold text-slate-500">Current Stage</TableHead>
                                <TableHead className="text-right font-semibold text-slate-500">Days in Stage</TableHead>
                                <TableHead className="font-semibold text-slate-500">Severity</TableHead>
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
                                    className={`transition-colors ${pipelineTarget ? 'cursor-pointer hover:bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
                                    style={{ borderColor: 'var(--orbis-grid)' }}
                                    onClick={pipelineTarget ? () => navigate(pipelineTarget) : undefined}
                                  >
                                    <TableCell>
                                      <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold">
                                          {c.name[0]?.toUpperCase() ?? '?'}
                                        </div>
                                        <span className="font-medium text-white">{c.name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-slate-400 text-sm">{c.email}</TableCell>
                                    <TableCell>
                                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize bg-white/5 text-slate-300 border border-white/10">
                                        {c.current_stage}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums text-white">{c.days_in_stage}</TableCell>
                                    <TableCell>
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize border ${SEVERITY_STYLES[severity]}`}>
                                        {severity === 'high' && <XCircle className="h-3 w-3 mr-1" />}
                                        {severity === 'medium' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                        {severity === 'low' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                        {severity}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {pipelineTarget && (
                                        <button
                                          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-lg text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors"
                                          onClick={(e) => { e.stopPropagation(); navigate(pipelineTarget); }}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          Pipeline
                                        </button>
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
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900/40 mx-auto mb-3">
                            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                          </div>
                          <p className="text-sm font-medium text-white">All clear</p>
                          <p className="text-xs text-slate-500 mt-1">
                            No overdue candidates. All candidates are within SLA thresholds.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Fade>
            ) : (
              <div className="rounded-xl p-16 text-center" style={glassCard}>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 mx-auto mb-4">
                  <Clock className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">No SLA data</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  SLA tracking data will appear once candidates are progressing through stages
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/*  Tab 3: Data Export                                                */}
        {/* ================================================================ */}
        <TabsContent value="export">
          <div className="space-y-6">
            {/* Candidate Search */}
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <div className="px-6 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/40">
                    <Search className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Candidate Data Lookup</h3>
                    <p className="text-xs text-slate-500">Search, export, or erase candidate records (GDPR)</p>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      placeholder="Search by email or name..."
                      value={exportEmail}
                      onChange={e => setExportEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="w-full h-10 pl-9 pr-4 text-sm rounded-xl outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
                      style={glassInput}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading || !exportEmail.trim()}
                    className="inline-flex items-center gap-1.5 h-10 px-5 text-sm font-medium rounded-xl text-white transition-all disabled:opacity-50 hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                  >
                    {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </button>
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
                      <div className="rounded-xl max-h-64 overflow-y-auto" style={{ border: '1px solid var(--orbis-border)' }}>
                        {searchResults.map((c, idx) => (
                          <motion.button
                            key={c.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`w-full flex items-center gap-3 p-3.5 text-left hover:bg-white/[0.04] transition-all ${
                              selectedCandidate?.id === c.id
                                ? 'bg-blue-500/10 border-l-3 border-l-blue-500'
                                : ''
                            }`}
                            style={{ borderBottom: '1px solid var(--orbis-grid)' }}
                            onClick={() => setSelectedCandidate(c)}
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold shadow-sm">
                              {(c.full_name || c.name || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-white">{c.full_name || c.name}</p>
                              <p className="text-xs text-slate-500 truncate">{c.email || 'No email'}</p>
                            </div>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 tabular-nums bg-white/5 text-slate-400 border border-white/10">
                              ID: {c.id}
                            </span>
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
                      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-bold">
                            {(selectedCandidate.full_name || selectedCandidate.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate text-white">
                              {selectedCandidate.full_name || selectedCandidate.name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {selectedCandidate.email || 'No email'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExportCandidate('json')}
                            disabled={exportLoading}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-xl text-white transition-all disabled:opacity-50 hover:bg-white/10"
                            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
                          >
                            <FileJson className="h-4 w-4" /> JSON
                          </button>
                          <button
                            onClick={() => handleExportCandidate('csv')}
                            disabled={exportLoading}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-xl text-white transition-all disabled:opacity-50 hover:bg-white/10"
                            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
                          >
                            <FileSpreadsheet className="h-4 w-4" /> CSV
                          </button>
                          <button
                            onClick={() => setEraseDialogOpen(true)}
                            disabled={eraseLoading}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-xl text-[#f87171] transition-all disabled:opacity-50 hover:bg-red-500/20"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                          >
                            <Trash2 className="h-4 w-4" /> GDPR Erasure
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bulk Job Export */}
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <div className="px-6 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900/40">
                    <Download className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Bulk Job Export</h3>
                    <p className="text-xs text-slate-500">Export all candidates for a specific job as CSV</p>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="flex items-center gap-3">
                  <Select value={bulkJobId} onValueChange={setBulkJobId}>
                    <SelectTrigger className="w-[300px] h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                      <SelectValue placeholder="Select a job..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      {jobs.map(j => (
                        <SelectItem className={sItemCls} key={j.job_id} value={String(j.job_id)}>
                          {j.job_title || `Job ${j.job_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={handleBulkExport}
                    disabled={!bulkJobId || bulkExportLoading}
                    className="inline-flex items-center gap-1.5 h-10 px-5 text-sm font-medium rounded-xl text-white transition-all disabled:opacity-50 hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                  >
                    {bulkExportLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export All Candidates
                  </button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* GDPR Erasure Confirmation Dialog */}
      <AlertDialog open={eraseDialogOpen} onOpenChange={setEraseDialogOpen}>
        <AlertDialogContent className="border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-900/40">
                <AlertTriangle className="h-5 w-5" />
              </div>
              Confirm GDPR Erasure
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-slate-400">
              This will permanently anonymize all data for{' '}
              <span className="font-semibold text-white">
                {selectedCandidate?.full_name || selectedCandidate?.name}
              </span>
              . This action cannot be undone. All personal information, resumes, evaluations,
              and associated records will be irreversibly erased.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eraseLoading} className="rounded-xl border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEraseCandidate}
              disabled={eraseLoading}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
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
