import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Zap, Brain, Cog, Send, Package,
  MoreVertical, Pencil, Trash2,
} from 'lucide-react';
import { Search as SearchIcon } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { toast } from 'sonner';

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#1B8EE5', search: '#3b82f6', ai: '#f59e0b',
  processing: '#10b981', action: '#ef4444',
};

const CATEGORY_LABELS: Record<string, string> = {
  trigger: 'Trigger', search: 'Search Source', ai: 'AI Processing',
  processing: 'Data Processing', action: 'Action',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  trigger: <Zap className="h-5 w-5" />,
  search: <SearchIcon className="h-5 w-5" />,
  ai: <Brain className="h-5 w-5" />,
  processing: <Cog className="h-5 w-5" />,
  action: <Send className="h-5 w-5" />,
};

type FilterTab = 'all' | 'built-in' | 'custom' | 'trigger' | 'search' | 'ai' | 'processing' | 'action';

export default function NodeLibrary() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: publishedNodes = [], isLoading: loadingPublished } = useQuery({
    queryKey: ['workflow-node-types'],
    queryFn: () => apiClient.request<any[]>('/api/workflows/node-types'),
  });

  const { data: customNodes = [], isLoading: loadingCustom } = useQuery({
    queryKey: ['custom-nodes'],
    queryFn: () => apiClient.getCustomNodes(),
  });

  const isLoading = loadingPublished || loadingCustom;

  // Merge: all published nodes + any draft custom nodes not already in published list
  const nodeTypes = useMemo(() => {
    const publishedCustomTypes = new Set(
      publishedNodes.filter((n: any) => n.is_custom).map((n: any) => n.type)
    );
    const draftNodes = customNodes
      .filter((n: any) => n.status === 'draft' && !publishedCustomTypes.has(n.node_type))
      .map((n: any) => ({
        type: n.node_type,
        category: n.category,
        display_name: n.display_name,
        description: n.description,
        config_schema: n.config_schema || {},
        is_custom: true,
        is_draft: true,
        id: n.id,
      }));
    return [...publishedNodes, ...draftNodes];
  }, [publishedNodes, customNodes]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteCustomNode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-node-types'] });
      queryClient.invalidateQueries({ queryKey: ['custom-nodes'] });
      toast.success('Node deleted');
    },
  });

  const filtered = useMemo(() => {
    let items = nodeTypes;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (n: any) => n.display_name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'built-in') items = items.filter((n: any) => !n.is_custom);
    else if (activeTab === 'custom') items = items.filter((n: any) => n.is_custom);
    else if (['trigger', 'search', 'ai', 'processing', 'action'].includes(activeTab))
      items = items.filter((n: any) => n.category === activeTab);
    return items;
  }, [nodeTypes, search, activeTab]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${nodeTypes.length})` },
    { key: 'built-in', label: `Built-in (${nodeTypes.filter((n: any) => !n.is_custom).length})` },
    { key: 'custom', label: `Custom (${nodeTypes.filter((n: any) => n.is_custom).length})` },
    { key: 'trigger', label: 'Triggers' },
    { key: 'search', label: 'Search' },
    { key: 'ai', label: 'AI' },
    { key: 'processing', label: 'Processing' },
    { key: 'action', label: 'Actions' },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Node Library</h1>
            <p className="text-sm text-slate-400 mt-1">Browse, manage, and create workflow nodes</p>
          </div>
          <button
            onClick={() => navigate('/workflows/nodes/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #1676c0 0%, #1B8EE5 100%)' }}
          >
            <Plus className="h-4 w-4" />
            Create Custom Node
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.key
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-500">Loading nodes...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((node: any) => (
                <div
                  key={node.type}
                  className="relative rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 transition-colors overflow-hidden group"
                >
                  <div className="h-1" style={{ backgroundColor: CATEGORY_COLORS[node.category] || '#6b7280' }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${CATEGORY_COLORS[node.category]}20`, color: CATEGORY_COLORS[node.category] }}
                        >
                          {CATEGORY_ICONS[node.category] || <Package className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{node.display_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: `${CATEGORY_COLORS[node.category]}20`,
                                color: CATEGORY_COLORS[node.category],
                              }}
                            >
                              {CATEGORY_LABELS[node.category] || node.category}
                            </span>
                            {node.is_custom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-300">
                                Custom
                              </span>
                            )}
                            {node.is_draft && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-300">
                                Draft
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {node.is_custom && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === node.type ? null : node.type);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4 text-slate-400" />
                          </button>
                          {openMenuId === node.type && (
                            <div className="absolute right-0 top-8 z-10 w-36 rounded-lg bg-slate-800 border border-slate-700 shadow-xl py-1">
                              <button
                                onClick={() => { navigate(`/workflows/nodes/${node.id}/edit`); setOpenMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => { if (node.id) deleteMutation.mutate(node.id); setOpenMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-slate-700/50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem]">{node.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Showing {filtered.length} of {nodeTypes.length} nodes
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
