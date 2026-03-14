import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatLabel } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
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

/* ── Design system constants ────────────────────────── */
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
const sItemCls = "text-slate-200 focus:bg-white/10 focus:text-white";

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

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  low:      { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  medium:   { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  high:     { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  critical: { bg: 'rgba(244,63,94,0.15)',   text: '#fb7185', border: 'rgba(244,63,94,0.3)' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.12)', text: '#fcd34d', border: 'rgba(245,158,11,0.3)', dot: '#f59e0b' },
  approved:  { bg: 'rgba(16,185,129,0.12)', text: '#6ee7b7', border: 'rgba(16,185,129,0.3)', dot: '#10b981' },
  rejected:  { bg: 'rgba(244,63,94,0.12)',  text: '#fda4af', border: 'rgba(244,63,94,0.3)',  dot: '#f43f5e' },
  converted: { bg: 'rgba(14,165,233,0.12)', text: '#7dd3fc', border: 'rgba(14,165,233,0.3)', dot: '#0ea5e9' },
};

const KPI_CONFIGS = [
  { iconBg: 'rgba(59,130,246,0.18)', iconColor: '#60a5fa', cardBg: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(22,118,192,0.06) 100%)' },
  { iconBg: 'rgba(245,158,11,0.18)', iconColor: '#fbbf24', cardBg: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(234,179,8,0.06) 100%)' },
  { iconBg: 'rgba(16,185,129,0.18)', iconColor: '#6ee7b7', cardBg: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(34,197,94,0.06) 100%)' },
  { iconBg: 'rgba(244,63,94,0.18)',  iconColor: '#fb7185', cardBg: 'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(239,68,68,0.06) 100%)' },
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
              <div
                className="flex items-center justify-center h-9 w-9 rounded-xl"
                style={{ background: 'linear-gradient(135deg, rgba(27,142,229,0.25), rgba(27,142,229,0.08))' }}
              >
                <ClipboardList className="h-5 w-5 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Job Requests</h1>
            </div>
            <p className="text-sm text-slate-400 ml-[46px]">
              Manage and review hiring manager job requests
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:brightness-110 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 8px 24px rgba(27,142,229,0.25)' }}
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
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
              <div
                className="relative overflow-hidden rounded-xl p-5 flex items-start gap-4 transition-shadow duration-300 hover:shadow-lg"
                style={{ ...glassCard, background: KPI_CONFIGS[i].cardBg }}
              >
                <div
                  className="flex items-center justify-center h-11 w-11 rounded-xl shrink-0"
                  style={{ background: KPI_CONFIGS[i].iconBg }}
                >
                  <kpi.icon className="h-5 w-5" style={{ color: KPI_CONFIGS[i].iconColor }} />
                </div>
                <div className="min-w-0">
                  <p className="text-3xl font-bold tracking-tight leading-none text-white">
                    <CountingNumber value={kpi.value} />
                  </p>
                  <p className="text-sm font-medium text-slate-300 mt-1">{kpi.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{kpi.subtitle}</p>
                </div>
              </div>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              placeholder="Search role, team, department, requester..."
              className="w-full pl-9 pr-3 h-9 text-sm rounded-xl outline-none placeholder:text-slate-500 transition-all"
              style={glassInput}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Filter className="h-4 w-4" />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[160px] rounded-xl h-9 text-sm border-white/10 bg-white/5 text-slate-200 hover:bg-white/8">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" style={selectDrop}>
                <SelectItem value="all" className={sItemCls}>All Status</SelectItem>
                <SelectItem value="pending" className={sItemCls}>Pending</SelectItem>
                <SelectItem value="approved" className={sItemCls}>Approved</SelectItem>
                <SelectItem value="rejected" className={sItemCls}>Rejected</SelectItem>
                <SelectItem value="converted" className={sItemCls}>Converted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => { setSortBy(v as any); setPage(1); }}>
              <SelectTrigger className="w-[170px] rounded-xl h-9 text-sm border-white/10 bg-white/5 text-slate-200 hover:bg-white/8">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl" style={selectDrop}>
                <SelectItem value="newest" className={sItemCls}>Newest First</SelectItem>
                <SelectItem value="oldest" className={sItemCls}>Oldest First</SelectItem>
                <SelectItem value="priority" className={sItemCls}>Priority</SelectItem>
                <SelectItem value="role_az" className={sItemCls}>Role A-Z</SelectItem>
              </SelectContent>
            </Select>
            {(statusFilter || searchQuery) && (
              <button
                className="h-8 px-3 text-xs text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                style={{ background: 'var(--orbis-input)' }}
                onClick={() => { setStatusFilter(''); setSearchQuery(''); setPage(1); }}
              >
                Clear
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Request List ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="rounded-xl animate-pulse"
                style={glassCard}
              >
                <div className="p-6 space-y-4">
                  <div className="flex justify-between">
                    <div className="h-5 w-48 rounded-lg" style={{ background: 'var(--orbis-hover)' }} />
                    <div className="h-5 w-20 rounded-full" style={{ background: 'var(--orbis-hover)' }} />
                  </div>
                  <div className="h-4 w-64 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                  <div className="h-4 w-32 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <motion.div variants={scaleIn} initial="hidden" animate="visible">
            <div
              className="rounded-xl py-16 text-center"
              style={{ ...glassCard, borderStyle: 'dashed', borderWidth: '2px' }}
            >
              <div
                className="flex items-center justify-center h-16 w-16 rounded-2xl mx-auto mb-4"
                style={{ background: 'var(--orbis-input)' }}
              >
                <ClipboardList className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">No job requests found</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Create a new request to start the hiring approval workflow
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-200 transition-all hover:bg-white/10 cursor-pointer"
                style={{ border: '1px solid var(--orbis-border-strong)', background: 'var(--orbis-input)' }}
              >
                <Plus className="h-4 w-4" /> Create First Request
              </button>
            </div>
          </motion.div>
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pageItems.map((req: any) => {
              const statusS = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
              const priorityS = PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.medium;

              return (
                <motion.div key={req.id} variants={fadeInUp} whileHover={hoverLift}>
                  <div
                    className="rounded-xl overflow-hidden transition-all duration-300 group hover:border-blue-500/30"
                    style={glassCard}
                  >
                    {/* Card Header with status strip */}
                    <div className="h-1 w-full" style={{ background: statusS.dot }} />

                    <div className="p-5 space-y-4">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-white truncate group-hover:text-blue-400 transition-colors duration-200">
                            {req.requested_role}
                          </h3>
                          {req.requester_name && (
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Requested by {req.requester_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                            style={{ background: priorityS.bg, color: priorityS.text, border: `1px solid ${priorityS.border}` }}
                          >
                            {req.priority === 'critical' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                            {req.priority}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                            style={{ background: statusS.bg, color: statusS.text, border: `1px solid ${statusS.border}` }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusS.dot }} />
                            {req.status}
                          </span>
                        </div>
                      </div>

                      {/* Meta grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-400">
                        {req.team && (
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="h-3 w-3 shrink-0 text-slate-400" /> {req.team}
                          </span>
                        )}
                        {req.department && (
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3 shrink-0 text-slate-400" /> {req.department}
                          </span>
                        )}
                        {req.expected_join_date && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3 w-3 shrink-0 text-slate-400" /> {new Date(req.expected_join_date).toLocaleDateString()}
                          </span>
                        )}
                        {req.number_of_positions > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0 text-slate-400" /> {req.number_of_positions} position{req.number_of_positions > 1 ? 's' : ''}
                          </span>
                        )}
                        {req.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" /> {req.location}
                          </span>
                        )}
                        {req.budget && (
                          <span className="flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3 shrink-0 text-slate-400" /> {req.budget_currency || 'USD'} {Number(req.budget).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Skills */}
                      {req.skills_required?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {req.skills_required.slice(0, 5).map((s: string) => (
                            <span
                              key={s}
                              className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full text-slate-400"
                              style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-hover)' }}
                            >
                              {s}
                            </span>
                          ))}
                          {req.skills_required.length > 5 && (
                            <span className="text-[10px] text-slate-400 px-1 self-center">
                              +{req.skills_required.length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Justification preview */}
                      {req.justification && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">
                          &ldquo;{req.justification}&rdquo;
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                        {canReview && req.status === 'pending' && (
                          <button
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg text-slate-300 transition-all hover:text-blue-400 hover:border-blue-500/30 cursor-pointer"
                            style={{ border: '1px solid var(--orbis-border)', background: 'var(--orbis-grid)' }}
                            onClick={() => { setReviewTarget(req); setReviewComments(''); }}
                          >
                            <Eye className="h-3.5 w-3.5" /> Review
                          </button>
                        )}
                        {req.status === 'approved' && (
                          <button
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg text-white font-medium transition-all hover:brightness-110 cursor-pointer"
                            style={{ background: '#059669', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}
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
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-white/10 bg-[#0f0b2a]" style={{ background: 'rgba(15,11,42,0.97)', backdropFilter: 'blur(20px)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(27,142,229,0.15)' }}>
                <Plus className="h-4 w-4 text-blue-400" />
              </div>
              New Job Request
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Submit a hiring request for review and approval by the HR team.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Requested Role */}
            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="jr-role" className="text-xs font-medium text-slate-300">Requested Role *</label>
              <input
                id="jr-role"
                placeholder="e.g. Senior Backend Engineer"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.requested_role}
                onChange={e => setForm(f => ({ ...f, requested_role: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Team */}
            <div className="space-y-1.5">
              <label htmlFor="jr-team" className="text-xs font-medium text-slate-300">Team</label>
              <input
                id="jr-team"
                placeholder="e.g. Platform Engineering"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.team}
                onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label htmlFor="jr-dept" className="text-xs font-medium text-slate-300">Department</label>
              <input
                id="jr-dept"
                placeholder="e.g. Engineering"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="rounded-xl h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl" style={selectDrop}>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p} value={p} className={`capitalize ${sItemCls}`}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Number of Positions */}
            <div className="space-y-1.5">
              <label htmlFor="jr-positions" className="text-xs font-medium text-slate-300">Number of Positions</label>
              <input
                id="jr-positions"
                type="number"
                min={1}
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.number_of_positions}
                onChange={e => setForm(f => ({ ...f, number_of_positions: parseInt(e.target.value) || 1 }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Job Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Job Type</label>
              <Select value={form.job_type} onValueChange={v => setForm(f => ({ ...f, job_type: v }))}>
                <SelectTrigger className="rounded-xl h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl" style={selectDrop}>
                  {JOB_TYPES.map(t => (
                    <SelectItem key={t} value={t} className={sItemCls}>{formatLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Location Type</label>
              <Select value={form.location_type} onValueChange={v => setForm(f => ({ ...f, location_type: v }))}>
                <SelectTrigger className="rounded-xl h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl" style={selectDrop}>
                  {LOCATION_TYPES.map(t => (
                    <SelectItem key={t} value={t} className={sItemCls}>{formatLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label htmlFor="jr-location" className="text-xs font-medium text-slate-300">Location</label>
              <input
                id="jr-location"
                placeholder="e.g. Milan, Italy"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Expected Join Date */}
            <div className="space-y-1.5">
              <label htmlFor="jr-date" className="text-xs font-medium text-slate-300">Expected Join Date</label>
              <input
                id="jr-date"
                type="date"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.expected_join_date}
                onChange={e => setForm(f => ({ ...f, expected_join_date: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Budget */}
            <div className="space-y-1.5">
              <label htmlFor="jr-budget" className="text-xs font-medium text-slate-300">Budget</label>
              <input
                id="jr-budget"
                type="number"
                placeholder="e.g. 80000"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Budget Currency */}
            <div className="space-y-1.5">
              <label htmlFor="jr-currency" className="text-xs font-medium text-slate-300">Currency</label>
              <input
                id="jr-currency"
                placeholder="USD"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.budget_currency}
                onChange={e => setForm(f => ({ ...f, budget_currency: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Skills */}
            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="jr-skills" className="text-xs font-medium text-slate-300">Skills Required (comma-separated)</label>
              <input
                id="jr-skills"
                placeholder="e.g. Python, FastAPI, PostgreSQL"
                className="w-full rounded-xl h-10 px-3 text-sm outline-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.skills_required}
                onChange={e => setForm(f => ({ ...f, skills_required: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Justification */}
            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="jr-justification" className="text-xs font-medium text-slate-300">Justification</label>
              <textarea
                id="jr-justification"
                placeholder="Why is this role needed?"
                rows={3}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none placeholder:text-slate-500 transition-all"
                style={glassInput}
                value={form.justification}
                onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:bg-white/10 cursor-pointer"
              style={{ border: '1px solid var(--orbis-border)', background: 'var(--orbis-grid)' }}
              onClick={() => { setShowCreate(false); setForm(emptyForm()); }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.requested_role.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 8px 24px rgba(27,142,229,0.2)' }}
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
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!reviewTarget} onOpenChange={v => { if (!v) { setReviewTarget(null); setReviewComments(''); } }}>
        <DialogContent className="max-w-lg rounded-2xl border-white/10 bg-[#0f0b2a]" style={{ background: 'rgba(15,11,42,0.97)', backdropFilter: 'blur(20px)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(27,142,229,0.15)' }}>
                <Eye className="h-4 w-4 text-blue-400" />
              </div>
              Review Request
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {reviewTarget?.requested_role} - {reviewTarget?.number_of_positions} position{reviewTarget?.number_of_positions > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          {reviewTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {reviewTarget.requester_name && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Requester</span>
                    <p className="font-medium text-white">{reviewTarget.requester_name}</p>
                  </div>
                )}
                {reviewTarget.team && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Team</span>
                    <p className="font-medium text-white">{reviewTarget.team}</p>
                  </div>
                )}
                {reviewTarget.department && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Department</span>
                    <p className="font-medium text-white">{reviewTarget.department}</p>
                  </div>
                )}
                {reviewTarget.priority && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Priority</span>
                    <p className="font-medium text-white capitalize">{reviewTarget.priority}</p>
                  </div>
                )}
                {reviewTarget.job_type && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Type</span>
                    <p className="font-medium text-white">{formatLabel(reviewTarget.job_type)}</p>
                  </div>
                )}
                {reviewTarget.location && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Location</span>
                    <p className="font-medium text-white">{reviewTarget.location}</p>
                  </div>
                )}
                {reviewTarget.budget && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Budget</span>
                    <p className="font-medium text-white">{reviewTarget.budget_currency || 'USD'} {Number(reviewTarget.budget).toLocaleString()}</p>
                  </div>
                )}
                {reviewTarget.expected_join_date && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Join By</span>
                    <p className="font-medium text-white">{new Date(reviewTarget.expected_join_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {reviewTarget.justification && (
                <div className="rounded-xl p-3 space-y-1" style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-hover)' }}>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Justification</span>
                  <p className="text-sm leading-relaxed text-slate-300">{reviewTarget.justification}</p>
                </div>
              )}

              {reviewTarget.skills_required?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reviewTarget.skills_required.map((s: string) => (
                    <span
                      key={s}
                      className="text-xs rounded-full px-2.5 py-0.5 text-slate-300"
                      style={{ background: 'var(--orbis-hover)', border: '1px solid var(--orbis-border)' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="review-comments" className="text-xs font-medium text-slate-300">Comments (optional)</label>
                <textarea
                  id="review-comments"
                  rows={2}
                  placeholder="Add review comments..."
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none placeholder:text-slate-500 transition-all"
                  style={glassInput}
                  value={reviewComments}
                  onChange={e => setReviewComments(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:bg-white/10 cursor-pointer"
              style={{ border: '1px solid var(--orbis-border)', background: 'var(--orbis-grid)' }}
              onClick={() => { setReviewTarget(null); setReviewComments(''); }}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: '#e11d48', boxShadow: '0 4px 12px rgba(225,29,72,0.25)' }}
              onClick={() => handleReview('rejected')}
              disabled={reviewing}
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button
              onClick={() => handleReview('approved')}
              disabled={reviewing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: '#059669', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
