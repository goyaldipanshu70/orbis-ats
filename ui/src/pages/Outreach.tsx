import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
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
/*  Design-system constants                                                   */
/* -------------------------------------------------------------------------- */

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

const focusStyles = {
  background: 'var(--orbis-hover)',
  borderColor: '#1B8EE5',
  boxShadow: '0 0 20px rgba(27,142,229,0.15)',
};
const blurStyles = {
  background: 'var(--orbis-input)',
  borderColor: 'var(--orbis-border)',
  boxShadow: 'none',
};

const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  Object.assign(e.target.style, focusStyles);
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  Object.assign(e.target.style, blurStyles);
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const STATUS_BORDER: Record<string, string> = {
  draft: 'rgba(251,191,36,0.7)',
  sent: 'rgba(16,185,129,0.7)',
  paused: 'rgba(250,204,21,0.7)',
  sending: 'rgba(59,130,246,0.7)',
};

const STATUS_BADGE_STYLES: Record<string, React.CSSProperties> = {
  draft: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' },
  sent: { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' },
  paused: { background: 'rgba(250,204,21,0.15)', color: '#fde047', border: '1px solid rgba(250,204,21,0.3)' },
  sending: { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' },
};

const RECIPIENT_STATUS_STYLES: Record<string, React.CSSProperties> = {
  pending: { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' },
  sent: { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' },
  opened: { background: 'rgba(22,118,192,0.15)', color: '#818cf8', border: '1px solid rgba(22,118,192,0.25)' },
  clicked: { background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' },
  bounced: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' },
  replied: { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' },
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Outreach</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Manage email campaigns, sequences, and stage-based automations
          </p>
        </div>
        <button
          onClick={() => setShowEmailComposer(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #1676c0, #1676c0)', border: '1px solid var(--orbis-border)' }}
        >
          <Mail className="h-4 w-4" />
          Compose Email
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Tab Navigation                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div style={{ borderBottom: '1px solid var(--orbis-border)' }} className="mb-6">
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
                className="relative bg-transparent rounded-none border-b-2 border-transparent px-1 pb-3 pt-1.5 font-medium text-slate-400 transition-colors data-[state=active]:border-b-blue-500 data-[state=active]:text-blue-400 data-[state=active]:shadow-none hover:text-white"
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
            <h2 className="text-lg font-semibold tracking-tight text-white">Email Campaigns</h2>
            <button
              onClick={() => { resetCampaignForm(); setShowNewCampaign(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={glassCard}
            >
              <Plus className="h-4 w-4" /> New Campaign
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                placeholder="Search campaigns..."
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full pl-9 h-10 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none transition-all"
                style={glassInput}
              />
            </div>
            <Select value={campaignSort} onValueChange={setCampaignSort}>
              <SelectTrigger className="w-[180px] h-10 rounded-lg text-slate-300" style={glassInput}>
                <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-slate-500" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent style={selectDrop}>
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
                <div key={i} className="h-[72px] w-full rounded-xl animate-pulse" style={{ background: 'var(--orbis-input)' }} />
              ))}
            </div>
          ) : filteredSortedCampaigns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-xl py-16 text-center" style={{ ...glassCard, borderStyle: 'dashed' }}>
                <div className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
                  <Mail className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  No campaigns yet. Create your first outreach campaign.
                </p>
                <button
                  onClick={() => { resetCampaignForm(); setShowNewCampaign(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
                  style={glassCard}
                >
                  <Plus className="h-4 w-4" /> Create Campaign
                </button>
              </div>
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
                    <div
                      className="rounded-xl p-4 cursor-pointer group transition-all"
                      style={{ ...glassCard, borderLeft: `4px solid ${STATUS_BORDER[camp.status] || STATUS_BORDER.draft}` }}
                      onClick={() => openCampaignDetail(camp)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Name + Status */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-0.5">
                            <h3 className="text-sm font-semibold text-white truncate">{camp.name}</h3>
                            <span
                              className="text-[10px] capitalize shrink-0 font-medium px-2 py-0.5 rounded-full"
                              style={STATUS_BADGE_STYLES[camp.status] || STATUS_BADGE_STYLES.draft}
                            >
                              {camp.status}
                            </span>
                            {camp.campaign_type === 'sequence' && (
                              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--orbis-hover)', color: '#94a3b8', border: '1px solid var(--orbis-border)' }}>
                                Sequence
                              </span>
                            )}
                          </div>
                          {camp.job_title && (
                            <p className="text-xs text-slate-500 truncate">
                              {camp.job_title}
                            </p>
                          )}
                        </div>

                        {/* Right: Metrics */}
                        <div className="flex items-center gap-5 shrink-0">
                          <MetricPill label="Recipients" value={camp.recipient_count ?? 0} />
                          <MetricPill label="Sent" value={camp.sent_count ?? 0} color="text-emerald-400" />
                          <MetricPill
                            label="Opened"
                            value={`${pct(camp.opened_count, camp.sent_count)}%`}
                            color="text-blue-400"
                            showValue={camp.sent_count > 0}
                            fallback={String(camp.opened_count ?? 0)}
                          />
                          <MetricPill
                            label="Clicked"
                            value={`${pct(camp.clicked_count, camp.sent_count)}%`}
                            color="text-blue-400"
                            showValue={camp.sent_count > 0}
                            fallback={String(camp.clicked_count ?? 0)}
                          />

                          {camp.status === 'draft' && (
                            <div className="flex items-center gap-1.5 ml-1" onClick={e => e.stopPropagation()}>
                              <button
                                className="h-7 text-xs gap-1 px-2.5 inline-flex items-center rounded-md text-slate-300 transition-all hover:text-white"
                                style={glassCard}
                                onClick={() => openAddRecipients(camp.id)}
                              >
                                <Plus className="h-3 w-3" /> Recipients
                              </button>
                              <button
                                className="h-7 text-xs gap-1 px-3 inline-flex items-center rounded-md text-white font-medium transition-all"
                                style={{ background: 'linear-gradient(135deg, #1676c0, #1676c0)', border: '1px solid var(--orbis-border)' }}
                                onClick={() => handleSendCampaign(camp.id)}
                              >
                                <Send className="h-3 w-3" /> Send
                              </button>
                            </div>
                          )}

                          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-400 transition-colors ml-1" />
                        </div>
                      </div>
                    </div>
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
            <h2 className="text-lg font-semibold tracking-tight text-white">Campaign Sequences</h2>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={glassCard}
              onClick={() => {
                resetCampaignForm();
                setCampaignForm(prev => ({ ...prev, campaign_type: 'sequence' }));
                setShowNewCampaign(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Sequence
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-40 w-full rounded-xl animate-pulse" style={{ background: 'var(--orbis-input)' }} />
              ))}
            </div>
          ) : sequenceCampaigns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-xl py-16 text-center" style={{ ...glassCard, borderStyle: 'dashed' }}>
                <div className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
                  <ArrowRight className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  No sequence campaigns yet. Create a multi-step campaign to follow up with candidates automatically.
                </p>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
                  style={glassCard}
                  onClick={() => {
                    resetCampaignForm();
                    setCampaignForm(prev => ({ ...prev, campaign_type: 'sequence' }));
                    setShowNewCampaign(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Create Sequence
                </button>
              </div>
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
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ ...glassCard, borderLeft: `4px solid ${STATUS_BORDER[camp.status] || STATUS_BORDER.draft}` }}
                  >
                    {/* Sequence header */}
                    <div className="flex items-center justify-between p-4 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-semibold text-white">{camp.name}</span>
                        <span
                          className="text-[10px] capitalize font-medium px-2 py-0.5 rounded-full"
                          style={STATUS_BADGE_STYLES[camp.status] || STATUS_BADGE_STYLES.draft}
                        >
                          {camp.status}
                        </span>
                      </div>
                      <button
                        className="h-7 text-xs gap-1 px-2.5 inline-flex items-center rounded-md text-slate-300 transition-all hover:text-white"
                        style={glassCard}
                        onClick={() => openAddStep(camp.id)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Step
                      </button>
                    </div>
                    {/* Sequence body */}
                    <div className="px-4 pb-4">
                      {/* Initial email step */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                            1
                          </div>
                          <div className="w-px h-6 mt-1" style={{ background: 'var(--orbis-border)' }} />
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium text-white">{camp.template_subject}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {camp.template_body}
                          </p>
                        </div>
                      </div>

                      <SequenceStepsPreview campaignId={camp.id} />

                      <p className="text-xs text-slate-500 text-center mt-2">
                        Click "Add Step" to build follow-up emails in this sequence
                      </p>
                    </div>
                  </div>
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
            <h2 className="text-lg font-semibold tracking-tight text-white">Stage Automations</h2>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={glassCard}
              onClick={() => {
                setEditingAutomation(null);
                setAutoForm({ jd_id: '', stage: '', subject: '', body: '' });
                setShowNewAutomation(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Automation
            </button>
          </div>

          {loadingAutomations ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[68px] w-full rounded-xl animate-pulse" style={{ background: 'var(--orbis-input)' }} />
              ))}
            </div>
          ) : automations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-xl py-16 text-center" style={{ ...glassCard, borderStyle: 'dashed' }}>
                <div className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
                  <Zap className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  No automations configured. Set up automatic emails when candidates enter specific stages.
                </p>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
                  style={glassCard}
                  onClick={() => {
                    setEditingAutomation(null);
                    setAutoForm({ jd_id: '', stage: '', subject: '', body: '' });
                    setShowNewAutomation(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Create Automation
                </button>
              </div>
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
                    <div
                      className="rounded-xl p-4 transition-colors"
                      style={{ ...glassCard, borderLeft: `4px solid ${auto.is_active ? 'rgba(16,185,129,0.7)' : 'var(--orbis-border-strong)'}` }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-xs text-slate-500">When candidate enters</span>
                            <span className="text-xs capitalize font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--orbis-hover)', color: '#94a3b8', border: '1px solid var(--orbis-border)' }}>
                              {auto.trigger_stage}
                            </span>
                            <ArrowRight className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">Send</span>
                            <span className="text-sm font-medium text-white truncate">
                              "{auto.email_subject}"
                            </span>
                          </div>
                          {auto.job_title && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Job: {auto.job_title}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${auto.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {auto.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <Switch
                              checked={auto.is_active}
                              onCheckedChange={() => handleToggleAutomation(auto)}
                            />
                          </div>
                          <div className="h-5 w-px" style={{ background: 'var(--orbis-border)' }} />
                          <button
                            className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-slate-400 transition-colors hover:text-white hover:bg-white/5"
                            onClick={() => openEditAutomation(auto)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-slate-400 transition-colors hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => handleDeleteAutomation(auto.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
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
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <div className="p-4 pb-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                  Post Job to LinkedIn
                </h3>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <Select value={linkedInJobId} onValueChange={setLinkedInJobId}>
                  <SelectTrigger className="text-slate-300" style={glassInput}><SelectValue placeholder="Select a job..." /></SelectTrigger>
                  <SelectContent style={selectDrop}>
                    {jobs.map(j => <SelectItem key={j.job_id} value={j.job_id}>{j.job_title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <textarea
                  value={linkedInMessage}
                  onChange={e => setLinkedInMessage(e.target.value)}
                  placeholder="Custom message (optional)..."
                  onFocus={handleFocus as any}
                  onBlur={handleBlur as any}
                  className="w-full min-h-[80px] rounded-lg text-sm text-white placeholder:text-slate-500 p-3 outline-none resize-y transition-all"
                  style={glassInput}
                />
                <button
                  onClick={handlePostToLinkedIn}
                  disabled={!linkedInJobId || postingJob}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1676c0, #1676c0)', border: '1px solid var(--orbis-border)' }}
                >
                  <Linkedin className="h-4 w-4" />
                  {postingJob ? 'Posting...' : 'Post to LinkedIn'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Profile Lookup */}
          <motion.div
            custom={1}
            variants={cardEntrance}
            initial="hidden"
            animate="visible"
          >
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <div className="p-4 pb-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Eye className="h-4 w-4 text-slate-400" />
                  Profile Lookup
                </h3>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    value={profileUrl}
                    onChange={e => setProfileUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className="flex-1 h-10 rounded-lg text-sm text-white placeholder:text-slate-500 px-3 outline-none transition-all"
                    style={glassInput}
                  />
                  <button
                    onClick={handleProfileLookup}
                    disabled={!profileUrl || lookingUp}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white disabled:opacity-50"
                    style={glassCard}
                  >
                    {lookingUp ? 'Loading...' : 'Lookup'}
                  </button>
                </div>
                {profileData && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg space-y-1"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    <p className="font-medium text-white">{profileData.name}</p>
                    <p className="text-sm text-slate-400">{profileData.email}</p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Send Message (stub) */}
          <motion.div
            custom={2}
            variants={cardEntrance}
            initial="hidden"
            animate="visible"
          >
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <div className="p-4 pb-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Send className="h-4 w-4 text-slate-400" />
                  Send LinkedIn Message
                </h3>
              </div>
              <div className="px-4 pb-4">
                <div className="p-4 rounded-lg text-sm flex items-start gap-2.5" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    LinkedIn Messaging API requires a LinkedIn partnership agreement.
                    Please apply at developer.linkedin.com for messaging access.
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* ================================================================== */}
      {/*  DIALOGS                                                           */}
      {/* ================================================================== */}

      {/* --- New Campaign Dialog --- */}
      <Dialog open={showNewCampaign} onOpenChange={v => { if (!v) { setShowNewCampaign(false); resetCampaignForm(); } else setShowNewCampaign(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">
              {campaignForm.campaign_type === 'sequence' ? 'New Sequence Campaign' : 'New Campaign'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Create an outreach campaign to engage candidates.
              {' '}Use {'{{candidate_name}}'} in the body to personalize.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Campaign Name</label>
              <input
                placeholder="e.g. Spring Engineering Outreach"
                value={campaignForm.name}
                onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full h-10 rounded-lg text-sm text-white placeholder:text-slate-500 px-3 outline-none transition-all"
                style={glassInput}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Job (optional)</label>
              <Select value={campaignForm.jd_id} onValueChange={v => setCampaignForm(p => ({ ...p, jd_id: v }))}>
                <SelectTrigger className="text-slate-300" style={glassInput}><SelectValue placeholder="All jobs" /></SelectTrigger>
                <SelectContent style={selectDrop}>
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
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Subject</label>
              <input
                placeholder="Email subject line"
                value={campaignForm.subject}
                onChange={e => setCampaignForm(p => ({ ...p, subject: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full h-10 rounded-lg text-sm text-white placeholder:text-slate-500 px-3 outline-none transition-all"
                style={glassInput}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Body</label>
              <textarea
                placeholder={"Hi {{candidate_name}},\n\nWe have an exciting opportunity..."}
                value={campaignForm.body}
                onChange={e => setCampaignForm(p => ({ ...p, body: e.target.value }))}
                onFocus={handleFocus as any}
                onBlur={handleBlur as any}
                rows={6}
                className="w-full rounded-lg text-sm text-white placeholder:text-slate-500 p-3 outline-none resize-y transition-all"
                style={glassInput}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Use {'{{candidate_name}}'} to insert the candidate's name.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Audience Filter (Stage)</label>
              <Select value={campaignForm.stage} onValueChange={v => setCampaignForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger className="text-slate-300" style={glassInput}><SelectValue placeholder="All stages" /></SelectTrigger>
                <SelectContent style={selectDrop}>
                  <SelectItem value="all">All stages</SelectItem>
                  {STAGE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Campaign Type</label>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${campaignForm.campaign_type === 'one_time' ? 'font-semibold text-white' : 'text-slate-500'}`}>
                  One-time
                </span>
                <Switch
                  checked={campaignForm.campaign_type === 'sequence'}
                  onCheckedChange={v => setCampaignForm(p => ({ ...p, campaign_type: v ? 'sequence' : 'one_time' }))}
                />
                <span className={`text-xs ${campaignForm.campaign_type === 'sequence' ? 'font-semibold text-white' : 'text-slate-500'}`}>
                  Sequence
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => { setShowNewCampaign(false); resetCampaignForm(); }}
              disabled={creatingCampaign}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white disabled:opacity-50"
              style={glassCard}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCampaign}
              disabled={creatingCampaign}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1676c0, #1676c0)', border: '1px solid var(--orbis-border)' }}
            >
              {creatingCampaign ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Campaign'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Campaign Detail Dialog --- */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          {loadingDetail ? (
            <div className="space-y-4 py-8">
              <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--orbis-input)' }} />
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: 'var(--orbis-input)' }} />)}
              </div>
              <div className="h-40 w-full rounded-lg animate-pulse" style={{ background: 'var(--orbis-input)' }} />
            </div>
          ) : selectedCampaign ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-white">
                  {selectedCampaign.name}
                  <span
                    className="text-xs capitalize font-medium px-2 py-0.5 rounded-full"
                    style={STATUS_BADGE_STYLES[selectedCampaign.status] || STATUS_BADGE_STYLES.draft}
                  >
                    {selectedCampaign.status}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {selectedCampaign.job_title ? `Job: ${selectedCampaign.job_title}` : 'All jobs'}
                  {' '}&middot;{' '}Subject: {selectedCampaign.template_subject}
                </DialogDescription>
              </DialogHeader>

              {/* Detail KPIs */}
              <div className="grid grid-cols-4 gap-3 my-4">
                {[
                  { label: 'Sent', value: selectedCampaign.sent_count ?? 0, icon: Send, color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
                  {
                    label: 'Opened',
                    value: selectedCampaign.opened_count ?? 0,
                    pct: pct(selectedCampaign.opened_count, selectedCampaign.sent_count),
                    icon: Eye,
                    color: '#818cf8',
                    bg: 'rgba(22,118,192,0.1)',
                  },
                  {
                    label: 'Clicked',
                    value: selectedCampaign.clicked_count ?? 0,
                    pct: pct(selectedCampaign.clicked_count, selectedCampaign.sent_count),
                    icon: MousePointerClick,
                    color: '#c084fc',
                    bg: 'rgba(168,85,247,0.1)',
                  },
                  {
                    label: 'Replied',
                    value: selectedCampaign.replied_count ?? 0,
                    pct: pct(selectedCampaign.replied_count ?? 0, selectedCampaign.sent_count),
                    icon: Reply,
                    color: '#34d399',
                    bg: 'rgba(16,185,129,0.1)',
                  },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                  >
                    <div className="rounded-lg p-3 text-center" style={{ background: kpi.bg, border: 'none' }}>
                      <kpi.icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: kpi.color }} />
                      <p className="text-lg font-bold text-white">
                        <CountingNumber value={kpi.value} />
                      </p>
                      {'pct' in kpi && (
                        <p className="text-[10px] text-slate-400">{kpi.pct}%</p>
                      )}
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{kpi.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Recipients section */}
              <div className="h-px w-full" style={{ background: 'var(--orbis-border)' }} />
              <div className="flex items-center justify-between mt-3 mb-2">
                <h4 className="text-sm font-semibold text-white">Recipients</h4>
                <button
                  className="h-7 text-xs gap-1 px-2.5 inline-flex items-center rounded-md text-slate-300 transition-all hover:text-white"
                  style={glassCard}
                  onClick={() => openAddRecipients(selectedCampaign.id)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Recipients
                </button>
              </div>
              {selectedCampaign.recipients && selectedCampaign.recipients.length > 0 ? (
                <div className="max-h-60 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--orbis-border)' }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: 'var(--orbis-input)' }} className="border-b border-white/10 hover:bg-white/5">
                        <TableHead className="text-xs font-semibold text-slate-400">Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400">Email</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400">Sent</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400">Opened</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400">Clicked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCampaign.recipients.map(r => (
                        <TableRow key={r.id} className="border-b border-white/5 hover:bg-white/5">
                          <TableCell className="text-sm text-white">{r.name || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-400">{r.email}</TableCell>
                          <TableCell>
                            <span
                              className="text-[10px] capitalize px-2 py-0.5 rounded-full"
                              style={RECIPIENT_STATUS_STYLES[r.status] || RECIPIENT_STATUS_STYLES.pending}
                            >
                              {r.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {r.sent_at ? new Date(r.sent_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 rounded-lg" style={{ ...glassCard, borderStyle: 'dashed' }}>
                  <Users className="h-6 w-6 mx-auto text-slate-500 mb-2" />
                  <p className="text-xs text-slate-500 mb-3">No recipients added yet</p>
                  <button
                    className="text-xs gap-1 px-3 py-1.5 inline-flex items-center rounded-md text-slate-300 transition-all hover:text-white"
                    style={glassCard}
                    onClick={() => openAddRecipients(selectedCampaign.id)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Recipients
                  </button>
                </div>
              )}

              <DialogFooter className="mt-4">
                {selectedCampaign.status === 'draft' && (
                  <button
                    onClick={() => handleSendCampaign(selectedCampaign.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #1676c0, #1676c0)', border: '1px solid var(--orbis-border)' }}
                  >
                    <Send className="h-4 w-4" /> Send Campaign
                  </button>
                )}
                <button
                  onClick={() => setShowDetail(false)}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
                  style={glassCard}
                >
                  Close
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* --- Add Step Dialog --- */}
      <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
        <DialogContent className="sm:max-w-md" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Add Sequence Step</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a follow-up email to this sequence. It will be sent after the specified delay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Delay (days after previous step)</label>
              <input
                type="number"
                min={1}
                value={stepForm.delay_days}
                onChange={e => setStepForm(p => ({ ...p, delay_days: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full h-10 rounded-lg text-sm text-white placeholder:text-slate-500 px-3 outline-none transition-all"
                style={glassInput}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Subject</label>
              <input
                placeholder="Follow-up subject"
                value={stepForm.subject}
                onChange={e => setStepForm(p => ({ ...p, subject: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full h-10 rounded-lg text-sm text-white placeholder:text-slate-500 px-3 outline-none transition-all"
                style={glassInput}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Body</label>
              <textarea
                placeholder={"Hi {{candidate_name}},\n\nJust following up..."}
                value={stepForm.body}
                onChange={e => setStepForm(p => ({ ...p, body: e.target.value }))}
                onFocus={handleFocus as any}
                onBlur={handleBlur as any}
                rows={5}
                className="w-full rounded-lg text-sm text-white placeholder:text-slate-500 p-3 outline-none resize-y transition-all"
                style={glassInput}
              />
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setShowAddStep(false)}
              disabled={addingStep}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white disabled:opacity-50"
              style={glassCard}
            >
              Cancel
            </button>
            <button
              onClick={handleAddStep}
              disabled={addingStep || !stepForm.subject.trim() || !stepForm.body.trim()}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1676c0, #1676c0)', border: '1px solid var(--orbis-border)' }}
            >
              {addingStep ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </span>
              ) : (
                'Add Step'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- New / Edit Automation Dialog --- */}
      <Dialog open={showNewAutomation} onOpenChange={v => { if (!v) { setShowNewAutomation(false); setEditingAutomation(null); } else setShowNewAutomation(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingAutomation ? 'Edit Automation' : 'New Stage Automation'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Automatically send an email when a candidate enters a specific pipeline stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Job</label>
              <Select
                value={autoForm.jd_id}
                onValueChange={v => setAutoForm(p => ({ ...p, jd_id: v }))}
                disabled={!!editingAutomation}
              >
                <SelectTrigger className="text-slate-300" style={glassInput}><SelectValue placeholder="Select a job..." /></SelectTrigger>
                <SelectContent style={selectDrop}>
                  {jobs.map(j => (
                    <SelectItem key={j.job_id} value={String(j.jd_id ?? j.job_id)}>
                      {j.job_title || `Job ${j.job_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Trigger Stage</label>
              <Select value={autoForm.stage} onValueChange={v => setAutoForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger className="text-slate-300" style={glassInput}><SelectValue placeholder="Select stage..." /></SelectTrigger>
                <SelectContent style={selectDrop}>
                  {STAGE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Email Subject</label>
              <input
                placeholder="e.g. Your application update"
                value={autoForm.subject}
                onChange={e => setAutoForm(p => ({ ...p, subject: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full h-10 rounded-lg text-sm text-white placeholder:text-slate-500 px-3 outline-none transition-all"
                style={glassInput}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-300">Email Body</label>
              <textarea
                placeholder={"Hi {{candidate_name}},\n\nYour application status has been updated..."}
                value={autoForm.body}
                onChange={e => setAutoForm(p => ({ ...p, body: e.target.value }))}
                onFocus={handleFocus as any}
                onBlur={handleBlur as any}
                rows={6}
                className="w-full rounded-lg text-sm text-white placeholder:text-slate-500 p-3 outline-none resize-y transition-all"
                style={glassInput}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Use {'{{candidate_name}}'} to insert the candidate's name.
              </p>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => { setShowNewAutomation(false); setEditingAutomation(null); }}
              disabled={creatingAutomation}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white disabled:opacity-50"
              style={glassCard}
            >
              Cancel
            </button>
            <button
              onClick={editingAutomation ? handleUpdateAutomation : handleCreateAutomation}
              disabled={creatingAutomation}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1676c0, #1676c0)', border: '1px solid var(--orbis-border)' }}
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
            </button>
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
/*  MetricPill -- compact metric display for campaign cards                     */
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
      <p className={`text-sm font-semibold tabular-nums ${color || 'text-white'}`}>
        {showValue ? value : (fallback ?? '-')}
      </p>
      <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SequenceStepsPreview -- lazy-loads steps for sequence cards                 */
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
        <div className="h-8 w-3/4 rounded-lg animate-pulse" style={{ background: 'var(--orbis-input)' }} />
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <>
      {steps.map((step, idx) => (
        <div key={step.id ?? idx} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 my-1">
              <Clock className="h-3 w-3" />
              {step.delay_days}d
            </div>
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
              {step.step_number ?? idx + 2}
            </div>
            {idx < steps.length - 1 && <div className="w-px h-6 mt-1" style={{ background: 'var(--orbis-border)' }} />}
          </div>
          <div className="flex-1 pb-4 pt-4">
            <p className="text-sm font-medium text-white">{step.subject}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{step.body}</p>
          </div>
        </div>
      ))}
    </>
  );
}
