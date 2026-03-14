import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
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
// Glass Design System
// ---------------------------------------------------------------------------

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
const gradientBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
  boxShadow: '0 8px 24px rgba(27,142,229,0.2)',
};
const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};
const sItemCls = 'text-slate-200 focus:bg-white/10 focus:text-white';

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
  // Checklist form (used in Create & Edit dialogs)
  // -----------------------------------------------------------------------

  const checklistForm = (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <label htmlFor="ob-title" className="text-sm font-medium text-slate-300">Template Name</label>
        <input
          id="ob-title"
          placeholder="e.g. Engineering New Hire Onboarding"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 transition-all"
          style={glassInput}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="ob-desc" className="text-sm font-medium text-slate-300">Description</label>
        <textarea
          id="ob-desc"
          placeholder="Brief description of this onboarding checklist..."
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={2}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none placeholder:text-slate-500 transition-all"
          style={glassInput}
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">Checklist Items</label>
          <button
            type="button"
            onClick={addChecklistItem}
            className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors"
            style={{ background: 'rgba(16,185,129,0.1)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Step
          </button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {formChecklist.map((item, index) => (
            <div key={index} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-slate-400 transition-colors" />
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-emerald-300"
                style={{ background: 'rgba(16,185,129,0.15)' }}
              >
                {index + 1}
              </div>
              <input
                placeholder={`Step ${index + 1}...`}
                value={item}
                onChange={(e) => updateChecklistItem(index, e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="flex-1 h-9 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
              />
              {formChecklist.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeChecklistItem(index)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">Add the steps a new hire should complete during onboarding.</p>
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
              <h1 className="text-2xl font-bold tracking-tight text-white">Onboarding Checklists</h1>
              <p className="text-sm text-slate-400 mt-0.5">Create and manage structured onboarding programs for new hires</p>
            </div>
          </div>
          {canWrite && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl text-white shadow-md hover:shadow-lg transition-all duration-200 px-5 h-10 text-sm font-medium hover:brightness-110"
              style={gradientBtn}
            >
              <Plus className="h-4 w-4" />
              New Template
            </button>
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
              gradient: 'from-emerald-500 to-teal-500',
              iconColor: 'text-emerald-400',
              iconBg: 'rgba(16,185,129,0.12)',
            },
            {
              label: 'Total Steps',
              value: totalSteps,
              icon: ListChecks,
              gradient: 'from-blue-500 to-blue-500',
              iconColor: 'text-blue-400',
              iconBg: 'rgba(59,130,246,0.12)',
            },
            {
              label: 'Avg Steps per Template',
              value: avgSteps,
              icon: Sparkles,
              gradient: 'from-blue-500 to-blue-500',
              iconColor: 'text-blue-400',
              iconBg: 'rgba(27,142,229,0.12)',
            },
          ].map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp}>
              <div className="rounded-xl overflow-hidden" style={glassCard}>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-3xl font-bold tracking-tight text-white">
                        <CountingNumber value={stat.value} />
                      </p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: stat.iconBg }}>
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                  </div>
                  <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${stat.gradient} opacity-60`} />
                </div>
              </div>
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              placeholder="Search onboarding templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="w-full h-10 pl-10 pr-3 rounded-xl text-sm outline-none placeholder:text-slate-500 transition-all"
              style={glassInput}
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[170px] h-9 text-xs text-white border-0 rounded-xl" style={glassInput}>
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem className={sItemCls} value="name-asc">Name A-Z</SelectItem>
              <SelectItem className={sItemCls} value="name-desc">Name Z-A</SelectItem>
              <SelectItem className={sItemCls} value="newest">Newest</SelectItem>
              <SelectItem className={sItemCls} value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Template Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl animate-pulse overflow-hidden" style={glassCard}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl" style={{ background: 'var(--orbis-border)' }} />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-3/4 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                      <div className="h-3 w-1/2 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-3 w-full rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                    <div className="h-3 w-5/6 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                    <div className="h-3 w-2/3 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-5 rounded-2xl mb-5" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <ClipboardCheck className="h-10 w-10 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1.5">No onboarding templates yet</h3>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              {searchQuery
                ? 'Try adjusting your search to find what you are looking for.'
                : 'Create your first onboarding checklist template to streamline new hire setup.'}
            </p>
            {canWrite && !searchQuery && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 mt-5 rounded-xl text-emerald-400 hover:text-emerald-300 px-4 h-10 text-sm font-medium transition-colors"
                style={{ background: 'var(--orbis-card)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            )}
          </motion.div>
        ) : (
          <>
            <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTemplates.map((t) => {
                const progressPercent = Math.min(100, (t.checklist.length / 10) * 100);
                return (
                  <motion.div key={t.id} variants={fadeInUp} whileHover={hoverLift}>
                    <div
                      className="group rounded-xl flex flex-col overflow-hidden hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
                      style={{ ...glassCard, borderColor: 'var(--orbis-hover)' }}
                    >
                      {/* Card top accent bar */}
                      <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="p-5 flex flex-col flex-1">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className="p-2.5 rounded-xl shrink-0 group-hover:brightness-125 transition-all"
                            style={{ background: 'rgba(16,185,129,0.1)' }}
                          >
                            <ClipboardCheck className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                              {t.title}
                            </h3>
                            {t.description && (
                              <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{t.description}</p>
                            )}
                          </div>
                          <span
                            className="shrink-0 text-[10px] px-2 py-0.5 rounded-lg text-emerald-300 font-medium inline-flex items-center gap-1"
                            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
                          >
                            {t.checklist.length} steps
                          </span>
                        </div>

                        {/* Progress indicator */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-wider font-medium text-slate-500">Complexity</span>
                            <span className="text-[10px] text-slate-500">{t.checklist.length} / 10</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
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
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5"
                                style={{ background: 'rgba(16,185,129,0.12)' }}
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              </div>
                              <span className="text-slate-400 line-clamp-1 pt-0.5">{itemText(item)}</span>
                            </div>
                          ))}
                          {t.checklist.length > 3 && (
                            <button
                              onClick={() => setPreviewTarget(t)}
                              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium pl-7 transition-colors"
                            >
                              +{t.checklist.length - 3} more steps
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 mt-4" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(t.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-400 transition-colors"
                              style={{ background: 'transparent' }}
                              title="Preview"
                              onClick={() => setPreviewTarget(t)}
                            >
                              <ListChecks className="h-4 w-4" />
                            </button>
                            {canWrite && (
                              <button
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 transition-colors"
                                style={{ background: 'transparent' }}
                                title="Edit"
                                onClick={() => openEdit(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {(isAdmin()) && (
                              <button
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                                style={{ background: 'transparent' }}
                                title="Delete"
                                onClick={() => setDeleteTarget(t)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
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
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewTarget} onOpenChange={() => setPreviewTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col sm:rounded-2xl border-0" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <ClipboardCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg text-white">{previewTarget?.title}</DialogTitle>
                {previewTarget?.description && (
                  <DialogDescription className="mt-0.5 text-slate-400">{previewTarget.description}</DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Progress summary */}
          {previewTarget && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--orbis-grid)' }}>
              <ListChecks className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-slate-400">
                <span className="font-semibold text-white">{previewTarget.checklist.length}</span> steps to complete
              </span>
            </div>
          )}

          <StaggerGrid className="flex-1 overflow-y-auto mt-2 space-y-2">
            {previewTarget?.checklist.map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="flex items-start gap-3 p-3 rounded-xl transition-colors group"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--orbis-grid)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-sm">
                  {idx + 1}
                </div>
                <span className="text-sm text-slate-300 pt-1 leading-relaxed">{itemText(item)}</span>
              </motion.div>
            ))}
          </StaggerGrid>
          <DialogFooter className="mt-4">
            <button
              onClick={() => setPreviewTarget(null)}
              className="h-9 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={glassInput}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-2xl border-0" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <Plus className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-white">New Onboarding Template</DialogTitle>
                <DialogDescription className="text-slate-400">Create a reusable onboarding checklist for new hires.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {checklistForm}
          <DialogFooter>
            <button
              onClick={() => setCreateOpen(false)}
              className="h-9 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={glassInput}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-medium text-white hover:brightness-110 transition-all disabled:opacity-50"
              style={gradientBtn}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : 'Create Template'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-2xl border-0" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <Pencil className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-white">Edit Onboarding Template</DialogTitle>
                <DialogDescription className="text-slate-400">Update the onboarding checklist.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {checklistForm}
          <DialogFooter>
            <button
              onClick={() => { setEditTarget(null); resetForm(); }}
              className="h-9 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={glassInput}
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={saving}
              className="flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-medium text-white hover:brightness-110 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 8px 24px rgba(245,158,11,0.2)' }}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm sm:rounded-2xl border-0" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <DialogTitle className="text-white">Delete Template</DialogTitle>
                <DialogDescription className="text-slate-400">Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              className="h-9 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={glassInput}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-medium text-white hover:brightness-110 transition-all"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 8px 24px rgba(239,68,68,0.2)' }}
            >
              <Trash2 className="h-4 w-4" />Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
