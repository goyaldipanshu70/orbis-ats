import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { CountingNumber } from '@/components/ui/counting-number';
import { Fade } from '@/components/ui/fade';
import { fadeInUp, scaleIn, hoverLift, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import {
  Mail, Send, Zap, Plus, Eye, MousePointerClick, Reply, Clock,
  ArrowRight, Trash2, Pencil, ToggleLeft, ChevronRight, Megaphone,
  Users, BarChart3, Linkedin, AlertTriangle, PenSquare,
} from 'lucide-react';
import EmailComposerModal from '@/components/EmailComposerModal';
import AddRecipientsModal from '@/components/AddRecipientsModal';
import { useClientPagination } from '@/hooks/useClientPagination';
import { DataPagination } from '@/components/DataPagination';
import { Search, ArrowUpDown } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface Campaign {
  id: number;
  name: string;
  status: string;
  jd_id?: number;
  job_title?: string;
  template_subject: string;
  template_body: string;
  campaign_type: string;
  recipient_count: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
}

interface CampaignDetail extends Campaign {
  replied_count: number;
  steps?: CampaignStep[];
  recipients?: Recipient[];
}

interface CampaignStep {
  id: number;
  step_number: number;
  delay_days: number;
  subject: string;
  body: string;
}

interface Recipient {
  id: number;
  name: string;
  email: string;
  status: string;
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
}

interface StageAutomation {
  id: number;
  jd_id: number;
  job_title?: string;
  trigger_stage: string;
  email_subject: string;
  email_body: string;
  is_active: boolean;
  created_at: string;
}

interface JobOption {
  job_id: string;
  jd_id?: number;
  job_title: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const STATUS_BORDER_COLORS: Record<string, string> = {
  draft: 'border-l-amber-400',
  sent: 'border-l-emerald-500',
  paused: 'border-l-yellow-400',
  sending: 'border-l-blue-500',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  sent: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
  paused: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
  sending: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
};

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  sent: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  opened: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  clicked: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  bounced: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  replied: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
};

const STAGE_OPTIONS = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
];

const cardEntrance = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function Outreach() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('campaigns');

  // --- Campaigns state ---
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: '', jd_id: '', subject: '', body: '', stage: '', campaign_type: 'one_time',
  });
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Campaign detail
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Add step dialog
  const [showAddStep, setShowAddStep] = useState(false);
  const [stepForm, setStepForm] = useState({ delay_days: '1', subject: '', body: '' });
  const [addingStep, setAddingStep] = useState(false);
  const [stepCampaignId, setStepCampaignId] = useState<number | null>(null);

  // --- Automations state ---
  const [automations, setAutomations] = useState<StageAutomation[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(true);
  const [showNewAutomation, setShowNewAutomation] = useState(false);
  const [autoForm, setAutoForm] = useState({ jd_id: '', stage: '', subject: '', body: '' });
  const [creatingAutomation, setCreatingAutomation] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<StageAutomation | null>(null);

  // --- Jobs ---
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);

  // --- LinkedIn state ---
  const [linkedInJobId, setLinkedInJobId] = useState('');
  const [linkedInMessage, setLinkedInMessage] = useState('');
  const [postingJob, setPostingJob] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // --- Email Composer ---
  const [showEmailComposer, setShowEmailComposer] = useState(false);

  // --- Add Recipients ---
  const [showAddRecipients, setShowAddRecipients] = useState(false);
  const [addRecipientsCampaignId, setAddRecipientsCampaignId] = useState<number | null>(null);

  /* -- Data Fetching -------------------------------------------------------- */

  const loadJobs = useCallback(async () => {
    if (jobsLoaded) return;
    try {
      const result = await apiClient.getJobs(1, 100);
      setJobs(result?.items ?? []);
      setJobsLoaded(true);
    } catch {
      // non-critical, swallow
    }
  }, [jobsLoaded]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const result = await apiClient.getCampaigns(1, 100);
      const items = result?.items ?? (Array.isArray(result) ? result : []);
      setCampaigns(items);
    } catch {
      toast({ title: 'Error', description: 'Failed to load campaigns', variant: 'destructive' });
    } finally {
      setLoadingCampaigns(false);
    }
  }, [toast]);

  const loadAutomations = useCallback(async () => {
    setLoadingAutomations(true);
    try {
      const data = await apiClient.getStageAutomations();
      setAutomations(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load automations', variant: 'destructive' });
    } finally {
      setLoadingAutomations(false);
    }
  }, [toast]);

  useEffect(() => {
    loadJobs();
    loadCampaigns();
    loadAutomations();
  }, [loadJobs, loadCampaigns, loadAutomations]);

  /* -- Campaign Handlers ---------------------------------------------------- */

  const openCampaignDetail = async (campaign: Campaign) => {
    setShowDetail(true);
    setLoadingDetail(true);
    try {
      const detail = await apiClient.getCampaignDetail(campaign.id);
      setSelectedCampaign(detail);
    } catch {
      toast({ title: 'Error', description: 'Failed to load campaign details', variant: 'destructive' });
      setShowDetail(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignForm.name.trim() || !campaignForm.subject.trim() || !campaignForm.body.trim()) {
      toast({ title: 'Validation', description: 'Name, subject, and body are required', variant: 'destructive' });
      return;
    }
    setCreatingCampaign(true);
    try {
      const payload: any = {
        name: campaignForm.name.trim(),
        template_subject: campaignForm.subject.trim(),
        template_body: campaignForm.body.trim(),
        campaign_type: campaignForm.campaign_type,
      };
      if (campaignForm.jd_id) payload.jd_id = Number(campaignForm.jd_id);
      if (campaignForm.stage) payload.audience_filter = { stage: campaignForm.stage };
      await apiClient.createCampaign(payload);
      toast({ title: 'Success', description: 'Campaign created' });
      setShowNewCampaign(false);
      resetCampaignForm();
      loadCampaigns();
    } catch {
      toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleSendCampaign = async (campaignId: number) => {
    try {
      await apiClient.sendCampaign(campaignId);
      toast({ title: 'Success', description: 'Campaign sent successfully' });
      loadCampaigns();
      if (selectedCampaign?.id === campaignId) {
        openCampaignDetail({ id: campaignId } as Campaign);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send campaign', variant: 'destructive' });
    }
  };

  const resetCampaignForm = () => {
    setCampaignForm({ name: '', jd_id: '', subject: '', body: '', stage: '', campaign_type: 'one_time' });
  };

  /* -- Step Handlers -------------------------------------------------------- */

  const openAddStep = (campaignId: number) => {
    setStepCampaignId(campaignId);
    setStepForm({ delay_days: '1', subject: '', body: '' });
    setShowAddStep(true);
  };

  const handleAddStep = async () => {
    if (!stepCampaignId || !stepForm.subject.trim() || !stepForm.body.trim()) return;
    setAddingStep(true);
    try {
      const currentSteps = selectedCampaign?.steps ?? [];
      await apiClient.addCampaignStep(stepCampaignId, {
        step_number: currentSteps.length + 1,
        delay_days: Number(stepForm.delay_days) || 1,
        subject: stepForm.subject.trim(),
        body: stepForm.body.trim(),
      });
      toast({ title: 'Success', description: 'Step added to campaign' });
      setShowAddStep(false);
      if (selectedCampaign?.id === stepCampaignId) {
        openCampaignDetail({ id: stepCampaignId } as Campaign);
      }
      loadCampaigns();
    } catch {
      toast({ title: 'Error', description: 'Failed to add step', variant: 'destructive' });
    } finally {
      setAddingStep(false);
    }
  };

  /* -- Automation Handlers -------------------------------------------------- */

  const handleCreateAutomation = async () => {
    if (!autoForm.jd_id || !autoForm.stage || !autoForm.subject.trim() || !autoForm.body.trim()) {
      toast({ title: 'Validation', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    setCreatingAutomation(true);
    try {
      await apiClient.createStageAutomation({
        jd_id: Number(autoForm.jd_id),
        trigger_stage: autoForm.stage,
        email_subject: autoForm.subject.trim(),
        email_body: autoForm.body.trim(),
      });
      toast({ title: 'Success', description: 'Automation created' });
      setShowNewAutomation(false);
      setAutoForm({ jd_id: '', stage: '', subject: '', body: '' });
      loadAutomations();
    } catch {
      toast({ title: 'Error', description: 'Failed to create automation', variant: 'destructive' });
    } finally {
      setCreatingAutomation(false);
    }
  };

  const handleToggleAutomation = async (auto: StageAutomation) => {
    try {
      await apiClient.updateStageAutomation(auto.id, { is_active: !auto.is_active });
      toast({
        title: auto.is_active ? 'Automation paused' : 'Automation activated',
        description: `"${auto.email_subject}" is now ${auto.is_active ? 'inactive' : 'active'}`,
      });
      loadAutomations();
    } catch {
      toast({ title: 'Error', description: 'Failed to update automation', variant: 'destructive' });
    }
  };

  const handleDeleteAutomation = async (id: number) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    try {
      await apiClient.deleteStageAutomation(id);
      toast({ title: 'Deleted', description: 'Automation removed' });
      loadAutomations();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete automation', variant: 'destructive' });
    }
  };

  const openEditAutomation = (auto: StageAutomation) => {
    setEditingAutomation(auto);
    setAutoForm({
      jd_id: String(auto.jd_id),
      stage: auto.trigger_stage,
      subject: auto.email_subject,
      body: auto.email_body,
    });
    setShowNewAutomation(true);
  };

  const handleUpdateAutomation = async () => {
    if (!editingAutomation || !autoForm.subject.trim() || !autoForm.body.trim()) return;
    setCreatingAutomation(true);
    try {
      await apiClient.updateStageAutomation(editingAutomation.id, {
        trigger_stage: autoForm.stage,
        email_subject: autoForm.subject.trim(),
        email_body: autoForm.body.trim(),
      });
      toast({ title: 'Updated', description: 'Automation updated' });
      setShowNewAutomation(false);
      setEditingAutomation(null);
      setAutoForm({ jd_id: '', stage: '', subject: '', body: '' });
      loadAutomations();
    } catch {
      toast({ title: 'Error', description: 'Failed to update automation', variant: 'destructive' });
    } finally {
      setCreatingAutomation(false);
    }
  };

  /* -- LinkedIn Handlers ---------------------------------------------------- */

  const handlePostToLinkedIn = async () => {
    setPostingJob(true);
    try {
      await apiClient.postJobToLinkedIn(Number(linkedInJobId), linkedInMessage || undefined);
      toast({ title: 'Posted!', description: 'Job posted to LinkedIn successfully' });
      setLinkedInJobId('');
      setLinkedInMessage('');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setPostingJob(false);
    }
  };

  const handleProfileLookup = async () => {
    setLookingUp(true);
    try {
      const data = await apiClient.getLinkedInProfile(profileUrl);
      setProfileData(data);
    } catch (err: any) {
      toast({ title: 'Lookup failed', description: err.message, variant: 'destructive' });
    } finally {
      setLookingUp(false);
    }
  };

  /* -- Add Recipients ------------------------------------------------------- */

  const openAddRecipients = (campaignId: number) => {
    setAddRecipientsCampaignId(campaignId);
    setShowAddRecipients(true);
  };

  const handleRecipientsAdded = () => {
    loadCampaigns();
    if (addRecipientsCampaignId && selectedCampaign?.id === addRecipientsCampaignId) {
      openCampaignDetail({ id: addRecipientsCampaignId } as Campaign);
    }
  };

  /* -- Campaign Search / Sort / Pagination ---------------------------------- */

  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignSort, setCampaignSort] = useState('newest');

  const filteredSortedCampaigns = useMemo(() => {
    let list = campaigns;
    if (campaignSearch.trim()) {
      const q = campaignSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.template_subject.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (campaignSort) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'most_opens':
        sorted.sort((a, b) => (b.opened_count ?? 0) - (a.opened_count ?? 0));
        break;
      case 'most_clicks':
        sorted.sort((a, b) => (b.clicked_count ?? 0) - (a.clicked_count ?? 0));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return sorted;
  }, [campaigns, campaignSearch, campaignSort]);

  const campaignPagination = useClientPagination(filteredSortedCampaigns, { pageSize: 10 });

  /* -- Derived -------------------------------------------------------------- */

  const sequenceCampaigns = campaigns.filter(c => c.campaign_type === 'sequence');

  /* -- Helpers -------------------------------------------------------------- */

  const pct = (num: number | undefined | null, den: number | undefined | null) =>
    den && den > 0 && num != null ? ((num / den) * 100).toFixed(1) : '0';

  /* -- Render --------------------------------------------------------------- */

  return (
    <AppLayout>
      {/* ------------------------------------------------------------------ */}
      {/*  Page Header                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outreach</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage email campaigns, sequences, and stage-based automations
          </p>
        </div>
        <Button onClick={() => setShowEmailComposer(true)} className="gap-2">
          <Mail className="h-4 w-4" />
          Compose Email
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Tab Navigation                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b mb-6">
          <TabsList className="bg-transparent h-auto p-0 gap-6">
            {[
              { value: 'campaigns', label: 'Campaigns', icon: Megaphone },
              { value: 'sequences', label: 'Sequences', icon: ArrowRight },
              { value: 'automations', label: 'Automations', icon: Zap },
              { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative bg-transparent rounded-none border-b-2 border-transparent px-1 pb-3 pt-1.5 font-medium text-muted-foreground transition-colors data-[state=active]:border-b-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:data-[state=active]:border-b-blue-400 dark:data-[state=active]:text-blue-400 hover:text-foreground"
              >
                <tab.icon className="h-4 w-4 mr-1.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: Campaigns                                                 */}
        {/* ================================================================ */}
        <TabsContent value="campaigns" className="mt-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold tracking-tight">Email Campaigns</h2>
            <Button
              variant="outline"
              onClick={() => { resetCampaignForm(); setShowNewCampaign(true); }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                className="pl-9 h-10 rounded-lg bg-background border-border/60"
              />
            </div>
            <Select value={campaignSort} onValueChange={setCampaignSort}>
              <SelectTrigger className="w-[180px] h-10 rounded-lg border-border/60">
                <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="most_opens">Most Opens</SelectItem>
                <SelectItem value="most_clicks">Most Clicks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingCampaigns ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredSortedCampaigns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    No campaigns yet. Create your first outreach campaign.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => { resetCampaignForm(); setShowNewCampaign(true); }}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Create Campaign
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {campaignPagination.pageItems.map((camp, idx) => (
                  <motion.div
                    key={camp.id}
                    custom={idx}
                    variants={cardEntrance}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                  >
                    <Card
                      className={`border-l-4 ${STATUS_BORDER_COLORS[camp.status] || STATUS_BORDER_COLORS.draft} hover:shadow-md transition-shadow cursor-pointer group`}
                      onClick={() => openCampaignDetail(camp)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          {/* Left: Name + Status */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-0.5">
                              <h3 className="text-sm font-semibold truncate">{camp.name}</h3>
                              <Badge
                                variant="outline"
                                className={`text-[10px] capitalize shrink-0 font-medium ${STATUS_BADGE_STYLES[camp.status] || STATUS_BADGE_STYLES.draft}`}
                              >
                                {camp.status}
                              </Badge>
                              {camp.campaign_type === 'sequence' && (
                                <Badge variant="secondary" className="text-[10px] font-normal">Sequence</Badge>
                              )}
                            </div>
                            {camp.job_title && (
                              <p className="text-xs text-muted-foreground truncate">
                                {camp.job_title}
                              </p>
                            )}
                          </div>

                          {/* Right: Metrics */}
                          <div className="flex items-center gap-5 shrink-0">
                            <MetricPill label="Recipients" value={camp.recipient_count ?? 0} />
                            <MetricPill label="Sent" value={camp.sent_count ?? 0} color="text-emerald-600 dark:text-emerald-400" />
                            <MetricPill
                              label="Opened"
                              value={`${pct(camp.opened_count, camp.sent_count)}%`}
                              color="text-indigo-600 dark:text-indigo-400"
                              showValue={camp.sent_count > 0}
                              fallback={String(camp.opened_count ?? 0)}
                            />
                            <MetricPill
                              label="Clicked"
                              value={`${pct(camp.clicked_count, camp.sent_count)}%`}
                              color="text-purple-600 dark:text-purple-400"
                              showValue={camp.sent_count > 0}
                              fallback={String(camp.clicked_count ?? 0)}
                            />

                            {camp.status === 'draft' && (
                              <div className="flex items-center gap-1.5 ml-1" onClick={e => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 px-2.5"
                                  onClick={() => openAddRecipients(camp.id)}
                                >
                                  <Plus className="h-3 w-3" /> Recipients
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1 px-3"
                                  onClick={() => handleSendCampaign(camp.id)}
                                >
                                  <Send className="h-3 w-3" /> Send
                                </Button>
                              </div>
                            )}

                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors ml-1" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
              <DataPagination
                page={campaignPagination.page}
                totalPages={campaignPagination.totalPages}
                total={campaignPagination.total}
                pageSize={campaignPagination.pageSize}
                onPageChange={campaignPagination.setPage}
              />
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 2: Sequences                                                 */}
        {/* ================================================================ */}
        <TabsContent value="sequences" className="mt-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold tracking-tight">Campaign Sequences</h2>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                resetCampaignForm();
                setCampaignForm(prev => ({ ...prev, campaign_type: 'sequence' }));
                setShowNewCampaign(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Sequence
            </Button>
          </div>

          {loadingCampaigns ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : sequenceCampaigns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    No sequence campaigns yet. Create a multi-step campaign to follow up with candidates automatically.
                  </p>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      resetCampaignForm();
                      setCampaignForm(prev => ({ ...prev, campaign_type: 'sequence' }));
                      setShowNewCampaign(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Create Sequence
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-5">
              {sequenceCampaigns.map((camp, idx) => (
                <motion.div
                  key={camp.id}
                  custom={idx}
                  variants={cardEntrance}
                  initial="hidden"
                  animate="visible"
                >
                  <Card className={`border-l-4 ${STATUS_BORDER_COLORS[camp.status] || STATUS_BORDER_COLORS.draft}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2.5">
                          {camp.name}
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize font-medium ${STATUS_BADGE_STYLES[camp.status] || STATUS_BADGE_STYLES.draft}`}
                          >
                            {camp.status}
                          </Badge>
                        </CardTitle>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openAddStep(camp.id)}>
                          <Plus className="h-3.5 w-3.5" /> Add Step
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Initial email step */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                            1
                          </div>
                          <div className="w-px h-6 bg-border mt-1" />
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium">{camp.template_subject}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {camp.template_body}
                          </p>
                        </div>
                      </div>

                      <SequenceStepsPreview campaignId={camp.id} />

                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Click "Add Step" to build follow-up emails in this sequence
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 3: Automations                                               */}
        {/* ================================================================ */}
        <TabsContent value="automations" className="mt-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold tracking-tight">Stage Automations</h2>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setEditingAutomation(null);
                setAutoForm({ jd_id: '', stage: '', subject: '', body: '' });
                setShowNewAutomation(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Automation
            </Button>
          </div>

          {loadingAutomations ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
              ))}
            </div>
          ) : automations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Zap className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    No automations configured. Set up automatic emails when candidates enter specific stages.
                  </p>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setEditingAutomation(null);
                      setAutoForm({ jd_id: '', stage: '', subject: '', body: '' });
                      setShowNewAutomation(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Create Automation
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {automations.map((auto, idx) => (
                  <motion.div
                    key={auto.id}
                    custom={idx}
                    variants={cardEntrance}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                  >
                    <Card className={`border-l-4 ${auto.is_active ? 'border-l-emerald-500' : 'border-l-muted-foreground/30'} transition-colors`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-xs text-muted-foreground">When candidate enters</span>
                              <Badge variant="secondary" className="text-xs capitalize font-medium">
                                {auto.trigger_stage}
                              </Badge>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Send</span>
                              <span className="text-sm font-medium truncate">
                                "{auto.email_subject}"
                              </span>
                            </div>
                            {auto.job_title && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Job: {auto.job_title}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${auto.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                {auto.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <Switch
                                checked={auto.is_active}
                                onCheckedChange={() => handleToggleAutomation(auto)}
                              />
                            </div>
                            <Separator orientation="vertical" className="h-5" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditAutomation(auto)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDeleteAutomation(auto.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 4: LinkedIn                                                  */}
        {/* ================================================================ */}
        <TabsContent value="linkedin" className="mt-0 space-y-5">
          {/* Post Job */}
          <motion.div
            custom={0}
            variants={cardEntrance}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                  Post Job to LinkedIn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={linkedInJobId} onValueChange={setLinkedInJobId}>
                  <SelectTrigger><SelectValue placeholder="Select a job..." /></SelectTrigger>
                  <SelectContent>
                    {jobs.map(j => <SelectItem key={j.job_id} value={j.job_id}>{j.job_title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea
                  value={linkedInMessage}
                  onChange={e => setLinkedInMessage(e.target.value)}
                  placeholder="Custom message (optional)..."
                  className="min-h-[80px]"
                />
                <Button onClick={handlePostToLinkedIn} disabled={!linkedInJobId || postingJob} className="gap-2">
                  <Linkedin className="h-4 w-4" />
                  {postingJob ? 'Posting...' : 'Post to LinkedIn'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Profile Lookup */}
          <motion.div
            custom={1}
            variants={cardEntrance}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Profile Lookup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={profileUrl}
                    onChange={e => setProfileUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleProfileLookup}
                    disabled={!profileUrl || lookingUp}
                  >
                    {lookingUp ? 'Loading...' : 'Lookup'}
                  </Button>
                </div>
                {profileData && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border bg-muted/30 space-y-1"
                  >
                    <p className="font-medium">{profileData.name}</p>
                    <p className="text-sm text-muted-foreground">{profileData.email}</p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Send Message (stub) */}
          <motion.div
            custom={2}
            variants={cardEntrance}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  Send LinkedIn Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    LinkedIn Messaging API requires a LinkedIn partnership agreement.
                    Please apply at developer.linkedin.com for messaging access.
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* ================================================================== */}
      {/*  DIALOGS                                                           */}
      {/* ================================================================== */}

      {/* --- New Campaign Dialog --- */}
      <Dialog open={showNewCampaign} onOpenChange={v => { if (!v) { setShowNewCampaign(false); resetCampaignForm(); } else setShowNewCampaign(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {campaignForm.campaign_type === 'sequence' ? 'New Sequence Campaign' : 'New Campaign'}
            </DialogTitle>
            <DialogDescription>
              Create an outreach campaign to engage candidates.
              {' '}Use {'{{candidate_name}}'} in the body to personalize.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Campaign Name</Label>
              <Input
                placeholder="e.g. Spring Engineering Outreach"
                value={campaignForm.name}
                onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Job (optional)</Label>
              <Select value={campaignForm.jd_id} onValueChange={v => setCampaignForm(p => ({ ...p, jd_id: v }))}>
                <SelectTrigger><SelectValue placeholder="All jobs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All jobs</SelectItem>
                  {jobs.map(j => (
                    <SelectItem key={j.job_id} value={String(j.jd_id ?? j.job_id)}>
                      {j.job_title || `Job ${j.job_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Subject</Label>
              <Input
                placeholder="Email subject line"
                value={campaignForm.subject}
                onChange={e => setCampaignForm(p => ({ ...p, subject: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Body</Label>
              <Textarea
                placeholder={"Hi {{candidate_name}},\n\nWe have an exciting opportunity..."}
                value={campaignForm.body}
                onChange={e => setCampaignForm(p => ({ ...p, body: e.target.value }))}
                rows={6}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use {'{{candidate_name}}'} to insert the candidate's name.
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Audience Filter (Stage)</Label>
              <Select value={campaignForm.stage} onValueChange={v => setCampaignForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger><SelectValue placeholder="All stages" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {STAGE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Campaign Type</Label>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${campaignForm.campaign_type === 'one_time' ? 'font-semibold' : 'text-muted-foreground'}`}>
                  One-time
                </span>
                <Switch
                  checked={campaignForm.campaign_type === 'sequence'}
                  onCheckedChange={v => setCampaignForm(p => ({ ...p, campaign_type: v ? 'sequence' : 'one_time' }))}
                />
                <span className={`text-xs ${campaignForm.campaign_type === 'sequence' ? 'font-semibold' : 'text-muted-foreground'}`}>
                  Sequence
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewCampaign(false); resetCampaignForm(); }} disabled={creatingCampaign}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign} disabled={creatingCampaign}>
              {creatingCampaign ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Campaign Detail Dialog --- */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="space-y-4 py-8">
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : selectedCampaign ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  {selectedCampaign.name}
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize font-medium ${STATUS_BADGE_STYLES[selectedCampaign.status] || STATUS_BADGE_STYLES.draft}`}
                  >
                    {selectedCampaign.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedCampaign.job_title ? `Job: ${selectedCampaign.job_title}` : 'All jobs'}
                  {' '}&middot;{' '}Subject: {selectedCampaign.template_subject}
                </DialogDescription>
              </DialogHeader>

              {/* Detail KPIs */}
              <div className="grid grid-cols-4 gap-3 my-4">
                {[
                  { label: 'Sent', value: selectedCampaign.sent_count ?? 0, icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
                  {
                    label: 'Opened',
                    value: selectedCampaign.opened_count ?? 0,
                    pct: pct(selectedCampaign.opened_count, selectedCampaign.sent_count),
                    icon: Eye,
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
                  },
                  {
                    label: 'Clicked',
                    value: selectedCampaign.clicked_count ?? 0,
                    pct: pct(selectedCampaign.clicked_count, selectedCampaign.sent_count),
                    icon: MousePointerClick,
                    color: 'text-purple-600',
                    bg: 'bg-purple-50 dark:bg-purple-950/40',
                  },
                  {
                    label: 'Replied',
                    value: selectedCampaign.replied_count ?? 0,
                    pct: pct(selectedCampaign.replied_count ?? 0, selectedCampaign.sent_count),
                    icon: Reply,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                  },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                  >
                    <Card className={`${kpi.bg} border-0`}>
                      <CardContent className="p-3 text-center">
                        <kpi.icon className={`h-5 w-5 mx-auto mb-1.5 ${kpi.color}`} />
                        <p className="text-lg font-bold">
                          <CountingNumber value={kpi.value} />
                        </p>
                        {'pct' in kpi && (
                          <p className="text-[10px] text-muted-foreground">{kpi.pct}%</p>
                        )}
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{kpi.label}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Recipients section */}
              <Separator />
              <div className="flex items-center justify-between mt-3 mb-2">
                <h4 className="text-sm font-semibold">Recipients</h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => openAddRecipients(selectedCampaign.id)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Recipients
                </Button>
              </div>
              {selectedCampaign.recipients && selectedCampaign.recipients.length > 0 ? (
                <div className="max-h-60 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold">Name</TableHead>
                        <TableHead className="text-xs font-semibold">Email</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">Sent</TableHead>
                        <TableHead className="text-xs font-semibold">Opened</TableHead>
                        <TableHead className="text-xs font-semibold">Clicked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCampaign.recipients.map(r => (
                        <TableRow key={r.id} className="hover:bg-muted/20">
                          <TableCell className="text-sm">{r.name || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] capitalize ${RECIPIENT_STATUS_COLORS[r.status] || RECIPIENT_STATUS_COLORS.pending}`}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.sent_at ? new Date(r.sent_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg bg-muted/10 border-dashed">
                  <Users className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground mb-3">No recipients added yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => openAddRecipients(selectedCampaign.id)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Recipients
                  </Button>
                </div>
              )}

              <DialogFooter className="mt-4">
                {selectedCampaign.status === 'draft' && (
                  <Button onClick={() => handleSendCampaign(selectedCampaign.id)} className="gap-1.5">
                    <Send className="h-4 w-4" /> Send Campaign
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowDetail(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* --- Add Step Dialog --- */}
      <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sequence Step</DialogTitle>
            <DialogDescription>
              Add a follow-up email to this sequence. It will be sent after the specified delay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Delay (days after previous step)</Label>
              <Input
                type="number"
                min={1}
                value={stepForm.delay_days}
                onChange={e => setStepForm(p => ({ ...p, delay_days: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Subject</Label>
              <Input
                placeholder="Follow-up subject"
                value={stepForm.subject}
                onChange={e => setStepForm(p => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Body</Label>
              <Textarea
                placeholder={"Hi {{candidate_name}},\n\nJust following up..."}
                value={stepForm.body}
                onChange={e => setStepForm(p => ({ ...p, body: e.target.value }))}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStep(false)} disabled={addingStep}>
              Cancel
            </Button>
            <Button onClick={handleAddStep} disabled={addingStep || !stepForm.subject.trim() || !stepForm.body.trim()}>
              {addingStep ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </span>
              ) : (
                'Add Step'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- New / Edit Automation Dialog --- */}
      <Dialog open={showNewAutomation} onOpenChange={v => { if (!v) { setShowNewAutomation(false); setEditingAutomation(null); } else setShowNewAutomation(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? 'Edit Automation' : 'New Stage Automation'}
            </DialogTitle>
            <DialogDescription>
              Automatically send an email when a candidate enters a specific pipeline stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Job</Label>
              <Select
                value={autoForm.jd_id}
                onValueChange={v => setAutoForm(p => ({ ...p, jd_id: v }))}
                disabled={!!editingAutomation}
              >
                <SelectTrigger><SelectValue placeholder="Select a job..." /></SelectTrigger>
                <SelectContent>
                  {jobs.map(j => (
                    <SelectItem key={j.job_id} value={String(j.jd_id ?? j.job_id)}>
                      {j.job_title || `Job ${j.job_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Trigger Stage</Label>
              <Select value={autoForm.stage} onValueChange={v => setAutoForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger><SelectValue placeholder="Select stage..." /></SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Email Subject</Label>
              <Input
                placeholder="e.g. Your application update"
                value={autoForm.subject}
                onChange={e => setAutoForm(p => ({ ...p, subject: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Email Body</Label>
              <Textarea
                placeholder={"Hi {{candidate_name}},\n\nYour application status has been updated..."}
                value={autoForm.body}
                onChange={e => setAutoForm(p => ({ ...p, body: e.target.value }))}
                rows={6}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use {'{{candidate_name}}'} to insert the candidate's name.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewAutomation(false); setEditingAutomation(null); }} disabled={creatingAutomation}>
              Cancel
            </Button>
            <Button
              onClick={editingAutomation ? handleUpdateAutomation : handleCreateAutomation}
              disabled={creatingAutomation}
            >
              {creatingAutomation ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {editingAutomation ? 'Updating...' : 'Creating...'}
                </span>
              ) : editingAutomation ? (
                'Update Automation'
              ) : (
                'Create Automation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Add Recipients Modal --- */}
      {addRecipientsCampaignId && (
        <AddRecipientsModal
          open={showAddRecipients}
          onClose={() => setShowAddRecipients(false)}
          campaignId={addRecipientsCampaignId}
          onRecipientsAdded={handleRecipientsAdded}
        />
      )}

      {/* --- Email Composer Modal --- */}
      <EmailComposerModal
        open={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
      />
    </AppLayout>
  );
}

/* -------------------------------------------------------------------------- */
/*  MetricPill — compact metric display for campaign cards                     */
/* -------------------------------------------------------------------------- */

function MetricPill({
  label,
  value,
  color,
  showValue = true,
  fallback,
}: {
  label: string;
  value: number | string;
  color?: string;
  showValue?: boolean;
  fallback?: string;
}) {
  return (
    <div className="text-center min-w-[48px]">
      <p className={`text-sm font-semibold tabular-nums ${color || ''}`}>
        {showValue ? value : (fallback ?? '-')}
      </p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SequenceStepsPreview — lazy-loads steps for sequence cards                 */
/* -------------------------------------------------------------------------- */

function SequenceStepsPreview({ campaignId }: { campaignId: number }) {
  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await apiClient.getCampaignDetail(campaignId);
        if (!cancelled && detail?.steps) {
          setSteps(detail.steps);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  if (!loaded) {
    return (
      <div className="space-y-2 ml-10">
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <>
      {steps.map((step, idx) => (
        <div key={step.id ?? idx} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground my-1">
              <Clock className="h-3 w-3" />
              {step.delay_days}d
            </div>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
              {step.step_number ?? idx + 2}
            </div>
            {idx < steps.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
          </div>
          <div className="flex-1 pb-4 pt-4">
            <p className="text-sm font-medium">{step.subject}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{step.body}</p>
          </div>
        </div>
      ))}
    </>
  );
}
