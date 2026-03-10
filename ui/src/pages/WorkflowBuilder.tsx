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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// ── Category configuration ───────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#8b5cf6',
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
      className={`bg-card border rounded-lg shadow-sm min-w-[180px] transition-shadow ${
        selected ? 'ring-2 ring-primary shadow-md' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !bg-muted-foreground"
      />
      <div
        className="px-3 py-2 rounded-t-lg flex items-center gap-2"
        style={{ backgroundColor: color }}
      >
        <span className="text-white">
          {isConditional ? <GitBranch className="h-4 w-4" /> : (CATEGORY_ICONS[nodeData.category] || <Circle className="h-4 w-4" />)}
        </span>
        <span className="text-sm font-medium text-white truncate">
          {nodeData.label}
        </span>
      </div>
      <div className="px-3 py-2 flex items-center gap-1.5">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-muted-foreground capitalize">
          {isConditional ? 'conditional' : nodeData.category}
        </span>
      </div>
      {isConditional ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-3 !h-3 !border-2 !border-white !bg-green-500"
            style={{ top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="!w-3 !h-3 !border-2 !border-white !bg-red-500"
            style={{ top: '65%' }}
          />
          <div className="absolute right-[-28px] text-[9px] font-medium" style={{ top: '28%' }}>
            <span className="text-green-600">T</span>
          </div>
          <div className="absolute right-[-28px] text-[9px] font-medium" style={{ top: '58%' }}>
            <span className="text-red-600">F</span>
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !border-2 !border-white !bg-muted-foreground"
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
        stroke: label === 'true' ? '#22c55e' : label === 'false' ? '#ef4444' : undefined,
      },
      label: label === 'true' ? 'Yes' : label === 'false' ? 'No' : undefined,
      labelStyle: { fontSize: 10, fontWeight: 600 },
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
      const label = connection.sourceHandle; // 'true' or 'false' for conditional
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: {
              strokeWidth: 2,
              stroke: label === 'true' ? '#22c55e' : label === 'false' ? '#ef4444' : undefined,
            },
            label: label === 'true' ? 'Yes' : label === 'false' ? 'No' : undefined,
            labelStyle: { fontSize: 10, fontWeight: 600 },
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

  // Keep a ref so the keyboard shortcut always calls the latest version
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
      if (value.length > 100) return; // cap label length
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
        <div className="flex items-center justify-center h-[calc(100vh-48px)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const statusColor =
    workflow?.status === 'active'
      ? 'bg-green-100 text-green-700'
      : workflow?.status === 'archived'
        ? 'bg-gray-100 text-gray-500'
        : 'bg-yellow-100 text-yellow-700';

  const selectedNodeData = selectedNode?.data as any;
  const configSchema: Record<string, any> =
    selectedNodeData?.config_schema || {};
  const configKeys = Object.keys(configSchema);

  return (
    <AppLayout noPadding fullWidth>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        {/* ── Top toolbar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {editingName ? (
            <Input
              value={workflowName}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setWorkflowName(e.target.value);
                  setHasUnsavedChanges(true);
                }
              }}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              className="max-w-[260px] h-8 text-sm font-semibold"
              autoFocus
              maxLength={200}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-semibold hover:underline underline-offset-2 truncate max-w-[260px]"
            >
              {workflowName || 'Untitled Workflow'}
            </button>
          )}

          <Badge variant="secondary" className={statusColor}>
            {workflow?.status || 'draft'}
          </Badge>

          {hasUnsavedChanges && (
            <span className="text-xs text-muted-foreground italic">
              Unsaved changes
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStatusToggle}
              disabled={saveMutation.isPending}
            >
              {workflow?.status === 'active' ? 'Set Draft' : 'Activate'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              size="sm"
              onClick={handleRun}
              disabled={
                runMutation.isPending || workflow?.status !== 'active'
              }
            >
              <Play className="h-4 w-4 mr-1" />
              {runMutation.isPending ? 'Running...' : 'Run'}
            </Button>
          </div>
        </div>

        {/* ── Body: sidebar + canvas ──────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* ── Left sidebar: Node palette ─────────────────────── */}
          <div
            className={`border-r bg-card shrink-0 transition-all duration-200 overflow-hidden ${
              sidebarOpen ? 'w-[250px]' : 'w-0'
            }`}
          >
            <div className="h-full overflow-y-auto p-3 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Node Palette</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSidebarOpen(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              {nodeTypesLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading nodes...
                </div>
              )}

              {nodeTypesError && (
                <div className="flex items-center gap-2 text-xs text-destructive py-4">
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
                    <div className="space-y-1">
                      {items.map((nt) => (
                        <div
                          key={nt.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, nt.type)}
                          className="flex items-start gap-2 p-2 rounded-md border bg-background hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {nt.display_name}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
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
                <p className="text-xs text-muted-foreground py-4">No node types available.</p>
              )}
            </div>
          </div>

          {/* Sidebar expand toggle */}
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-6 rounded-l-none border border-l-0 bg-card"
              onClick={() => setSidebarOpen(true)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
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
            >
              <Background gap={16} size={1} />
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const d = n.data as any;
                  return CATEGORY_COLORS[d?.category] || '#6b7280';
                }}
                maskColor="rgba(0,0,0,0.08)"
                className="!bg-card !border"
              />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* ── Right panel: Node configuration sheet ─────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[360px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedNodeData && (
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[selectedNodeData.category] || '#6b7280',
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
                <Label>Label</Label>
                <Input
                  value={selectedNodeData?.label || ''}
                  onChange={(e) => updateNodeLabel(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Type info */}
              <div className="space-y-1.5">
                <Label>Type</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[selectedNodeData?.category] + '20',
                      color:
                        CATEGORY_COLORS[selectedNodeData?.category],
                    }}
                  >
                    {selectedNodeData?.category}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {selectedNodeData?.nodeType}
                  </span>
                </div>
              </div>

              {/* Cron trigger schedule presets */}
              {selectedNodeData?.nodeType === 'cron_trigger' && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Schedule</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Every Hour', cron: '0 * * * *' },
                      { label: 'Daily 9am', cron: '0 9 * * *' },
                      { label: 'Mon-Fri 9am', cron: '0 9 * * 1-5' },
                      { label: 'Weekly Mon', cron: '0 9 * * 1' },
                      { label: 'Bi-Weekly', cron: '0 9 1,15 * *' },
                      { label: 'Monthly', cron: '0 9 1 * *' },
                    ].map((preset) => (
                      <Button
                        key={preset.cron}
                        variant={selectedNodeData?.config?.cron_expression === preset.cron ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => updateNodeConfig('cron_expression', preset.cron)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Custom Cron Expression</Label>
                    <Input
                      value={selectedNodeData?.config?.cron_expression || '0 9 * * 1'}
                      onChange={(e) => updateNodeConfig('cron_expression', e.target.value)}
                      placeholder="0 9 * * 1"
                      className="h-8 font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Format: minute hour day month weekday
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic config fields from config_schema */}
              {configKeys.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-sm font-semibold">
                    Configuration
                  </Label>
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
                          <Label className="text-xs capitalize">
                            {schema?.label || key.replace(/_/g, ' ')}
                          </Label>
                          <Select
                            value={String(value)}
                            onValueChange={(v) =>
                              updateNodeConfig(key, v)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue
                                placeholder={`Select ${key}`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(schema.options as string[]).map(
                                (opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                          {schema?.description && (
                            <p className="text-[10px] text-muted-foreground">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    if (fieldType === 'number' || fieldType === 'integer') {
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label className="text-xs capitalize">
                            {schema?.label || key.replace(/_/g, ' ')}
                          </Label>
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) =>
                              updateNodeConfig(
                                key,
                                Number(e.target.value),
                              )
                            }
                            className="h-8"
                            min={schema?.min}
                            max={schema?.max}
                          />
                          {schema?.description && (
                            <p className="text-[10px] text-muted-foreground">{schema.description}</p>
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
                              className="rounded"
                            />
                            <Label className="text-xs capitalize">
                              {schema?.label || key.replace(/_/g, ' ')}
                            </Label>
                          </div>
                          {schema?.description && (
                            <p className="text-[10px] text-muted-foreground ml-5">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    // Multiline text for body/template fields
                    if (key.includes('body') || key.includes('template')) {
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label className="text-xs capitalize">
                            {schema?.label || key.replace(/_/g, ' ')}
                          </Label>
                          <textarea
                            value={String(value)}
                            onChange={(e) =>
                              updateNodeConfig(key, e.target.value)
                            }
                            placeholder={schema?.placeholder || ''}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                            rows={3}
                          />
                          {key.includes('email') && (
                            <p className="text-[10px] text-muted-foreground">
                              Supports: {'{name}'}, {'{role}'}, {'{company}'} placeholders
                            </p>
                          )}
                        </div>
                      );
                    }

                    // Default: text input
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs capitalize">
                          {schema?.label || key.replace(/_/g, ' ')}
                        </Label>
                        <Input
                          value={String(value)}
                          onChange={(e) =>
                            updateNodeConfig(key, e.target.value)
                          }
                          placeholder={schema?.description || ''}
                          className="h-8"
                        />
                        {schema?.description && (
                          <p className="text-[10px] text-muted-foreground">{schema.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Delete node */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Delete Node
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete confirmation dialog ────────────────────────────── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedNodeData?.label}"? This will also remove all connections to and from this node. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelectedNode} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
