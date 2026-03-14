import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { DataPagination } from '@/components/DataPagination';
import { CandidateDrawer } from '@/components/CandidateDrawer';
import {
  Users, Briefcase, MapPin, Clock, Search, UserPlus, X, Mail,
  Trash2, MoreVertical, Tag, Upload, FileText, User, Phone, FileSpreadsheet,
} from 'lucide-react';
import { CountingNumber } from '@/components/ui/counting-number';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import ResumeReviewForm, { emptyAddForm, metadataToForm, formToMetadata, type AddFormState } from '@/components/talent-pool/ResumeReviewForm';
import RecruiterDuplicateModal from '@/components/RecruiterDuplicateModal';
import { CSVImportModal } from '@/components/CSVImportModal';

/* ── Design-system constants ─────────────────────────────────────────────── */

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

/* ── Constants ───────────────────────────────────────────────────────────── */

const CATEGORIES = [
  'Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'IT', 'Product', 'Design', 'Other'
];

const STATUS_OPTIONS = ['active', 'inactive', 'blacklisted'] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active:      { bg: 'rgba(34,197,94,0.10)', text: 'text-green-400', border: 'border-green-500/20' },
  inactive:    { bg: 'rgba(234,179,8,0.10)', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  blacklisted: { bg: 'var(--orbis-input)', text: 'text-slate-400', border: 'border-white/10' },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Engineering: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  HR:          { bg: 'bg-pink-500/10', text: 'text-pink-400' },
  Finance:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  Marketing:   { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  Sales:       { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  IT:          { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  Product:     { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  Design:      { bg: 'bg-rose-500/10', text: 'text-rose-400' },
  Other:       { bg: 'bg-white/[0.05]', text: 'text-slate-400' },
};

const AVATAR_GRADIENTS: Record<string, string> = {
  A: 'from-blue-500 to-blue-600',
  B: 'from-emerald-500 to-teal-600',
  C: 'from-orange-500 to-red-500',
  D: 'from-blue-500 to-blue-600',
  E: 'from-pink-500 to-rose-600',
  F: 'from-cyan-500 to-blue-600',
  G: 'from-amber-500 to-orange-600',
  H: 'from-teal-500 to-emerald-600',
  I: 'from-blue-500 to-blue-600',
  J: 'from-rose-500 to-pink-600',
  K: 'from-blue-600 to-cyan-500',
  L: 'from-blue-500 to-blue-600',
  M: 'from-red-500 to-orange-500',
  N: 'from-green-500 to-emerald-600',
  O: 'from-sky-500 to-blue-600',
  P: 'from-fuchsia-500 to-blue-600',
  Q: 'from-lime-500 to-green-600',
  R: 'from-yellow-500 to-amber-600',
  S: 'from-blue-600 to-blue-500',
  T: 'from-emerald-600 to-green-500',
  U: 'from-orange-600 to-amber-500',
  V: 'from-blue-600 to-fuchsia-500',
  W: 'from-cyan-600 to-teal-500',
  X: 'from-rose-600 to-red-500',
  Y: 'from-blue-500 to-blue-600',
  Z: 'from-teal-600 to-cyan-500',
};

function getAvatarGradient(name: string): string {
  const initial = (name || '?')[0].toUpperCase();
  return AVATAR_GRADIENTS[initial] || 'from-blue-500 to-blue-600';
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function TalentPool() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Selection for bulk actions
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addToJobId, setAddToJobId] = useState('');

  // Drawer
  const [drawerId, setDrawerId] = useState<string | null>(null);

  // Add Candidate dialog -- two-phase: upload -> review/confirm
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{ metadata: any; resume_url: string } | null>(null);
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm());
  const [addLoading, setAddLoading] = useState(false);

  // CSV Import
  const [showCSVImport, setShowCSVImport] = useState(false);

  // Duplicate pre-check state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);

  // ---- data fetching via React Query ----
  const {
    data: talentData,
    isLoading: loading,
  } = useQuery({
    queryKey: ['talent-pool', currentPage, search, sort, category, statusFilter],
    queryFn: () =>
      apiClient.getTalentPool({
        page: currentPage,
        pageSize: 20,
        search: search || undefined,
        sort,
        category: category || undefined,
        status: statusFilter || undefined,
      }),
  });

  const candidates = Array.isArray(talentData?.items) ? talentData.items : [];
  const paginationMeta = {
    total: talentData?.total ?? 0,
    totalPages: talentData?.total_pages ?? 0,
    pageSize: talentData?.page_size ?? 20,
  };

  // Load jobs for "Add to Job" dropdown
  const { data: jobsData } = useQuery({
    queryKey: ['available-jobs'],
    queryFn: () => apiClient.getJobs(1, 50),
    staleTime: 60000,
  });
  const availableJobs = jobsData?.items ?? [];

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, sort, category, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddToJob = async () => {
    if (!addToJobId || selected.size === 0) return;
    try {
      const res = await apiClient.addTalentToJob(Array.from(selected), addToJobId);
      toast({ title: 'Success', description: res.message });
      setSelected(new Set());
      setAddToJobId('');
    } catch {
      toast({ title: 'Error', description: 'Failed to add candidates to job', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the talent pool? This cannot be undone.`)) return;
    try {
      await apiClient.deleteTalentPoolCandidate(id);
      toast({ title: 'Success', description: `${name} removed from talent pool` });
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete candidate', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.updateCandidateStatus(id, newStatus);
      toast({ title: 'Status updated', description: `Changed to ${newStatus}` });
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) return;
    setIsParsing(true);
    try {
      const result = await apiClient.parseResumeForProfile(resumeFile);
      const meta = result.metadata || {};
      setParsedData({ metadata: meta, resume_url: result.resume_url });
      setAddForm(metadataToForm(meta));
      toast({ title: 'Resume parsed', description: 'Review the extracted information below' });
    } catch {
      toast({ title: 'Error', description: 'Failed to parse resume. You can fill in details manually.', variant: 'destructive' });
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmAdd = async () => {
    if (!addForm.full_name.trim()) return;
    setAddLoading(true);
    try {
      // Pre-check for duplicates before saving
      const checkParams: Record<string, string> = {};
      if (addForm.email.trim()) checkParams.email = addForm.email.trim();
      if (addForm.phone.trim()) checkParams.phone = addForm.phone.trim();
      if (addForm.links.linkedin_url?.trim()) checkParams.linkedin_url = addForm.links.linkedin_url.trim();
      if (addForm.links.github_url?.trim()) checkParams.github_url = addForm.links.github_url.trim();

      if (Object.keys(checkParams).length > 0) {
        try {
          const dupResult = await apiClient.checkDuplicateCandidate(checkParams);
          if (dupResult.is_duplicate && dupResult.duplicate_info) {
            // Show modal and pause -- don't save yet
            setDuplicateInfo(dupResult.duplicate_info);
            setShowDuplicateModal(true);
            setAddLoading(false);
            return;
          }
        } catch {
          // If pre-check fails, fall through to save -- don't block the user
        }
      }

      await saveProfile();
    } catch {
      toast({ title: 'Error', description: 'Failed to add candidate', variant: 'destructive' });
      setAddLoading(false);
    }
  };

  const saveProfile = async () => {
    setAddLoading(true);
    try {
      const deepMeta = formToMetadata(addForm);
      await apiClient.createProfile({
        full_name: addForm.full_name.trim(),
        email: addForm.email.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        category: addForm.category || undefined,
        current_role: addForm.current_role.trim() || undefined,
        notes: addForm.notes.trim() || undefined,
        resume_url: parsedData?.resume_url || undefined,
        linkedin_url: addForm.links.linkedin_url?.trim() || undefined,
        github_url: addForm.links.github_url?.trim() || undefined,
        portfolio_url: addForm.links.portfolio_url?.trim() || undefined,
        parsed_metadata: deepMeta,
      });
      toast({ title: 'Success', description: `${addForm.full_name} added to talent pool` });
      resetAddDialog();
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to add candidate', variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDupMerge = async () => {
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    await saveProfile();
  };

  const handleDupViewExisting = () => {
    const profileId = duplicateInfo?.profile_id;
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    resetAddDialog();
    if (profileId) setDrawerId(String(profileId));
  };

  const handleDupCancel = () => {
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setAddLoading(false);
  };

  const resetAddDialog = () => {
    setShowAddDialog(false);
    setResumeFile(null);
    setParsedData(null);
    setAddForm(emptyAddForm());
  };

  const totalPool = paginationMeta.total;
  const withEmail = candidates.filter((c: any) => c.email && c.email !== 'N/A').length;
  const uniqueRoles = new Set(candidates.map((c: any) => c.current_role).filter(Boolean)).size;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Talent Pool</h1>
          <p className="text-slate-400 mt-1">Browse unique candidate profiles and reuse across open positions</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-10 px-4 rounded-lg text-sm font-medium inline-flex items-center text-slate-300 hover:text-white transition-colors"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                <Upload className="h-4 w-4 mr-2" /> Bulk Upload
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={selectDrop}>
              <DropdownMenuItem onClick={() => setShowCSVImport(true)} className="text-slate-200 focus:bg-white/10 focus:text-white">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Import CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => setShowAddDialog(true)}
            className="h-10 px-5 rounded-lg text-sm font-medium text-white shadow-sm inline-flex items-center hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Add Candidate
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {[
          {
            label: 'Total Candidates',
            value: totalPool,
            icon: Users,
            iconColor: 'text-blue-400',
            iconBg: 'bg-blue-500/10',
            gradient: 'linear-gradient(135deg, #3b82f6, #1676c0)',
          },
          {
            label: 'With Contact Info',
            value: withEmail,
            icon: Mail,
            iconColor: 'text-emerald-400',
            iconBg: 'bg-emerald-500/10',
            gradient: 'linear-gradient(135deg, #10b981, #059669)',
          },
          {
            label: 'Unique Roles',
            value: uniqueRoles,
            icon: Briefcase,
            iconColor: 'text-blue-400',
            iconBg: 'bg-blue-500/10',
            gradient: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
          },
        ].map(kpi => (
          <motion.div key={kpi.label} variants={fadeInUp}>
            <div className="rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-blue-500/5 transition-shadow duration-200" style={glassCard}>
              {/* Gradient accent bar */}
              <div className="h-1 w-full" style={{ background: kpi.gradient }} />
              <div className="p-5 flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${kpi.iconBg}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight text-white">
                    <CountingNumber value={kpi.value} />
                  </p>
                  <p className="text-sm text-slate-400 font-medium">{kpi.label}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </StaggerGrid>

      {/* Filter Bar */}
      <div className="mb-6 rounded-2xl p-4" style={glassCard}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 h-10 rounded-xl text-sm placeholder:text-slate-500 focus:outline-none"
              style={glassInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <Select value={category} onValueChange={v => setCategory(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="all" className="text-slate-200 focus:bg-white/10 focus:text-white">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-slate-200 focus:bg-white/10 focus:text-white">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[150px] h-11 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="all" className="text-slate-200 focus:bg-white/10 focus:text-white">All Status</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize text-slate-200 focus:bg-white/10 focus:text-white">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="newest" className="text-slate-200 focus:bg-white/10 focus:text-white">Newest First</SelectItem>
              <SelectItem value="oldest" className="text-slate-200 focus:bg-white/10 focus:text-white">Oldest First</SelectItem>
              <SelectItem value="name_asc" className="text-slate-200 focus:bg-white/10 focus:text-white">Name A-Z</SelectItem>
              <SelectItem value="name_desc" className="text-slate-200 focus:bg-white/10 focus:text-white">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selection Action Bar */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-5 p-3.5 rounded-xl"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          <span className="text-sm font-semibold text-blue-300">{selected.size} selected</span>
          <Select value={addToJobId} onValueChange={setAddToJobId}>
            <SelectTrigger className="w-[200px] h-8 rounded-xl text-white border-0" style={glassInput}>
              <SelectValue placeholder="Select job..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              {availableJobs.map((j: any) => (
                <SelectItem key={j.job_id} value={j.job_id} className="text-slate-200 focus:bg-white/10 focus:text-white">
                  {j.job_title || `Job ${j.job_id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleAddToJob}
            disabled={!addToJobId}
            className="h-8 px-3 rounded-lg text-xs font-medium text-white inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add to Job
          </button>
          <button
            aria-label="Clear selection"
            onClick={() => setSelected(new Set())}
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Candidate Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-2xl animate-pulse" style={glassCard}>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
                    <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-white/[0.06]" />
                  <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
                </div>
                <div className="h-3 w-full rounded bg-white/[0.06]" />
                <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl" style={glassCard}>
          <div className="p-16 text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-white/[0.04] mb-4">
              <Users className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">No candidates in talent pool</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
              Onboard candidates from job evaluations or add them manually to build your talent pool
            </p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="mt-5 h-10 px-5 rounded-lg text-sm font-medium text-white inline-flex items-center hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              <UserPlus className="h-4 w-4 mr-2" /> Add First Candidate
            </button>
          </div>
        </div>
      ) : (
        <>
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {candidates.map((c: any) => {
              const sc = STATUS_COLORS[c.status] || STATUS_COLORS.active;
              const cc = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other;
              return (
              <motion.div
                key={c._id}
                variants={fadeInUp}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="h-full"
              >
                <div
                  className="group rounded-2xl overflow-hidden cursor-pointer h-full flex flex-col transition-shadow duration-200 hover:shadow-lg hover:shadow-blue-500/5"
                  style={glassCard}
                  onClick={() => setDrawerId(c._id)}
                >
                  <div className="flex-1 flex flex-col">
                    {/* Card Top Content */}
                    <div className="p-5 pb-0 flex-1 flex flex-col">
                      {/* Checkbox + Avatar + Name */}
                      <div className="flex items-start gap-3 mb-3.5">
                        <Checkbox
                          checked={selected.has(c._id)}
                          onCheckedChange={() => toggleSelect(c._id)}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          className="mt-2.5"
                        />
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(c.name)} text-white text-sm font-bold shadow-sm`}>
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-white truncate leading-tight">{c.name}</h3>
                          {c.email && c.email !== 'N/A' && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">{c.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        <span
                          className={`inline-flex items-center text-[10px] px-2 py-0.5 capitalize font-medium rounded-md border ${sc.text} ${sc.border}`}
                          style={{ background: sc.bg }}
                        >
                          {c.status || 'active'}
                        </span>
                        {c.category && (
                          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 font-medium rounded-md ${cc.bg} ${cc.text} border border-transparent`}>
                            {c.category}
                          </span>
                        )}
                        {(c.job_count || 0) > 0 && (
                          <span className="inline-flex items-center text-[10px] px-2 py-0.5 font-medium rounded-md bg-white/[0.05] text-slate-400 border border-white/10">
                            <Briefcase className="h-2.5 w-2.5 mr-1" />{c.job_count} {c.job_count === 1 ? 'job' : 'jobs'}
                          </span>
                        )}
                      </div>

                      {/* Info Lines */}
                      <div className="space-y-1.5 mb-3">
                        {c.current_role && c.current_role !== 'N/A' && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="truncate">{c.current_role}</span>
                          </div>
                        )}
                        {(c.experience || 0) > 0 && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span>{c.experience} years experience</span>
                          </div>
                        )}
                        {c.location && c.location !== 'N/A' && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="truncate">{c.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Skills Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
                        {c.skills?.length > 0 && (
                          <>
                            {c.skills.slice(0, 4).map((s: string) => (
                              <span
                                key={s}
                                className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full text-slate-400"
                                style={{ background: 'var(--orbis-input)' }}
                              >
                                {s}
                              </span>
                            ))}
                            {c.skills.length > 4 && (
                              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                                +{c.skills.length - 4}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Footer - pinned to bottom */}
                    <div
                      className="flex items-center justify-between px-5 py-3 mt-auto"
                      style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 text-xs px-2 text-slate-400 hover:text-white inline-flex items-center rounded-md transition-colors hover:bg-white/[0.05]">
                            <span className="capitalize">{c.status || 'active'}</span>
                            <MoreVertical className="h-3 w-3 ml-1.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" style={selectDrop}>
                          {STATUS_OPTIONS.filter(s => s !== (c.status || 'active')).map(s => (
                            <DropdownMenuItem key={s} onClick={() => handleStatusChange(c._id, s)} className="capitalize text-xs text-slate-200 focus:bg-white/10 focus:text-white">
                              {s}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button
                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md inline-flex items-center justify-center transition-colors"
                        aria-label="Delete candidate"
                        onClick={() => handleDelete(c._id, c.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
              );
            })}
          </StaggerGrid>

          <div className="mt-6">
            <DataPagination
              page={currentPage}
              totalPages={paginationMeta.totalPages}
              total={paginationMeta.total}
              pageSize={paginationMeta.pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}

      {/* Candidate Drawer */}
      <CandidateDrawer
        candidateId={drawerId}
        open={!!drawerId}
        onClose={() => setDrawerId(null)}
      />

      {/* Duplicate Pre-Check Modal */}
      {duplicateInfo && (
        <RecruiterDuplicateModal
          isOpen={showDuplicateModal}
          duplicateInfo={duplicateInfo}
          mode="pre-check"
          onContinue={handleDupMerge}
          onViewExisting={handleDupViewExisting}
          onCancel={handleDupCancel}
        />
      )}

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        onImported={() => {
          setShowCSVImport(false);
          queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
        }}
      />

      {/* Add Candidate Dialog -- two-phase: upload resume -> review & confirm */}
      <Dialog open={showAddDialog} onOpenChange={v => { if (!v) resetAddDialog(); else setShowAddDialog(true); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader className="space-y-2 pb-4">
            <DialogTitle className="text-xl font-bold text-white flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-400" />
              Add Candidate to Talent Pool
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              {!parsedData ? 'Upload a resume to auto-extract candidate details, or skip to enter manually.' : 'Review the extracted information and confirm.'}
            </DialogDescription>
          </DialogHeader>

          {!parsedData ? (
            /* Phase 1: Upload Resume */
            <div className="space-y-6">
              <div className="rounded-2xl p-6" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}>
                <div className="flex items-center space-x-3 mb-5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Resume Upload</h4>
                </div>

                <div>
                  <label htmlFor="tp-resume" className="text-sm font-medium text-slate-300 mb-2 block">
                    Resume/CV (PDF, DOC, DOCX)
                  </label>
                  <input
                    id="tp-resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={e => setResumeFile(e.target.files?.[0] || null)}
                    className="w-full cursor-pointer p-4 rounded-xl text-sm text-slate-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30"
                    style={{ background: 'var(--orbis-card)', border: '2px dashed var(--orbis-border)' }}
                  />
                  {resumeFile && (
                    <div className="mt-3 p-3 rounded-lg flex items-center space-x-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <FileText className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-300 font-medium">{resumeFile.name}</span>
                      <span className="text-xs text-green-400">({(resumeFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2">Max 10 MB. AI will extract education, experience, projects, skills, and more.</p>
                </div>
              </div>

              <div className="h-px" style={{ background: 'var(--orbis-border)' }} />

              <div className="flex justify-between">
                <button
                  onClick={() => { setParsedData({ metadata: {}, resume_url: '' }); }}
                  className="h-10 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                >
                  Skip &mdash; Enter Manually
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={resetAddDialog}
                    disabled={isParsing}
                    className="h-10 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white disabled:opacity-50 transition-colors"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResumeUpload}
                    disabled={isParsing || !resumeFile}
                    className="h-10 px-6 rounded-xl text-sm font-medium text-white shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                  >
                    {isParsing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Upload & Parse
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Phase 2: Deep Review Form */
            <div className="space-y-4">
              <ResumeReviewForm
                form={addForm}
                onChange={setAddForm}
                showSuccess={!!parsedData.resume_url}
              />

              <div className="h-px" style={{ background: 'var(--orbis-border)' }} />

              <div className="flex justify-between">
                <button
                  onClick={() => { setParsedData(null); setResumeFile(null); }}
                  className="h-10 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                >
                  Back
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={resetAddDialog}
                    className="h-10 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAdd}
                    disabled={!addForm.full_name.trim() || addLoading}
                    className="h-10 px-6 rounded-xl text-sm font-medium text-white shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                  >
                    {addLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Adding...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Add to Talent Pool
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
