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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import {
  ClipboardCheck, Plus, Trash2, Search, Pencil, Loader2, ListChecks, X, GripVertical, CheckCircle2,
  Sparkles, LayoutTemplate, ArrowRight, Calendar, ArrowUpDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { DataPagination } from '@/components/DataPagination';
import { fadeInUp, hoverLift, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { CountingNumber } from '@/components/ui/counting-number';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistItem {
  task: string;
  done: boolean;
}

interface OnboardingTemplate {
  id: number;
  title: string;
  description: string;
  checklist: (string | ChecklistItem)[];
  created_by?: number;
  created_at: string;
}

/** Normalize a checklist item (string or {task,done} object) to a display string. */
function itemText(item: string | ChecklistItem): string {
  return typeof item === 'string' ? item : item.task;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Onboarding() {
  const { isAdmin, isHR } = useAuth();
  const { toast } = useToast();
  const canWrite = isAdmin() || isHR();

  // Data
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, page: 1, page_size: 20, total_pages: 1 });

  // Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OnboardingTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<OnboardingTemplate | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formChecklist, setFormChecklist] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

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
  // Fetch
  // -----------------------------------------------------------------------

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const search = searchDebounce.trim() || undefined;
      const data = await apiClient.getOnboardingTemplates(currentPage, 20, search);
      setTemplates(data.items);
      setPaginationMeta({ total: data.total, page: data.page, page_size: data.page_size, total_pages: data.total_pages });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to load onboarding templates.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, currentPage, searchDebounce]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormChecklist(['']);
  };

  const openEdit = (t: OnboardingTemplate) => {
    setFormTitle(t.title);
    setFormDescription(t.description || '');
    setFormChecklist(t.checklist.length > 0 ? t.checklist.map(itemText) : ['']);
    setEditTarget(t);
  };

  const addChecklistItem = () => {
    setFormChecklist((prev) => [...prev, '']);
  };

  const removeChecklistItem = (index: number) => {
    setFormChecklist((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, value: string) => {
    setFormChecklist((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  const handleCreate = async () => {
    const checklist = formChecklist.map((s) => s.trim()).filter(Boolean);
    if (!formTitle.trim() || checklist.length === 0) {
      toast({ title: 'Validation', description: 'Title and at least one checklist item are required.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await apiClient.createOnboardingTemplate({ title: formTitle.trim(), description: formDescription.trim(), checklist });
      toast({ title: 'Created', description: 'Onboarding template created successfully.' });
      setCreateOpen(false);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to create onboarding template.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Edit
  // -----------------------------------------------------------------------

  const handleEdit = async () => {
    const checklist = formChecklist.map((s) => s.trim()).filter(Boolean);
    if (!editTarget || !formTitle.trim() || checklist.length === 0) {
      toast({ title: 'Validation', description: 'Title and at least one checklist item are required.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await apiClient.updateOnboardingTemplate(editTarget.id, { title: formTitle.trim(), description: formDescription.trim(), checklist });
      toast({ title: 'Updated', description: 'Onboarding template updated successfully.' });
      setEditTarget(null);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update onboarding template.', variant: 'destructive' });
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
      await apiClient.deleteOnboardingTemplate(deleteTarget.id);
      toast({ title: 'Deleted', description: `"${deleteTarget.title}" has been removed.` });
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to delete template.', variant: 'destructive' });
    }
  };

  // -----------------------------------------------------------------------
  // Derived stats
  // -----------------------------------------------------------------------

  const totalSteps = templates.reduce((sum, t) => sum + t.checklist.length, 0);
  const avgSteps = templates.length > 0 ? Math.round(totalSteps / templates.length) : 0;

  const sortedTemplates = useMemo(() => {
    const sorted = [...templates];
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'name-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'newest':
      default:
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [templates, sortBy]);

  // -----------------------------------------------------------------------
  // Checklist form
  // -----------------------------------------------------------------------

  const checklistForm = (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <Label htmlFor="ob-title" className="text-sm font-medium">Template Name</Label>
        <Input id="ob-title" placeholder="e.g. Engineering New Hire Onboarding" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ob-desc" className="text-sm font-medium">Description</Label>
        <Textarea id="ob-desc" placeholder="Brief description of this onboarding checklist..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} className="rounded-xl resize-none" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Checklist Items</Label>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs h-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={addChecklistItem}>
            <Plus className="h-3.5 w-3.5" />
            Add Step
          </Button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {formChecklist.map((item, index) => (
            <div key={index} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                {index + 1}
              </div>
              <Input
                placeholder={`Step ${index + 1}...`}
                value={item}
                onChange={(e) => updateChecklistItem(index, e.target.value)}
                className="flex-1 rounded-xl"
              />
              {formChecklist.length > 1 && (
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground/40 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeChecklistItem(index)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70">Add the steps a new hire should complete during onboarding.</p>
      </div>
    </div>
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <ClipboardCheck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Onboarding Checklists</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Create and manage structured onboarding programs for new hires</p>
            </div>
          </div>
          {canWrite && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-200 px-5"
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          )}
        </motion.div>

        {/* KPI Stats Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            {
              label: 'Total Templates',
              value: paginationMeta.total,
              icon: LayoutTemplate,
              color: 'emerald',
              gradient: 'from-emerald-500 to-teal-500',
              bg: 'bg-emerald-50 dark:bg-emerald-950/30',
              text: 'text-emerald-700 dark:text-emerald-300',
            },
            {
              label: 'Total Steps',
              value: totalSteps,
              icon: ListChecks,
              color: 'blue',
              gradient: 'from-blue-500 to-indigo-500',
              bg: 'bg-blue-50 dark:bg-blue-950/30',
              text: 'text-blue-700 dark:text-blue-300',
            },
            {
              label: 'Avg Steps per Template',
              value: avgSteps,
              icon: Sparkles,
              color: 'violet',
              gradient: 'from-violet-500 to-purple-500',
              bg: 'bg-violet-50 dark:bg-violet-950/30',
              text: 'text-violet-700 dark:text-violet-300',
            },
          ].map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp}>
              <Card className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                      <p className="text-3xl font-bold tracking-tight text-foreground">
                        <CountingNumber value={stat.value} />
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.text}`} />
                    </div>
                  </div>
                  <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${stat.gradient} opacity-60`} />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Search & Sort Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search onboarding templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl border-muted-foreground/15 bg-background shadow-sm focus:shadow-md transition-shadow"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[170px] h-9 text-xs rounded-xl">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Template Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="rounded-xl animate-pulse overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-muted" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-3/4 bg-muted rounded-lg" />
                      <div className="h-3 w-1/2 bg-muted rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-3 w-full bg-muted rounded-lg" />
                    <div className="h-3 w-5/6 bg-muted rounded-lg" />
                    <div className="h-3 w-2/3 bg-muted rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 mb-5">
              <ClipboardCheck className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1.5">No onboarding templates yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              {searchQuery
                ? 'Try adjusting your search to find what you are looking for.'
                : 'Create your first onboarding checklist template to streamline new hire setup.'}
            </p>
            {canWrite && !searchQuery && (
              <Button
                onClick={() => setCreateOpen(true)}
                variant="outline"
                className="gap-2 mt-5 rounded-xl border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            )}
          </motion.div>
        ) : (
          <>
            <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTemplates.map((t) => {
                const progressPercent = Math.min(100, (t.checklist.length / 10) * 100);
                return (
                  <motion.div key={t.id} variants={fadeInUp} whileHover={hoverLift}>
                    <Card className="group rounded-xl border border-border/50 hover:border-emerald-200 dark:hover:border-emerald-800/60 hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden">
                      {/* Card top accent bar */}
                      <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="p-5 flex flex-col flex-1">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors">
                            <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                              {t.title}
                            </h3>
                            {t.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{t.description}</p>
                            )}
                          </div>
                          <Badge className="shrink-0 text-[10px] px-2 py-0.5 gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium">
                            {t.checklist.length} steps
                          </Badge>
                        </div>

                        {/* Progress indicator */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Complexity</span>
                            <span className="text-[10px] text-muted-foreground">{t.checklist.length} / 10</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercent}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                            />
                          </div>
                        </div>

                        {/* Checklist preview */}
                        <div className="space-y-2 flex-1">
                          {t.checklist.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-xs">
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mt-0.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              </div>
                              <span className="text-muted-foreground line-clamp-1 pt-0.5">{itemText(item)}</span>
                            </div>
                          ))}
                          {t.checklist.length > 3 && (
                            <button
                              onClick={() => setPreviewTarget(t)}
                              className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium pl-7 transition-colors"
                            >
                              +{t.checklist.length - 3} more steps
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(t.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Preview"
                              onClick={() => setPreviewTarget(t)}
                            >
                              <ListChecks className="h-4 w-4" />
                            </Button>
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Edit"
                                onClick={() => openEdit(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {(isAdmin()) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Delete"
                                onClick={() => setDeleteTarget(t)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewTarget} onOpenChange={() => setPreviewTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col sm:rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg">{previewTarget?.title}</DialogTitle>
                {previewTarget?.description && (
                  <DialogDescription className="mt-0.5">{previewTarget.description}</DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Progress summary */}
          {previewTarget && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50">
              <ListChecks className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{previewTarget.checklist.length}</span> steps to complete
              </span>
            </div>
          )}

          <StaggerGrid className="flex-1 overflow-y-auto mt-2 space-y-2">
            {previewTarget?.checklist.map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-sm">
                  {idx + 1}
                </div>
                <span className="text-sm text-foreground pt-1 leading-relaxed">{itemText(item)}</span>
              </motion.div>
            ))}
          </StaggerGrid>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPreviewTarget(null)} className="rounded-xl">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle>New Onboarding Template</DialogTitle>
                <DialogDescription>Create a reusable onboarding checklist for new hires.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {checklistForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                <Pencil className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle>Edit Onboarding Template</DialogTitle>
                <DialogDescription>Update the onboarding checklist.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {checklistForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTarget(null); resetForm(); }} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleEdit}
              disabled={saving}
              className="gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm sm:rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/30">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <DialogTitle>Delete Template</DialogTitle>
                <DialogDescription>Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="gap-2 rounded-xl"><Trash2 className="h-4 w-4" />Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
