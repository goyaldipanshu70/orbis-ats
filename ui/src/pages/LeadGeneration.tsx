import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Progress } from '@/components/ui/progress';
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

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SOURCE_COLORS: Record<string, string> = {
  manual: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  ai_discovery: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  csv_import: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  linkedin: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  github: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

const SOURCE_ICONS: Record<string, typeof Globe> = {
  manual: Users,
  ai_discovery: Sparkles,
  csv_import: BarChart3,
  linkedin: Linkedin,
  github: Github,
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  contacted: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  qualified: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  converted: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
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
      bgGlow: 'bg-blue-500/10 dark:bg-blue-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'New Leads',
      value: newLeads,
      icon: Zap,
      gradient: 'from-purple-500 to-purple-600',
      bgGlow: 'bg-purple-500/10 dark:bg-purple-500/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Converted',
      value: convertedLeads,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-emerald-600',
      bgGlow: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Conversion Rate',
      value: conversionRate,
      icon: Target,
      gradient: 'from-amber-500 to-orange-500',
      bgGlow: 'bg-amber-500/10 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      suffix: '%',
    },
  ];

  return (
    <AppLayout>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* ── Page Header ── */}
        <motion.div variants={fadeInUp} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Lead Generation
            </h1>
            <p className="mt-1 text-muted-foreground">
              Discover, organize, and convert candidate leads from multiple platforms
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => { setTab('discover'); }}
              className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 dark:shadow-purple-500/15 rounded-xl h-10 px-5"
            >
              <Sparkles className="h-4 w-4" /> AI Discover
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
              className="gap-2 rounded-xl h-10 px-5 border-dashed"
            >
              <Plus className="h-4 w-4" /> New List
            </Button>
          </div>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, index) => (
            <motion.div
              key={kpi.label}
              variants={fadeInUp}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-shadow duration-300">
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${kpi.bgGlow}`} />
                <CardContent className="p-5 relative">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {kpi.label}
                      </p>
                      <p className="text-3xl font-bold tracking-tight">
                        <CountingNumber value={kpi.value} suffix={kpi.suffix} />
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-xl ${kpi.bgGlow} flex items-center justify-center`}>
                      <kpi.icon className={`h-6 w-6 ${kpi.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <motion.div variants={fadeInUp}>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="lists" className="gap-2 rounded-lg data-[state=active]:shadow-sm px-5">
                <List className="h-4 w-4" /> Lead Lists
              </TabsTrigger>
              <TabsTrigger value="discover" className="gap-2 rounded-lg data-[state=active]:shadow-sm px-5">
                <Sparkles className="h-4 w-4" /> AI Discovery
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Lead Lists ── */}
            <TabsContent value="lists">
              {listsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="rounded-xl animate-pulse">
                      <CardContent className="p-6 h-36">
                        <div className="h-4 w-2/3 bg-muted rounded-lg mb-3" />
                        <div className="h-3 w-full bg-muted rounded-lg mb-2" />
                        <div className="h-3 w-1/2 bg-muted rounded-lg" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (Array.isArray(leadLists) && leadLists.length > 0) ? (
                <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {leadLists.map((list: any) => {
                    const SourceIcon = SOURCE_ICONS[list.source] || Users;
                    return (
                      <motion.div key={list.id} variants={fadeInUp} whileHover={hoverLift}>
                        <Card
                          className="rounded-xl border border-border/60 hover:border-border transition-all duration-300 cursor-pointer h-full flex flex-col group"
                          onClick={() => handleOpenDetail(list)}
                        >
                          <CardContent className="p-5 flex-1 flex flex-col">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                                  <SourceIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-sm font-semibold truncate">{list.name}</h3>
                                  <Badge
                                    variant="outline"
                                    className={`mt-0.5 text-[10px] px-2 py-0 rounded-full font-medium ${SOURCE_COLORS[list.source] || SOURCE_COLORS.manual}`}
                                  >
                                    {(list.source || 'manual').replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {list.description && (
                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">{list.description}</p>
                            )}

                            <div className="flex items-center gap-3 mt-auto pt-3 border-t border-border/40">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                                <Users className="h-3.5 w-3.5" />
                                {list.lead_count ?? list.leads?.length ?? 0} leads
                              </span>
                              {list.created_at && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-auto">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {new Date(list.created_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </StaggerGrid>
              ) : (
                <motion.div variants={fadeInUp}>
                  <Card className="rounded-xl border-dashed border-2">
                    <CardContent className="p-16 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-muted/80 flex items-center justify-center mx-auto mb-4">
                        <Target className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No lead lists yet</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                        Create a list to start organizing your candidate leads, or use AI discovery to find new talent
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-6">
                        <Button className="gap-2 rounded-xl" onClick={() => setShowCreateDialog(true)}>
                          <Plus className="h-4 w-4" /> Create Lead List
                        </Button>
                        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setTab('discover')}>
                          <Sparkles className="h-4 w-4" /> Try AI Discovery
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </TabsContent>

            {/* ── Tab 2: AI Discovery ── */}
            <TabsContent value="discover">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Discovery Form */}
                <motion.div variants={fadeInUp}>
                  <Card className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/5 dark:from-purple-500/20 dark:via-indigo-500/15 dark:to-purple-500/10 px-6 py-4 border-b border-border/40">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        AI Lead Discovery
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Let AI scan platforms to find your ideal candidates
                      </p>
                    </div>

                    <CardContent className="p-6 space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="discover-role" className="text-xs font-medium">Role / Title *</Label>
                        <Input
                          id="discover-role"
                          placeholder="e.g. Senior React Developer"
                          value={discoverForm.role}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, role: e.target.value }))}
                          className="rounded-lg h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="discover-skills" className="text-xs font-medium">Skills (comma-separated)</Label>
                        <Input
                          id="discover-skills"
                          placeholder="e.g. React, TypeScript, Node.js"
                          value={discoverForm.skills}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, skills: e.target.value }))}
                          className="rounded-lg h-10"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="discover-location" className="text-xs font-medium">Location</Label>
                          <Input
                            id="discover-location"
                            placeholder="e.g. San Francisco"
                            value={discoverForm.location}
                            onChange={e => setDiscoverForm(prev => ({ ...prev, location: e.target.value }))}
                            className="rounded-lg h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="discover-exp" className="text-xs font-medium">Min Experience (yrs)</Label>
                          <Input
                            id="discover-exp"
                            type="number"
                            min={0}
                            placeholder="e.g. 3"
                            value={discoverForm.experience_min}
                            onChange={e => setDiscoverForm(prev => ({ ...prev, experience_min: e.target.value }))}
                            className="rounded-lg h-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Platforms</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {PLATFORMS.map(platform => (
                            <label
                              key={platform}
                              className={`flex items-center gap-2.5 text-sm cursor-pointer rounded-lg border px-3 py-2.5 transition-all duration-200 ${
                                discoverForm.platforms.includes(platform)
                                  ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                                  : 'border-border/60 hover:border-border hover:bg-muted/30'
                              }`}
                            >
                              <Checkbox
                                checked={discoverForm.platforms.includes(platform)}
                                onCheckedChange={() => togglePlatform(platform)}
                              />
                              {platform === 'LinkedIn' && <Linkedin className="h-4 w-4 text-blue-600" />}
                              {platform === 'GitHub' && <Github className="h-4 w-4" />}
                              {platform === 'StackOverflow' && <Globe className="h-4 w-4 text-orange-500" />}
                              {platform === 'Job Boards' && <Globe className="h-4 w-4 text-green-500" />}
                              <span className="text-xs font-medium">{platform}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="discover-jd" className="text-xs font-medium">JD Context (optional)</Label>
                        <Textarea
                          id="discover-jd"
                          placeholder="Paste a job description summary for better matching..."
                          value={discoverForm.jd_context}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, jd_context: e.target.value }))}
                          rows={3}
                          className="rounded-lg resize-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="discover-max" className="text-xs font-medium">Max Results</Label>
                        <Input
                          id="discover-max"
                          type="number"
                          min={1}
                          max={100}
                          value={discoverForm.max_results}
                          onChange={e => setDiscoverForm(prev => ({ ...prev, max_results: e.target.value }))}
                          className="rounded-lg h-10"
                        />
                      </div>

                      <Button
                        onClick={handleDiscover}
                        disabled={discovering || !discoverForm.role.trim()}
                        className="w-full gap-2 rounded-xl h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 dark:shadow-purple-500/15"
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
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Discovery Results */}
                <motion.div variants={fadeInUp}>
                  {discoveryResults === null && !discovering && (
                    <Card className="rounded-xl border-dashed border-2 h-full">
                      <CardContent className="p-16 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 flex items-center justify-center mb-5">
                          <Search className="h-10 w-10 text-purple-500/60" />
                        </div>
                        <h3 className="text-lg font-semibold">Ready to Discover</h3>
                        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
                          Fill in the criteria and click Discover Leads to find matching candidates across platforms
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {discovering && (
                    <Card className="rounded-xl h-full">
                      <CardContent className="p-16 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 flex items-center justify-center mb-5">
                          <Loader2 className="h-10 w-10 text-purple-500 animate-spin" />
                        </div>
                        <h3 className="text-lg font-semibold">Searching platforms...</h3>
                        <p className="text-sm text-muted-foreground mt-1.5">
                          AI is scanning for matching candidates
                        </p>
                        <div className="mt-6 w-48">
                          <Progress value={65} className="h-1.5 rounded-full" />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {discoveryResults && discoveryResults.length === 0 && (
                    <Card className="rounded-xl h-full">
                      <CardContent className="p-16 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div className="h-20 w-20 rounded-2xl bg-muted/80 flex items-center justify-center mb-5">
                          <Target className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No leads found</h3>
                        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
                          Try broadening your search criteria or selecting different platforms
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {discoveryResults && discoveryResults.length > 0 && (
                    <Card className="rounded-xl border border-border/60 overflow-hidden">
                      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Check className="h-4 w-4 text-emerald-600" />
                          </div>
                          <h3 className="text-sm font-semibold">
                            {discoveryResults.length} Leads Found
                          </h3>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleSaveDiscoveryResults}
                          disabled={savingResults}
                          className="gap-2 rounded-lg"
                        >
                          {savingResults ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Save All to List
                        </Button>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead className="text-xs font-semibold">Name</TableHead>
                              <TableHead className="text-xs font-semibold">Title</TableHead>
                              <TableHead className="text-xs font-semibold">Company</TableHead>
                              <TableHead className="text-xs font-semibold">Platform</TableHead>
                              <TableHead className="text-xs font-semibold">Relevance</TableHead>
                              <TableHead className="text-xs font-semibold">Skills</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {discoveryResults.map((lead: any, idx: number) => (
                              <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium text-sm">{lead.name || 'N/A'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{lead.title || lead.current_title || '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{lead.company || lead.current_company || '-'}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    {lead.platform === 'LinkedIn' && <Linkedin className="h-3.5 w-3.5 text-blue-600" />}
                                    {lead.platform === 'GitHub' && <Github className="h-3.5 w-3.5" />}
                                    {lead.platform && !['LinkedIn', 'GitHub'].includes(lead.platform) && <Globe className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-medium">{lead.platform || '-'}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {lead.relevance_score != null ? (
                                    <div className="flex items-center gap-2">
                                      <Progress value={lead.relevance_score} className="h-1.5 w-16 rounded-full" />
                                      <span className="text-xs font-medium text-muted-foreground">{lead.relevance_score}%</span>
                                    </div>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {(lead.skills || []).slice(0, 3).map((s: string) => (
                                      <Badge key={s} variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-medium">{s}</Badge>
                                    ))}
                                    {(lead.skills || []).length > 3 && (
                                      <span className="text-[10px] text-muted-foreground font-medium">+{lead.skills.length - 3}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  )}
                </motion.div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      {/* ── Lead List Detail Sheet ── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedList && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-muted/80 flex items-center justify-center">
                    {(() => {
                      const Icon = SOURCE_ICONS[selectedList.source] || Users;
                      return <Icon className="h-5 w-5 text-muted-foreground" />;
                    })()}
                  </div>
                  <div>
                    <span className="block">{selectedList.name}</span>
                    <Badge
                      variant="outline"
                      className={`mt-0.5 text-[10px] px-2 py-0 rounded-full font-medium ${SOURCE_COLORS[selectedList.source] || SOURCE_COLORS.manual}`}
                    >
                      {(selectedList.source || 'manual').replace('_', ' ')}
                    </Badge>
                  </div>
                </SheetTitle>
                {selectedList.description && (
                  <SheetDescription className="mt-1">{selectedList.description}</SheetDescription>
                )}
              </SheetHeader>

              <div className="mt-5 flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-lg"
                  onClick={() => setShowPushDialog(true)}
                >
                  <Send className="h-3.5 w-3.5" /> Push to Campaign
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
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
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800"
                  onClick={() => handleDeleteList(selectedList.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete List
                </Button>
              </div>

              <div className="mt-5 border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs font-semibold">Name</TableHead>
                      <TableHead className="text-xs font-semibold">Email</TableHead>
                      <TableHead className="text-xs font-semibold">Title</TableHead>
                      <TableHead className="text-xs font-semibold">Company</TableHead>
                      <TableHead className="text-xs font-semibold">Location</TableHead>
                      <TableHead className="text-xs font-semibold">Skills</TableHead>
                      <TableHead className="text-xs font-semibold">Relevance</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedList.leads || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground/50" />
                            <span>No leads in this list</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selectedList.leads || []).map((lead: any) => (
                        <TableRow key={lead.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium text-sm">{lead.name || 'N/A'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.email || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.title || lead.current_title || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.company || lead.current_company || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lead.location ? (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-muted-foreground/70" /> {lead.location}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {(lead.skills || []).slice(0, 2).map((s: string) => (
                                <Badge key={s} variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-medium">{s}</Badge>
                              ))}
                              {(lead.skills || []).length > 2 && (
                                <span className="text-[10px] text-muted-foreground font-medium">+{lead.skills.length - 2}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.relevance_score != null ? (
                              <div className="flex items-center gap-1.5">
                                <Progress value={lead.relevance_score} className="h-1.5 w-12 rounded-full" />
                                <span className="text-[10px] text-muted-foreground font-medium">{lead.relevance_score}%</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={lead.status || 'new'}
                              onValueChange={(v) => handleUpdateLeadStatus(lead.id, v)}
                            >
                              <SelectTrigger className="h-7 text-[10px] w-[90px] px-2 rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(STATUS_COLORS).map(s => (
                                  <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                                title={lead.status === 'converted' || addedToPool.has(lead.id) ? 'Already in talent pool' : 'Add to talent pool'}
                                disabled={lead.status === 'converted' || addedToPool.has(lead.id) || addingToPool === lead.id}
                                onClick={() => handleAddToTalentPool(lead.id)}
                              >
                                {addingToPool === lead.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : lead.status === 'converted' || addedToPool.has(lead.id) ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <UserPlus className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                onClick={() => handleDeleteLead(lead.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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

      {/* ── Create Lead List Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              Create Lead List
            </DialogTitle>
            <DialogDescription>Organize your candidate leads into a new list</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="list-name" className="text-xs font-medium">Name *</Label>
              <Input
                id="list-name"
                placeholder="e.g. Senior Engineers Q1"
                value={createForm.name}
                onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-lg h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-desc" className="text-xs font-medium">Description</Label>
              <Textarea
                id="list-desc"
                placeholder="Optional description..."
                value={createForm.description}
                onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-source" className="text-xs font-medium">Source</Label>
              <Select value={createForm.source} onValueChange={v => setCreateForm(prev => ({ ...prev, source: v }))}>
                <SelectTrigger id="list-source" className="rounded-lg h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="csv_import">CSV Import</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-job" className="text-xs font-medium">Link to Job (optional)</Label>
              <Select value={createForm.jd_id} onValueChange={v => setCreateForm(prev => ({ ...prev, jd_id: v === 'none' ? '' : v }))}>
                <SelectTrigger id="list-job" className="rounded-lg h-10">
                  <SelectValue placeholder="Select a job..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No job</SelectItem>
                  {(Array.isArray(availableJobs) ? availableJobs : []).map((j: any) => (
                    <SelectItem key={j.job_id || j.id} value={String(j.job_id || j.id)}>
                      {j.job_title || j.title || `Job ${j.job_id || j.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleCreateList} disabled={creating || !createForm.name.trim()} className="rounded-lg gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Push to Campaign Dialog ── */}
      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Send className="h-4 w-4 text-blue-600" />
              </div>
              Push Leads to Campaign
            </DialogTitle>
            <DialogDescription>Select an outreach campaign to add these leads to</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 mt-2">
            <Label htmlFor="push-campaign" className="text-xs font-medium">Campaign</Label>
            <Select value={pushCampaignId} onValueChange={setPushCampaignId}>
              <SelectTrigger id="push-campaign" className="rounded-lg h-10">
                <SelectValue placeholder="Select campaign..." />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(campaigns) ? campaigns : []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name || c.title || `Campaign ${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowPushDialog(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handlePushToCampaign} disabled={pushing || !pushCampaignId} className="rounded-lg gap-2">
              {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Push to Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
