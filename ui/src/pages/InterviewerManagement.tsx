import { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'] as const;
const SENIORITY_COLORS: Record<string, string> = {
  Junior: 'bg-sky-50 text-sky-700 border-sky-200',
  Mid: 'bg-blue-50 text-blue-700 border-blue-200',
  Senior: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Lead: 'bg-violet-50 text-violet-700 border-violet-200',
  Principal: 'bg-purple-50 text-purple-700 border-purple-200',
};

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
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
      gradient: 'from-blue-500/10 to-indigo-500/10',
      iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
    },
    {
      label: 'Active Panel', value: active, icon: Award,
      gradient: 'from-emerald-500/10 to-teal-500/10',
      iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
    },
    {
      label: 'Avg Rating', value: avgRating, icon: Star, isDecimal: true,
      gradient: 'from-amber-500/10 to-orange-500/10',
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
    },
    {
      label: 'With Specializations', value: withSpecs, icon: Sparkles,
      gradient: 'from-violet-500/10 to-purple-500/10',
      iconBg: 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400',
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
                <Users className="h-4.5 w-4.5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Interviewer Panel</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-[46px]">
              Manage your interviewer panel, track performance, and send invitations
            </p>
          </div>
          <Button
            onClick={() => setShowInvite(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Invite Interviewer
          </Button>
        </motion.div>

        {/* ── KPI Cards ────────────────────────────────────────────── */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <motion.div key={kpi.label} variants={scaleIn}>
              <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} pointer-events-none`} />
                <CardContent className="relative p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        {kpi.label}
                      </p>
                      <p className="text-3xl font-bold tracking-tight">
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
                </CardContent>
              </Card>
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl border-muted-foreground/20 bg-background/80 backdrop-blur-sm focus-visible:ring-blue-500/30"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl border-muted-foreground/20">
              <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
              <SelectItem value="most_interviews">Most Interviews</SelectItem>
              <SelectItem value="highest_rating">Highest Rating</SelectItem>
              <SelectItem value="active_first">Active First</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={v => setDeptFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl border-muted-foreground/20">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
            <SelectTrigger className="w-full sm:w-[120px] h-10 rounded-xl border-muted-foreground/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* ── Interviewer Grid ─────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-48 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-5 w-16 bg-muted rounded-full" />
                      <div className="h-5 w-20 bg-muted rounded-full" />
                    </div>
                    <div className="h-px bg-muted" />
                    <div className="flex gap-4">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-3 w-20 bg-muted rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : interviewers.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <Card className="rounded-2xl border-dashed border-2 border-muted-foreground/20">
              <CardContent className="p-16 text-center">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 mb-4">
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No interviewers found</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Get started by inviting interviewers to build your interview panel
                </p>
                <Button
                  onClick={() => setShowInvite(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite Your First Interviewer
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageItems.map((iv) => (
              <motion.div key={iv.id} variants={fadeInUp} whileHover={hoverLift}>
                <Card className="rounded-2xl border-0 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
                  <CardContent className="p-0">
                    {/* Card top accent bar */}
                    <div className={`h-1 bg-gradient-to-r ${iv.is_active ? 'from-emerald-400 to-teal-500' : 'from-gray-300 to-gray-400'}`} />

                    <div className="p-5">
                      {/* Header row */}
                      <div className="flex items-start gap-3.5 mb-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(iv.id)} text-white text-sm font-bold shadow-lg ring-2 ring-white dark:ring-gray-800`}>
                          {getInitials(...splitName(iv.full_name))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold truncate">
                              {iv.full_name}
                            </h3>
                            <Switch
                              checked={iv.is_active}
                              onCheckedChange={() => handleToggleActive(iv)}
                              aria-label={`Toggle ${iv.full_name} active status`}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            {iv.email}
                          </p>
                        </div>
                      </div>

                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        {iv.seniority && (
                          <Badge
                            variant="outline"
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${SENIORITY_COLORS[iv.seniority] || 'bg-muted text-foreground'}`}
                          >
                            {iv.seniority}
                          </Badge>
                        )}
                        {iv.department && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 rounded-full font-medium gap-1">
                            <Building2 className="h-3 w-3" />
                            {iv.department}
                          </Badge>
                        )}
                        <Badge
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            iv.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                              : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                          }`}
                          variant="outline"
                        >
                          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${iv.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {iv.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      {/* Specialization badges */}
                      {iv.specializations?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-4">
                          {iv.specializations.slice(0, 3).map(s => (
                            <Badge
                              key={s}
                              variant="secondary"
                              className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border-0 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              {s}
                            </Badge>
                          ))}
                          {iv.specializations.length > 3 && (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              +{iv.specializations.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Stats footer */}
                      <div className="flex items-center gap-5 pt-3.5 border-t border-dashed border-muted-foreground/15">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" />
                          <span className="font-semibold text-foreground">{iv.total_interviews ?? 0}</span>
                          interviews
                        </span>
                        {iv.avg_rating_given != null && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            <span className="font-semibold text-foreground">{iv.avg_rating_given.toFixed(1)}</span>
                            rating
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                <UserPlus className="h-4 w-4" />
              </div>
              Invite Interviewer
            </DialogTitle>
            <DialogDescription>Send an invitation to a new interviewer to join the panel.</DialogDescription>
          </DialogHeader>
          {!inviteUrl ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-first" className="text-xs font-medium">First Name *</Label>
                  <Input id="inv-first" value={inviteForm.first_name}
                    onChange={e => setInviteForm(f => ({ ...f, first_name: e.target.value }))}
                    placeholder="Jane" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-last" className="text-xs font-medium">Last Name *</Label>
                  <Input id="inv-last" value={inviteForm.last_name}
                    onChange={e => setInviteForm(f => ({ ...f, last_name: e.target.value }))}
                    placeholder="Smith" className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-email" className="text-xs font-medium">Email *</Label>
                <Input id="inv-email" type="email" value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane.smith@company.com" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-specs" className="text-xs font-medium">Specializations</Label>
                <Input id="inv-specs" value={inviteForm.specializations}
                  onChange={e => setInviteForm(f => ({ ...f, specializations: e.target.value }))}
                  placeholder="React, System Design, Behavioral" className="rounded-xl" />
                <p className="text-[11px] text-muted-foreground">Comma-separated list of interview topics</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-seniority" className="text-xs font-medium">Seniority</Label>
                  <Select value={inviteForm.seniority} onValueChange={v => setInviteForm(f => ({ ...f, seniority: v }))}>
                    <SelectTrigger id="inv-seniority" className="rounded-xl"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {SENIORITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-dept" className="text-xs font-medium">Department</Label>
                  <Input id="inv-dept" value={inviteForm.department}
                    onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="Engineering" className="rounded-xl" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Invitation created successfully</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Share this link with the interviewer:</p>
                <div className="flex items-center gap-2">
                  <Input value={inviteUrl} readOnly className="text-xs font-mono rounded-xl bg-muted/50" />
                  <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0 rounded-xl h-10 w-10">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {copied && (
                  <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Copied to clipboard
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {!inviteUrl ? (
              <>
                <Button variant="outline" onClick={resetInviteDialog} className="rounded-xl">Cancel</Button>
                <Button onClick={handleInvite}
                  disabled={inviteLoading || !inviteForm.email.trim() || !inviteForm.first_name.trim() || !inviteForm.last_name.trim()}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                  {inviteLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Inviting...
                    </span>
                  ) : 'Send Invite'}
                </Button>
              </>
            ) : (
              <Button onClick={resetInviteDialog} className="rounded-xl">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
