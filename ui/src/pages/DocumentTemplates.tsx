import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import {
  FileText, Plus, Trash2, Eye, Search, Pencil, Copy, Wand2,
  ClipboardCopy, Download, Printer, Loader2, Sparkles, X, CheckSquare,
  Link2, Settings2, Calendar, ArrowUpDown,
} from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DataPagination } from '@/components/DataPagination';
import { fadeInUp, hoverLift, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentTemplate {
  id: number;
  name: string;
  category: string;
  description: string;
  content: string;
  variables: string[];
  created_at: string;
}

type TemplateCategory =
  | 'offer_letter'
  | 'nda'
  | 'employment_contract'
  | 'policy'
  | 'onboarding'
  | 'termination'
  | 'performance_review'
  | 'other';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: TemplateCategory[] = [
  'offer_letter',
  'nda',
  'employment_contract',
  'policy',
  'onboarding',
  'termination',
  'performance_review',
  'other',
];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  offer_letter: 'Offer Letter',
  nda: 'NDA',
  employment_contract: 'Employment Contract',
  policy: 'Policy',
  onboarding: 'Onboarding',
  termination: 'Termination',
  performance_review: 'Performance Review',
  other: 'Other',
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  offer_letter: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  nda: 'bg-amber-50 text-amber-700 border-amber-200',
  employment_contract: 'bg-blue-50 text-blue-700 border-blue-200',
  policy: 'bg-violet-50 text-violet-700 border-violet-200',
  onboarding: 'bg-teal-50 text-teal-700 border-teal-200',
  termination: 'bg-rose-50 text-rose-700 border-rose-200',
  performance_review: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  other: 'bg-slate-50 text-slate-600 border-slate-200',
};

const CATEGORY_BORDER_COLORS: Record<TemplateCategory, string> = {
  offer_letter: 'border-l-emerald-500',
  nda: 'border-l-amber-500',
  employment_contract: 'border-l-blue-500',
  policy: 'border-l-violet-500',
  onboarding: 'border-l-teal-500',
  termination: 'border-l-rose-500',
  performance_review: 'border-l-cyan-500',
  other: 'border-l-slate-400',
};

const CATEGORY_ICON_COLORS: Record<TemplateCategory, string> = {
  offer_letter: 'text-emerald-500',
  nda: 'text-amber-500',
  employment_contract: 'text-blue-500',
  policy: 'text-violet-500',
  onboarding: 'text-teal-500',
  termination: 'text-rose-500',
  performance_review: 'text-cyan-500',
  other: 'text-slate-400',
};

const CATEGORY_PILL_ACTIVE: Record<TemplateCategory, string> = {
  offer_letter: 'bg-emerald-600 text-white',
  nda: 'bg-amber-600 text-white',
  employment_contract: 'bg-blue-600 text-white',
  policy: 'bg-violet-600 text-white',
  onboarding: 'bg-teal-600 text-white',
  termination: 'bg-rose-600 text-white',
  performance_review: 'bg-cyan-600 text-white',
  other: 'bg-slate-600 text-white',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat as TemplateCategory] ?? cat;
}

function getCategoryBadgeClass(cat: string): string {
  return CATEGORY_COLORS[cat as TemplateCategory] ?? CATEGORY_COLORS.other;
}

function getCategoryBorderClass(cat: string): string {
  return CATEGORY_BORDER_COLORS[cat as TemplateCategory] ?? CATEGORY_BORDER_COLORS.other;
}

function getCategoryIconColor(cat: string): string {
  return CATEGORY_ICON_COLORS[cat as TemplateCategory] ?? CATEGORY_ICON_COLORS.other;
}

function varLabel(v: string): string {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Client-side variable substitution for live preview */
function renderContent(content: string, vars: Record<string, string>): string {
  let out = content;
  for (const [k, v] of Object.entries(vars)) {
    if (v) out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentTemplates() {
  const { isAdmin, isHR } = useAuth();
  const { toast } = useToast();
  const canWrite = isAdmin() || isHR();

  // Data
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, page: 1, page_size: 20, total_pages: 1 });

  // Filters (server-side)
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Dialogs
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<DocumentTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [useTemplate, setUseTemplate] = useState<DocumentTemplate | null>(null);

  // Create / Edit form
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('offer_letter');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formVariables, setFormVariables] = useState('');
  const [saving, setSaving] = useState(false);

  // Use-template variable values
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  // Action spinners
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkOperating, setBulkOperating] = useState(false);

  const hasSelection = selectedIds.size > 0;
  const allVisibleSelected = useMemo(
    () => templates.length > 0 && templates.every((t) => selectedIds.has(t.id)),
    [templates, selectedIds],
  );

  const sortedTemplates = useMemo(() => {
    const sorted = [...templates];
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'category':
        return sorted.sort((a, b) => a.category.localeCompare(b.category));
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'newest':
      default:
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [templates, sortBy]);

  // Tab: 'templates' | 'stage-rules'
  const [activeTab, setActiveTab] = useState<'templates' | 'stage-rules'>('templates');

  // Stage Rules state
  const [stageRules, setStageRules] = useState<any[]>([]);
  const [stageRulesByStage, setStageRulesByStage] = useState<Record<string, any[]>>({});
  const [rulesLoading, setRulesLoading] = useState(false);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [ruleStage, setRuleStage] = useState<string>('applied');
  const [ruleTemplateId, setRuleTemplateId] = useState<number | null>(null);
  const [ruleTemplateName, setRuleTemplateName] = useState('');
  const [ruleTemplateCategory, setRuleTemplateCategory] = useState('');
  const [ruleIsRequired, setRuleIsRequired] = useState(true);
  const [ruleSaving, setRuleSaving] = useState(false);

  const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'];

  const fetchStageRules = useCallback(async () => {
    try {
      setRulesLoading(true);
      const data = await apiClient.getStageDocumentRules();
      setStageRules(data.rules || []);
      setStageRulesByStage(data.by_stage || {});
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to load stage rules.', variant: 'destructive' });
    } finally {
      setRulesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'stage-rules') {
      fetchStageRules();
    }
  }, [activeTab, fetchStageRules]);

  const handleCreateRule = async () => {
    if (!ruleTemplateId || !ruleTemplateName) {
      toast({ title: 'Validation', description: 'Please select a template.', variant: 'destructive' });
      return;
    }
    try {
      setRuleSaving(true);
      await apiClient.createStageDocumentRule({
        stage: ruleStage,
        template_id: ruleTemplateId,
        template_name: ruleTemplateName,
        template_category: ruleTemplateCategory || undefined,
        is_required: ruleIsRequired,
      });
      toast({ title: 'Created', description: 'Stage document rule created.' });
      setAddRuleOpen(false);
      setRuleTemplateId(null);
      setRuleTemplateName('');
      setRuleTemplateCategory('');
      setRuleIsRequired(true);
      fetchStageRules();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to create rule.', variant: 'destructive' });
    } finally {
      setRuleSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      await apiClient.deleteStageDocumentRule(ruleId);
      toast({ title: 'Deleted', description: 'Stage rule removed.' });
      fetchStageRules();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to delete rule.', variant: 'destructive' });
    }
  };

  // All templates list for the rule creation dropdown
  const [allTemplatesForRule, setAllTemplatesForRule] = useState<DocumentTemplate[]>([]);
  useEffect(() => {
    if (addRuleOpen) {
      (async () => {
        try {
          const data = await (apiClient as any).getDocumentTemplates(1, 100);
          setAllTemplatesForRule(data.items || []);
        } catch { /* ignore */ }
      })();
    }
  }, [addRuleOpen]);

  // -----------------------------------------------------------------------
  // Debounce search
  // -----------------------------------------------------------------------

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounce(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // -----------------------------------------------------------------------
  // Fetch (server-side filtering)
  // -----------------------------------------------------------------------

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const cat = activeCategory === 'all' ? undefined : activeCategory;
      const search = searchDebounce.trim() || undefined;
      const data = await (apiClient as any).getDocumentTemplates(currentPage, 20, search, cat);
      setTemplates(data.items);
      setPaginationMeta({ total: data.total, page: data.page, page_size: data.page_size, total_pages: data.total_pages });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to load document templates.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, currentPage, searchDebounce, activeCategory]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------

  const resetForm = () => {
    setFormName('');
    setFormCategory('offer_letter');
    setFormDescription('');
    setFormContent('');
    setFormVariables('');
  };

  const openEdit = (t: DocumentTemplate) => {
    setFormName(t.name);
    setFormCategory(t.category);
    setFormDescription(t.description || '');
    setFormContent(t.content);
    setFormVariables(t.variables.join(', '));
    setEditTemplate(t);
  };

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  const handleCreate = async () => {
    if (!formName.trim() || !formContent.trim()) {
      toast({ title: 'Validation', description: 'Name and content are required.', variant: 'destructive' });
      return;
    }
    const variables = formVariables.split(',').map((v) => v.trim()).filter(Boolean);
    try {
      setSaving(true);
      await (apiClient as any).createDocumentTemplate({ name: formName.trim(), category: formCategory, description: formDescription.trim(), content: formContent, variables });
      toast({ title: 'Created', description: 'Document template created successfully.' });
      setCreateOpen(false);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to create template.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Edit (save)
  // -----------------------------------------------------------------------

  const handleEdit = async () => {
    if (!editTemplate || !formName.trim() || !formContent.trim()) {
      toast({ title: 'Validation', description: 'Name and content are required.', variant: 'destructive' });
      return;
    }
    const variables = formVariables.split(',').map((v) => v.trim()).filter(Boolean);
    try {
      setSaving(true);
      await (apiClient as any).updateDocumentTemplate(editTemplate.id, {
        name: formName.trim(), category: formCategory, description: formDescription.trim(), content: formContent, variables,
      });
      toast({ title: 'Updated', description: 'Template updated successfully.' });
      setEditTemplate(null);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update template.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await (apiClient as any).deleteDocumentTemplate(deleteTarget.id);
      toast({ title: 'Deleted', description: `"${deleteTarget.name}" has been removed.` });
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to delete template.', variant: 'destructive' });
    }
  };

  // -----------------------------------------------------------------------
  // Duplicate
  // -----------------------------------------------------------------------

  const handleDuplicate = async (t: DocumentTemplate) => {
    try {
      setDuplicatingId(t.id);
      await (apiClient as any).duplicateDocumentTemplate(t.id);
      toast({ title: 'Duplicated', description: `Copy of "${t.name}" created.` });
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to duplicate template.', variant: 'destructive' });
    } finally {
      setDuplicatingId(null);
    }
  };

  // -----------------------------------------------------------------------
  // Seed
  // -----------------------------------------------------------------------

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const res = await (apiClient as any).seedDocumentTemplates();
      toast({ title: 'Seeded', description: res.message });
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to seed templates.', variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  // -----------------------------------------------------------------------
  // Bulk selection helpers
  // -----------------------------------------------------------------------

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map((t) => t.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Clear selection when page / filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, searchDebounce, activeCategory]);

  // Escape key clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        clearSelection();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedIds]);

  // -----------------------------------------------------------------------
  // Bulk Duplicate
  // -----------------------------------------------------------------------

  const handleBulkDuplicate = async () => {
    const ids = Array.from(selectedIds);
    try {
      setBulkOperating(true);
      await Promise.all(ids.map((id) => (apiClient as any).duplicateDocumentTemplate(id)));
      toast({ title: 'Duplicated', description: `${ids.length} template(s) duplicated successfully.` });
      clearSelection();
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Some duplications failed.', variant: 'destructive' });
    } finally {
      setBulkOperating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Bulk Export
  // -----------------------------------------------------------------------

  const handleBulkExport = () => {
    const selected = templates.filter((t) => selectedIds.has(t.id));
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-templates-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${selected.length} template(s) exported as JSON.` });
  };

  // -----------------------------------------------------------------------
  // Bulk Delete
  // -----------------------------------------------------------------------

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      setBulkOperating(true);
      await Promise.all(ids.map((id) => (apiClient as any).deleteDocumentTemplate(id)));
      toast({ title: 'Deleted', description: `${ids.length} template(s) deleted.` });
      setBulkDeleteOpen(false);
      clearSelection();
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Some deletions failed.', variant: 'destructive' });
    } finally {
      setBulkOperating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Use Template helpers
  // -----------------------------------------------------------------------

  const openUseTemplate = (t: DocumentTemplate) => {
    const init: Record<string, string> = {};
    (t.variables || []).forEach((v) => { init[v] = ''; });
    setVarValues(init);
    setUseTemplate(t);
  };

  const handleCopyRendered = () => {
    if (!useTemplate) return;
    const text = renderContent(useTemplate.content, varValues);
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Rendered document copied to clipboard.' });
  };

  const handleDownloadRendered = () => {
    if (!useTemplate) return;
    const text = renderContent(useTemplate.content, varValues);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${useTemplate.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintRendered = () => {
    if (!useTemplate) return;
    const text = renderContent(useTemplate.content, varValues);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>${useTemplate.name}</title><style>body{font-family:monospace;white-space:pre-wrap;padding:40px;line-height:1.6;max-width:800px;margin:0 auto;}</style></head><body>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`);
    w.document.close();
    w.print();
  };

  const handleDownloadPdf = async () => {
    if (!useTemplate) return;
    try {
      setDownloadingPdf(true);
      await (apiClient as any).downloadTemplatePDF(useTemplate.id, varValues);
      toast({ title: 'Downloaded', description: 'PDF document downloaded successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // -----------------------------------------------------------------------
  // Template form (shared between create & edit)
  // -----------------------------------------------------------------------

  const templateForm = (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <Label htmlFor="tpl-name" className="text-sm font-medium">Template Name</Label>
        <Input id="tpl-name" placeholder="e.g. Standard Offer Letter" value={formName} onChange={(e) => setFormName(e.target.value)} className="h-10" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Category</Label>
        <Select value={formCategory} onValueChange={setFormCategory}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tpl-desc" className="text-sm font-medium">Description</Label>
        <Textarea id="tpl-desc" placeholder="Brief description of this template..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tpl-content" className="text-sm font-medium">Content</Label>
        <Textarea id="tpl-content" placeholder={'Write the template body here. Use {{variable_name}} for placeholders...'} value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={10} className="font-mono text-sm" />
        <p className="text-xs text-muted-foreground">Supports markdown formatting (bold, headings, lists).</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tpl-vars" className="text-sm font-medium">Variables</Label>
        <Input id="tpl-vars" placeholder="employee_name, start_date, salary" value={formVariables} onChange={(e) => setFormVariables(e.target.value)} className="h-10" />
        <p className="text-xs text-muted-foreground">Comma-separated list of placeholder variable names used in the template.</p>
      </div>
    </div>
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage reusable document templates for your hiring workflow.</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'templates' && isAdmin() && templates.length === 0 && !loading && (
              <Button variant="outline" onClick={handleSeed} disabled={seeding} className="gap-2">
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Seed Defaults
              </Button>
            )}
            {activeTab === 'templates' && canWrite && (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            )}
            {activeTab === 'stage-rules' && canWrite && (
              <Button onClick={() => setAddRuleOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'templates' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('stage-rules')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'stage-rules' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Settings2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Stage Rules
          </button>
        </div>

        {/* Stage Rules Tab */}
        {activeTab === 'stage-rules' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Configure which document templates are auto-assigned when a candidate moves to a pipeline stage.
            </p>
            {rulesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stageRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Link2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">No stage rules configured</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add rules to automatically assign document templates when candidates enter specific pipeline stages.
                </p>
                {canWrite && (
                  <Button onClick={() => setAddRuleOpen(true)} variant="outline" className="gap-2 mt-4">
                    <Plus className="h-4 w-4" />
                    Add First Rule
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {PIPELINE_STAGES.map((stage) => {
                  const rules = stageRulesByStage[stage] || [];
                  if (rules.length === 0) return null;
                  return (
                    <Card key={stage} className="overflow-hidden">
                      <div className="px-4 py-3 bg-muted/50 border-b border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                            <span className="text-sm font-semibold capitalize">{stage}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">{rules.length} template{rules.length !== 1 ? 's' : ''}</Badge>
                        </div>
                      </div>
                      <CardContent className="px-4 py-3 space-y-2">
                        {rules.map((rule: any) => (
                          <div key={rule.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 bg-card">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{rule.template_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {rule.template_category && (
                                  <Badge className={`text-[10px] ${getCategoryBadgeClass(rule.template_category)}`}>
                                    {getCategoryLabel(rule.template_category)}
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {rule.is_required ? 'Required' : 'Optional'}
                                </span>
                              </div>
                            </div>
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Add Rule Dialog */}
            <Dialog open={addRuleOpen} onOpenChange={(open) => { setAddRuleOpen(open); }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Stage Document Rule</DialogTitle>
                  <DialogDescription>Select a pipeline stage and a document template to auto-assign.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Pipeline Stage</Label>
                    <Select value={ruleStage} onValueChange={setRuleStage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Document Template</Label>
                    <Select
                      value={ruleTemplateId ? String(ruleTemplateId) : ''}
                      onValueChange={(val) => {
                        const tpl = allTemplatesForRule.find((t) => String(t.id) === val);
                        if (tpl) {
                          setRuleTemplateId(tpl.id);
                          setRuleTemplateName(tpl.name);
                          setRuleTemplateCategory(tpl.category);
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                      <SelectContent>
                        {allTemplatesForRule.map((tpl) => (
                          <SelectItem key={tpl.id} value={String(tpl.id)}>
                            {tpl.name} ({getCategoryLabel(tpl.category)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={ruleIsRequired}
                      onCheckedChange={(v) => setRuleIsRequired(v === true)}
                      id="rule-required"
                    />
                    <Label htmlFor="rule-required" className="text-sm">Required document</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddRuleOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateRule} disabled={ruleSaving} className="gap-2">
                    {ruleSaving ? 'Creating...' : 'Add Rule'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Templates Tab Content */}
        {activeTab === 'templates' && (<>
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 bg-card" />
          </div>
          <Select value={activeCategory} onValueChange={(val) => { setActiveCategory(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[200px] h-10 bg-card">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Action Bar */}
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5"
          >
            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              {canWrite && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleBulkDuplicate} disabled={bulkOperating}>
                  {bulkOperating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  Duplicate All
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleBulkExport} disabled={bulkOperating}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              {isAdmin() && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-red-200 text-red-700 hover:bg-red-50" onClick={() => setBulkDeleteOpen(true)} disabled={bulkOperating}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete All
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs text-muted-foreground" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </motion.div>
        )}

        {/* Template Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/3 bg-muted rounded" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-2/3 bg-muted rounded" />
                </div>
                <div className="h-8 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No templates found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery || activeCategory !== 'all'
                ? 'Try adjusting your search or filter to find what you are looking for.'
                : 'Get started by creating your first document template.'}
            </p>
            {isAdmin() && !searchQuery && activeCategory === 'all' && (
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSeed} variant="outline" disabled={seeding} className="gap-2">
                  {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Seed Default Templates
                </Button>
                <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Template
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Select-all row */}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all visible templates"
              />
              <span className="text-sm text-muted-foreground">
                {allVisibleSelected ? 'Deselect all' : 'Select all'}
                {hasSelection && ` (${selectedIds.size} selected)`}
              </span>
            </div>

            <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTemplates.map((template) => {
                const isSelected = selectedIds.has(template.id);
                return (
                <motion.div key={template.id} variants={fadeInUp} whileHover={hoverLift}>
                <Card
                  className={`group relative overflow-hidden border-l-4 ${getCategoryBorderClass(template.category)} hover:shadow-md transition-all duration-200 flex flex-col ${isSelected ? 'ring-2 ring-primary/40 shadow-md' : ''}`}
                >
                  {/* Per-card checkbox */}
                  <div
                    className={`absolute top-3 right-3 z-10 transition-opacity ${hasSelection || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(template.id)}
                      aria-label={`Select ${template.name}`}
                      className="bg-card"
                    />
                  </div>

                  {/* Card Body */}
                  <div className="p-4 pb-3 flex-1 space-y-3">
                    {/* Icon + Name + Badge */}
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 p-2 rounded-lg bg-muted/80 ${getCategoryIconColor(template.category)}`}>
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-foreground line-clamp-1 pr-6">{template.name}</h3>
                        <Badge className={`mt-1 text-[10px] px-2 py-0 font-medium border ${getCategoryBadgeClass(template.category)}`}>
                          {getCategoryLabel(template.category)}
                        </Badge>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {template.description || 'No description provided.'}
                    </p>

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(template.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 px-3 text-xs gap-1.5"
                      onClick={(e) => { e.stopPropagation(); openUseTemplate(template); }}
                    >
                      <Wand2 className="h-3 w-3" />
                      Use
                    </Button>
                    <div className="flex items-center gap-0.5">
                      <button
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                        onClick={(e) => { e.stopPropagation(); openEdit(template); }}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                        onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template); }}
                      >
                        <Eye className="h-3 w-3" />
                        Preview
                      </button>
                      {canWrite && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600" title="Duplicate" aria-label="Duplicate" disabled={duplicatingId === template.id} onClick={(e) => { e.stopPropagation(); handleDuplicate(template); }}>
                          {duplicatingId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {isAdmin() && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" title="Delete" aria-label="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(template); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                </motion.div>
                );
              })}
            </StaggerGrid>
            <DataPagination page={paginationMeta.page} totalPages={paginationMeta.total_pages} total={paginationMeta.total} pageSize={paginationMeta.page_size} onPageChange={setCurrentPage} />
          </>
        )}
      </>)}
      </div>

      {/* ================================================================= */}
      {/* Preview Dialog                                                     */}
      {/* ================================================================= */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${previewTemplate ? getCategoryIconColor(previewTemplate.category) : ''}`}>
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">{previewTemplate?.name}</DialogTitle>
                {previewTemplate && (
                  <Badge className={`mt-1 text-[10px] border ${getCategoryBadgeClass(previewTemplate.category)}`}>{getCategoryLabel(previewTemplate.category)}</Badge>
                )}
              </div>
            </div>
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              {previewTemplate?.description || 'Preview the template content and variables.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {previewTemplate && previewTemplate.variables.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewTemplate.variables.map((v) => (
                    <span key={v} className="inline-flex items-center rounded-md bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Template Content</p>
              <div className="rounded-lg border border-border bg-card p-6 prose prose-sm max-w-none prose-neutral dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold">
                {previewTemplate?.content && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {previewTemplate.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
            {previewTemplate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Created {format(new Date(previewTemplate.created_at), 'MMMM d, yyyy')}
              </p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Create Dialog                                                      */}
      {/* ================================================================= */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>Add a new reusable document template to your library.</DialogDescription>
          </DialogHeader>
          {templateForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2">{saving ? 'Creating...' : 'Create Template'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Edit Dialog                                                        */}
      {/* ================================================================= */}
      <Dialog open={!!editTemplate} onOpenChange={(open) => { if (!open) { setEditTemplate(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update the template details and content.</DialogDescription>
          </DialogHeader>
          {templateForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTemplate(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving} className="gap-2">{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Use Template Dialog (two-panel)                                    */}
      {/* ================================================================= */}
      <Dialog open={!!useTemplate} onOpenChange={(open) => { if (!open) { setUseTemplate(null); setVarValues({}); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Use Template: {useTemplate?.name}
            </DialogTitle>
            <DialogDescription>Fill in the variables below to generate your document.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex gap-6 overflow-hidden min-h-0 mt-2">
            {/* Left panel -- variable inputs */}
            <div className="w-72 shrink-0 overflow-y-auto space-y-3 pr-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Variables</p>
              {useTemplate && useTemplate.variables.length > 0 ? (
                useTemplate.variables.map((v) => (
                  <div key={v} className="space-y-1">
                    <Label className="text-sm">{varLabel(v)}</Label>
                    <Input
                      placeholder={varLabel(v)}
                      value={varValues[v] || ''}
                      onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">This template has no variables.</p>
              )}
            </div>

            {/* Right panel -- live preview */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Live Preview</p>
              <div className="prose prose-sm max-w-none prose-neutral dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold">
                {useTemplate && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {renderContent(useTemplate.content, varValues)}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex-wrap gap-2">
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyRendered}>
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadRendered}>
                <Download className="h-3.5 w-3.5" />
                Download .txt
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrintRendered}>
                <Printer className="h-3.5 w-3.5" />
                Print / PDF
              </Button>
            </div>
            <Button variant="outline" onClick={() => { setUseTemplate(null); setVarValues({}); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Delete Confirmation Dialog                                         */}
      {/* ================================================================= */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="gap-2"><Trash2 className="h-4 w-4" />Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Bulk Delete Confirmation Dialog                                    */}
      {/* ================================================================= */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} template(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected template(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkOperating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkOperating}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {bulkOperating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {bulkOperating ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
