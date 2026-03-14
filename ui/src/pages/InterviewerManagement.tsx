import { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useClientPagination } from '@/hooks/useClientPagination';
import { DataPagination } from '@/components/DataPagination';
import { apiClient } from '@/utils/api';
import { CountingNumber } from '@/components/ui/counting-number';
import { motion } from 'framer-motion';
import { scaleIn, fadeInUp, hoverLift } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import {
  Users, UserPlus, Search, Star, Award, Building2, Mail, Copy, Check,
  Briefcase, Sparkles, ArrowUpDown,
} from 'lucide-react';

/* ── Dark Glass Design System ──────────────────────────── */
const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };
const sItemCls = 'text-slate-200 focus:bg-white/10 focus:text-white';

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = 'rgba(27,142,229,0.5)';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'] as const;
const SENIORITY_COLORS: Record<string, string> = {
  Junior: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Mid: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Senior: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Lead: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Principal: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

const AVATAR_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-blue-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

interface Interviewer {
  id: number; user_id: number;
  full_name: string; email: string;
  specializations: string[]; seniority: string | null;
  department: string | null; is_active: boolean;
  total_interviews: number; avg_rating_given: number | null;
}

/** Split full_name into first/last for display helpers. */
function splitName(fullName: string): [string, string] {
  const parts = (fullName || '').trim().split(/\s+/);
  return [parts[0] || '', parts.slice(1).join(' ') || ''];
}

interface InviteForm {
  email: string; first_name: string; last_name: string;
  specializations: string; seniority: string; department: string;
}

const emptyForm = (): InviteForm => ({
  email: '', first_name: '', last_name: '',
  specializations: '', seniority: '', department: '',
});

export default function InterviewerManagement() {
  const { toast } = useToast();
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyForm());
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState('name_asc');

  const loadInterviewers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getInterviewers({
        search: search || undefined, department: deptFilter || undefined,
      });
      setInterviewers(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load interviewers', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [search, deptFilter, toast]);

  useEffect(() => { loadInterviewers(); }, [loadInterviewers]);

  const handleInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.first_name.trim() || !inviteForm.last_name.trim()) return;
    setInviteLoading(true);
    try {
      const specs = inviteForm.specializations.split(',').map(s => s.trim()).filter(Boolean);
      const res = await apiClient.inviteInterviewer({
        email: inviteForm.email.trim(),
        first_name: inviteForm.first_name.trim(),
        last_name: inviteForm.last_name.trim(),
        specializations: specs.length > 0 ? specs : undefined,
        seniority: inviteForm.seniority || undefined,
        department: inviteForm.department.trim() || undefined,
      });
      setInviteUrl(res.invite_url);
      toast({ title: 'Interviewer invited', description: res.message });
      loadInterviewers();
    } catch {
      toast({ title: 'Error', description: 'Failed to invite interviewer', variant: 'destructive' });
    } finally { setInviteLoading(false); }
  };

  const handleToggleActive = async (iv: Interviewer) => {
    const newActive = !iv.is_active;
    try {
      await apiClient.toggleInterviewerStatus(iv.id, newActive);
      setInterviewers(prev => prev.map(i => i.id === iv.id ? { ...i, is_active: newActive } : i));
      toast({ title: 'Status updated', description: `${iv.full_name} is now ${newActive ? 'active' : 'inactive'}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  const resetInviteDialog = () => {
    setShowInvite(false); setInviteForm(emptyForm()); setInviteUrl(''); setCopied(false);
  };

  const getInitials = (first: string, last: string) =>
    `${(first || '?')[0]}${(last || '?')[0]}`.toUpperCase();

  const getAvatarGradient = (id: number) => AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];

  const total = interviewers.length;
  const active = interviewers.filter(i => i.is_active).length;
  const withSpecs = interviewers.filter(i => i.specializations?.length > 0).length;
  const avgRating = interviewers.filter(i => i.avg_rating_given != null).length > 0
    ? interviewers.filter(i => i.avg_rating_given != null).reduce((sum, i) => sum + (i.avg_rating_given ?? 0), 0) /
      interviewers.filter(i => i.avg_rating_given != null).length
    : 0;
  const departments = [...new Set(interviewers.map(i => i.department).filter(Boolean))] as string[];

  const sortedInterviewers = useMemo(() => {
    const sorted = [...interviewers];
    switch (sortBy) {
      case 'name_asc':
        sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
        break;
      case 'name_desc':
        sorted.sort((a, b) => b.full_name.localeCompare(a.full_name));
        break;
      case 'most_interviews':
        sorted.sort((a, b) => (b.total_interviews ?? 0) - (a.total_interviews ?? 0));
        break;
      case 'highest_rating':
        sorted.sort((a, b) => (b.avg_rating_given ?? 0) - (a.avg_rating_given ?? 0));
        break;
      case 'active_first':
        sorted.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));
        break;
    }
    return sorted;
  }, [interviewers, sortBy]);

  const { pageItems, page, total: paginatedTotal, pageSize, totalPages, setPage, setPageSize } =
    useClientPagination(sortedInterviewers, { pageSize: 12 });

  const kpis = [
    {
      label: 'Total Interviewers', value: total, icon: Users,
      iconBg: 'bg-blue-500/15 text-blue-400',
    },
    {
      label: 'Active Panel', value: active, icon: Award,
      iconBg: 'bg-emerald-500/15 text-emerald-400',
    },
    {
      label: 'Avg Rating', value: avgRating, icon: Star, isDecimal: true,
      iconBg: 'bg-amber-500/15 text-amber-400',
    },
    {
      label: 'With Specializations', value: withSpecs, icon: Sparkles,
      iconBg: 'bg-blue-500/15 text-blue-400',
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ── Section Header ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Users className="h-4.5 w-4.5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Interviewer Panel</h1>
            </div>
            <p className="text-slate-400 text-sm ml-[46px]">
              Manage your interviewer panel, track performance, and send invitations
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            <UserPlus className="h-4 w-4" />
            Invite Interviewer
          </button>
        </motion.div>

        {/* ── KPI Cards ────────────────────────────────────────────── */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <motion.div key={kpi.label} variants={scaleIn}>
              <div className="relative overflow-hidden rounded-2xl" style={glassCard}>
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                        {kpi.label}
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-white">
                        <CountingNumber
                          value={kpi.value}
                          decimalPlaces={(kpi as any).isDecimal ? 1 : 0}
                        />
                      </p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                      <kpi.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </StaggerGrid>

        {/* ── Search & Filters ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
              style={glassInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl text-white border-0" style={glassInput}>
              <ArrowUpDown className="h-4 w-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="name_asc" className={sItemCls}>Name A-Z</SelectItem>
              <SelectItem value="name_desc" className={sItemCls}>Name Z-A</SelectItem>
              <SelectItem value="most_interviews" className={sItemCls}>Most Interviews</SelectItem>
              <SelectItem value="highest_rating" className={sItemCls}>Highest Rating</SelectItem>
              <SelectItem value="active_first" className={sItemCls}>Active First</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={v => setDeptFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl text-white border-0" style={glassInput}>
              <Building2 className="h-4 w-4 mr-2 text-slate-500" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="all" className={sItemCls}>All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d} className={sItemCls}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
            <SelectTrigger className="w-full sm:w-[120px] h-10 rounded-xl text-white border-0" style={glassInput}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              <SelectItem value="10" className={sItemCls}>10 / page</SelectItem>
              <SelectItem value="25" className={sItemCls}>25 / page</SelectItem>
              <SelectItem value="50" className={sItemCls}>50 / page</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* ── Interviewer Grid ─────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                <div className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-white/10 rounded" />
                        <div className="h-3 w-48 bg-white/10 rounded" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-5 w-16 bg-white/10 rounded-full" />
                      <div className="h-5 w-20 bg-white/10 rounded-full" />
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex gap-4">
                      <div className="h-3 w-24 bg-white/10 rounded" />
                      <div className="h-3 w-20 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : interviewers.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <div className="rounded-2xl border-2 border-dashed border-white/10 p-16 text-center">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-blue-500/10 mb-4">
                <Users className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">No interviewers found</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
                Get started by inviting interviewers to build your interview panel
              </p>
              <button
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                <UserPlus className="h-4 w-4" />
                Invite Your First Interviewer
              </button>
            </div>
          </motion.div>
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageItems.map((iv) => (
              <motion.div key={iv.id} variants={fadeInUp} whileHover={hoverLift}>
                <div className="rounded-2xl overflow-hidden transition-all duration-300 group" style={glassCard}>
                  {/* Card top accent bar */}
                  <div className={`h-1 bg-gradient-to-r ${iv.is_active ? 'from-emerald-400 to-teal-500' : 'from-gray-500 to-gray-600'}`} />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(iv.id)} text-white text-sm font-bold shadow-lg ring-2 ring-white/10`}>
                        {getInitials(...splitName(iv.full_name))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {iv.full_name}
                          </h3>
                          <Switch
                            checked={iv.is_active}
                            onCheckedChange={() => handleToggleActive(iv)}
                            aria-label={`Toggle ${iv.full_name} active status`}
                          />
                        </div>
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          {iv.email}
                        </p>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      {iv.seniority && (
                        <span
                          className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium border ${SENIORITY_COLORS[iv.seniority] || 'bg-white/5 text-slate-400 border-white/10'}`}
                        >
                          {iv.seniority}
                        </span>
                      )}
                      {iv.department && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/5 text-slate-300 border border-white/10">
                          <Building2 className="h-3 w-3" />
                          {iv.department}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                          iv.is_active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${iv.is_active ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                        {iv.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Specialization badges */}
                    {iv.specializations?.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-4">
                        {iv.specializations.slice(0, 3).map(s => (
                          <span
                            key={s}
                            className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-medium"
                          >
                            {s}
                          </span>
                        ))}
                        {iv.specializations.length > 3 && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            +{iv.specializations.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Stats footer */}
                    <div className="flex items-center gap-5 pt-3.5 border-t border-dashed border-white/10">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span className="font-semibold text-white">{iv.total_interviews ?? 0}</span>
                        interviews
                      </span>
                      {iv.avg_rating_given != null && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          <span className="font-semibold text-white">{iv.avg_rating_given.toFixed(1)}</span>
                          rating
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </StaggerGrid>
        )}

        {!loading && interviewers.length > 0 && (
          <DataPagination
            page={page}
            totalPages={totalPages}
            total={paginatedTotal}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* ── Invite Interviewer Dialog ──────────────────────────────── */}
      <Dialog open={showInvite} onOpenChange={v => { if (!v) resetInviteDialog(); else setShowInvite(true); }}>
        <DialogContent className="sm:max-w-md border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-600 text-white">
                <UserPlus className="h-4 w-4" />
              </div>
              Invite Interviewer
            </DialogTitle>
            <DialogDescription className="text-slate-400">Send an invitation to a new interviewer to join the panel.</DialogDescription>
          </DialogHeader>
          {!inviteUrl ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="inv-first" className="text-xs font-medium text-slate-300">First Name *</label>
                  <input id="inv-first" value={inviteForm.first_name}
                    onChange={e => setInviteForm(f => ({ ...f, first_name: e.target.value }))}
                    placeholder="Jane"
                    className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                    style={glassInput}
                    onFocus={handleFocus} onBlur={handleBlur} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="inv-last" className="text-xs font-medium text-slate-300">Last Name *</label>
                  <input id="inv-last" value={inviteForm.last_name}
                    onChange={e => setInviteForm(f => ({ ...f, last_name: e.target.value }))}
                    placeholder="Smith"
                    className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                    style={glassInput}
                    onFocus={handleFocus} onBlur={handleBlur} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="inv-email" className="text-xs font-medium text-slate-300">Email *</label>
                <input id="inv-email" type="email" value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane.smith@company.com"
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                  onFocus={handleFocus} onBlur={handleBlur} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="inv-specs" className="text-xs font-medium text-slate-300">Specializations</label>
                <input id="inv-specs" value={inviteForm.specializations}
                  onChange={e => setInviteForm(f => ({ ...f, specializations: e.target.value }))}
                  placeholder="React, System Design, Behavioral"
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                  onFocus={handleFocus} onBlur={handleBlur} />
                <p className="text-[11px] text-slate-500">Comma-separated list of interview topics</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="inv-seniority" className="text-xs font-medium text-slate-300">Seniority</label>
                  <Select value={inviteForm.seniority} onValueChange={v => setInviteForm(f => ({ ...f, seniority: v }))}>
                    <SelectTrigger id="inv-seniority" className="h-10 rounded-xl text-white border-0" style={glassInput}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      {SENIORITY_OPTIONS.map(s => <SelectItem key={s} value={s} className={sItemCls}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="inv-dept" className="text-xs font-medium text-slate-300">Department</label>
                  <input id="inv-dept" value={inviteForm.department}
                    onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="Engineering"
                    className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                    style={glassInput}
                    onFocus={handleFocus} onBlur={handleBlur} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm text-emerald-400 font-medium">Invitation created successfully</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">Share this link with the interviewer:</p>
                <div className="flex items-center gap-2">
                  <input value={inviteUrl} readOnly
                    className="flex-1 h-10 px-3 rounded-xl text-xs font-mono outline-none"
                    style={{ ...glassInput, background: 'var(--orbis-card)' }} />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-all hover:text-white"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Copied to clipboard
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {!inviteUrl ? (
              <>
                <button
                  onClick={resetInviteDialog}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading || !inviteForm.email.trim() || !inviteForm.first_name.trim() || !inviteForm.last_name.trim()}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                >
                  {inviteLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Inviting...
                    </span>
                  ) : 'Send Invite'}
                </button>
              </>
            ) : (
              <button
                onClick={resetInviteDialog}
                className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                Done
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
