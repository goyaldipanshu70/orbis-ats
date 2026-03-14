import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Layout, GitBranch, Zap, ArrowRight, Search, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/utils/api';
import type { WorkflowTemplate, Workflow } from '@/types/workflow';

// ── Design-system constants ───────────────────────────────────────────
const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  sourcing: Search,
  outreach: Mail,
};

const CATEGORY_BADGE: Record<string, string> = {
  sourcing: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  outreach: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
};

function MiniWorkflowDiagram({ nodeCount }: { nodeCount: number }) {
  const dots = Array.from({ length: Math.min(nodeCount, 8) });
  return (
    <div className="flex items-center gap-1.5 py-3 px-2">
      {dots.map((_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`w-3 h-3 rounded-full ${
              i === 0
                ? 'bg-green-500'
                : i === dots.length - 1
                  ? 'bg-red-400'
                  : 'bg-blue-500'
            }`}
          />
          {i < dots.length - 1 && (
            <div className="w-4 h-0.5 bg-slate-500/30" />
          )}
        </div>
      ))}
      {nodeCount > 8 && (
        <span className="text-xs text-slate-500 ml-1">+{nodeCount - 8}</span>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl p-5 space-y-3" style={glassCard}>
      <div className="space-y-2">
        <div className="h-5 w-2/3 bg-white/5 rounded" />
        <div className="h-4 w-full bg-white/5 rounded" />
      </div>
      <div className="h-4 w-1/4 bg-white/5 rounded" />
      <div className="flex gap-2">
        <div className="h-3 w-3 bg-white/5 rounded-full" />
        <div className="h-3 w-4 bg-white/5 rounded" />
        <div className="h-3 w-3 bg-white/5 rounded-full" />
        <div className="h-3 w-4 bg-white/5 rounded" />
        <div className="h-3 w-3 bg-white/5 rounded-full" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-4 w-24 bg-white/5 rounded" />
        <div className="h-9 w-28 bg-white/5 rounded" />
      </div>
    </div>
  );
}

export default function WorkflowTemplates() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => apiClient.request<WorkflowTemplate[]>('/api/workflows/templates'),
  });

  const createMutation = useMutation({
    mutationFn: (template: WorkflowTemplate) =>
      apiClient.request<Workflow>('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({ name: template.name, template_id: template.id }),
      }),
    onSuccess: (workflow) => {
      toast.success('Workflow created from template');
      navigate(`/workflows/${workflow.id}`);
    },
    onError: (err: any) => {
      const detail = err?.detail;
      const msg = typeof detail === 'object' && detail?.validation_errors
        ? `Validation errors: ${detail.validation_errors.join(', ')}`
        : detail || err?.message || 'Failed to create workflow';
      toast.error(msg);
    },
  });

  const categories = useMemo(() => {
    if (!templates) return [];
    const cats = [...new Set(templates.map((t) => t.category))];
    return cats.sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (activeCategory === 'all') return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [templates, activeCategory]);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Layout className="h-6 w-6" />
            Workflow Templates
          </h1>
          <p className="text-slate-400 mt-1">
            Choose a pre-built template to quickly create a new workflow. Each template comes with
            pre-configured nodes and connections you can customize.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2" style={{ borderBottom: '1px solid var(--orbis-border)', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveCategory('all')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={
              activeCategory === 'all'
                ? { background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', color: 'hsl(var(--foreground))' }
                : { ...glassCard, color: '#94a3b8' }
            }
          >
            <Zap className="h-4 w-4" />
            All
          </button>
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || GitBranch;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={
                  activeCategory === cat
                    ? { background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', color: 'hsl(var(--foreground))' }
                    : { ...glassCard, color: '#94a3b8' }
                }
              >
                <Icon className="h-4 w-4" />
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Template Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No templates found</p>
            <p className="text-sm">Try selecting a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => {
              const Icon = CATEGORY_ICONS[template.category] || GitBranch;
              const nodeCount = template.definition_json?.nodes?.length ?? 0;
              const edgeCount = template.definition_json?.edges?.length ?? 0;

              return (
                <div
                  key={template.id}
                  className="flex flex-col rounded-xl hover:shadow-lg hover:shadow-blue-500/5 transition-shadow"
                  style={glassCard}
                >
                  <div className="px-5 pt-5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-white">{template.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${CATEGORY_BADGE[template.category] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}
                      >
                        <Icon className="h-3 w-3" />
                        {template.category}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                      {template.description}
                    </p>
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-3 px-5 pb-5">
                    {/* Mini diagram */}
                    <div className="rounded-md" style={{ background: 'var(--orbis-card)' }}>
                      <MiniWorkflowDiagram nodeCount={nodeCount} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3.5 w-3.5" />
                          {nodeCount} nodes
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowRight className="h-3.5 w-3.5" />
                          {edgeCount} edges
                        </span>
                      </div>
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                        onClick={() => createMutation.mutate(template)}
                        disabled={createMutation.isPending}
                      >
                        Use Template
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
