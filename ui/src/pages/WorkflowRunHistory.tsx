import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/utils/api';
import { PaginatedResponse } from '@/types/pagination';
import { Workflow, WorkflowRun, WorkflowNodeRun } from '@/types/workflow';
import AppLayout from '@/components/layout/AppLayout';
import { DataPagination } from '@/components/DataPagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  XCircle,
  Users,
  Clock,
  Play,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  running: 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse',
  completed: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
  skipped: 'bg-gray-100 text-gray-500 border-gray-300',
};

function formatDuration(startedAt: string, completedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;

  if (diffMs < 1000) return `${diffMs}ms`;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function NodeRunsTable({ nodeRuns }: { nodeRuns: WorkflowNodeRun[] }) {
  if (!nodeRuns || nodeRuns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2 px-4">
        No node execution data available.
      </p>
    );
  }

  return (
    <div className="px-4 pb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Node ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Execution Time</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodeRuns.map((node) => (
            <TableRow key={node.id}>
              <TableCell className="font-mono text-xs">{node.node_id}</TableCell>
              <TableCell>{node.node_type}</TableCell>
              <TableCell>
                <Badge variant="outline" className={STATUS_STYLES[node.status] || ''}>
                  {node.status}
                </Badge>
              </TableCell>
              <TableCell>
                {node.execution_time_ms != null
                  ? node.execution_time_ms < 1000
                    ? `${node.execution_time_ms}ms`
                    : `${(node.execution_time_ms / 1000).toFixed(1)}s`
                  : '-'}
              </TableCell>
              <TableCell className="max-w-[300px] truncate text-xs text-red-600">
                {node.error_message || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RunRow({
  run,
  workflowName,
}: {
  run: WorkflowRun;
  workflowName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: detailedRun } = useQuery({
    queryKey: ['workflow-run', run.id],
    queryFn: () => apiClient.request<WorkflowRun>(`/api/workflows/runs/${run.id}`),
    enabled: expanded,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiClient.request<{ message: string }>(`/api/workflows/runs/${run.id}/cancel`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Run cancelled');
      queryClient.invalidateQueries({ queryKey: ['workflow-runs'] });
    },
    onError: () => {
      toast.error('Failed to cancel run');
    },
  });

  const isActive = run.status === 'pending' || run.status === 'running';

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="w-8">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </TableCell>
          <TableCell className="font-mono text-xs">#{run.id}</TableCell>
          <TableCell className="font-medium">{workflowName}</TableCell>
          <TableCell>
            <Badge variant="outline" className={STATUS_STYLES[run.status] || ''}>
              {run.status === 'running' && (
                <Play className="h-3 w-3 mr-1 inline-block" />
              )}
              {run.status === 'failed' && (
                <AlertCircle className="h-3 w-3 mr-1 inline-block" />
              )}
              {run.status}
            </Badge>
          </TableCell>
          <TableCell>{run.trigger_type}</TableCell>
          <TableCell>{formatDateTime(run.started_at)}</TableCell>
          <TableCell>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(run.started_at, run.completed_at)}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/workflows/runs/${run.id}/leads`)}
              >
                <Users className="h-3 w-3 mr-1" />
                Leads
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={8} className="p-0 bg-muted/30">
            {detailedRun ? (
              <NodeRunsTable nodeRuns={detailedRun.node_runs} />
            ) : (
              <p className="text-sm text-muted-foreground py-3 px-4">Loading...</p>
            )}
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function WorkflowRunHistory() {
  const { workflowId: workflow_id } = useParams<{ workflowId?: string }>();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(
    workflow_id || 'all'
  );
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (workflow_id) {
      setSelectedWorkflowId(workflow_id);
    }
  }, [workflow_id]);

  useEffect(() => {
    setPage(1);
  }, [selectedWorkflowId]);

  const { data: workflowsData } = useQuery({
    queryKey: ['workflows-list'],
    queryFn: () => apiClient.request<{ items: Workflow[] }>('/api/workflows'),
  });

  const workflows = workflowsData?.items || [];

  const workflowNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const w of workflows) {
      map[w.id] = w.name;
    }
    return map;
  }, [workflows]);

  const activeWorkflowId =
    selectedWorkflowId !== 'all' ? selectedWorkflowId : null;

  const { data: runsData, isLoading } = useQuery({
    queryKey: ['workflow-runs', activeWorkflowId, page],
    queryFn: () => {
      const endpoint = activeWorkflowId
        ? `/api/workflows/${activeWorkflowId}/runs?page=${page}&page_size=${pageSize}`
        : `/api/workflows/runs?page=${page}&page_size=${pageSize}`;
      return apiClient.request<PaginatedResponse<WorkflowRun>>(endpoint);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.items.some(
        (r) => r.status === 'running' || r.status === 'pending'
      );
      return hasActive ? 5000 : false;
    },
  });

  const runs = runsData?.items || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Run History</h1>
          <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="All Workflows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {activeWorkflowId
                ? `Runs for ${workflowNameMap[Number(activeWorkflowId)] || `Workflow #${activeWorkflowId}`}`
                : 'Recent Runs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading runs...
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-10 w-10 mb-3 opacity-40" />
                <p>No runs found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Run ID</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <RunRow
                        key={run.id}
                        run={run}
                        workflowName={
                          workflowNameMap[run.workflow_id] ||
                          `Workflow #${run.workflow_id}`
                        }
                      />
                    ))}
                  </TableBody>
                </Table>

                {runsData && (
                  <DataPagination
                    page={runsData.page}
                    totalPages={runsData.total_pages}
                    total={runsData.total}
                    pageSize={runsData.page_size}
                    onPageChange={setPage}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
