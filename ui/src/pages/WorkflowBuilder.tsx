import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Save,
  Play,
  ChevronLeft,
  ChevronRight,
  Zap,
  Search,
  Brain,
  Cog,
  Send,
  GripVertical,
  X,
  Circle,
  Loader2,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { apiClient } from '@/utils/api';
import type { Workflow, NodeTypeInfo, WorkflowNode } from '@/types/workflow';

// ── Style constants ──────────────────────────────────────────────────

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

const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};

const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

// ── Category configuration ───────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#1B8EE5',
  search: '#3b82f6',
  ai: '#f59e0b',
  processing: '#10b981',
  action: '#ef4444',
};

const CATEGORY_LABELS: Record<string, string> = {
  trigger: 'Triggers',
  search: 'Search Sources',
  ai: 'AI Processing',
  processing: 'Data Processing',
  action: 'Actions',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  trigger: <Zap className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  ai: <Brain className="h-4 w-4" />,
  processing: <Cog className="h-4 w-4" />,
  action: <Send className="h-4 w-4" />,
};

const CATEGORY_ORDER = ['trigger', 'search', 'ai', 'processing', 'action'] as const;

// ── Custom node component ────────────────────────────────────────────

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as {
    label: string;
    category: string;
    config: Record<string, any>;
    nodeType: string;
  };
  const color = CATEGORY_COLORS[nodeData.category] || '#6b7280';
  const isConditional = nodeData.nodeType === 'conditional';

  return (
    <div
      className="min-w-[180px] transition-shadow rounded-2xl"
      style={{
        ...glassCard,
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 0 24px ${color}40`
          : '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: color }}
      />
      <div
        className="px-3 py-2 rounded-t-2xl flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
      >
        <span className="text-white">
          {isConditional ? <GitBranch className="h-4 w-4" /> : (CATEGORY_ICONS[nodeData.category] || <Circle className="h-4 w-4" />)}
        </span>
        <span className="text-sm font-medium text-white truncate">
          {nodeData.label}
        </span>
      </div>
      <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: 'var(--orbis-subtle)' }}>
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
        />
        <span className="text-xs text-slate-400 capitalize">
          {isConditional ? 'conditional' : nodeData.category}
        </span>
      </div>
      {isConditional ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-3 !h-3 !border-2 !border-white !bg-emerald-400"
            style={{ top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="!w-3 !h-3 !border-2 !border-white !bg-rose-400"
            style={{ top: '65%' }}
          />
          <div className="absolute right-[-28px] text-[9px] font-medium" style={{ top: '28%' }}>
            <span className="text-emerald-400">T</span>
          </div>
          <div className="absolute right-[-28px] text-[9px] font-medium" style={{ top: '58%' }}>
            <span className="text-rose-400">F</span>
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !border-2 !border-white"
          style={{ background: color }}
        />
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNodeComponent as any,
};

// ── Conversion helpers ───────────────────────────────────────────────

function workflowNodesToFlow(
  wfNodes: WorkflowNode[],
  nodeTypeMap: Map<string, NodeTypeInfo>,
): Node[] {
  return wfNodes.map((n) => {
    const info = nodeTypeMap.get(n.type);
    return {
      id: n.id,
      type: 'workflowNode',
      position: n.position,
      data: {
        label: n.data.label,
        category: info?.category || 'processing',
        config: n.data.config || {},
        nodeType: n.type,
        config_schema: info?.config_schema || {},
      },
    };
  });
}

function workflowEdgesToFlow(edges: (string[])[]): Edge[] {
  return edges.map((edge, i) => {
    const [source, target, label] = edge;
    return {
      id: `e-${source}-${target}-${label || ''}-${i}`,
      source,
      target,
      sourceHandle: label || undefined,
      animated: true,
      style: {
        strokeWidth: 2,
        stroke: label === 'true' ? '#34d399' : label === 'false' ? '#fb7185' : '#1B8EE5',
      },
      label: label === 'true' ? 'Yes' : label === 'false' ? 'No' : undefined,
      labelStyle: { fontSize: 10, fontWeight: 600, fill: '#cbd5e1' },
      labelBgStyle: { fill: 'var(--orbis-card)', fillOpacity: 0.8 },
      data: { branchLabel: label },
    };
  });
}

function flowNodesToWorkflow(nodes: Node[]): WorkflowNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: (n.data as any).nodeType || 'unknown',
    position: n.position,
    data: {
      label: (n.data as any).label || '',
      config: (n.data as any).config || {},
    },
  }));
}

function flowEdgesToWorkflow(edges: Edge[]): string[][] {
  return edges.map((e) => {
    const label = (e.data as any)?.branchLabel || e.sourceHandle;
    if (label) return [e.source, e.target, label];
    return [e.source, e.target];
  });
}

// ── Main page ────────────────────────────────────────────────────────

function WorkflowBuilderInner() {
  const { workflowId: workflow_id } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // ── Warn before leaving with unsaved changes ─────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Queries ────────────────────────────────────────────────────────

  const { data: workflow, isLoading: workflowLoading } = useQuery({
    queryKey: ['workflow', workflow_id],
    queryFn: () =>
      apiClient.request<Workflow>(`/api/workflows/${workflow_id}`),
    enabled: !!workflow_id,
  });

  const { data: nodeTypesData, isLoading: nodeTypesLoading, isError: nodeTypesError } = useQuery({
    queryKey: ['workflow-node-types'],
    queryFn: () =>
      apiClient.request<NodeTypeInfo[]>('/api/workflows/node-types'),
  });

  const nodeTypeMap = useMemo(() => {
    const map = new Map<string, NodeTypeInfo>();
    nodeTypesData?.forEach((nt) => map.set(nt.type, nt));
    return map;
  }, [nodeTypesData]);

  const nodesByCategory = useMemo(() => {
    const groups: Record<string, NodeTypeInfo[]> = {};
    nodeTypesData?.forEach((nt) => {
      if (!groups[nt.category]) groups[nt.category] = [];
      groups[nt.category].push(nt);
    });
    return groups;
  }, [nodeTypesData]);

  // Populate flow state when workflow data loads
  useEffect(() => {
    if (workflow && nodeTypesData) {
      const def = workflow.definition_json;
      setNodes(workflowNodesToFlow(def.nodes || [], nodeTypeMap));
      setEdges(workflowEdgesToFlow(def.edges || []));
      setWorkflowName(workflow.name);
      setHasUnsavedChanges(false);
    }
  }, [workflow, nodeTypesData, nodeTypeMap, setNodes, setEdges]);

  // ── Mutations ──────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (payload: {
      name?: string;
      description?: string;
      definition_json?: any;
      status?: string;
    }) =>
      apiClient.request<Workflow>(`/api/workflows/${workflow_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Workflow saved');
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['workflow', workflow_id] });
    },
    onError: (err: any) => {
      const detail = err?.detail || err?.message || 'Failed to save workflow';
      if (typeof detail === 'object' && detail?.validation_errors) {
        toast.error(`Validation failed: ${detail.validation_errors.join('; ')}`);
      } else {
        toast.error(String(detail));
      }
    },
  });

  const runMutation = useMutation({
    mutationFn: () =>
      apiClient.request<{ id: number; status: string }>(
        `/api/workflows/${workflow_id}/run`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
    onSuccess: (data) => {
      toast.success(`Workflow run started (ID: ${data.id})`);
      queryClient.invalidateQueries({ queryKey: ['workflow', workflow_id] });
    },
    onError: (err: any) => {
      const detail = err?.detail || err?.message || 'Failed to run workflow';
      toast.error(String(detail));
    },
  });

  // ── Flow event handlers ────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      const label = connection.sourceHandle;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: {
              strokeWidth: 2,
              stroke: label === 'true' ? '#34d399' : label === 'false' ? '#fb7185' : '#1B8EE5',
            },
            label: label === 'true' ? 'Yes' : label === 'false' ? 'No' : undefined,
            labelStyle: { fontSize: 10, fontWeight: 600, fill: '#cbd5e1' },
            labelBgStyle: { fill: 'var(--orbis-card)', fillOpacity: 0.8 },
            data: { branchLabel: label },
          },
          eds,
        ),
      );
      setHasUnsavedChanges(true);
    },
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSheetOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSheetOpen(false);
  }, []);

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      const hasMeaningful = changes.some(
        (c: any) => c.type === 'position' || c.type === 'remove',
      );
      if (hasMeaningful) setHasUnsavedChanges(true);
    },
    [onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      setHasUnsavedChanges(true);
    },
    [onEdgesChange],
  );

  // ── Save and status toggle ─────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!workflowName.trim()) {
      toast.error('Workflow name cannot be empty');
      setEditingName(true);
      return;
    }
    if (workflowName.length > 200) {
      toast.error('Workflow name must be under 200 characters');
      return;
    }
    saveMutation.mutate({
      name: workflowName.trim(),
      definition_json: {
        nodes: flowNodesToWorkflow(nodes),
        edges: flowEdgesToWorkflow(edges),
      },
    });
  }, [nodes, edges, workflowName, saveMutation]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleStatusToggle = useCallback(() => {
    if (!workflow) return;
    const newStatus = workflow.status === 'active' ? 'draft' : 'active';
    if (newStatus === 'active' && nodes.length === 0) {
      toast.error('Cannot activate an empty workflow. Add at least one node.');
      return;
    }
    saveMutation.mutate({ status: newStatus });
  }, [workflow, nodes, saveMutation]);

  const handleRun = useCallback(() => {
    if (nodes.length === 0) {
      toast.error('Cannot run an empty workflow. Add nodes first.');
      return;
    }
    if (workflow?.status !== 'active') {
      toast.error('Workflow must be active to run. Click "Activate" first.');
      return;
    }
    runMutation.mutate();
  }, [nodes, workflow, runMutation]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        return;
      }
    }
    navigate(-1);
  }, [hasUnsavedChanges, navigate]);

  // ── Drag and drop from palette ─────────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const typeStr = event.dataTransfer.getData(
        'application/workflow-node-type',
      );
      if (!typeStr || !reactFlowInstance) return;

      const nodeInfo = nodeTypeMap.get(typeStr);
      if (!nodeInfo) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'workflowNode',
        position,
        data: {
          label: nodeInfo.display_name,
          category: nodeInfo.category,
          config: {},
          nodeType: nodeInfo.type,
          config_schema: nodeInfo.config_schema || {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setHasUnsavedChanges(true);
    },
    [reactFlowInstance, nodeTypeMap, setNodes],
  );

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData('application/workflow-node-type', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  // ── Node config updates ────────────────────────────────────────────

  const updateNodeConfig = useCallback(
    (key: string, value: any) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNode.id) {
            const newData = { ...n.data } as any;
            newData.config = { ...newData.config, [key]: value };
            return { ...n, data: newData };
          }
          return n;
        }),
      );
      setSelectedNode((prev) => {
        if (!prev) return null;
        const d = prev.data as any;
        return {
          ...prev,
          data: { ...d, config: { ...d.config, [key]: value } },
        };
      });
      setHasUnsavedChanges(true);
    },
    [selectedNode, setNodes],
  );

  const updateNodeLabel = useCallback(
    (value: string) => {
      if (!selectedNode) return;
      if (value.length > 100) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, label: value } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, label: value } } : null,
      );
      setHasUnsavedChanges(true);
    },
    [selectedNode, setNodes],
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter(
        (e) =>
          e.source !== selectedNode.id && e.target !== selectedNode.id,
      ),
    );
    setSelectedNode(null);
    setSheetOpen(false);
    setDeleteConfirmOpen(false);
    setHasUnsavedChanges(true);
  }, [selectedNode, setNodes, setEdges]);

  // ── Render ─────────────────────────────────────────────────────────

  if (workflowLoading) {
    return (
      <AppLayout noPadding fullWidth>
        <div
          className="flex items-center justify-center h-[calc(100vh-48px)]"
          style={{ background: 'var(--orbis-page)' }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  const statusBadgeStyle: React.CSSProperties =
    workflow?.status === 'active'
      ? { background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
      : workflow?.status === 'archived'
        ? { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }
        : { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' };

  const selectedNodeData = selectedNode?.data as any;
  const configSchema: Record<string, any> =
    selectedNodeData?.config_schema || {};
  const configKeys = Object.keys(configSchema);

  return (
    <AppLayout noPadding fullWidth>
      <div className="flex flex-col h-[calc(100vh-48px)]" style={{ background: 'var(--orbis-page)' }}>
        {/* ── Top toolbar ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-2 shrink-0"
          style={{
            background: 'var(--orbis-card)',
            borderBottom: '1px solid var(--orbis-border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={handleBack}
            className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {editingName ? (
            <input
              value={workflowName}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setWorkflowName(e.target.value);
                  setHasUnsavedChanges(true);
                }
              }}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              onFocus={handleFocus}
              className="max-w-[260px] h-8 px-3 rounded-xl text-sm font-semibold outline-none transition-all"
              style={glassInput}
              autoFocus
              maxLength={200}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-semibold hover:underline underline-offset-2 truncate max-w-[260px] text-white"
            >
              {workflowName || 'Untitled Workflow'}
            </button>
          )}

          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
            style={statusBadgeStyle}
          >
            {workflow?.status || 'draft'}
          </span>

          {hasUnsavedChanges && (
            <span className="text-xs text-slate-500 italic">
              Unsaved changes
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleStatusToggle}
              disabled={saveMutation.isPending}
              className="px-3 py-1.5 text-sm font-medium rounded-xl text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              {workflow?.status === 'active' ? 'Set Draft' : 'Activate'}
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-xl text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleRun}
              disabled={runMutation.isPending || workflow?.status !== 'active'}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-xl text-white transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
            >
              <Play className="h-4 w-4" />
              {runMutation.isPending ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>

        {/* ── Body: sidebar + canvas ──────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* ── Left sidebar: Node palette ─────────────────────── */}
          <div
            className={`shrink-0 transition-all duration-200 overflow-hidden ${sidebarOpen ? 'w-[250px]' : 'w-0'}`}
            style={{
              background: 'var(--orbis-subtle)',
              borderRight: sidebarOpen ? '1px solid var(--orbis-hover)' : 'none',
            }}
          >
            <div className="h-full overflow-y-auto p-3 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Node Palette</span>
                <button
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              {nodeTypesLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading nodes...
                </div>
              )}

              {nodeTypesError && (
                <div className="flex items-center gap-2 text-xs text-rose-400 py-4">
                  <AlertTriangle className="h-4 w-4" /> Failed to load node types
                </div>
              )}

              {CATEGORY_ORDER.map((cat) => {
                const items = nodesByCategory[cat];
                if (!items?.length) return null;
                return (
                  <div key={cat}>
                    <div
                      className="flex items-center gap-1.5 mb-2"
                      style={{ color: CATEGORY_COLORS[cat] }}
                    >
                      {CATEGORY_ICONS[cat]}
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((nt) => (
                        <div
                          key={nt.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, nt.type)}
                          className="flex items-start gap-2 p-2 rounded-xl cursor-grab active:cursor-grabbing transition-all hover:scale-[1.01]"
                          style={{
                            ...glassCard,
                            borderLeft: `3px solid ${CATEGORY_COLORS[nt.category] || '#6b7280'}`,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.background = 'var(--orbis-border)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.background = 'var(--orbis-card)';
                          }}
                        >
                          <GripVertical className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate text-slate-200">
                              {nt.display_name}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-2">
                              {nt.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {!nodeTypesLoading && !nodeTypesError && !nodeTypesData?.length && (
                <p className="text-xs text-slate-500 py-4">No node types available.</p>
              )}
            </div>
          </div>

          {/* Sidebar expand toggle */}
          {!sidebarOpen && (
            <button
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-6 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              style={{
                background: 'var(--orbis-input)',
                border: '1px solid var(--orbis-border)',
                borderLeft: 0,
                borderRadius: '0 8px 8px 0',
              }}
              onClick={() => setSidebarOpen(true)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* ── Center canvas ─────────────────────────────────── */}
          <div className="flex-1" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
              proOptions={{ hideAttribution: true }}
              style={{ background: 'var(--orbis-page)' }}
            >
              <Background gap={16} size={1} color="rgba(27,142,229,0.08)" />
              <Controls
                className="!rounded-xl !shadow-lg [&>button]:!bg-[var(--orbis-card)] [&>button]:!border-white/10 [&>button]:!text-slate-300 [&>button:hover]:!bg-white/10 [&>button_svg]:!fill-slate-300"
                style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)', borderRadius: '12px' }}
              />
              <MiniMap
                nodeColor={(n) => {
                  const d = n.data as any;
                  return CATEGORY_COLORS[d?.category] || '#6b7280';
                }}
                maskColor="var(--orbis-overlay)"
                style={{
                  background: 'var(--orbis-card)',
                  border: '1px solid var(--orbis-border)',
                  borderRadius: '12px',
                }}
              />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* ── Right panel: Node configuration sheet ─────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          className="w-[360px] sm:w-[400px] border-0"
          style={{ background: 'var(--orbis-card)', borderLeft: '1px solid var(--orbis-border)' }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-white">
              {selectedNodeData && (
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[selectedNodeData.category] || '#6b7280',
                    boxShadow: `0 0 8px ${CATEGORY_COLORS[selectedNodeData.category] || '#6b7280'}60`,
                  }}
                />
              )}
              {selectedNodeData?.label || 'Node Configuration'}
            </SheetTitle>
          </SheetHeader>

          {selectedNode && (
            <div className="mt-6 space-y-5">
              {/* Label field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Label</label>
                <input
                  value={selectedNodeData?.label || ''}
                  onChange={(e) => updateNodeLabel(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  maxLength={100}
                  className="w-full h-9 rounded-xl px-3 text-sm outline-none transition-all"
                  style={glassInput}
                />
              </div>

              {/* Type info */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Type</label>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[selectedNodeData?.category] + '18',
                      color:
                        CATEGORY_COLORS[selectedNodeData?.category],
                      border: `1px solid ${CATEGORY_COLORS[selectedNodeData?.category]}30`,
                    }}
                  >
                    {selectedNodeData?.category}
                  </span>
                  <span className="text-sm text-slate-400">
                    {selectedNodeData?.nodeType}
                  </span>
                </div>
              </div>

              {/* Cron trigger schedule presets */}
              {selectedNodeData?.nodeType === 'cron_trigger' && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-white">Schedule</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Every Hour', cron: '0 * * * *' },
                      { label: 'Daily 9am', cron: '0 9 * * *' },
                      { label: 'Mon-Fri 9am', cron: '0 9 * * 1-5' },
                      { label: 'Weekly Mon', cron: '0 9 * * 1' },
                      { label: 'Bi-Weekly', cron: '0 9 1,15 * *' },
                      { label: 'Monthly', cron: '0 9 1 * *' },
                    ].map((preset) => (
                      <button
                        key={preset.cron}
                        className="text-xs h-7 rounded-lg font-medium transition-all"
                        style={
                          selectedNodeData?.config?.cron_expression === preset.cron
                            ? { background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', color: 'hsl(var(--foreground))', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }
                            : { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: '#94a3b8' }
                        }
                        onClick={() => updateNodeConfig('cron_expression', preset.cron)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Custom Cron Expression</label>
                    <input
                      value={selectedNodeData?.config?.cron_expression || '0 9 * * 1'}
                      onChange={(e) => updateNodeConfig('cron_expression', e.target.value)}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="0 9 * * 1"
                      className="w-full h-8 font-mono text-xs rounded-xl px-3 outline-none transition-all"
                      style={glassInput}
                    />
                    <p className="text-[10px] text-slate-500">
                      Format: minute hour day month weekday
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic config fields from config_schema */}
              {configKeys.length > 0 && (
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-white">
                    Configuration
                  </label>
                  {configKeys.map((key) => {
                    const schema = configSchema[key];
                    const value = selectedNodeData?.config?.[key] ?? '';
                    const fieldType =
                      schema?.type ||
                      (typeof schema === 'string' ? schema : 'string');

                    // Skip cron_expression if already shown above
                    if (selectedNodeData?.nodeType === 'cron_trigger' && key === 'cron_expression') {
                      return null;
                    }

                    if (fieldType === 'select' && schema?.options) {
                      return (
                        <div key={key} className="space-y-1.5">
                          <label className="text-xs capitalize text-slate-400">
                            {schema?.label || key.replace(/_/g, ' ')}
                          </label>
                          <Select
                            value={String(value)}
                            onValueChange={(v) =>
                              updateNodeConfig(key, v)
                            }
                          >
                            <SelectTrigger className="h-11 rounded-xl text-white border-0" style={glassInput}>
                              <SelectValue
                                placeholder={`Select ${key}`}
                              />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-0" style={selectDrop}>
                              {(schema.options as string[]).map(
                                (opt: string) => (
                                  <SelectItem key={opt} value={opt} className="text-slate-200 focus:bg-white/10 focus:text-white">
                                    {opt}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                          {schema?.description && (
                            <p className="text-[10px] text-slate-500">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    if (fieldType === 'number' || fieldType === 'integer') {
                      return (
                        <div key={key} className="space-y-1.5">
                          <label className="text-xs capitalize text-slate-400">
                            {schema?.label || key.replace(/_/g, ' ')}
                          </label>
                          <input
                            type="number"
                            value={value}
                            onChange={(e) =>
                              updateNodeConfig(
                                key,
                                Number(e.target.value),
                              )
                            }
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            className="w-full h-8 rounded-xl px-3 text-sm outline-none transition-all"
                            style={glassInput}
                            min={schema?.min}
                            max={schema?.max}
                          />
                          {schema?.description && (
                            <p className="text-[10px] text-slate-500">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    if (fieldType === 'boolean') {
                      return (
                        <div
                          key={key}
                          className="space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!value}
                              onChange={(e) =>
                                updateNodeConfig(
                                  key,
                                  e.target.checked,
                                )
                              }
                              className="rounded accent-[#1B8EE5]"
                            />
                            <label className="text-xs capitalize text-slate-300">
                              {schema?.label || key.replace(/_/g, ' ')}
                            </label>
                          </div>
                          {schema?.description && (
                            <p className="text-[10px] text-slate-500 ml-5">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    // Array fields — comma-separated input, stored as string[]
                    if (fieldType === 'array') {
                      const arrDisplay = Array.isArray(value)
                        ? value.join(', ')
                        : String(value || '');
                      return (
                        <div key={key} className="space-y-1.5">
                          <label className="text-xs capitalize text-slate-400">
                            {schema?.label || key.replace(/_/g, ' ')}
                          </label>
                          <input
                            value={arrDisplay}
                            onChange={(e) => {
                              const arr = e.target.value
                                .split(',')
                                .map((s: string) => s.trim())
                                .filter(Boolean);
                              updateNodeConfig(key, arr);
                            }}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder="e.g. Python, React, AWS"
                            className="w-full h-8 rounded-xl px-3 text-sm outline-none transition-all"
                            style={glassInput}
                          />
                          <p className="text-[10px] text-slate-500">
                            {schema?.description || 'Comma-separated list'}
                          </p>
                        </div>
                      );
                    }

                    // Multiline text for body/template fields
                    if (key.includes('body') || key.includes('template')) {
                      return (
                        <div key={key} className="space-y-1.5">
                          <label className="text-xs capitalize text-slate-400">
                            {schema?.label || key.replace(/_/g, ' ')}
                          </label>
                          <textarea
                            value={String(value)}
                            onChange={(e) =>
                              updateNodeConfig(key, e.target.value)
                            }
                            onFocus={(e) => handleFocus(e)}
                            onBlur={(e) => handleBlur(e)}
                            placeholder={schema?.placeholder || ''}
                            className="w-full rounded-xl px-3 py-2 text-sm min-h-[80px] resize-y outline-none transition-all"
                            style={glassInput}
                            rows={3}
                          />
                          {key.includes('email') && (
                            <p className="text-[10px] text-slate-500">
                              Supports: {'{name}'}, {'{role}'}, {'{company}'} placeholders
                            </p>
                          )}
                        </div>
                      );
                    }

                    // Default: text input
                    return (
                      <div key={key} className="space-y-1.5">
                        <label className="text-xs capitalize text-slate-400">
                          {schema?.label || key.replace(/_/g, ' ')}
                        </label>
                        <input
                          value={String(value)}
                          onChange={(e) =>
                            updateNodeConfig(key, e.target.value)
                          }
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          placeholder={schema?.description || ''}
                          className="w-full h-8 rounded-xl px-3 text-sm outline-none transition-all"
                          style={glassInput}
                        />
                        {schema?.description && (
                          <p className="text-[10px] text-slate-500">{schema.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Delete node */}
              <div className="pt-4" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                <button
                  className="w-full px-3 py-2 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1 text-rose-400 hover:text-white"
                  style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)' }}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <X className="h-4 w-4" />
                  Delete Node
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete confirmation dialog ────────────────────────────── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent
          className="border-0 rounded-2xl"
          style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Node</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete &ldquo;{selectedNodeData?.label}&rdquo;? This will also remove all connections to and from this node. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-0 text-slate-300 hover:text-white hover:bg-white/10"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelectedNode}
              className="border-0 text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)', boxShadow: '0 4px 20px rgba(225,29,72,0.25)' }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

export default function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}
