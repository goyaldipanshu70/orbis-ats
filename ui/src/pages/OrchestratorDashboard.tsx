import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, scaleIn, slideInRight, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CountingNumber } from '@/components/ui/counting-number';
import { Fade } from '@/components/ui/fade';
import {
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  Workflow,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  MessageSquare,
  BookOpen,
  ClipboardList,
  ArrowRight,
  Play,
  Zap,
  TrendingUp,
  Layers,
  Timer,
  CircleDot,
  ExternalLink,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ─── Design System ─── */

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border)',
};

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface ExecutionLog {
  id: number;
  workflow_type: string;
  execution_id: string;
  user_id: string;
  status: string;
  provider: string | null;
  model: string | null;
  input_summary: string | null;
  output_summary: string | null;
  total_tokens: number | null;
  total_duration_ms: number | null;
  node_count: number;
  iteration_count: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface NodeExecution {
  id: number;
  node_name: string;
  node_type: string | null;
  status: string;
  duration_ms: number | null;
  tokens_used: number | null;
  retry_count: number;
  error: string | null;
  created_at: string;
}

interface ExecutionDetail extends ExecutionLog {
  nodes: NodeExecution[];
}

interface Stats {
  total: number;
  completed: number;
  failed: number;
  success_rate: number;
  avg_duration_ms: number;
  by_workflow: Record<string, number>;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const WORKFLOW_COLORS: Record<string, string> = {
  hiring_agent: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  resume_scoring: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  interview_eval: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  rag: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
};

const WORKFLOW_LABELS: Record<string, string> = {
  hiring_agent: 'Hiring Agent',
  resume_scoring: 'Resume Scoring',
  interview_eval: 'Interview Eval',
  rag: 'RAG',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  failed: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  running: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  timeout: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  completed: 'bg-emerald-400',
  failed: 'bg-rose-400',
  running: 'bg-amber-400',
  timeout: 'bg-slate-400',
};

const NODE_BAR_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500',
  failed: 'bg-rose-500',
  retried: 'bg-amber-500',
  started: 'bg-blue-500',
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const WORKFLOW_BAR_COLORS: Record<string, string> = {
  hiring_agent: '#3b82f6',
  resume_scoring: '#10b981',
  interview_eval: '#1B8EE5',
  rag: '#f97316',
};

const QUICK_ACTIONS = [
  {
    key: 'resume_scoring',
    title: 'Resume Scoring',
    description: 'AI-powered candidate evaluation',
    icon: FileSearch,
    path: '/jobs',
    color: 'from-emerald-500/20 to-emerald-600/10',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
  },
  {
    key: 'interview_eval',
    title: 'Interview Evaluation',
    description: 'Review interview assessments',
    icon: ClipboardList,
    path: '/interviews',
    color: 'from-blue-500/20 to-blue-600/10',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    ring: 'ring-blue-500/20',
  },
  {
    key: 'hiring_agent',
    title: 'Hiring Agent',
    description: 'Chat-based hiring assistant',
    icon: MessageSquare,
    path: '/hiring-assistant',
    color: 'from-blue-500/20 to-blue-600/10',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    ring: 'ring-blue-500/20',
  },
  {
    key: 'rag',
    title: 'Knowledge Base',
    description: 'RAG-powered knowledge chat',
    icon: BookOpen,
    path: '/hiring-assistant',
    color: 'from-orange-500/20 to-orange-600/10',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    ring: 'ring-orange-500/20',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function OrchestratorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [executions, setExecutions] = useState<ExecutionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const pageSize = 15;
  const totalPages = Math.ceil(total / pageSize);

  // Load stats + executions
  useEffect(() => {
    loadData();
  }, [page, workflowFilter, statusFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, execRes] = await Promise.all([
        apiClient.getOrchestratorStats(),
        apiClient.getOrchestratorExecutions({
          workflow_type: workflowFilter !== 'all' ? workflowFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page,
          page_size: pageSize,
        }),
      ]);
      setStats(statsRes);
      setExecutions(execRes.items);
      setTotal(execRes.total);
    } catch (err) {
      console.error('Failed to load orchestrator data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(executionId: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const detail = await apiClient.getOrchestratorExecutionDetail(executionId);
      setSelectedExecution(detail);
    } catch (err) {
      console.error('Failed to load execution detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  function formatDuration(ms: number | null): string {
    if (ms === null) return '\u2014';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatTimestamp(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Max duration for timeline scaling
  const maxNodeDuration = selectedExecution?.nodes
    ? Math.max(...selectedExecution.nodes.map(n => n.duration_ms || 1), 1)
    : 1;

  return (
    <AppLayout>
      <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
        {/* Ambient background glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl" style={{ background: 'rgba(27,142,229,0.04)' }} />
          <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full blur-3xl" style={{ background: 'rgba(22,118,192,0.04)' }} />
        </div>

        <div className="relative z-10 p-6 lg:p-8 max-w-[1440px] mx-auto">
          {/* Header */}
          <Fade>
            <div className="mb-8 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl" style={{ background: 'rgba(27,142,229,0.1)', boxShadow: '0 0 0 1px rgba(27,142,229,0.25)' }}>
                    <Workflow className="w-5 h-5" style={{ color: '#4db5f0' }} />
                  </div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">
                    AI Orchestrator
                  </h1>
                </div>
                <p className="text-sm text-slate-400 ml-[52px]">
                  Monitor LangGraph workflow executions and performance
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 text-white rounded-xl px-5 h-10 transition-all hover:brightness-110 text-sm font-semibold"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
                  >
                    <Play className="w-4 h-4" />
                    Run Workflow
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl shadow-xl shadow-black/30 p-1.5" style={selectDrop}>
                  <DropdownMenuItem onClick={() => navigate('/jobs')} className="text-slate-200 hover:bg-white/[0.05] focus:bg-white/[0.05] rounded-lg px-3 py-2.5">
                    <FileSearch className="w-4 h-4 mr-2.5 text-emerald-400" /> Resume Scoring
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/interviews')} className="text-slate-200 hover:bg-white/[0.05] focus:bg-white/[0.05] rounded-lg px-3 py-2.5">
                    <ClipboardList className="w-4 h-4 mr-2.5 text-blue-400" /> Interview Evaluation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/hiring-assistant')} className="text-slate-200 hover:bg-white/[0.05] focus:bg-white/[0.05] rounded-lg px-3 py-2.5">
                    <MessageSquare className="w-4 h-4 mr-2.5 text-blue-400" /> Hiring Agent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/hiring-assistant')} className="text-slate-200 hover:bg-white/[0.05] focus:bg-white/[0.05] rounded-lg px-3 py-2.5">
                    <BookOpen className="w-4 h-4 mr-2.5 text-orange-400" /> Knowledge Base (RAG)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Fade>

          {/* KPI Cards */}
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {loading && !stats ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl p-5 animate-pulse" style={glassCard}>
                  <div className="h-4 w-24 mb-3 rounded bg-white/5" />
                  <div className="h-8 w-20 rounded bg-white/5" />
                </div>
              ))
            ) : stats ? (
              <>
                <motion.div variants={scaleIn}>
                  <div className="rounded-2xl hover:brightness-110 transition-all group p-5 relative overflow-hidden" style={glassCard}>
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #1B8EE5, #1676c0)' }} />
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Executions</p>
                      <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/15 transition-colors">
                        <Activity className="w-4 h-4 text-blue-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-white font-mono tracking-tight">
                      <CountingNumber value={stats.total} />
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-slate-500" />
                      <span className="text-[11px] text-slate-500">All workflows</span>
                    </div>
                  </div>
                </motion.div>
                <motion.div variants={scaleIn}>
                  <div className="rounded-2xl hover:brightness-110 transition-all group p-5 relative overflow-hidden" style={glassCard}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Success Rate</p>
                      <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/15 transition-colors">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-emerald-400 font-mono tracking-tight">
                      <CountingNumber value={stats.success_rate} />
                      <span className="text-lg ml-0.5">%</span>
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-emerald-500/60" />
                      <span className="text-[11px] text-slate-500">{stats.completed} completed</span>
                    </div>
                  </div>
                </motion.div>
                <motion.div variants={scaleIn}>
                  <div className="rounded-2xl hover:brightness-110 transition-all group p-5 relative overflow-hidden" style={glassCard}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-400 to-slate-300" />
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Avg Duration</p>
                      <div className="p-2 rounded-lg bg-slate-500/10 group-hover:bg-slate-500/15 transition-colors">
                        <Timer className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-white font-mono tracking-tight">
                      {formatDuration(stats.avg_duration_ms)}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span className="text-[11px] text-slate-500">Per execution</span>
                    </div>
                  </div>
                </motion.div>
                <motion.div variants={scaleIn}>
                  <div className="rounded-2xl hover:brightness-110 transition-all group p-5 relative overflow-hidden" style={glassCard}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 to-rose-400" />
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Failed</p>
                      <div className="p-2 rounded-lg bg-rose-500/10 group-hover:bg-rose-500/15 transition-colors">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-rose-400 font-mono tracking-tight">
                      <CountingNumber value={stats.failed} />
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-rose-500/60" />
                      <span className="text-[11px] text-slate-500">Needs attention</span>
                    </div>
                  </div>
                </motion.div>
              </>
            ) : null}
          </StaggerGrid>

          {/* Quick Actions */}
          <Fade delay={0.15}>
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                Quick Actions
              </h2>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {QUICK_ACTIONS.map(action => (
                  <motion.div key={action.key} variants={itemVariants}>
                    <div
                      className={`bg-gradient-to-br ${action.color} cursor-pointer transition-all duration-300 group rounded-2xl ring-1 ${action.ring} hover:ring-2 p-5`}
                      style={{ border: '1px solid var(--orbis-hover)' }}
                      onClick={() => navigate(action.path)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-2.5 rounded-xl ${action.iconBg} ring-1 ${action.ring}`}>
                          <action.icon className={`w-5 h-5 ${action.iconColor}`} />
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">{action.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{action.description}</p>
                      {stats?.by_workflow?.[action.key] != null && (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {stats.by_workflow[action.key]} executions
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </Fade>

          {/* Workflow Distribution + Recent Activity */}
          <Fade delay={0.25}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              {/* Workflow Distribution Chart */}
              <div className="rounded-2xl lg:col-span-2" style={glassCard}>
                <div className="pb-2 px-6 pt-5">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Workflow Distribution
                  </h3>
                </div>
                <div className="p-5 pt-2">
                  {stats?.by_workflow && Object.keys(stats.by_workflow).length > 0 ? (
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart
                        data={Object.entries(stats.by_workflow).map(([key, value]) => ({
                          name: WORKFLOW_LABELS[key] || key,
                          count: value,
                          key,
                        }))}
                        layout="vertical"
                        margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                      >
                        <XAxis type="number" stroke="var(--orbis-grid)" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" stroke="var(--orbis-grid)" tick={{ fill: '#64748b', fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)', borderRadius: 12, color: 'hsl(var(--foreground))', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                          itemStyle={{ color: '#94a3b8' }}
                          cursor={{ fill: 'var(--orbis-subtle)' }}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                          {Object.keys(stats.by_workflow).map((key) => (
                            <Cell key={key} fill={WORKFLOW_BAR_COLORS[key] || '#64748b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[190px] text-slate-500">
                      <Layers className="w-8 h-8 mb-2 opacity-30" />
                      <span className="text-sm">No workflow data available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="rounded-2xl" style={glassCard}>
                <div className="pb-2 px-5 pt-5">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CircleDot className="w-3.5 h-3.5" />
                    Recent Activity
                  </h3>
                </div>
                <div className="p-4 pt-2">
                  {executions.length > 0 ? (
                    <div className="space-y-1">
                      {executions.slice(0, 5).map((exec, idx) => (
                        <motion.div
                          key={exec.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.3 }}
                          className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] rounded-xl p-2.5 -mx-1 transition-all duration-200 group"
                          onClick={() => openDetail(exec.execution_id)}
                        >
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[exec.status] || 'bg-slate-400'} ring-2 ring-offset-1 ${
                              exec.status === 'completed' ? 'ring-emerald-400/20' :
                              exec.status === 'failed' ? 'ring-rose-400/20' : 'ring-amber-400/20'
                            }`}
                            style={{ '--tw-ring-offset-color': 'var(--orbis-page)' } as React.CSSProperties}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white font-medium truncate">
                              {WORKFLOW_LABELS[exec.workflow_type] || exec.workflow_type}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {formatTimestamp(exec.created_at)} · {formatDuration(exec.total_duration_ms)}
                            </p>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[160px] text-slate-500">
                      <Activity className="w-8 h-8 mb-2 opacity-30" />
                      <span className="text-sm">No recent activity</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Fade>

          {/* Execution Log Section */}
          <Fade delay={0.35}>
            <div>
              {/* Section header + Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  Execution Log
                </h2>
                <div className="flex items-center gap-3">
                  <Select value={workflowFilter} onValueChange={(v) => { setWorkflowFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px] text-white rounded-xl h-9 text-sm" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}>
                      <SelectValue placeholder="Workflow Type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl shadow-black/30" style={selectDrop}>
                      <SelectItem value="all">All Workflows</SelectItem>
                      <SelectItem value="hiring_agent">Hiring Agent</SelectItem>
                      <SelectItem value="resume_scoring">Resume Scoring</SelectItem>
                      <SelectItem value="interview_eval">Interview Eval</SelectItem>
                      <SelectItem value="rag">RAG</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[150px] text-white rounded-xl h-9 text-sm" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl shadow-black/30" style={selectDrop}>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-slate-500 font-mono tabular-nums">
                    {total} result{total !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Execution Table */}
              <div className="rounded-2xl overflow-hidden" style={glassCard}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--orbis-subtle)', borderBottom: '1px solid var(--orbis-grid)' }}>
                      <th className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-left px-4 py-3">Workflow</th>
                      <th className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-left px-4 py-3">Status</th>
                      <th className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-left px-4 py-3">Provider</th>
                      <th className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-right px-4 py-3">Duration</th>
                      <th className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-right px-4 py-3">Tokens</th>
                      <th className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-right px-4 py-3">Nodes</th>
                      <th className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-left px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--orbis-grid)' }}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><div className="h-5 w-full rounded-lg bg-white/5 animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    ) : executions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-slate-500 py-16">
                          <div className="flex flex-col items-center gap-2">
                            <Workflow className="w-8 h-8 opacity-30" />
                            <span>No executions found</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      executions.map((exec, index) => (
                        <motion.tr
                          key={exec.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                          className="cursor-pointer hover:bg-white/[0.02] transition-colors duration-200"
                          style={{ borderBottom: '1px solid var(--orbis-grid)' }}
                          onClick={() => openDetail(exec.execution_id)}
                        >
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium ${WORKFLOW_COLORS[exec.workflow_type] || 'text-slate-400 bg-slate-500/10 border border-slate-500/20'}`}>
                              {WORKFLOW_LABELS[exec.workflow_type] || exec.workflow_type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium ${STATUS_COLORS[exec.status] || 'text-slate-400 bg-slate-500/10 border border-slate-500/20'}`}>
                              {exec.status}
                            </span>
                          </td>
                          <td className="text-slate-300 text-sm px-4 py-3">
                            {exec.provider || '\u2014'}
                          </td>
                          <td className="text-right text-slate-300 font-mono text-sm tabular-nums px-4 py-3">
                            {formatDuration(exec.total_duration_ms)}
                          </td>
                          <td className="text-right text-slate-300 font-mono text-sm tabular-nums px-4 py-3">
                            {exec.total_tokens?.toLocaleString() || '\u2014'}
                          </td>
                          <td className="text-right text-slate-300 font-mono text-sm tabular-nums px-4 py-3">
                            {exec.node_count}
                          </td>
                          <td className="text-slate-400 text-sm px-4 py-3">
                            {formatTimestamp(exec.created_at)}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-center gap-3 mt-5"
                >
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-xl h-9 w-9 flex items-center justify-center text-slate-300 hover:brightness-125 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-400 font-mono tabular-nums min-w-[100px] text-center">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-xl h-9 w-9 flex items-center justify-center text-slate-300 hover:brightness-125 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>
          </Fade>
        </div>

        {/* Detail Sheet */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent
            className="w-[520px] sm:max-w-[520px] overflow-y-auto border-0"
            style={{ background: 'var(--orbis-card)', borderLeft: '1px solid var(--orbis-border)' }}
          >
            <SheetHeader className="pb-4" style={{ borderBottom: '1px solid var(--orbis-hover)' }}>
              <SheetTitle className="text-white flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: 'rgba(27,142,229,0.1)', boxShadow: '0 0 0 1px rgba(27,142,229,0.25)' }}>
                  <Workflow className="w-4 h-4" style={{ color: '#4db5f0' }} />
                </div>
                <div>
                  <span className="block text-base">Execution Detail</span>
                  {selectedExecution && (
                    <span className="block text-[11px] text-slate-500 font-mono mt-0.5">
                      {selectedExecution.execution_id.slice(0, 16)}...
                    </span>
                  )}
                </div>
              </SheetTitle>
            </SheetHeader>
            {detailLoading ? (
              <div className="mt-6 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : selectedExecution ? (
              <motion.div
                className="mt-6 space-y-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Summary Grid */}
                <motion.div variants={itemVariants}>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl p-3.5" style={glassCard}>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Workflow</p>
                      <p className="text-sm text-white font-medium">
                        {WORKFLOW_LABELS[selectedExecution.workflow_type] || selectedExecution.workflow_type}
                      </p>
                    </div>
                    <div className="rounded-2xl p-3.5" style={glassCard}>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Status</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium ${STATUS_COLORS[selectedExecution.status] || 'text-slate-400'}`}>
                        {selectedExecution.status}
                      </span>
                    </div>
                    <div className="rounded-2xl p-3.5" style={glassCard}>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Duration</p>
                      <p className="text-sm text-white font-mono">
                        {formatDuration(selectedExecution.total_duration_ms)}
                      </p>
                    </div>
                    <div className="rounded-2xl p-3.5" style={glassCard}>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Provider</p>
                      <p className="text-sm text-white">{selectedExecution.provider || '\u2014'}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Input/Output */}
                {selectedExecution.input_summary && (
                  <motion.div variants={itemVariants}>
                    <h3 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Input</h3>
                    <p className="text-sm text-slate-300 rounded-2xl p-4 break-words leading-relaxed" style={glassCard}>
                      {selectedExecution.input_summary}
                    </p>
                  </motion.div>
                )}
                {selectedExecution.error && (
                  <motion.div variants={itemVariants}>
                    <h3 className="text-[10px] text-rose-400 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      Error
                    </h3>
                    <p className="text-sm text-rose-300 rounded-2xl p-4 break-words leading-relaxed" style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
                      {selectedExecution.error}
                    </p>
                  </motion.div>
                )}

                {/* Node Timeline */}
                <motion.div variants={itemVariants}>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Timer className="w-3.5 h-3.5" />
                    Node Timeline
                    <span className="text-slate-500 font-mono text-[10px] font-normal ml-1">
                      ({selectedExecution.nodes.length} nodes)
                    </span>
                  </h3>
                  <motion.div className="space-y-2.5" variants={staggerContainer} initial="hidden" animate="visible">
                    {selectedExecution.nodes.map((node) => (
                      <motion.div key={node.id} variants={slideInRight} className="flex items-center gap-3 group">
                        <div className="w-28 text-xs text-slate-400 truncate text-right shrink-0 group-hover:text-slate-300 transition-colors">
                          {node.node_name}
                        </div>
                        <div className="flex-1 rounded-lg h-7 relative overflow-hidden" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-grid)' }}>
                          <motion.div
                            className={`h-full rounded-lg ${NODE_BAR_COLORS[node.status] || 'bg-slate-600'}`}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.max(
                                ((node.duration_ms || 0) / maxNodeDuration) * 100,
                                4
                              )}%`,
                            }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                          />
                          <span className="absolute inset-0 flex items-center px-2.5 text-[10px] text-white/80 font-mono">
                            {formatDuration(node.duration_ms)}
                          </span>
                        </div>
                        {node.retry_count > 0 && (
                          <span className="text-[10px] text-amber-400 shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                            retry:{node.retry_count}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              </motion.div>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
