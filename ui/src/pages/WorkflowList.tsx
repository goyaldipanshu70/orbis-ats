import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = ['all', 'active', 'draft', 'archived'] as const;

const STATUS_COLORS: Record<string, string> = {
  draft:
    'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  active:
    'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
  archived: 'bg-muted text-muted-foreground border-border',
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  event: 'Event-based',
  webhook: 'Webhook',
};

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#8b5cf6',
  search: '#22c55e',
  ai: '#3b82f6',
  processing: '#f59e0b',
  action: '#14b8a6',
};

// ---------------------------------------------------------------------------
// Mini flow visualisation (unchanged)
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
            stroke="currentColor"
            className="text-muted-foreground/40"
            strokeWidth={1.5}
          />
        );
      })}
      {nodes.map((n) => {
        const pos = posMap.get(n.id);
        if (!pos) return null;
        const color = CATEGORY_COLORS[n.type] || '#6b7280';
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
  const diff = Date.now() - new Date(dateStr).getTime();
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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTemplateId, setCreateTemplateId] = useState<string | null>(null);

  const pageSize = 20;

  // ── Queries ────────────────────────────────────────────────────────

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

  // ── Mutations ──────────────────────────────────────────────────────

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
      apiClient.request(`/api/workflows/${id}/run`, { method: 'POST' }),
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

  // ── Helpers ────────────────────────────────────────────────────────

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

  // ── Stats (from current page data; could come from a dedicated endpoint) ──

  const stats = {
    total: workflowsResponse?.total ?? 0,
    active: workflows.filter((w) => w.status === 'active').length,
    totalRuns: workflows.reduce((sum, w) => sum + (w.runs_count || 0), 0),
    leadsGenerated: 0,
  };

  const statCards = [
    { label: 'Total Workflows', value: stats.total, icon: Workflow, color: 'from-violet-500 to-purple-600' },
    { label: 'Active', value: stats.active, icon: Zap, color: 'from-green-500 to-emerald-600' },
    { label: 'Total Runs', value: stats.totalRuns, icon: BarChart3, color: 'from-blue-500 to-indigo-600' },
    { label: 'Leads Generated', value: stats.leadsGenerated, icon: Users, color: 'from-amber-500 to-orange-600' },
  ];

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Fade direction="down" distance={12}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Workflows</h1>
              <p className="text-muted-foreground mt-1">
                Build automated talent sourcing and scoring pipelines
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        </Fade>

        {/* Stats */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp}>
              <Card className="relative overflow-hidden border-0 shadow-sm">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-[0.06] dark:opacity-[0.12]`}
                />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {stat.label}
                      </p>
                      <div className="text-2xl font-bold mt-1">
                        <CountingNumber value={stat.value} />
                      </div>
                    </div>
                    <div
                      className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                    >
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </StaggerGrid>

        {/* Search + Status Tabs */}
        <Fade>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
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
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
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
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : workflows.length === 0 ? (
          <Fade>
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <GitBranch className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No workflows yet</h3>
                <p className="text-muted-foreground text-sm mb-4 text-center max-w-sm">
                  Create your first AI-powered workflow to automate talent
                  sourcing, scoring, and outreach.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/workflows/templates')}
                  >
                    <LayoutTemplate className="h-4 w-4 mr-2" />
                    Browse Templates
                  </Button>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Fade>
        ) : (
          <StaggerGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {workflows.map((workflow) => (
              <motion.div key={workflow.id} variants={fadeInUp}>
                <motion.div whileHover={hoverLift} whileTap={tapScale}>
                  <Card className="group cursor-pointer transition-colors hover:border-primary/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className="font-semibold truncate hover:underline"
                              onClick={() =>
                                navigate(`/workflows/${workflow.id}`)
                              }
                            >
                              {workflow.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 shrink-0 ${STATUS_COLORS[workflow.status]}`}
                            >
                              {workflow.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {workflow.description || 'No description'}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/workflows/${workflow.id}`)
                              }
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                runMutation.mutate(workflow.id)
                              }
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Run
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
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(workflow.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MiniFlowViz definition={workflow.definition_json} />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8"
                          disabled={runMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            runMutation.mutate(workflow.id);
                          }}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Run
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workflows/${workflow.id}`);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 ml-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workflows/${workflow.id}/runs`);
                          }}
                        >
                          <BarChart3 className="h-3.5 w-3.5 mr-1" />
                          History
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            ))}
          </StaggerGrid>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <DataPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}

        {/* Create from Template Section */}
        {templates.length > 0 && (
          <Fade>
            <div className="space-y-4 pt-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Create from Template
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
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
                    <Card className="h-full transition-colors hover:border-primary/30 cursor-pointer">
                      <CardContent className="p-5 flex flex-col h-full">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <LayoutTemplate className="h-4.5 w-4.5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm truncate">
                              {template.name}
                            </h3>
                            <Badge
                              variant="secondary"
                              className="text-[10px] mt-1"
                            >
                              {template.category}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                          {template.description}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 w-full"
                          onClick={() => handleCreateFromTemplate(template)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>
              Set up a new AI-powered workflow for your hiring pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                placeholder="e.g. Senior Engineer Pipeline"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-desc">Description</Label>
              <Textarea
                id="wf-desc"
                placeholder="Describe what this workflow does..."
                rows={3}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
              />
            </div>
            {createTemplateId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                <LayoutTemplate className="h-4 w-4 shrink-0" />
                <span>Creating from template</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 ml-auto"
                  onClick={() => setCreateTemplateId(null)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !createName.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this workflow and all its run history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
