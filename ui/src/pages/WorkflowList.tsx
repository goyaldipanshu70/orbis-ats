import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Play,
  Pencil,
  Copy,
  Trash2,
  Search,
  Zap,
  GitBranch,
  Users,
  BarChart3,
  Clock,
  MoreVertical,
  LayoutTemplate,
  Workflow,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, hoverLift, tapScale } from '@/lib/animations';
import { Fade } from '@/components/ui/fade';
import { CountingNumber } from '@/components/ui/counting-number';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { DataPagination } from '@/components/DataPagination';
import { apiClient } from '@/utils/api';
import type {
  Workflow as WorkflowType,
  WorkflowDefinition,
  WorkflowTemplate,
} from '@/types/workflow';
import type { PaginatedResponse } from '@/types/pagination';
import { cn } from '@/lib/utils';

// ── Design-system constants ───────────────────────────────────────────
const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = ['all', 'active', 'draft', 'archived'] as const;

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  archived: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  event: 'Event-based',
  webhook: 'Webhook',
};

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#1B8EE5',
  search: '#22c55e',
  ai: '#3b82f6',
  processing: '#f59e0b',
  action: '#14b8a6',
};

/** Map node type string to its category for color lookup */
function nodeTypeToCategory(type: string): string {
  if (type.includes('trigger')) return 'trigger';
  if (type.includes('search') || type.includes('scraper') || type === 'linkedin_search') return 'search';
  if (type.startsWith('ai_')) return 'ai';
  if (type === 'save_to_talent_pool' || type === 'add_to_email_campaign' || type === 'notify_hr') return 'action';
  return 'processing';
}

// ---------------------------------------------------------------------------
// Mini flow visualisation
// ---------------------------------------------------------------------------

function MiniFlowViz({ definition }: { definition: WorkflowDefinition }) {
  if (!definition?.nodes?.length) return null;

  const nodes = definition.nodes;
  const edges = definition.edges || [];

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxY = Math.max(...nodes.map((n) => n.position.y));

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const width = 160;
  const height = 48;
  const padX = 12;
  const padY = 8;

  const scale = (n: { position: { x: number; y: number } }) => ({
    x: padX + ((n.position.x - minX) / rangeX) * (width - padX * 2),
    y: padY + ((n.position.y - minY) / rangeY) * (height - padY * 2),
  });

  const posMap = new Map(nodes.map((n) => [n.id, scale(n)]));

  return (
    <svg width={width} height={height} className="overflow-visible">
      {edges.map(([src, tgt], i) => {
        const s = posMap.get(src);
        const t = posMap.get(tgt);
        if (!s || !t) return null;
        return (
          <line
            key={i}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke="rgba(148,163,184,0.3)"
            strokeWidth={1.5}
          />
        );
      })}
      {nodes.map((n) => {
        const pos = posMap.get(n.id);
        if (!pos) return null;
        const color = CATEGORY_COLORS[nodeTypeToCategory(n.type)] || '#6b7280';
        return (
          <circle key={n.id} cx={pos.x} cy={pos.y} r={4} fill={color} />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return 'Never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkflowList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTemplateId, setCreateTemplateId] = useState<string | null>(null);

  const pageSize = 20;

  // -- Queries ---------------------------------------------------------------

  const queryParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (search) queryParams.set('search', search);

  const {
    data: workflowsResponse,
    isLoading,
  } = useQuery<PaginatedResponse<WorkflowType>>({
    queryKey: ['workflows', page, statusFilter, search],
    queryFn: () =>
      apiClient.request<PaginatedResponse<WorkflowType>>(
        `/api/workflows?${queryParams.toString()}`
      ),
  });

  const workflows = workflowsResponse?.items ?? [];
  const totalPages = workflowsResponse?.total_pages ?? 1;

  const { data: templates = [] } = useQuery<WorkflowTemplate[]>({
    queryKey: ['workflow-templates'],
    queryFn: () =>
      apiClient.request<WorkflowTemplate[]>('/api/workflows/templates'),
  });

  // -- Mutations -------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description: string; template_id?: string }) =>
      apiClient.request<WorkflowType>('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (created) => {
      toast.success('Workflow created');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setCreateOpen(false);
      resetCreateForm();
      navigate(`/workflows/${created.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.request(`/api/workflows/${id}/run`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      toast.success('Workflow run started');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.request(`/api/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Workflow deleted');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.request(`/api/workflows/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Workflow duplicated');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // -- Helpers ---------------------------------------------------------------

  function resetCreateForm() {
    setCreateName('');
    setCreateDesc('');
    setCreateTemplateId(null);
  }

  function handleCreate() {
    if (!createName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }
    createMutation.mutate({
      name: createName.trim(),
      description: createDesc.trim(),
      ...(createTemplateId ? { template_id: createTemplateId } : {}),
    });
  }

  function handleCreateFromTemplate(template: WorkflowTemplate) {
    setCreateName(template.name);
    setCreateDesc(template.description);
    setCreateTemplateId(template.id);
    setCreateOpen(true);
  }

  // -- Stats -----------------------------------------------------------------

  const stats = {
    total: workflowsResponse?.total ?? 0,
    active: workflows.filter((w) => w.status === 'active').length,
    totalRuns: workflows.reduce((sum, w) => sum + (w.runs_count || 0), 0),
    leadsGenerated: 0,
  };

  const statCards = [
    { label: 'Total Workflows', value: stats.total, icon: Workflow, color: 'from-blue-500 to-blue-600' },
    { label: 'Active', value: stats.active, icon: Zap, color: 'from-green-500 to-emerald-600' },
    { label: 'Total Runs', value: stats.totalRuns, icon: BarChart3, color: 'from-blue-500 to-blue-600' },
    { label: 'Leads Generated', value: stats.leadsGenerated, icon: Users, color: 'from-amber-500 to-orange-600' },
  ];

  // -- Render ----------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Fade direction="down" distance={12}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">AI Workflows</h1>
              <p className="text-slate-400 mt-1">
                Build automated talent sourcing and scoring pipelines
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              <Plus className="h-4 w-4" />
              Create Workflow
            </button>
          </div>
        </Fade>

        {/* Stats */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp}>
              <div className="relative overflow-hidden rounded-xl" style={glassCard}>
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-[0.12]`}
                />
                <div className="p-4 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        {stat.label}
                      </p>
                      <div className="text-2xl font-bold mt-1 text-white">
                        <CountingNumber value={stat.value} />
                      </div>
                    </div>
                    <div
                      className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                    >
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </StaggerGrid>

        {/* Search + Status Tabs */}
        <Fade>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                placeholder="Search workflows..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={glassInput}
              />
            </div>
            <div className="flex rounded-lg p-0.5" style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-border)' }}>
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setStatusFilter(tab);
                    setPage(1);
                  }}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                    statusFilter === tab
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  {tab === 'all' ? 'All' : tab}
                </button>
              ))}
            </div>
          </div>
        </Fade>

        {/* Workflow Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : workflows.length === 0 ? (
          <Fade>
            <div className="rounded-xl border-dashed" style={{ ...glassCard, borderStyle: 'dashed' }}>
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--orbis-input)' }}>
                  <GitBranch className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold mb-1 text-white">No workflows yet</h3>
                <p className="text-slate-400 text-sm mb-4 text-center max-w-sm">
                  Create your first AI-powered workflow to automate talent
                  sourcing, scoring, and outreach.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/workflows/templates')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white"
                    style={glassCard}
                  >
                    <LayoutTemplate className="h-4 w-4" />
                    Browse Templates
                  </button>
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                  >
                    <Plus className="h-4 w-4" />
                    Create Workflow
                  </button>
                </div>
              </div>
            </div>
          </Fade>
        ) : (
          <StaggerGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {workflows.map((workflow) => (
              <motion.div key={workflow.id} variants={fadeInUp}>
                <motion.div whileHover={hoverLift} whileTap={tapScale}>
                  <div
                    className="group cursor-pointer rounded-xl transition-colors hover:border-blue-500/30"
                    style={glassCard}
                  >
                    <div className="px-5 pt-5 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className="font-semibold truncate hover:underline text-white"
                              onClick={() =>
                                navigate(`/workflows/${workflow.id}`)
                              }
                            >
                              {workflow.name}
                            </h3>
                            <span
                              className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[workflow.status] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}
                            >
                              {workflow.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 line-clamp-2">
                            {workflow.description || 'No description'}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" style={selectDrop}>
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/workflows/${workflow.id}`)
                              }
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={workflow.status !== 'active'}
                              onClick={() =>
                                runMutation.mutate(workflow.id)
                              }
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Run{workflow.status !== 'active' ? ' (activate first)' : ''}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                duplicateMutation.mutate(workflow.id)
                              }
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-400"
                              onClick={() => setDeleteId(workflow.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <MiniFlowViz definition={workflow.definition_json} />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {TRIGGER_LABELS[workflow.trigger_type] ||
                              workflow.trigger_type}
                          </span>
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            {workflow.runs_count || 0} runs
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(workflow.last_run_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                        <button
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                          style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                          disabled={runMutation.isPending || workflow.status !== 'active'}
                          onClick={(e) => {
                            e.stopPropagation();
                            runMutation.mutate(workflow.id);
                          }}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Run
                        </button>
                        <button
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
                          style={glassCard}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workflows/${workflow.id}`);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white ml-auto transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workflows/${workflow.id}/runs`);
                          }}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          History
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </StaggerGrid>
        )}

        {/* Pagination */}
        {totalPages > 1 && workflowsResponse && (
          <DataPagination
            page={page}
            totalPages={totalPages}
            total={workflowsResponse.total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}

        {/* Create from Template Section */}
        {templates.length > 0 && (
          <Fade>
            <div className="space-y-4 pt-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Create from Template
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Start with a pre-built workflow and customise it for your needs
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <motion.div
                    key={template.id}
                    whileHover={hoverLift}
                    whileTap={tapScale}
                  >
                    <div
                      className="h-full rounded-xl transition-colors hover:border-blue-500/30 cursor-pointer"
                      style={glassCard}
                    >
                      <div className="p-5 flex flex-col h-full">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <LayoutTemplate className="h-4 w-4 text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm truncate text-white">
                              {template.name}
                            </h3>
                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full mt-1 bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              {template.category}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2 flex-1">
                          {template.description}
                        </p>
                        <button
                          className="inline-flex items-center justify-center gap-1.5 mt-4 w-full px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
                          style={glassCard}
                          onClick={() => handleCreateFromTemplate(template)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Use Template
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Fade>
        )}
      </div>

      {/* Create Workflow Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-md" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Create Workflow</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set up a new AI-powered workflow for your hiring pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="wf-name" className="text-sm font-medium text-slate-300">Name</label>
              <input
                id="wf-name"
                placeholder="e.g. Senior Engineer Pipeline"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={glassInput}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="wf-desc" className="text-sm font-medium text-slate-300">Description</label>
              <textarea
                id="wf-desc"
                placeholder="Describe what this workflow does..."
                rows={3}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                style={glassInput}
              />
            </div>
            {createTemplateId && (
              <div
                className="flex items-center gap-2 text-sm text-slate-400 rounded-md px-3 py-2"
                style={{ background: 'var(--orbis-grid)' }}
              >
                <LayoutTemplate className="h-4 w-4 shrink-0" />
                <span>Creating from template</span>
                <button
                  className="h-5 w-5 ml-auto rounded flex items-center justify-center text-slate-400 hover:text-white"
                  onClick={() => setCreateTemplateId(null)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={glassCard}
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              onClick={handleCreate}
              disabled={createMutation.isPending || !createName.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
      >
        <AlertDialogContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete this workflow and all its run history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-slate-300 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
