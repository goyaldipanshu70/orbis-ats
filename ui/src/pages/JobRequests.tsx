import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatLabel } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import { CountingNumber } from '@/components/ui/counting-number';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { motion } from 'framer-motion';
import { fadeInUp, hoverLift, scaleIn } from '@/lib/animations';
import { useClientPagination } from '@/hooks/useClientPagination';
import { DataPagination } from '@/components/DataPagination';
import {
  ClipboardList, Plus, Clock, CheckCircle2, XCircle, Eye, ArrowRight,
  Users, CalendarDays, MapPin, DollarSign, Briefcase, AlertTriangle,
  Filter, Sparkles, TrendingUp, Search, ArrowUpDown,
} from 'lucide-react';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  medium: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  high: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  critical: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  approved: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  rejected: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700',
  converted: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700',
};

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  converted: 'bg-sky-500',
};

const KPI_GRADIENTS = [
  'from-blue-500/10 to-indigo-500/5 dark:from-blue-500/20 dark:to-indigo-500/10',
  'from-amber-500/10 to-yellow-500/5 dark:from-amber-500/20 dark:to-yellow-500/10',
  'from-emerald-500/10 to-green-500/5 dark:from-emerald-500/20 dark:to-green-500/10',
  'from-rose-500/10 to-red-500/5 dark:from-rose-500/20 dark:to-red-500/10',
];

const KPI_ICON_BG = [
  'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400',
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const JOB_TYPES = ['full_time', 'part_time', 'contract', 'internship'] as const;
const LOCATION_TYPES = ['onsite', 'remote', 'hybrid'] as const;

interface CreateForm {
  requested_role: string;
  team: string;
  department: string;
  justification: string;
  budget: string;
  budget_currency: string;
  priority: string;
  expected_join_date: string;
  number_of_positions: number;
  job_type: string;
  location_type: string;
  location: string;
  skills_required: string;
}

const emptyForm = (): CreateForm => ({
  requested_role: '',
  team: '',
  department: '',
  justification: '',
  budget: '',
  budget_currency: 'USD',
  priority: 'medium',
  expected_join_date: '',
  number_of_positions: 1,
  job_type: 'full_time',
  location_type: 'onsite',
  location: '',
  skills_required: '',
});

export default function JobRequests() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'role_az'>('newest');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm());
  const [creating, setCreating] = useState(false);

  // Review dialog
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewComments, setReviewComments] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const canReview = user?.role === 'admin' || user?.role === 'hr';

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['job-requests', statusFilter],
    queryFn: () => apiClient.getJobRequests(statusFilter || undefined),
  });

  const totalRequests = requests.length;
  const pendingCount = requests.filter((r: any) => r.status === 'pending').length;
  const approvedCount = requests.filter((r: any) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r: any) => r.status === 'rejected').length;

  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const filteredAndSorted = useMemo(() => {
    let result = [...requests];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r: any) =>
        (r.requested_role || '').toLowerCase().includes(q) ||
        (r.team || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.requester_name || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'newest':
          return (b.created_at || b.id || 0) > (a.created_at || a.id || 0) ? 1 : -1;
        case 'oldest':
          return (a.created_at || a.id || 0) > (b.created_at || b.id || 0) ? 1 : -1;
        case 'priority':
          return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
        case 'role_az':
          return (a.requested_role || '').localeCompare(b.requested_role || '');
        default:
          return 0;
      }
    });

    return result;
  }, [requests, searchQuery, sortBy]);

  const { pageItems, page, total, pageSize, totalPages, setPage } = useClientPagination(filteredAndSorted, { pageSize: 10 });

  const handleCreate = async () => {
    if (!form.requested_role.trim()) {
      toast({ title: 'Validation', description: 'Requested role is required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, any> = {
        requested_role: form.requested_role.trim(),
        priority: form.priority,
        number_of_positions: form.number_of_positions,
        job_type: form.job_type,
        location_type: form.location_type,
      };
      if (form.team.trim()) payload.team = form.team.trim();
      if (form.department.trim()) payload.department = form.department.trim();
      if (form.justification.trim()) payload.justification = form.justification.trim();
      if (form.budget.trim()) payload.budget = parseFloat(form.budget);
      if (form.budget_currency.trim()) payload.budget_currency = form.budget_currency.trim();
      if (form.expected_join_date) payload.expected_join_date = form.expected_join_date;
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.skills_required.trim()) {
        payload.skills_required = form.skills_required.split(',').map(s => s.trim()).filter(Boolean);
      }

      await apiClient.createJobRequest(payload);
      toast({ title: 'Success', description: 'Job request submitted' });
      setShowCreate(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ['job-requests'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to create request', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleReview = async (action: 'approved' | 'rejected') => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      await apiClient.reviewJobRequest(reviewTarget.id, action, reviewComments || undefined);
      toast({ title: 'Success', description: `Request ${action}` });
      setReviewTarget(null);
      setReviewComments('');
      queryClient.invalidateQueries({ queryKey: ['job-requests'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to review request', variant: 'destructive' });
    } finally {
      setReviewing(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── Page Header ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/30 dark:to-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Job Requests</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-[46px]">
              Manage and review hiring manager job requests
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            size="lg"
            className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 gap-2"
          >
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        </motion.div>

        {/* ── KPI Cards ────────────────────────────────────────────── */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Requests', value: totalRequests, icon: ClipboardList, subtitle: 'All time' },
            { label: 'Pending Review', value: pendingCount, icon: Clock, subtitle: 'Awaiting action' },
            { label: 'Approved', value: approvedCount, icon: CheckCircle2, subtitle: 'Ready to convert' },
            { label: 'Rejected', value: rejectedCount, icon: XCircle, subtitle: 'Declined' },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} variants={fadeInUp}>
              <Card className={`relative overflow-hidden rounded-xl border-0 bg-gradient-to-br ${KPI_GRADIENTS[i]} backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300`}>
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={`flex items-center justify-center h-11 w-11 rounded-xl ${KPI_ICON_BG[i]} shrink-0`}>
                    <kpi.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xl font-bold tracking-tight leading-none">
                      <CountingNumber value={kpi.value} />
                    </p>
                    <p className="text-sm font-medium text-foreground/80 mt-1">{kpi.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </StaggerGrid>

        {/* ── Filter Bar ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
        >
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search role, team, department, requester..."
              className="pl-9 rounded-xl h-9 text-sm bg-background/80 backdrop-blur-sm"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[160px] rounded-xl h-9 text-sm bg-background/80 backdrop-blur-sm">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => { setSortBy(v as any); setPage(1); }}>
              <SelectTrigger className="w-[170px] rounded-xl h-9 text-sm bg-background/80 backdrop-blur-sm">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="role_az">Role A-Z</SelectItem>
              </SelectContent>
            </Select>
            {(statusFilter || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                onClick={() => { setStatusFilter(''); setSearchQuery(''); setPage(1); }}
              >
                Clear
              </Button>
            )}
          </div>
        </motion.div>

        {/* ── Request List ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border bg-card animate-pulse">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between">
                    <div className="h-5 w-48 bg-muted rounded-lg" />
                    <div className="h-5 w-20 bg-muted rounded-full" />
                  </div>
                  <div className="h-4 w-64 bg-muted rounded-lg" />
                  <div className="h-4 w-32 bg-muted rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <motion.div variants={scaleIn} initial="hidden" animate="visible">
            <Card className="rounded-xl border-dashed border-2">
              <CardContent className="py-16 text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50 mx-auto mb-4">
                  <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-semibold">No job requests found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Create a new request to start the hiring approval workflow
                </p>
                <Button
                  onClick={() => setShowCreate(true)}
                  variant="outline"
                  className="mt-5 rounded-xl gap-2"
                >
                  <Plus className="h-4 w-4" /> Create First Request
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pageItems.map((req: any) => (
              <motion.div key={req.id} variants={fadeInUp} whileHover={hoverLift}>
                <Card className="rounded-xl overflow-hidden border hover:border-primary/20 transition-all duration-300 group">
                  <CardContent className="p-0">
                    {/* Card Header with status strip */}
                    <div className={`h-1 w-full ${STATUS_DOT[req.status] || 'bg-muted'}`} />

                    <div className="p-5 space-y-4">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold truncate group-hover:text-primary transition-colors duration-200">
                            {req.requested_role}
                          </h3>
                          {req.requester_name && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Requested by {req.requester_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[req.priority] || PRIORITY_COLORS.medium}`}
                          >
                            {req.priority === 'critical' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                            {req.priority}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize flex items-center gap-1 ${STATUS_COLORS[req.status] || ''}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[req.status] || ''}`} />
                            {req.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Meta grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        {req.team && (
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground/60" /> {req.team}
                          </span>
                        )}
                        {req.department && (
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3 shrink-0 text-muted-foreground/60" /> {req.department}
                          </span>
                        )}
                        {req.expected_join_date && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground/60" /> {new Date(req.expected_join_date).toLocaleDateString()}
                          </span>
                        )}
                        {req.number_of_positions > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0 text-muted-foreground/60" /> {req.number_of_positions} position{req.number_of_positions > 1 ? 's' : ''}
                          </span>
                        )}
                        {req.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" /> {req.location}
                          </span>
                        )}
                        {req.budget && (
                          <span className="flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3 shrink-0 text-muted-foreground/60" /> {req.budget_currency || 'USD'} {Number(req.budget).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Skills */}
                      {req.skills_required?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {req.skills_required.slice(0, 5).map((s: string) => (
                            <span
                              key={s}
                              className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50"
                            >
                              {s}
                            </span>
                          ))}
                          {req.skills_required.length > 5 && (
                            <span className="text-[10px] text-muted-foreground/60 px-1 self-center">
                              +{req.skills_required.length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Justification preview */}
                      {req.justification && (
                        <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed italic">
                          &ldquo;{req.justification}&rdquo;
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                        {canReview && req.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-lg gap-1.5 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
                            onClick={() => { setReviewTarget(req); setReviewComments(''); }}
                          >
                            <Eye className="h-3.5 w-3.5" /> Review
                          </Button>
                        )}
                        {req.status === 'approved' && (
                          <Button
                            size="sm"
                            className="h-8 text-xs rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
                            onClick={() => navigate('/jobs/create', {
                              state: {
                                job_title: req.requested_role,
                                summary: req.justification || '',
                                number_of_vacancies: req.number_of_positions || 1,
                                core_skills: req.skills_required || [],
                                job_type: req.job_type || '',
                                location_type: req.location_type || '',
                                salary_min: req.budget ? String(req.budget) : '',
                                salary_max: '',
                                salary_currency: req.budget_currency || 'USD',
                                job_request_id: req.id,
                              },
                            })}
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Convert to Job
                            <ArrowRight className="h-3 w-3 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </StaggerGrid>
        )}

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {!isLoading && filteredAndSorted.length > 0 && (
          <DataPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* ── Create Request Dialog ─────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) { setShowCreate(false); setForm(emptyForm()); } else setShowCreate(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              New Job Request
            </DialogTitle>
            <DialogDescription>
              Submit a hiring request for review and approval by the HR team.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Requested Role */}
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="jr-role" className="text-xs font-medium">Requested Role *</Label>
              <Input
                id="jr-role"
                placeholder="e.g. Senior Backend Engineer"
                className="rounded-xl h-10"
                value={form.requested_role}
                onChange={e => setForm(f => ({ ...f, requested_role: e.target.value }))}
              />
            </div>

            {/* Team */}
            <div className="space-y-1.5">
              <Label htmlFor="jr-team" className="text-xs font-medium">Team</Label>
              <Input
                id="jr-team"
                placeholder="e.g. Platform Engineering"
                className="rounded-xl h-10"
                value={form.team}
                onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label htmlFor="jr-dept" className="text-xs font-medium">Department</Label>
              <Input
                id="jr-dept"
                placeholder="e.g. Engineering"
                className="rounded-xl h-10"
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {PRIORITIES.map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Number of Positions */}
            <div className="space-y-1.5">
              <Label htmlFor="jr-positions" className="text-xs font-medium">Number of Positions</Label>
              <Input
                id="jr-positions"
                type="number"
                min={1}
                className="rounded-xl h-10"
                value={form.number_of_positions}
                onChange={e => setForm(f => ({ ...f, number_of_positions: parseInt(e.target.value) || 1 }))}
              />
            </div>

            {/* Job Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Job Type</Label>
              <Select value={form.job_type} onValueChange={v => setForm(f => ({ ...f, job_type: v }))}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {JOB_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Location Type</Label>
              <Select value={form.location_type} onValueChange={v => setForm(f => ({ ...f, location_type: v }))}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {LOCATION_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="jr-location" className="text-xs font-medium">Location</Label>
              <Input
                id="jr-location"
                placeholder="e.g. Milan, Italy"
                className="rounded-xl h-10"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            {/* Expected Join Date */}
            <div className="space-y-1.5">
              <Label htmlFor="jr-date" className="text-xs font-medium">Expected Join Date</Label>
              <Input
                id="jr-date"
                type="date"
                className="rounded-xl h-10"
                value={form.expected_join_date}
                onChange={e => setForm(f => ({ ...f, expected_join_date: e.target.value }))}
              />
            </div>

            {/* Budget */}
            <div className="space-y-1.5">
              <Label htmlFor="jr-budget" className="text-xs font-medium">Budget</Label>
              <Input
                id="jr-budget"
                type="number"
                placeholder="e.g. 80000"
                className="rounded-xl h-10"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
              />
            </div>

            {/* Budget Currency */}
            <div className="space-y-1.5">
              <Label htmlFor="jr-currency" className="text-xs font-medium">Currency</Label>
              <Input
                id="jr-currency"
                placeholder="USD"
                className="rounded-xl h-10"
                value={form.budget_currency}
                onChange={e => setForm(f => ({ ...f, budget_currency: e.target.value }))}
              />
            </div>

            {/* Skills */}
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="jr-skills" className="text-xs font-medium">Skills Required (comma-separated)</Label>
              <Input
                id="jr-skills"
                placeholder="e.g. Python, FastAPI, PostgreSQL"
                className="rounded-xl h-10"
                value={form.skills_required}
                onChange={e => setForm(f => ({ ...f, skills_required: e.target.value }))}
              />
            </div>

            {/* Justification */}
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="jr-justification" className="text-xs font-medium">Justification</Label>
              <Textarea
                id="jr-justification"
                placeholder="Why is this role needed?"
                rows={3}
                className="rounded-xl resize-none"
                value={form.justification}
                onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => { setShowCreate(false); setForm(emptyForm()); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.requested_role.trim()}
              className="rounded-xl gap-2 shadow-md shadow-primary/20"
            >
              {creating ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!reviewTarget} onOpenChange={v => { if (!v) { setReviewTarget(null); setReviewComments(''); } }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              Review Request
            </DialogTitle>
            <DialogDescription>
              {reviewTarget?.requested_role} - {reviewTarget?.number_of_positions} position{reviewTarget?.number_of_positions > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          {reviewTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {reviewTarget.requester_name && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Requester</span>
                    <p className="font-medium">{reviewTarget.requester_name}</p>
                  </div>
                )}
                {reviewTarget.team && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Team</span>
                    <p className="font-medium">{reviewTarget.team}</p>
                  </div>
                )}
                {reviewTarget.department && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Department</span>
                    <p className="font-medium">{reviewTarget.department}</p>
                  </div>
                )}
                {reviewTarget.priority && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Priority</span>
                    <p className="font-medium capitalize">{reviewTarget.priority}</p>
                  </div>
                )}
                {reviewTarget.job_type && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Type</span>
                    <p className="font-medium">{formatLabel(reviewTarget.job_type)}</p>
                  </div>
                )}
                {reviewTarget.location && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Location</span>
                    <p className="font-medium">{reviewTarget.location}</p>
                  </div>
                )}
                {reviewTarget.budget && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Budget</span>
                    <p className="font-medium">{reviewTarget.budget_currency || 'USD'} {Number(reviewTarget.budget).toLocaleString()}</p>
                  </div>
                )}
                {reviewTarget.expected_join_date && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Join By</span>
                    <p className="font-medium">{new Date(reviewTarget.expected_join_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {reviewTarget.justification && (
                <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Justification</span>
                  <p className="text-sm leading-relaxed">{reviewTarget.justification}</p>
                </div>
              )}

              {reviewTarget.skills_required?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reviewTarget.skills_required.map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-xs rounded-full px-2.5">{s}</Badge>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="review-comments" className="text-xs font-medium">Comments (optional)</Label>
                <Textarea
                  id="review-comments"
                  rows={2}
                  placeholder="Add review comments..."
                  className="rounded-xl resize-none"
                  value={reviewComments}
                  onChange={e => setReviewComments(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => { setReviewTarget(null); setReviewComments(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl gap-1.5"
              onClick={() => handleReview('rejected')}
              disabled={reviewing}
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button
              onClick={() => handleReview('approved')}
              disabled={reviewing}
              className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
