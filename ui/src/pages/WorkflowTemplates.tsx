import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layout, GitBranch, Zap, ArrowRight, Search, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/utils/api';
import type { WorkflowTemplate, Workflow } from '@/types/workflow';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  sourcing: Search,
  outreach: Mail,
};

const CATEGORY_COLORS: Record<string, string> = {
  sourcing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  outreach: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
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
            <div className="w-4 h-0.5 bg-muted-foreground/30" />
          )}
        </div>
      ))}
      {nodeCount > 8 && (
        <span className="text-xs text-muted-foreground ml-1">+{nodeCount - 8}</span>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="space-y-2">
        <div className="h-5 w-2/3 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-4 w-1/4 bg-muted rounded" />
        <div className="flex gap-2">
          <div className="h-3 w-3 bg-muted rounded-full" />
          <div className="h-3 w-4 bg-muted rounded" />
          <div className="h-3 w-3 bg-muted rounded-full" />
          <div className="h-3 w-4 bg-muted rounded" />
          <div className="h-3 w-3 bg-muted rounded-full" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-9 w-28 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
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
    onError: () => {
      toast.error('Failed to create workflow');
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layout className="h-6 w-6" />
            Workflow Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Choose a pre-built template to quickly create a new workflow. Each template comes with
            pre-configured nodes and connections you can customize.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={activeCategory === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveCategory('all')}
          >
            <Zap className="h-4 w-4 mr-1" />
            All
          </Button>
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || GitBranch;
            return (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveCategory(cat)}
              >
                <Icon className="h-4 w-4 mr-1" />
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
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
          <div className="text-center py-16 text-muted-foreground">
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
                <Card key={template.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <Badge
                        variant="secondary"
                        className={CATEGORY_COLORS[template.category] || ''}
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {template.category}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between gap-3">
                    {/* Mini diagram */}
                    <div className="bg-muted/50 rounded-md">
                      <MiniWorkflowDiagram nodeCount={nodeCount} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3.5 w-3.5" />
                          {nodeCount} nodes
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowRight className="h-3.5 w-3.5" />
                          {edgeCount} edges
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => createMutation.mutate(template)}
                        disabled={createMutation.isPending}
                      >
                        Use Template
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
