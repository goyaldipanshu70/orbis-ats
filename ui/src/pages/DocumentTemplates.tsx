import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
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
// Design system -- dark glass tokens
// ---------------------------------------------------------------------------

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };
const dialogBg: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' };

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
  offer_letter: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  nda: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  employment_contract: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  policy: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  onboarding: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  termination: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  performance_review: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  other: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const CATEGORY_BORDER_COLORS: Record<TemplateCategory, string> = {
  offer_letter: 'border-l-emerald-500',
  nda: 'border-l-amber-500',
  employment_contract: 'border-l-blue-500',
  policy: 'border-l-blue-500',
  onboarding: 'border-l-teal-500',
  termination: 'border-l-rose-500',
  performance_review: 'border-l-cyan-500',
  other: 'border-l-slate-400',
};

const CATEGORY_ICON_COLORS: Record<TemplateCategory, string> = {
  offer_letter: 'text-emerald-400',
  nda: 'text-amber-400',
  employment_contract: 'text-blue-400',
  policy: 'text-blue-400',
  onboarding: 'text-teal-400',
  termination: 'text-rose-400',
  performance_review: 'text-cyan-400',
  other: 'text-slate-400',
};

const CATEGORY_PILL_ACTIVE: Record<TemplateCategory, string> = {
  offer_letter: 'bg-emerald-600 text-white',
  nda: 'bg-amber-600 text-white',
  employment_contract: 'bg-blue-600 text-white',
  policy: 'bg-blue-600 text-white',
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
        <label htmlFor="tpl-name" className="text-sm font-medium text-slate-300">Template Name</label>
        <input
          id="tpl-name"
          placeholder="e.g. Standard Offer Letter"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
          style={glassInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Category</label>
        <Select value={formCategory} onValueChange={setFormCategory}>
          <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent className="rounded-xl border-0" style={selectDrop}>
            {CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat} className="text-slate-200 focus:bg-white/10 focus:text-white">{getCategoryLabel(cat)}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="tpl-desc" className="text-sm font-medium text-slate-300">Description</label>
        <textarea
          id="tpl-desc"
          placeholder="Brief description of this template..."
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-y placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
          style={glassInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="tpl-content" className="text-sm font-medium text-slate-300">Content</label>
        <textarea
          id="tpl-content"
          placeholder={'Write the template body here. Use {{variable_name}} for placeholders...'}
          value={formContent}
          onChange={(e) => setFormContent(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none resize-y placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
          style={glassInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
        />
        <p className="text-xs text-slate-500">Supports markdown formatting (bold, headings, lists).</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="tpl-vars" className="text-sm font-medium text-slate-300">Variables</label>
        <input
          id="tpl-vars"
          placeholder="employee_name, start_date, salary"
          value={formVariables}
          onChange={(e) => setFormVariables(e.target.value)}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
          style={glassInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
        />
        <p className="text-xs text-slate-500">Comma-separated list of placeholder variable names used in the template.</p>
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
            <h1 className="text-2xl font-bold tracking-tight text-white">Templates</h1>
            <p className="text-sm text-slate-400 mt-1">Manage reusable document templates for your hiring workflow.</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'templates' && isAdmin() && templates.length === 0 && !loading && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white disabled:opacity-50"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Seed Defaults
              </button>
            )}
            {activeTab === 'templates' && canWrite && (
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            )}
            {activeTab === 'stage-rules' && canWrite && (
              <button
                onClick={() => setAddRuleOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                <Plus className="h-4 w-4" />
                Add Rule
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'templates' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('stage-rules')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'stage-rules' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Settings2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Stage Rules
          </button>
        </div>

        {/* Stage Rules Tab */}
        {activeTab === 'stage-rules' && (
          <div className="space-y-6">
            <p className="text-sm text-slate-400">
              Configure which document templates are auto-assigned when a candidate moves to a pipeline stage.
            </p>
            {rulesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : stageRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full mb-4" style={{ background: 'var(--orbis-input)' }}>
                  <Link2 className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">No stage rules configured</h3>
                <p className="text-sm text-slate-400 max-w-sm">
                  Add rules to automatically assign document templates when candidates enter specific pipeline stages.
                </p>
                {canWrite && (
                  <button
                    onClick={() => setAddRuleOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white mt-4"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    <Plus className="h-4 w-4" />
                    Add First Rule
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {PIPELINE_STAGES.map((stage) => {
                  const rules = stageRulesByStage[stage] || [];
                  if (rules.length === 0) return null;
                  return (
                    <div key={stage} className="rounded-xl overflow-hidden" style={glassCard}>
                      <div className="px-4 py-3" style={{ background: 'var(--orbis-card)', borderBottom: '1px solid var(--orbis-border)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                            <span className="text-sm font-semibold capitalize text-white">{stage}</span>
                          </div>
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10">
                            {rules.length} template{rules.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {rules.map((rule: any) => (
                          <div key={rule.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }}>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{rule.template_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {rule.template_category && (
                                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border ${getCategoryBadgeClass(rule.template_category)}`}>
                                    {getCategoryLabel(rule.template_category)}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  {rule.is_required ? 'Required' : 'Optional'}
                                </span>
                              </div>
                            </div>
                            {canWrite && (
                              <button
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 transition-colors shrink-0"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Rule Dialog */}
            <Dialog open={addRuleOpen} onOpenChange={(open) => { setAddRuleOpen(open); }}>
              <DialogContent className="border-0 rounded-2xl max-w-md" style={dialogBg}>
                <DialogHeader>
                  <DialogTitle className="text-lg text-white">Add Stage Document Rule</DialogTitle>
                  <DialogDescription className="text-slate-400">Select a pipeline stage and a document template to auto-assign.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Pipeline Stage</label>
                    <Select value={ruleStage} onValueChange={setRuleStage}>
                      <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-0" style={selectDrop}>
                        {PIPELINE_STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize text-slate-200 focus:bg-white/10 focus:text-white">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Document Template</label>
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
                      <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Select template..." /></SelectTrigger>
                      <SelectContent className="rounded-xl border-0" style={selectDrop}>
                        {allTemplatesForRule.map((tpl) => (
                          <SelectItem key={tpl.id} value={String(tpl.id)} className="text-slate-200 focus:bg-white/10 focus:text-white">
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
                    <label htmlFor="rule-required" className="text-sm text-slate-300">Required document</label>
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <button
                    onClick={() => setAddRuleOpen(false)}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateRule}
                    disabled={ruleSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                  >
                    {ruleSaving ? 'Creating...' : 'Add Rule'}
                  </button>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
              style={glassInput}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
            />
          </div>
          <Select value={activeCategory} onValueChange={(val) => { setActiveCategory(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[200px] h-10 rounded-xl text-white border-0" style={glassInput}>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="all" className="text-slate-200 focus:bg-white/10 focus:text-white">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-slate-200 focus:bg-white/10 focus:text-white">{getCategoryLabel(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[170px] h-9 text-xs gap-1.5 rounded-xl text-white border-0" style={glassInput}>
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="name-asc" className="text-slate-200 focus:bg-white/10 focus:text-white">Name A-Z</SelectItem>
              <SelectItem value="name-desc" className="text-slate-200 focus:bg-white/10 focus:text-white">Name Z-A</SelectItem>
              <SelectItem value="category" className="text-slate-200 focus:bg-white/10 focus:text-white">Category</SelectItem>
              <SelectItem value="newest" className="text-slate-200 focus:bg-white/10 focus:text-white">Newest</SelectItem>
              <SelectItem value="oldest" className="text-slate-200 focus:bg-white/10 focus:text-white">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Action Bar */}
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5"
            style={{ background: 'rgba(27,142,229,0.08)', border: '1px solid rgba(27,142,229,0.2)' }}
          >
            <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-sm font-medium text-white">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              {canWrite && (
                <button
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  onClick={handleBulkDuplicate}
                  disabled={bulkOperating}
                >
                  {bulkOperating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  Duplicate All
                </button>
              )}
              <button
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                onClick={handleBulkExport}
                disabled={bulkOperating}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              {isAdmin() && (
                <button
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={bulkOperating}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete All
                </button>
              )}
              <button
                className="inline-flex items-center gap-1.5 h-8 px-2 text-xs text-slate-500 hover:text-white transition-colors"
                onClick={clearSelection}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </motion.div>
        )}

        {/* Template Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-xl p-5 space-y-3" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-3/4 rounded" style={{ background: 'var(--orbis-border)' }} />
                    <div className="h-3 w-1/3 rounded" style={{ background: 'var(--orbis-border)' }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-full rounded" style={{ background: 'var(--orbis-border)' }} />
                  <div className="h-3 w-2/3 rounded" style={{ background: 'var(--orbis-border)' }} />
                </div>
                <div className="h-8 w-full rounded" style={{ background: 'var(--orbis-border)' }} />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full mb-4" style={{ background: 'var(--orbis-input)' }}>
              <FileText className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No templates found</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              {searchQuery || activeCategory !== 'all'
                ? 'Try adjusting your search or filter to find what you are looking for.'
                : 'Get started by creating your first document template.'}
            </p>
            {isAdmin() && !searchQuery && activeCategory === 'all' && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white disabled:opacity-50"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                >
                  {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Seed Default Templates
                </button>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                >
                  <Plus className="h-4 w-4" />
                  Create Template
                </button>
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
              <span className="text-sm text-slate-400">
                {allVisibleSelected ? 'Deselect all' : 'Select all'}
                {hasSelection && ` (${selectedIds.size} selected)`}
              </span>
            </div>

            <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTemplates.map((template) => {
                const isSelected = selectedIds.has(template.id);
                return (
                <motion.div key={template.id} variants={fadeInUp} whileHover={hoverLift}>
                <div
                  className={`group relative overflow-hidden rounded-xl border-l-4 ${getCategoryBorderClass(template.category)} transition-all duration-200 flex flex-col ${isSelected ? 'ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10' : ''}`}
                  style={glassCard}
                >
                  {/* Per-card checkbox */}
                  <div
                    className={`absolute top-3 right-3 z-10 transition-opacity ${hasSelection || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(template.id)}
                      aria-label={`Select ${template.name}`}
                    />
                  </div>

                  {/* Card Body */}
                  <div className="p-4 pb-3 flex-1 space-y-3">
                    {/* Icon + Name + Badge */}
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 p-2 rounded-lg ${getCategoryIconColor(template.category)}`} style={{ background: 'var(--orbis-input)' }}>
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-white line-clamp-1 pr-6">{template.name}</h3>
                        <span className={`inline-flex items-center mt-1 rounded-md px-2 py-0 text-[10px] font-medium border ${getCategoryBadgeClass(template.category)}`}>
                          {getCategoryLabel(template.category)}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                      {template.description || 'No description provided.'}
                    </p>

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(template.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
                    <button
                      className="inline-flex items-center h-7 px-3 text-xs gap-1.5 rounded-lg font-medium text-white transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                      onClick={(e) => { e.stopPropagation(); openUseTemplate(template); }}
                    >
                      <Wand2 className="h-3 w-3" />
                      Use
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                        onClick={(e) => { e.stopPropagation(); openEdit(template); }}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                        onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template); }}
                      >
                        <Eye className="h-3 w-3" />
                        Preview
                      </button>
                      {canWrite && (
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-50"
                          title="Duplicate"
                          aria-label="Duplicate"
                          disabled={duplicatingId === template.id}
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(template); }}
                        >
                          {duplicatingId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {isAdmin() && (
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete"
                          aria-label="Delete"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(template); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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
        <DialogContent className="border-0 rounded-2xl max-w-2xl max-h-[85vh] flex flex-col" style={dialogBg}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${previewTemplate ? getCategoryIconColor(previewTemplate.category) : ''}`} style={{ background: 'var(--orbis-input)' }}>
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg text-white">{previewTemplate?.name}</DialogTitle>
                {previewTemplate && (
                  <span className={`inline-flex items-center mt-1 rounded-md px-2 py-0.5 text-[10px] font-medium border ${getCategoryBadgeClass(previewTemplate.category)}`}>
                    {getCategoryLabel(previewTemplate.category)}
                  </span>
                )}
              </div>
            </div>
            <DialogDescription className="text-sm text-slate-400 mt-2">
              {previewTemplate?.description || 'Preview the template content and variables.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {previewTemplate && previewTemplate.variables.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewTemplate.variables.map((v) => (
                    <span key={v} className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium text-blue-400" style={{ background: 'rgba(27,142,229,0.1)', border: '1px solid rgba(27,142,229,0.2)' }}>{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Template Content</p>
              <div className="rounded-xl p-6 prose prose-sm max-w-none prose-invert prose-p:leading-relaxed prose-headings:font-semibold" style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }}>
                {previewTemplate?.content && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {previewTemplate.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
            {previewTemplate && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Created {format(new Date(previewTemplate.created_at), 'MMMM d, yyyy')}
              </p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <button
              onClick={() => setPreviewTemplate(null)}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Create Dialog                                                      */}
      {/* ================================================================= */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="border-0 rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" style={dialogBg}>
          <DialogHeader>
            <DialogTitle className="text-lg text-white">Create Template</DialogTitle>
            <DialogDescription className="text-slate-400">Add a new reusable document template to your library.</DialogDescription>
          </DialogHeader>
          {templateForm}
          <DialogFooter className="pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : 'Create Template'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Edit Dialog                                                        */}
      {/* ================================================================= */}
      <Dialog open={!!editTemplate} onOpenChange={(open) => { if (!open) { setEditTemplate(null); resetForm(); } }}>
        <DialogContent className="border-0 rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" style={dialogBg}>
          <DialogHeader>
            <DialogTitle className="text-lg text-white">Edit Template</DialogTitle>
            <DialogDescription className="text-slate-400">Update the template details and content.</DialogDescription>
          </DialogHeader>
          {templateForm}
          <DialogFooter className="pt-2">
            <button
              onClick={() => { setEditTemplate(null); resetForm(); }}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Use Template Dialog (two-panel)                                    */}
      {/* ================================================================= */}
      <Dialog open={!!useTemplate} onOpenChange={(open) => { if (!open) { setUseTemplate(null); setVarValues({}); } }}>
        <DialogContent className="border-0 rounded-2xl max-w-5xl max-h-[90vh] flex flex-col" style={dialogBg}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Wand2 className="h-5 w-5 text-blue-400" />
              Use Template: {useTemplate?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">Fill in the variables below to generate your document.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex gap-6 overflow-hidden min-h-0 mt-2">
            {/* Left panel -- variable inputs */}
            <div className="w-72 shrink-0 overflow-y-auto space-y-3 pr-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Variables</p>
              {useTemplate && useTemplate.variables.length > 0 ? (
                useTemplate.variables.map((v) => (
                  <div key={v} className="space-y-1">
                    <label className="text-sm text-slate-300">{varLabel(v)}</label>
                    <input
                      placeholder={varLabel(v)}
                      value={varValues[v] || ''}
                      onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                      className="w-full h-9 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                      style={glassInput}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">This template has no variables.</p>
              )}
            </div>

            {/* Right panel -- live preview */}
            <div className="flex-1 overflow-y-auto rounded-xl p-6" style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Live Preview</p>
              <div className="prose prose-sm max-w-none prose-invert prose-p:leading-relaxed prose-headings:font-semibold">
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
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                onClick={handleCopyRendered}
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                onClick={handleDownloadRendered}
              >
                <Download className="h-3.5 w-3.5" />
                Download .txt
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download PDF
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                onClick={handlePrintRendered}
              >
                <Printer className="h-3.5 w-3.5" />
                Print / PDF
              </button>
            </div>
            <button
              onClick={() => { setUseTemplate(null); setVarValues({}); }}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Delete Confirmation Dialog                                         */}
      {/* ================================================================= */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="border-0 rounded-2xl max-w-sm" style={dialogBg}>
          <DialogHeader>
            <DialogTitle className="text-white">Delete Template</DialogTitle>
            <DialogDescription className="text-slate-400">Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all"
            >
              <Trash2 className="h-4 w-4" />Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Bulk Delete Confirmation Dialog                                    */}
      {/* ================================================================= */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="border-0 rounded-2xl" style={dialogBg}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {selectedIds.size} template(s)?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete {selectedIds.size} selected template(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={bulkOperating}
              className="rounded-xl text-sm font-medium text-slate-300 hover:text-white border-0"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkOperating}
              className="bg-red-600 hover:bg-red-700 text-white gap-2 rounded-xl"
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
