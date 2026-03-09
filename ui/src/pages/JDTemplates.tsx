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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import {
  FileText, Plus, Trash2, Pencil, Search, Loader2, Briefcase, Clock, Tag, Copy,
  LayoutTemplate, TrendingUp, Layers, Sparkles, Upload, CheckCircle, X, FileUp,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useClientPagination } from '@/hooks/useClientPagination';
import { DataPagination } from '@/components/DataPagination';
import { ArrowUpDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JDTemplate {
  id: number;
  name: string;
  category: string;
  description: string;
  jd_content: any;
  skills: string[];
  experience_range: string;
  salary_range: { min?: number; max?: number; currency?: string } | null;
  benefits: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface TemplateFormState {
  name: string;
  category: string;
  description: string;
  jd_content: string;
  skills: string;
  experience_range: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  benefits: string;
}

const EMPTY_FORM: TemplateFormState = {
  name: '',
  category: '',
  description: '',
  jd_content: '',
  skills: '',
  experience_range: '',
  salary_min: '',
  salary_max: '',
  salary_currency: 'USD',
  benefits: '',
};

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, { badge: string; border: string; icon: string }> = {
  Engineering: {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
    border: 'border-l-indigo-500',
    icon: 'text-indigo-500',
  },
  Sales: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
    border: 'border-l-amber-500',
    icon: 'text-amber-500',
  },
  Marketing: {
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
    border: 'border-l-orange-500',
    icon: 'text-orange-500',
  },
  Finance: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    border: 'border-l-emerald-500',
    icon: 'text-emerald-500',
  },
  HR: {
    badge: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700',
    border: 'border-l-pink-500',
    icon: 'text-pink-500',
  },
  Design: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700',
    border: 'border-l-rose-500',
    icon: 'text-rose-500',
  },
  Product: {
    badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
    border: 'border-l-violet-500',
    icon: 'text-violet-500',
  },
  IT: {
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700',
    border: 'border-l-cyan-500',
    icon: 'text-cyan-500',
  },
};

const DEFAULT_CATEGORY_STYLE = {
  badge: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  border: 'border-l-slate-400',
  icon: 'text-slate-400',
};

function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? DEFAULT_CATEGORY_STYLE;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function templateToForm(t: JDTemplate): TemplateFormState {
  return {
    name: t.name,
    category: t.category ?? '',
    description: t.description ?? '',
    jd_content: typeof t.jd_content === 'string' ? t.jd_content : JSON.stringify(t.jd_content ?? '', null, 2),
    skills: (t.skills ?? []).join(', '),
    experience_range: t.experience_range ?? '',
    salary_min: t.salary_range?.min?.toString() ?? '',
    salary_max: t.salary_range?.max?.toString() ?? '',
    salary_currency: t.salary_range?.currency ?? 'USD',
    benefits: (t.benefits ?? []).join(', '),
  };
}

function formToPayload(f: TemplateFormState) {
  const skills = f.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const benefits = f.benefits
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let jd_content: any = f.jd_content;
  try {
    jd_content = JSON.parse(f.jd_content);
  } catch {
    // keep as string
  }

  const salary_range =
    f.salary_min || f.salary_max
      ? {
          min: f.salary_min ? Number(f.salary_min) : undefined,
          max: f.salary_max ? Number(f.salary_max) : undefined,
          currency: f.salary_currency || 'USD',
        }
      : null;

  return {
    name: f.name,
    category: f.category || null,
    description: f.description,
    jd_content,
    skills,
    experience_range: f.experience_range || null,
    salary_range,
    benefits,
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JDTemplates() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Data
  const [templates, setTemplates] = useState<JDTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JDTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<JDTemplate | null>(null);

  // AI parsing
  const [aiParseOpen, setAiParseOpen] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiDragOver, setAiDragOver] = useState(false);

  // ----------------------------------------------------------
  // Fetch
  // ----------------------------------------------------------

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const cat = selectedCategory !== 'all' ? selectedCategory : undefined;
      const data = await apiClient.getJDTemplates(cat);
      setTemplates(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load JD templates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, toast]);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await apiClient.getJDTemplateCategories();
      setCategories(cats);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ----------------------------------------------------------
  // Filtered list
  // ----------------------------------------------------------

  const filtered = useMemo(() => {
    let list = search
      ? templates.filter(
          (t) =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            (t.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (t.skills ?? []).some((s) => s.toLowerCase().includes(search.toLowerCase())),
        )
      : templates;

    const sorted = [...list];
    switch (sortBy) {
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return sorted;
  }, [templates, search, sortBy]);

  const pagination = useClientPagination(filtered, { pageSize: 10 });

  // ----------------------------------------------------------
  // Stats
  // ----------------------------------------------------------

  const totalTemplates = templates.length;
  const totalUsage = templates.reduce((sum, t) => sum + (t.usage_count ?? 0), 0);
  const uniqueCategories = new Set(templates.map((t) => t.category).filter(Boolean)).size;

  // ----------------------------------------------------------
  // CRUD handlers
  // ----------------------------------------------------------

  function openCreate() {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(t: JDTemplate) {
    setEditingTemplate(t);
    setForm(templateToForm(t));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Validation', description: 'Template name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editingTemplate) {
        await apiClient.updateJDTemplate(editingTemplate.id, payload);
        toast({ title: 'Updated', description: 'Template updated successfully' });
      } else {
        await apiClient.createJDTemplate(payload);
        toast({ title: 'Created', description: 'Template created successfully' });
      }
      setDialogOpen(false);
      fetchTemplates();
    } catch {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteJDTemplate(deleteTarget.id);
      toast({ title: 'Deleted', description: 'Template deleted' });
      setDeleteTarget(null);
      fetchTemplates();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' });
    }
  }

  async function handleUse(t: JDTemplate) {
    try {
      await apiClient.useJDTemplate(t.id);
      toast({ title: 'Template Applied', description: `"${t.name}" data copied for new job creation` });
      fetchTemplates(); // refresh usage count
    } catch {
      toast({ title: 'Error', description: 'Failed to use template', variant: 'destructive' });
    }
  }

  // ----------------------------------------------------------
  // AI Parse handler
  // ----------------------------------------------------------

  function handleAiFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setAiDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && /\.(pdf|docx?|txt)$/i.test(file.name)) {
      setAiFile(file);
    }
  }

  async function handleAiParse() {
    if (!aiFile) return;
    setAiParsing(true);
    try {
      const result = await apiClient.extractJD(aiFile);
      const rubric = result.extracted_rubric || {};
      const allSkills = [
        ...(rubric.core_skills || []),
        ...(rubric.preferred_skills || []),
      ];
      const jdExtra: Record<string, any> = {};
      if (rubric.soft_skills?.length) jdExtra.soft_skills = rubric.soft_skills;
      if (rubric.certifications?.length) jdExtra.certifications = rubric.certifications;
      if (rubric.role_keywords?.length) jdExtra.role_keywords = rubric.role_keywords;
      if (rubric.educational_requirements?.length) jdExtra.educational_requirements = rubric.educational_requirements;

      const parsed: TemplateFormState = {
        name: result.job_title || aiFile.name.replace(/\.[^.]+$/, ''),
        category: (result as any).role_category || '',
        description: result.summary || '',
        jd_content: Object.keys(jdExtra).length > 0 ? JSON.stringify(jdExtra, null, 2) : '',
        skills: allSkills.join(', '),
        experience_range: (rubric.experience_requirements || []).join(', '),
        salary_min: '',
        salary_max: '',
        salary_currency: 'USD',
        benefits: '',
      };

      setAiParseOpen(false);
      setAiFile(null);
      setEditingTemplate(null);
      setForm(parsed);
      setDialogOpen(true);
      toast({ title: 'AI Parsed', description: `Extracted fields from "${aiFile.name}"` });
    } catch {
      toast({ title: 'Parse Failed', description: 'Could not extract JD from the uploaded file', variant: 'destructive' });
    } finally {
      setAiParsing(false);
    }
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Page Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">JD Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Reusable job description templates for faster job creation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAiParseOpen(true)} className="gap-2 shadow-sm">
              <Sparkles className="h-4 w-4" />
              AI Parse
            </Button>
            <Button onClick={openCreate} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>
        </motion.div>

        {/* ── KPI Stats Strip ──────────────────────────────────── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { label: 'Total Templates', value: totalTemplates, icon: LayoutTemplate, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' },
            { label: 'Total Usage', value: totalUsage, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
            { label: 'Categories', value: uniqueCategories, icon: Layers, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/40' },
          ].map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp}>
              <Card className="rounded-xl border border-border/60 shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`flex-shrink-0 h-11 w-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Filters Bar ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-lg bg-background border-border/60"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px] h-10 rounded-lg border-border/60">
              <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] h-10 rounded-lg border-border/60">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* ── Template Grid ────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="p-4 rounded-2xl bg-muted/60 mb-4">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No templates found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create your first JD template to streamline job description creation across your team.
            </p>
            <Button onClick={openCreate} variant="outline" className="gap-2 mt-5">
              <Plus className="h-4 w-4" />
              Create First Template
            </Button>
          </motion.div>
        ) : (
          <>
          <motion.div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {pagination.pageItems.map((t) => {
              const style = getCategoryStyle(t.category);
              return (
                <motion.div key={t.id} variants={fadeInUp}>
                  <Card
                    className={`group h-full rounded-xl border-l-4 ${style.border} border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
                  >
                    <CardContent className="flex flex-col h-full gap-3 p-5">
                      {/* Top: Icon + Name + Category */}
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center`}>
                          <FileText className={`h-4.5 w-4.5 ${style.icon}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                            {t.name}
                          </h3>
                          {t.category && (
                            <Badge
                              variant="outline"
                              className={`mt-1.5 text-[10px] font-medium px-2 py-0 ${style.badge}`}
                            >
                              {t.category}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {t.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {t.description}
                        </p>
                      )}

                      {/* Skills */}
                      {t.skills && t.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {t.skills.slice(0, 4).map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/70 text-[10px] font-medium text-muted-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                          {t.skills.length > 4 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/70 text-[10px] font-medium text-muted-foreground">
                              +{t.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                        {t.experience_range && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {t.experience_range}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Copy className="h-3 w-3" />
                          {t.usage_count ?? 0} uses
                        </span>
                        {t.created_at && (
                          <span className="flex items-center gap-1 ml-auto">
                            <Clock className="h-3 w-3" />
                            {formatDate(t.created_at)}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs font-medium rounded-lg shadow-sm"
                          onClick={() => handleUse(t)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Use Template
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
          <DataPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit Dialog                                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update the JD template details below.'
                : 'Fill in the details to create a reusable JD template.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Senior Full-Stack Engineer"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-category">Category</Label>
              <Input
                id="tpl-category"
                placeholder="e.g. Engineering, Sales, Marketing"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                placeholder="Brief summary of the template"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* JD Content */}
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-jd">JD Content (JSON or plain text)</Label>
              <Textarea
                id="tpl-jd"
                placeholder='{"responsibilities": [...], "requirements": [...]} or plain text'
                rows={6}
                className="font-mono text-sm"
                value={form.jd_content}
                onChange={(e) => setForm({ ...form, jd_content: e.target.value })}
              />
            </div>

            {/* Skills */}
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-skills">Skills (comma-separated)</Label>
              <Input
                id="tpl-skills"
                placeholder="React, TypeScript, Node.js, PostgreSQL"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
            </div>

            {/* Experience Range */}
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-exp">Experience Range</Label>
              <Input
                id="tpl-exp"
                placeholder="e.g. 3-5 years"
                value={form.experience_range}
                onChange={(e) => setForm({ ...form, experience_range: e.target.value })}
              />
            </div>

            {/* Salary Range */}
            <div className="grid gap-1.5">
              <Label>Salary Range</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="Min"
                  type="number"
                  value={form.salary_min}
                  onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                />
                <Input
                  placeholder="Max"
                  type="number"
                  value={form.salary_max}
                  onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                />
                <Input
                  placeholder="Currency"
                  value={form.salary_currency}
                  onChange={(e) => setForm({ ...form, salary_currency: e.target.value })}
                />
              </div>
            </div>

            {/* Benefits */}
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-benefits">Benefits (comma-separated)</Label>
              <Input
                id="tpl-benefits"
                placeholder="Health insurance, 401k, Remote work"
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation                                                */}
      {/* ------------------------------------------------------------------ */}
      {/* ------------------------------------------------------------------ */}
      {/* AI Parse Dialog                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={aiParseOpen} onOpenChange={(open) => { setAiParseOpen(open); if (!open) { setAiFile(null); setAiDragOver(false); } }}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              AI Parse JD File
            </DialogTitle>
            <DialogDescription>
              Upload a PDF, DOCX, or TXT file and AI will extract the job description fields automatically.
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={(e) => { e.preventDefault(); setAiDragOver(true); }}
            onDragLeave={() => setAiDragOver(false)}
            onDrop={handleAiFileDrop}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer
              ${aiDragOver ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : 'border-border hover:border-muted-foreground/40'}
            `}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.pdf,.doc,.docx,.txt';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) setAiFile(file);
              };
              input.click();
            }}
          >
            {aiFile ? (
              <>
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{aiFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(aiFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setAiFile(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </>
            ) : (
              <>
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Drop a file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, or TXT</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiParseOpen(false)}>Cancel</Button>
            <Button onClick={handleAiParse} disabled={!aiFile || aiParsing} className="gap-2">
              {aiParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiParsing ? 'Parsing...' : 'Parse with AI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
