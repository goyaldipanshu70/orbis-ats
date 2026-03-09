import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { DataPagination } from '@/components/DataPagination';
import { CandidateDrawer } from '@/components/CandidateDrawer';
import { Separator } from '@/components/ui/separator';
import {
  Users, Briefcase, MapPin, Clock, Search, UserPlus, X, Mail,
  Trash2, MoreVertical, Tag, Upload, FileText, User, Phone, FileSpreadsheet,
} from 'lucide-react';
import { CountingNumber } from '@/components/ui/counting-number';
import { Fade } from '@/components/ui/fade';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import ResumeReviewForm, { emptyAddForm, metadataToForm, formToMetadata, type AddFormState } from '@/components/talent-pool/ResumeReviewForm';
import RecruiterDuplicateModal from '@/components/RecruiterDuplicateModal';
import { CSVImportModal } from '@/components/CSVImportModal';

const CATEGORIES = [
  'Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'IT', 'Product', 'Design', 'Other'
];

const STATUS_OPTIONS = ['active', 'inactive', 'blacklisted'] as const;

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
  inactive: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  blacklisted: 'bg-muted text-foreground border-border',
};

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  HR: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  Finance: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  Marketing: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  Sales: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  IT: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  Product: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  Design: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  Other: 'bg-muted text-foreground',
};

const AVATAR_GRADIENTS: Record<string, string> = {
  A: 'from-blue-500 to-indigo-600',
  B: 'from-emerald-500 to-teal-600',
  C: 'from-orange-500 to-red-500',
  D: 'from-purple-500 to-violet-600',
  E: 'from-pink-500 to-rose-600',
  F: 'from-cyan-500 to-blue-600',
  G: 'from-amber-500 to-orange-600',
  H: 'from-teal-500 to-emerald-600',
  I: 'from-indigo-500 to-purple-600',
  J: 'from-rose-500 to-pink-600',
  K: 'from-blue-600 to-cyan-500',
  L: 'from-violet-500 to-indigo-600',
  M: 'from-red-500 to-orange-500',
  N: 'from-green-500 to-emerald-600',
  O: 'from-sky-500 to-blue-600',
  P: 'from-fuchsia-500 to-purple-600',
  Q: 'from-lime-500 to-green-600',
  R: 'from-yellow-500 to-amber-600',
  S: 'from-indigo-600 to-blue-500',
  T: 'from-emerald-600 to-green-500',
  U: 'from-orange-600 to-amber-500',
  V: 'from-purple-600 to-fuchsia-500',
  W: 'from-cyan-600 to-teal-500',
  X: 'from-rose-600 to-red-500',
  Y: 'from-blue-500 to-violet-600',
  Z: 'from-teal-600 to-cyan-500',
};

function getAvatarGradient(name: string): string {
  const initial = (name || '?')[0].toUpperCase();
  return AVATAR_GRADIENTS[initial] || 'from-blue-500 to-indigo-600';
}

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

  // Add Candidate dialog — two-phase: upload → review/confirm
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
            // Show modal and pause — don't save yet
            setDuplicateInfo(dupResult.duplicate_info);
            setShowDuplicateModal(true);
            setAddLoading(false);
            return;
          }
        } catch {
          // If pre-check fails, fall through to save — don't block the user
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
  const withEmail = candidates.filter(c => c.email && c.email !== 'N/A').length;
  const uniqueRoles = new Set(candidates.map(c => c.current_role).filter(Boolean)).size;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Talent Pool</h1>
          <p className="text-muted-foreground mt-1">Browse unique candidate profiles and reuse across open positions</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 px-4 border-border">
                <Upload className="h-4 w-4 mr-2" /> Bulk Upload
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowCSVImport(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Import CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShowAddDialog(true)} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            <UserPlus className="h-4 w-4 mr-2" /> Add Candidate
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {[
          {
            label: 'Total Candidates',
            value: totalPool,
            icon: Users,
            iconBg: 'bg-blue-100 dark:bg-blue-900/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
            cardBg: 'bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-card',
          },
          {
            label: 'With Contact Info',
            value: withEmail,
            icon: Mail,
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            cardBg: 'bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-card',
          },
          {
            label: 'Unique Roles',
            value: uniqueRoles,
            icon: Briefcase,
            iconBg: 'bg-purple-100 dark:bg-purple-900/50',
            iconColor: 'text-purple-600 dark:text-purple-400',
            cardBg: 'bg-gradient-to-br from-purple-50/80 to-white dark:from-purple-950/30 dark:to-card',
          },
        ].map(kpi => (
          <motion.div key={kpi.label} variants={fadeInUp}>
            <Card className={`${kpi.cardBg} border-0 shadow-sm`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${kpi.iconBg}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight text-foreground">
                    <CountingNumber value={kpi.value} />
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </StaggerGrid>

      {/* Filter Bar */}
      <Card className="mb-6 border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 bg-muted/30 border-border"
              />
            </div>
            <Select value={category} onValueChange={v => setCategory(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[160px] h-10 bg-muted/30"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[150px] h-10 bg-muted/30"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[160px] h-10 bg-muted/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="name_desc">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Selection Action Bar */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-5 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30"
        >
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{selected.size} selected</span>
          <Select value={addToJobId} onValueChange={setAddToJobId}>
            <SelectTrigger className="w-[200px] h-8">
              <SelectValue placeholder="Select job..." />
            </SelectTrigger>
            <SelectContent>
              {availableJobs.map(j => (
                <SelectItem key={j.job_id} value={j.job_id}>
                  {j.job_title || `Job ${j.job_id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAddToJob} disabled={!addToJobId} className="bg-blue-600 hover:bg-blue-700 text-white">
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add to Job
          </Button>
          <Button size="sm" variant="ghost" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}

      {/* Candidate Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse border shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-muted" />
                  <div className="h-5 w-20 rounded-full bg-muted" />
                </div>
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-muted mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No candidates in talent pool</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Onboard candidates from job evaluations or add them manually to build your talent pool
            </p>
            <Button onClick={() => setShowAddDialog(true)} className="mt-5 bg-blue-600 hover:bg-blue-700 text-white">
              <UserPlus className="h-4 w-4 mr-2" /> Add First Candidate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {candidates.map((c) => (
              <motion.div
                key={c._id}
                variants={fadeInUp}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="h-full"
              >
                <Card
                  className="group border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer h-full flex flex-col overflow-hidden"
                  onClick={() => setDrawerId(c._id)}
                >
                  <CardContent className="p-0 flex-1 flex flex-col">
                    {/* Card Top Content */}
                    <div className="p-5 pb-0 flex-1 flex flex-col">
                      {/* Checkbox + Avatar + Name */}
                      <div className="flex items-start gap-3 mb-3.5">
                        <Checkbox
                          checked={selected.has(c._id)}
                          onCheckedChange={() => toggleSelect(c._id)}
                          onClick={e => e.stopPropagation()}
                          className="mt-2.5"
                        />
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(c.name)} text-white text-sm font-bold shadow-sm`}>
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-foreground truncate leading-tight">{c.name}</h3>
                          {c.email && c.email !== 'N/A' && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{c.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 capitalize font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.active}`}>
                          {c.status || 'active'}
                        </Badge>
                        {c.category && (
                          <Badge className={`text-[10px] px-2 py-0.5 font-medium border-0 ${CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other}`}>
                            {c.category}
                          </Badge>
                        )}
                        {(c.job_count || 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium">
                            <Briefcase className="h-2.5 w-2.5 mr-1" />{c.job_count} {c.job_count === 1 ? 'job' : 'jobs'}
                          </Badge>
                        )}
                      </div>

                      {/* Info Lines */}
                      <div className="space-y-1.5 mb-3">
                        {c.current_role && c.current_role !== 'N/A' && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                            <span className="truncate">{c.current_role}</span>
                          </div>
                        )}
                        {(c.experience || 0) > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                            <span>{c.experience} years experience</span>
                          </div>
                        )}
                        {c.location && c.location !== 'N/A' && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
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
                                className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                              >
                                {s}
                              </span>
                            ))}
                            {c.skills.length > 4 && (
                              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                +{c.skills.length - 4}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Footer - pinned to bottom */}
                    <div
                      className="flex items-center justify-between px-5 py-3 border-t bg-muted/20 mt-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                            <span className="capitalize">{c.status || 'active'}</span>
                            <MoreVertical className="h-3 w-3 ml-1.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {STATUS_OPTIONS.filter(s => s !== (c.status || 'active')).map(s => (
                            <DropdownMenuItem key={s} onClick={() => handleStatusChange(c._id, s)} className="capitalize text-xs">
                              {s}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        aria-label="Delete candidate"
                        onClick={() => handleDelete(c._id, c.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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

      {/* Add Candidate Dialog — two-phase: upload resume → review & confirm */}
      <Dialog open={showAddDialog} onOpenChange={v => { if (!v) resetAddDialog(); else setShowAddDialog(true); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-card to-blue-50 dark:to-blue-950/20 border-0 shadow-2xl">
          <DialogHeader className="space-y-2 pb-4">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Add Candidate to Talent Pool
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {!parsedData ? 'Upload a resume to auto-extract candidate details, or skip to enter manually.' : 'Review the extracted information and confirm.'}
            </DialogDescription>
          </DialogHeader>

          {!parsedData ? (
            /* Phase 1: Upload Resume */
            <div className="space-y-6">
              <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-blue-100 dark:border-blue-900 shadow-lg">
                <div className="flex items-center space-x-3 mb-5">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground">Resume Upload</h4>
                </div>

                <div>
                  <Label htmlFor="tp-resume" className="text-sm font-medium text-foreground mb-2 block">
                    Resume/CV (PDF, DOC, DOCX)
                  </Label>
                  <Input
                    id="tp-resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={e => setResumeFile(e.target.files?.[0] || null)}
                    className="cursor-pointer border-2 border-dashed border-blue-300 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-700 transition-colors bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/60 p-4 rounded-xl"
                  />
                  {resumeFile && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-800 dark:text-green-300 font-medium">{resumeFile.name}</span>
                      <span className="text-xs text-green-600 dark:text-green-400">({(resumeFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Max 10 MB. AI will extract education, experience, projects, skills, and more.</p>
                </div>
              </div>

              <Separator className="bg-gradient-to-r from-blue-200 to-indigo-200" />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setParsedData({ metadata: {}, resume_url: '' });
                }} className="rounded-xl">
                  Skip &mdash; Enter Manually
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetAddDialog} disabled={isParsing} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResumeUpload}
                    disabled={isParsing || !resumeFile}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
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
                  </Button>
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

              <Separator className="bg-gradient-to-r from-blue-200 to-indigo-200" />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => { setParsedData(null); setResumeFile(null); }} className="rounded-xl">
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetAddDialog} className="rounded-xl">Cancel</Button>
                  <Button
                    onClick={handleConfirmAdd}
                    disabled={!addForm.full_name.trim() || addLoading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
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
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
