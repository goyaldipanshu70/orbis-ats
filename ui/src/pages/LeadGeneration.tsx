import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { CountingNumber } from '@/components/ui/counting-number';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { fadeInUp, hoverLift, staggerContainer } from '@/lib/animations';
import { motion } from 'framer-motion';
import {
  Search, Users, Sparkles, Globe, Plus, Trash2, Send, Target,
  Linkedin, Github, MapPin, Briefcase, Clock, ExternalLink, List,
  CalendarDays, ArrowRight, Loader2, UserPlus, Check,
  TrendingUp, Zap, BarChart3, Filter,
} from 'lucide-react';

/* ── Glass Design System ───────────────────────────────── */
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
const sItemCls = 'text-slate-200 focus:bg-white/10 focus:text-white';

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

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  manual:       { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  ai_discovery: { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  csv_import:   { bg: 'rgba(59,130,246,0.15)',   text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  linkedin:     { bg: 'rgba(59,130,246,0.15)',   text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  github:       { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
};

const SOURCE_ICONS: Record<string, typeof Globe> = {
  manual: Users,
  ai_discovery: Sparkles,
  csv_import: BarChart3,
  linkedin: Linkedin,
  github: Github,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new:       { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa' },
  contacted: { bg: 'rgba(234,179,8,0.15)',   text: '#fbbf24' },
  qualified: { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
  converted: { bg: 'rgba(16,185,129,0.15)',  text: '#34d399' },
  rejected:  { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
};

const PLATFORMS = ['LinkedIn', 'GitHub', 'StackOverflow', 'Job Boards'] as const;

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function LeadGeneration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tab state
  const [tab, setTab] = useState('lists');

  // Lead lists
  const [listPage, setListPage] = useState(1);
  const [selectedList, setSelectedList] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Create list dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', source: 'manual', jd_id: '' });
  const [creating, setCreating] = useState(false);

  // Push to campaign dialog
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushCampaignId, setPushCampaignId] = useState('');
  const [pushing, setPushing] = useState(false);

  // AI Discovery form
  const [discoverForm, setDiscoverForm] = useState({
    role: '',
    skills: '',
    location: '',
    experience_min: '',
    platforms: [] as string[],
    jd_context: '',
    max_results: '20',
  });
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<any[] | null>(null);
  const [savingResults, setSavingResults] = useState(false);

  // Add to talent pool
  const [addedToPool, setAddedToPool] = useState<Set<number>>(new Set());
  const [addingToPool, setAddingToPool] = useState<number | null>(null);

  // ---- Data fetching ----

  const { data: statsData } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => apiClient.getLeadStats(),
    staleTime: 30_000,
  });

  const { data: listsData, isLoading: listsLoading } = useQuery({
    queryKey: ['lead-lists', listPage],
    queryFn: () => apiClient.getLeadLists(listPage, 20),
    staleTime: 30_000,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns-for-leads'],
    queryFn: () => apiClient.getCampaigns(1, 100),
    staleTime: 60_000,
  });

  const { data: jobsData } = useQuery({
    queryKey: ['jobs-for-leads'],
    queryFn: () => apiClient.getJobs(1, 100),
    staleTime: 60_000,
  });

  const leadLists = listsData?.items ?? [];
  const campaigns = campaignsData?.items ?? [];
  const availableJobs = jobsData?.items ?? [];

  const totalLeads = statsData?.total_leads ?? 0;
  const newLeads = statsData?.new_leads ?? 0;
  const convertedLeads = statsData?.converted_leads ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // ---- Handlers ----

  const handleCreateList = async () => {
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      await apiClient.createLeadList({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        source: createForm.source || undefined,
        jd_id: createForm.jd_id ? Number(createForm.jd_id) : undefined,
      });
      toast({ title: 'Success', description: 'Lead list created' });
      setShowCreateDialog(false);
      setCreateForm({ name: '', description: '', source: 'manual', jd_id: '' });
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to create lead list', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (!confirm('Are you sure you want to delete this lead list? This cannot be undone.')) return;
    try {
      await apiClient.deleteLeadList(listId);
      toast({ title: 'Success', description: 'Lead list deleted' });
      setDetailOpen(false);
      setSelectedList(null);
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete lead list', variant: 'destructive' });
    }
  };

  const handleOpenDetail = async (list: any) => {
    try {
      const full = await apiClient.getLeadList(list.id);
      setSelectedList(full);
      setDetailOpen(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to load lead list details', variant: 'destructive' });
    }
  };

  const handleUpdateLeadStatus = async (leadId: number, status: string) => {
    try {
      await apiClient.updateLead(leadId, { status });
      toast({ title: 'Status updated' });
      // Refresh detail
      if (selectedList) {
        const refreshed = await apiClient.getLeadList(selectedList.id);
        setSelectedList(refreshed);
      }
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to update lead', variant: 'destructive' });
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    try {
      await apiClient.deleteLead(leadId);
      toast({ title: 'Lead removed' });
      if (selectedList) {
        const refreshed = await apiClient.getLeadList(selectedList.id);
        setSelectedList(refreshed);
      }
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete lead', variant: 'destructive' });
    }
  };

  const handlePushToCampaign = async () => {
    if (!selectedList || !pushCampaignId) return;
    setPushing(true);
    try {
      await apiClient.pushLeadsToCampaign(selectedList.id, Number(pushCampaignId));
      toast({ title: 'Success', description: 'Leads pushed to campaign' });
      setShowPushDialog(false);
      setPushCampaignId('');
    } catch {
      toast({ title: 'Error', description: 'Failed to push leads to campaign', variant: 'destructive' });
    } finally {
      setPushing(false);
    }
  };

  const handleDiscover = async () => {
    if (!discoverForm.role.trim()) return;
    setDiscovering(true);
    setDiscoveryResults(null);
    try {
      const skills = discoverForm.skills.trim()
        ? discoverForm.skills.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      const res = await apiClient.discoverLeads({
        role: discoverForm.role.trim(),
        skills,
        location: discoverForm.location.trim() || undefined,
        experience_min: discoverForm.experience_min ? Number(discoverForm.experience_min) : undefined,
        platforms: discoverForm.platforms.length > 0 ? discoverForm.platforms : undefined,
        jd_context: discoverForm.jd_context.trim() || undefined,
        max_results: Number(discoverForm.max_results) || 20,
      });
      setDiscoveryResults(res?.leads ?? res?.results ?? res ?? []);
      toast({ title: 'Discovery complete', description: `Found ${(res?.leads ?? res?.results ?? res ?? []).length} leads` });
    } catch {
      toast({ title: 'Error', description: 'AI discovery failed. Please try again.', variant: 'destructive' });
    } finally {
      setDiscovering(false);
    }
  };

  const handleSaveDiscoveryResults = async () => {
    if (!discoveryResults || discoveryResults.length === 0) return;
    setSavingResults(true);
    try {
      const newList = await apiClient.createLeadList({
        name: `AI Discovery - ${discoverForm.role} (${new Date().toLocaleDateString()})`,
        source: 'ai_discovery',
      });
      const listId = newList?.id ?? newList?.list_id;
      if (listId) {
        await apiClient.addLeadsToList(listId, discoveryResults);
      }
      toast({ title: 'Success', description: 'Leads saved to new list' });
      setDiscoveryResults(null);
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setTab('lists');
    } catch {
      toast({ title: 'Error', description: 'Failed to save discovery results', variant: 'destructive' });
    } finally {
      setSavingResults(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setDiscoverForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const handleAddToTalentPool = async (leadId: number) => {
    setAddingToPool(leadId);
    try {
      const res = await apiClient.addLeadToTalentPool(leadId);
      setAddedToPool(prev => new Set(prev).add(leadId));
      toast({ title: res.was_existing ? 'Already in talent pool' : 'Added to talent pool', description: res.message });
      // Refresh detail to reflect converted status
      if (selectedList) {
        const refreshed = await apiClient.getLeadList(selectedList.id);
        setSelectedList(refreshed);
      }
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to add lead to talent pool', variant: 'destructive' });
    } finally {
      setAddingToPool(null);
    }
  };

  // ---- Render ----

  const kpiCards = [
    {
      label: 'Total Leads',
      value: totalLeads,
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      glow: 'rgba(59,130,246,0.15)',
      iconColor: '#60a5fa',
    },
    {
      label: 'New Leads',
      value: newLeads,
      icon: Zap,
      gradient: 'from-blue-500 to-blue-600',
      glow: 'rgba(168,85,247,0.15)',
      iconColor: '#c084fc',
    },
    {
      label: 'Converted',
      value: convertedLeads,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-emerald-600',
      glow: 'rgba(16,185,129,0.15)',
      iconColor: '#34d399',
    },
    {
      label: 'Conversion Rate',
      value: conversionRate,
      icon: Target,
      gradient: 'from-amber-500 to-orange-500',
      glow: 'rgba(245,158,11,0.15)',
      iconColor: '#fbbf24',
      suffix: '%',
    },
  ];

  /* helper: dark badge span */
  const SourceBadge = ({ source }: { source: string }) => {
    const c = SOURCE_COLORS[source] || SOURCE_COLORS.manual;
    return (
      <span
        className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
      >
        {(source || 'manual').replace('_', ' ')}
      </span>
    );
  };

  const SkillBadge = ({ label }: { label: string }) => (
    <span
      className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}
    >
      {label}
    </span>
  );

  return (
    <AppLayout>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* -- Page Header -- */}
        <motion.div variants={fadeInUp} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Lead Generation
            </h1>
            <p className="mt-1 text-slate-400">
              Discover, organize, and convert candidate leads from multiple platforms
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setTab('discover'); }}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 shadow-lg shadow-blue-500/20 transition-all"
            >
              <Sparkles className="h-4 w-4" /> AI Discover
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors border border-dashed"
              style={{ background: 'var(--orbis-card)', borderColor: 'var(--orbis-border-strong)' }}
            >
              <Plus className="h-4 w-4" /> New List
            </button>
          </div>
        </motion.div>

        {/* -- KPI Cards -- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <motion.div
              key={kpi.label}
              variants={fadeInUp}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <div
                className="rounded-xl overflow-hidden relative group hover:shadow-lg hover:shadow-black/20 transition-shadow duration-300"
                style={glassCard}
              >
                <div className="p-5 relative">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {kpi.label}
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-white">
                        <CountingNumber value={kpi.value} suffix={kpi.suffix} />
                      </p>
                    </div>
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center"
                      style={{ background: kpi.glow }}
                    >
                      <kpi.icon className="h-6 w-6" style={{ color: kpi.iconColor }} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* -- Tabs -- */}
        <motion.div variants={fadeInUp}>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 p-1 rounded-xl" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
              <TabsTrigger value="lists" className="gap-2 rounded-lg px-5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <List className="h-4 w-4" /> Lead Lists
              </TabsTrigger>
              <TabsTrigger value="discover" className="gap-2 rounded-lg px-5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <Sparkles className="h-4 w-4" /> AI Discovery
              </TabsTrigger>
            </TabsList>

            {/* -- Tab 1: Lead Lists -- */}
            <TabsContent value="lists">
              {listsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl animate-pulse" style={glassCard}>
                      <div className="p-6 h-36">
                        <div className="h-4 w-2/3 rounded-lg mb-3" style={{ background: 'var(--orbis-hover)' }} />
                        <div className="h-3 w-full rounded-lg mb-2" style={{ background: 'var(--orbis-border)' }} />
                        <div className="h-3 w-1/2 rounded-lg" style={{ background: 'var(--orbis-border)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (Array.isArray(leadLists) && leadLists.length > 0) ? (
                <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {leadLists.map((list: any) => {
                    const SourceIcon = SOURCE_ICONS[list.source] || Users;
                    return (
                      <motion.div key={list.id} variants={fadeInUp} whileHover={hoverLift}>
                        <div
                          className="rounded-xl transition-all duration-300 cursor-pointer h-full flex flex-col group hover:shadow-lg hover:shadow-black/20"
                          style={{ ...glassCard }}
                          onClick={() => handleOpenDetail(list)}
                        >
                          <div className="p-5 flex-1 flex flex-col">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500/15 transition-colors"
                                  style={{ background: 'var(--orbis-border)' }}
                                >
                                  <SourceIcon className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-sm font-semibold text-white truncate">{list.name}</h3>
                                  <div className="mt-0.5">
                                    <SourceBadge source={list.source} />
                                  </div>
                                </div>
                              </div>
                              <button
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {list.description && (
                              <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{list.description}</p>
                            )}

                            <div className="flex items-center gap-3 mt-auto pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                                <Users className="h-3.5 w-3.5" />
                                {list.lead_count ?? list.leads?.length ?? 0} leads
                              </span>
                              {list.created_at && (
                                <span className="text-xs text-slate-500 flex items-center gap-1.5 ml-auto">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {new Date(list.created_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </StaggerGrid>
              ) : (
                <motion.div variants={fadeInUp}>
                  <div
                    className="rounded-xl border-2 border-dashed"
                    style={{ background: 'var(--orbis-subtle)', borderColor: 'var(--orbis-border)' }}
                  >
                    <div className="p-16 text-center">
                      <div
                        className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'var(--orbis-border)' }}
                      >
                        <Target className="h-8 w-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">No lead lists yet</h3>
                      <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
                        Create a list to start organizing your candidate leads, or use AI discovery to find new talent
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-6">
                        <button
                          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 transition-all"
                          onClick={() => setShowCreateDialog(true)}
                        >
                          <Plus className="h-4 w-4" /> Create Lead List
                        </button>
                        <button
                          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
                          style={{ ...glassCard }}
                          onClick={() => setTab('discover')}
                        >
                          <Sparkles className="h-4 w-4" /> Try AI Discovery
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </TabsContent>

            {/* -- Tab 2: AI Discovery -- */}
            <TabsContent value="discover">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Discovery Form */}
                <motion.div variants={fadeInUp}>
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div
                      className="px-6 py-4"
                      style={{ background: 'linear-gradient(to right, rgba(168,85,247,0.12), rgba(22,118,192,0.10), rgba(168,85,247,0.06))', borderBottom: '1px solid var(--orbis-border)' }}
                    >
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        AI Lead Discovery
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Let AI scan platforms to find your ideal candidates
                      </p>
                    </div>

                    <div className="p-6 space-y-5">
                      <div className="space-y-1.5">
                        <label htmlFor="discover-role" className="text-xs font-medium text-slate-400">Role / Title *</label>
                        <input
                          id="discover-role"
                          placeholder="e.g. Senior React Developer"
                          value={discoverForm.role}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, role: e.target.value }))}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          className="w-full h-10 px-3 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all"
                          style={glassInput}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="discover-skills" className="text-xs font-medium text-slate-400">Skills (comma-separated)</label>
                        <input
                          id="discover-skills"
                          placeholder="e.g. React, TypeScript, Node.js"
                          value={discoverForm.skills}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, skills: e.target.value }))}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          className="w-full h-10 px-3 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all"
                          style={glassInput}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor="discover-location" className="text-xs font-medium text-slate-400">Location</label>
                          <input
                            id="discover-location"
                            placeholder="e.g. San Francisco"
                            value={discoverForm.location}
                            onChange={e => setDiscoverForm(prev => ({ ...prev, location: e.target.value }))}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            className="w-full h-10 px-3 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all"
                            style={glassInput}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="discover-exp" className="text-xs font-medium text-slate-400">Min Experience (yrs)</label>
                          <input
                            id="discover-exp"
                            type="number"
                            min={0}
                            placeholder="e.g. 3"
                            value={discoverForm.experience_min}
                            onChange={e => setDiscoverForm(prev => ({ ...prev, experience_min: e.target.value }))}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            className="w-full h-10 px-3 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all"
                            style={glassInput}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">Platforms</label>
                        <div className="grid grid-cols-2 gap-2">
                          {PLATFORMS.map(platform => {
                            const active = discoverForm.platforms.includes(platform);
                            return (
                              <label
                                key={platform}
                                className="flex items-center gap-2.5 text-sm cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200"
                                style={{
                                  background: active ? 'rgba(168,85,247,0.1)' : 'transparent',
                                  border: `1px solid ${active ? 'rgba(168,85,247,0.35)' : 'var(--orbis-hover)'}`,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => togglePlatform(platform)}
                                  className="rounded accent-blue-500"
                                />
                                {platform === 'LinkedIn' && <Linkedin className="h-4 w-4 text-blue-400" />}
                                {platform === 'GitHub' && <Github className="h-4 w-4 text-slate-300" />}
                                {platform === 'StackOverflow' && <Globe className="h-4 w-4 text-orange-400" />}
                                {platform === 'Job Boards' && <Globe className="h-4 w-4 text-green-400" />}
                                <span className="text-xs font-medium text-slate-300">{platform}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="discover-jd" className="text-xs font-medium text-slate-400">JD Context (optional)</label>
                        <textarea
                          id="discover-jd"
                          placeholder="Paste a job description summary for better matching..."
                          value={discoverForm.jd_context}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, jd_context: e.target.value }))}
                          rows={3}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          className="w-full px-3 py-2 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all resize-none"
                          style={glassInput}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="discover-max" className="text-xs font-medium text-slate-400">Max Results</label>
                        <input
                          id="discover-max"
                          type="number"
                          min={1}
                          max={100}
                          value={discoverForm.max_results}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, max_results: e.target.value }))}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          className="w-full h-10 px-3 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all"
                          style={glassInput}
                        />
                      </div>

                      <button
                        onClick={handleDiscover}
                        disabled={discovering || !discoverForm.role.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl h-11 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {discovering ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Discovering...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4" /> Discover Leads
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Discovery Results */}
                <motion.div variants={fadeInUp}>
                  {discoveryResults === null && !discovering && (
                    <div
                      className="rounded-xl border-2 border-dashed h-full"
                      style={{ background: 'var(--orbis-subtle)', borderColor: 'var(--orbis-border)' }}
                    >
                      <div className="p-16 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div
                          className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5"
                          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(22,118,192,0.12))' }}
                        >
                          <Search className="h-10 w-10 text-blue-400/60" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Ready to Discover</h3>
                        <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
                          Fill in the criteria and click Discover Leads to find matching candidates across platforms
                        </p>
                      </div>
                    </div>
                  )}

                  {discovering && (
                    <div className="rounded-xl h-full" style={glassCard}>
                      <div className="p-16 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div
                          className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5"
                          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(22,118,192,0.12))' }}
                        >
                          <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Searching platforms...</h3>
                        <p className="text-sm text-slate-400 mt-1.5">
                          AI is scanning for matching candidates
                        </p>
                        <div className="mt-6 w-48">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-hover)' }}>
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-500 animate-pulse" style={{ width: '65%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {discoveryResults && discoveryResults.length === 0 && (
                    <div className="rounded-xl h-full" style={glassCard}>
                      <div className="p-16 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div
                          className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5"
                          style={{ background: 'var(--orbis-border)' }}
                        >
                          <Target className="h-10 w-10 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">No leads found</h3>
                        <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
                          Try broadening your search criteria or selecting different platforms
                        </p>
                      </div>
                    </div>
                  )}

                  {discoveryResults && discoveryResults.length > 0 && (
                    <div className="rounded-xl overflow-hidden" style={glassCard}>
                      <div
                        className="px-5 py-4 flex items-center justify-between"
                        style={{ background: 'var(--orbis-card)', borderBottom: '1px solid var(--orbis-border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
                            <Check className="h-4 w-4 text-emerald-400" />
                          </div>
                          <h3 className="text-sm font-semibold text-white">
                            {discoveryResults.length} Leads Found
                          </h3>
                        </div>
                        <button
                          onClick={handleSaveDiscoveryResults}
                          disabled={savingResults}
                          className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 transition-all disabled:opacity-50"
                        >
                          {savingResults ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Save All to List
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow style={{ background: 'var(--orbis-card)' }}>
                              <TableHead className="text-xs font-semibold text-slate-400">Name</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-400">Title</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-400">Company</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-400">Platform</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-400">Relevance</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-400">Skills</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {discoveryResults.map((lead: any, idx: number) => (
                              <TableRow key={idx} className="hover:bg-white/[0.03] transition-colors" style={{ borderBottom: '1px solid var(--orbis-input)' }}>
                                <TableCell className="font-medium text-sm text-white">{lead.name || 'N/A'}</TableCell>
                                <TableCell className="text-sm text-slate-400">{lead.title || lead.current_title || '-'}</TableCell>
                                <TableCell className="text-sm text-slate-400">{lead.company || lead.current_company || '-'}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    {lead.platform === 'LinkedIn' && <Linkedin className="h-3.5 w-3.5 text-blue-400" />}
                                    {lead.platform === 'GitHub' && <Github className="h-3.5 w-3.5 text-slate-300" />}
                                    {lead.platform && !['LinkedIn', 'GitHub'].includes(lead.platform) && <Globe className="h-3.5 w-3.5 text-slate-400" />}
                                    <span className="text-xs font-medium text-slate-300">{lead.platform || '-'}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {lead.relevance_score != null ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: 'var(--orbis-hover)' }}>
                                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-500" style={{ width: `${lead.relevance_score}%` }} />
                                      </div>
                                      <span className="text-xs font-medium text-slate-400">{lead.relevance_score}%</span>
                                    </div>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {(lead.skills || []).slice(0, 3).map((s: string) => (
                                      <SkillBadge key={s} label={s} />
                                    ))}
                                    {(lead.skills || []).length > 3 && (
                                      <span className="text-[10px] text-slate-500 font-medium">+{lead.skills.length - 3}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      {/* -- Lead List Detail Sheet -- */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto" style={{ background: '#0d0a1a', borderLeft: '1px solid var(--orbis-hover)' }}>
          {selectedList && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3 text-white">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--orbis-border)' }}
                  >
                    {(() => {
                      const Icon = SOURCE_ICONS[selectedList.source] || Users;
                      return <Icon className="h-5 w-5 text-slate-400" />;
                    })()}
                  </div>
                  <div>
                    <span className="block">{selectedList.name}</span>
                    <div className="mt-0.5">
                      <SourceBadge source={selectedList.source} />
                    </div>
                  </div>
                </SheetTitle>
                {selectedList.description && (
                  <SheetDescription className="mt-1 text-slate-400">{selectedList.description}</SheetDescription>
                )}
              </SheetHeader>

              <div className="mt-5 flex items-center gap-2 flex-wrap">
                <button
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
                  style={glassCard}
                  onClick={() => setShowPushDialog(true)}
                >
                  <Send className="h-3.5 w-3.5" /> Push to Campaign
                </button>
                <button
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                  disabled={!(selectedList?.leads?.length)}
                  onClick={async () => {
                    const unconverted = (selectedList?.leads || []).filter(
                      (l: any) => l.status !== 'converted' && !addedToPool.has(l.id)
                    );
                    if (unconverted.length === 0) {
                      toast({ title: 'All leads already in talent pool' });
                      return;
                    }
                    for (const lead of unconverted) {
                      await handleAddToTalentPool(lead.id);
                    }
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add All to Talent Pool
                </button>
                <button
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  onClick={() => handleDeleteList(selectedList.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete List
                </button>
              </div>

              <div className="mt-5 rounded-xl overflow-hidden" style={{ border: '1px solid var(--orbis-hover)' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: 'var(--orbis-card)' }}>
                      <TableHead className="text-xs font-semibold text-slate-400">Name</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Email</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Title</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Company</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Location</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Skills</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Relevance</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400 w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedList.leads || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-slate-400" />
                            <span>No leads in this list</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selectedList.leads || []).map((lead: any) => (
                        <TableRow key={lead.id} className="hover:bg-white/[0.03] transition-colors" style={{ borderBottom: '1px solid var(--orbis-input)' }}>
                          <TableCell className="font-medium text-sm text-white">{lead.name || 'N/A'}</TableCell>
                          <TableCell className="text-sm text-slate-400">{lead.email || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-400">{lead.title || lead.current_title || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-400">{lead.company || lead.current_company || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-400">
                            {lead.location ? (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-slate-500" /> {lead.location}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {(lead.skills || []).slice(0, 2).map((s: string) => (
                                <SkillBadge key={s} label={s} />
                              ))}
                              {(lead.skills || []).length > 2 && (
                                <span className="text-[10px] text-slate-500 font-medium">+{lead.skills.length - 2}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.relevance_score != null ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-12 rounded-full overflow-hidden" style={{ background: 'var(--orbis-hover)' }}>
                                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-500" style={{ width: `${lead.relevance_score}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium">{lead.relevance_score}%</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={lead.status || 'new'}
                              onValueChange={(v) => handleUpdateLeadStatus(lead.id, v)}
                            >
                              <SelectTrigger
                                className="h-7 text-[10px] w-[90px] px-2 rounded-lg text-slate-300"
                                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent style={selectDrop}>
                                {Object.keys(STATUS_COLORS).map(s => (
                                  <SelectItem key={s} value={s} className={`text-xs capitalize ${sItemCls}`}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <button
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-400 transition-colors"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                title={lead.status === 'converted' || addedToPool.has(lead.id) ? 'Already in talent pool' : 'Add to talent pool'}
                                disabled={lead.status === 'converted' || addedToPool.has(lead.id) || addingToPool === lead.id}
                                onClick={() => handleAddToTalentPool(lead.id)}
                              >
                                {addingToPool === lead.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : lead.status === 'converted' || addedToPool.has(lead.id) ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <UserPlus className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                onClick={() => handleDeleteLead(lead.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* -- Create Lead List Dialog -- */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-xl" style={{ background: '#0d0a1a', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.12)' }}>
                <Plus className="h-4 w-4 text-blue-400" />
              </div>
              Create Lead List
            </DialogTitle>
            <DialogDescription className="text-slate-400">Organize your candidate leads into a new list</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label htmlFor="list-name" className="text-xs font-medium text-slate-400">Name *</label>
              <input
                id="list-name"
                placeholder="e.g. Senior Engineers Q1"
                value={createForm.name}
                onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full h-10 px-3 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all"
                style={glassInput}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="list-desc" className="text-xs font-medium text-slate-400">Description</label>
              <textarea
                id="list-desc"
                placeholder="Optional description..."
                value={createForm.description}
                onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full px-3 py-2 rounded-lg text-sm placeholder:text-slate-500 outline-none transition-all resize-none"
                style={glassInput}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="list-source" className="text-xs font-medium text-slate-400">Source</label>
              <Select value={createForm.source} onValueChange={v => setCreateForm(prev => ({ ...prev, source: v }))}>
                <SelectTrigger id="list-source" className="rounded-lg h-10 text-slate-300" style={glassInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={selectDrop}>
                  <SelectItem value="manual" className={sItemCls}>Manual</SelectItem>
                  <SelectItem value="csv_import" className={sItemCls}>CSV Import</SelectItem>
                  <SelectItem value="linkedin" className={sItemCls}>LinkedIn</SelectItem>
                  <SelectItem value="github" className={sItemCls}>GitHub</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="list-job" className="text-xs font-medium text-slate-400">Link to Job (optional)</label>
              <Select value={createForm.jd_id} onValueChange={v => setCreateForm(prev => ({ ...prev, jd_id: v === 'none' ? '' : v }))}>
                <SelectTrigger id="list-job" className="rounded-lg h-10 text-slate-300" style={glassInput}>
                  <SelectValue placeholder="Select a job..." />
                </SelectTrigger>
                <SelectContent style={selectDrop}>
                  <SelectItem value="none" className={sItemCls}>No job</SelectItem>
                  {(Array.isArray(availableJobs) ? availableJobs : []).map((j: any) => (
                    <SelectItem key={j.job_id || j.id} value={String(j.job_id || j.id)} className={sItemCls}>
                      {j.job_title || j.title || `Job ${j.job_id || j.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <button
              onClick={() => setShowCreateDialog(false)}
              className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={glassCard}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateList}
              disabled={creating || !createForm.name.trim()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create List
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Push to Campaign Dialog -- */}
      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent className="rounded-xl" style={{ background: '#0d0a1a', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Send className="h-4 w-4 text-blue-400" />
              </div>
              Push Leads to Campaign
            </DialogTitle>
            <DialogDescription className="text-slate-400">Select an outreach campaign to add these leads to</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 mt-2">
            <label htmlFor="push-campaign" className="text-xs font-medium text-slate-400">Campaign</label>
            <Select value={pushCampaignId} onValueChange={setPushCampaignId}>
              <SelectTrigger id="push-campaign" className="rounded-lg h-10 text-slate-300" style={glassInput}>
                <SelectValue placeholder="Select campaign..." />
              </SelectTrigger>
              <SelectContent style={selectDrop}>
                {(Array.isArray(campaigns) ? campaigns : []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)} className={sItemCls}>
                    {c.name || c.title || `Campaign ${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-2">
            <button
              onClick={() => setShowPushDialog(false)}
              className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={glassCard}
            >
              Cancel
            </button>
            <button
              onClick={handlePushToCampaign}
              disabled={pushing || !pushCampaignId}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Push to Campaign
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
