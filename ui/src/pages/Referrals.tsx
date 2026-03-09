import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { useClientPagination } from '@/hooks/useClientPagination';
import { DataPagination } from '@/components/DataPagination';
import { CountingNumber } from '@/components/ui/counting-number';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { scaleIn, fadeInUp, slideInRight, staggerContainer } from '@/lib/animations';
import {
  Link2, Users, Trophy, UserCheck, Copy, Check, DollarSign, Award,
  Clock, ShieldCheck, Gift, TrendingUp, Share2, MessageSquare, Search, ArrowUpDown,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface LeaderboardEntry {
  user_id?: number;
  referrer_name: string;
  referrer_email?: string;
  email?: string;
  total_referrals: number;
  hired_count: number;
  conversion_rate?: number;
  rewards_earned?: number;
}

interface ReferralLink {
  id: number;
  jd_id: number;
  job_title?: string;
  code: string;
  click_count: number;
  is_active: boolean;
  created_at: string;
  referrer_name?: string;
  reward_amount?: number;
  reward_currency?: string;
}

interface MyReferral {
  id: number;
  candidate_name: string;
  job_title: string;
  current_stage: string;
  referred_at: string;
  reward_status: string;
  reward_amount?: number;
  lock_in_days_remaining?: number;
  hired_at?: string;
}

interface JobOption {
  job_id: string;
  jd_id?: number;
  job_title: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const STAGE_COLORS: Record<string, string> = {
  Applied: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  Screening: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Interview: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  Offered: 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  Hired: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
};

const REWARD_COLORS: Record<string, string> = {
  Pending: 'bg-transparent text-muted-foreground border-border',
  'Lock-in Period': 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  Eligible: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Paid: 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500',
};

const PIPELINE_STAGES = ['Applied', 'Screening', 'Interview', 'Offered', 'Hired'];

const LOCK_IN_PERIOD_DAYS = 90;
const REWARD_PER_HIRE = 2500;

/* -------------------------------------------------------------------------- */
/*  Mock data for referrals tracking (TODO: replace with real API)            */
/* -------------------------------------------------------------------------- */

const MOCK_MY_REFERRALS: MyReferral[] = [
  { id: 1, candidate_name: 'Alice Chen', job_title: 'Senior Frontend Engineer', current_stage: 'Interview', referred_at: '2026-02-15', reward_status: 'Pending', reward_amount: REWARD_PER_HIRE },
  { id: 2, candidate_name: 'Bob Martinez', job_title: 'Product Manager', current_stage: 'Hired', referred_at: '2026-01-10', reward_status: 'Lock-in Period', reward_amount: REWARD_PER_HIRE, lock_in_days_remaining: 42, hired_at: '2026-02-01' },
  { id: 3, candidate_name: 'Carol Williams', job_title: 'Data Analyst', current_stage: 'Screening', referred_at: '2026-03-01', reward_status: 'Pending', reward_amount: REWARD_PER_HIRE },
  { id: 4, candidate_name: 'David Kim', job_title: 'Backend Engineer', current_stage: 'Hired', referred_at: '2025-10-05', reward_status: 'Paid', reward_amount: REWARD_PER_HIRE, hired_at: '2025-11-20' },
  { id: 5, candidate_name: 'Eva Johnson', job_title: 'UX Designer', current_stage: 'Applied', referred_at: '2026-03-05', reward_status: 'Pending', reward_amount: REWARD_PER_HIRE },
  { id: 6, candidate_name: 'Frank Liu', job_title: 'DevOps Engineer', current_stage: 'Offered', referred_at: '2026-02-20', reward_status: 'Pending', reward_amount: REWARD_PER_HIRE },
];

/* -------------------------------------------------------------------------- */
/*  Helper: Gradient progress bar                                            */
/* -------------------------------------------------------------------------- */

function PipelineProgressBar({ stage }: { stage: string }) {
  const stageIndex = PIPELINE_STAGES.indexOf(stage);
  const progress = stageIndex >= 0 ? ((stageIndex + 1) / PIPELINE_STAGES.length) * 100 : 0;

  const gradientClass =
    stage === 'Hired'
      ? 'from-green-400 to-emerald-600'
      : stage === 'Offered'
        ? 'from-amber-400 to-orange-500'
        : stage === 'Interview'
          ? 'from-purple-400 to-purple-600'
          : 'from-blue-400 to-blue-600';

  return (
    <div className="flex items-center gap-2.5 min-w-[140px]">
      <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`h-full rounded-full bg-gradient-to-r ${gradientClass}`}
        />
      </div>
      <span className="text-[11px] text-muted-foreground font-semibold tabular-nums whitespace-nowrap">
        {stageIndex + 1}/{PIPELINE_STAGES.length}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helper: Reward Journey timeline                                          */
/* -------------------------------------------------------------------------- */

const JOURNEY_STEPS = ['Referral Made', 'Candidate Hired', 'Lock-in Period', 'Reward Paid'];

function RewardTimeline() {
  return (
    <div className="relative pl-1">
      {JOURNEY_STEPS.map((step, i) => {
        const isLast = i === JOURNEY_STEPS.length - 1;
        return (
          <div key={step} className="flex items-start gap-3 relative">
            {/* vertical connector line */}
            {!isLast && (
              <div className="absolute left-[11px] top-[26px] w-0.5 h-[calc(100%-2px)] bg-border" />
            )}
            {/* numbered circle */}
            <div className="relative z-10 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shrink-0">
              {i + 1}
            </div>
            <span className="text-[13px] pt-0.5 pb-3 text-foreground/80">{step}</span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function Referrals() {
  const { toast } = useToast();

  // Create referral state
  const [selectedJobId, setSelectedJobId] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // My Referrals search & sort
  const [referralSearch, setReferralSearch] = useState('');
  const [referralSort, setReferralSort] = useState<string>('newest');

  /* -- Data Fetching ---------------------------------------------------- */

  const { data: leaderboard = [], isLoading: loadingLeaderboard } = useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: async () => {
      const data = await apiClient.getReferralLeaderboard();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: myLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['referral-links'],
    queryFn: async () => {
      const linksData = await apiClient.getReferralLinks();
      const links = Array.isArray(linksData) ? linksData : [];
      try {
        const jobsResult = await apiClient.getJobs(1, 100);
        const jobItems = jobsResult?.items ?? [];
        const jdTitleMap: Record<number, string> = {};
        for (const j of jobItems) {
          const id = j.jd_id ?? j.job_id;
          if (id) jdTitleMap[Number(id)] = j.job_title || `Job #${id}`;
        }
        return links.map((l: any) => ({ ...l, job_title: jdTitleMap[l.jd_id] || l.job_title }));
      } catch {
        return links;
      }
    },
  });

  // TODO: Replace mock data with apiClient.getMyReferrals() when backend returns full referral tracking data
  const { data: myReferrals = MOCK_MY_REFERRALS, isLoading: loadingReferrals } = useQuery({
    queryKey: ['my-referrals'],
    queryFn: async () => {
      try {
        const data = await apiClient.getMyReferrals();
        if (Array.isArray(data) && data.length > 0) return data as MyReferral[];
        return MOCK_MY_REFERRALS;
      } catch {
        return MOCK_MY_REFERRALS;
      }
    },
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['referral-jobs'],
    queryFn: async () => {
      const result = await apiClient.getJobs(1, 100);
      return (result?.items ?? []) as JobOption[];
    },
  });

  /* -- KPI Computations ------------------------------------------------- */

  const kpis = useMemo(() => {
    const totalReferrals = myReferrals.length;
    const inProgress = myReferrals.filter(r => !['Hired'].includes(r.current_stage)).length;
    const hired = myReferrals.filter(r => r.current_stage === 'Hired').length;
    const rewardsEarned = myReferrals
      .filter(r => r.reward_status === 'Paid')
      .reduce((sum, r) => sum + (r.reward_amount || 0), 0);
    return { totalReferrals, inProgress, hired, rewardsEarned };
  }, [myReferrals]);

  /* -- Filtered & sorted referrals ---------------------------------------- */

  const filteredSortedReferrals = useMemo(() => {
    let items = [...myReferrals];

    // Search filter
    if (referralSearch.trim()) {
      const q = referralSearch.toLowerCase();
      items = items.filter(
        (r) =>
          r.candidate_name.toLowerCase().includes(q) ||
          r.job_title.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (referralSort) {
      case 'newest':
        items.sort((a, b) => new Date(b.referred_at).getTime() - new Date(a.referred_at).getTime());
        break;
      case 'oldest':
        items.sort((a, b) => new Date(a.referred_at).getTime() - new Date(b.referred_at).getTime());
        break;
      case 'stage':
        items.sort((a, b) => PIPELINE_STAGES.indexOf(b.current_stage) - PIPELINE_STAGES.indexOf(a.current_stage));
        break;
      case 'name':
        items.sort((a, b) => a.candidate_name.localeCompare(b.candidate_name));
        break;
    }

    return items;
  }, [myReferrals, referralSearch, referralSort]);

  const referralPagination = useClientPagination(filteredSortedReferrals, { pageSize: 10 });

  /* -- Leaderboard pagination --------------------------------------------- */

  const sortedLeaderboard = useMemo(
    () => [...leaderboard].sort((a, b) => (b.hired_count || 0) - (a.hired_count || 0)),
    [leaderboard]
  );

  const leaderboardPagination = useClientPagination(sortedLeaderboard, { pageSize: 10 });

  /* -- Handlers --------------------------------------------------------- */

  const handleGenerateLink = async () => {
    if (!selectedJobId) return;
    setCreating(true);
    try {
      const result = await apiClient.createReferralLink(Number(selectedJobId));
      const code = result?.code || result?.referral_code || 'REF' + Date.now();
      const link = `${window.location.origin}/careers/${selectedJobId}?ref=${code}`;
      setGeneratedLink(link);
      setGeneratedCode(code);
      toast({ title: 'Success', description: 'Referral link generated' });
    } catch {
      toast({ title: 'Error', description: 'Failed to generate referral link', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'message') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2000);
      }
      toast({ title: 'Copied', description: `${type === 'link' ? 'Referral link' : 'Share message'} copied to clipboard` });
    }).catch(() => {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    });
  };

  const selectedJob = jobs.find(j => String(j.jd_id ?? j.job_id) === selectedJobId);
  const shareMessage = generatedLink
    ? `Hey! I think you'd be great for the ${selectedJob?.job_title || 'open'} position at our company. Apply here: ${generatedLink}`
    : '';

  /* -- Render ----------------------------------------------------------- */

  return (
    <AppLayout>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight">Referral Portal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Refer candidates and earn rewards when they get hired
        </p>
      </motion.div>

      {/* ── Create Referral Card ────────────────────────────────────────── */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Card className="mb-8 overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <Link2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
              </div>
              Create Referral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 min-w-[240px]">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Select an open job
                </label>
                {loadingJobs ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <Select value={selectedJobId} onValueChange={(v) => { setSelectedJobId(v); setGeneratedLink(null); setGeneratedCode(null); }}>
                    <SelectTrigger className="h-10 rounded-lg bg-muted/30 border-border/60 hover:border-border transition-colors">
                      <SelectValue placeholder="Choose a job position..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(j => (
                        <SelectItem key={j.job_id} value={String(j.jd_id ?? j.job_id)}>
                          {j.job_title || `Job ${j.job_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                onClick={handleGenerateLink}
                disabled={!selectedJobId || creating}
                className="shrink-0 h-10 px-5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm shadow-blue-600/20 transition-all"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Link2 className="h-4 w-4" /> Generate Referral Link
                  </span>
                )}
              </Button>
            </div>

            {/* Generated Link Display */}
            {generatedLink && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="mt-5 space-y-3"
              >
                <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border/50">
                  <code className="flex-1 text-sm font-mono truncate text-foreground select-all">{generatedLink}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedLink, 'link')}
                    className="shrink-0 rounded-md gap-1.5 h-8 text-xs"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-lg border border-blue-200/70 dark:border-blue-800/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" /> Shareable Message
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{shareMessage}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(shareMessage, 'message')}
                      className="shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 h-8 w-8 p-0 rounded-md"
                    >
                      {copiedMessage ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Referrals', value: kpis.totalReferrals, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/50', ring: '' },
          { label: 'In Progress', value: kpis.inProgress, icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/50', ring: '' },
          { label: 'Hired', value: kpis.hired, icon: UserCheck, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/50', ring: 'ring-1 ring-green-200/60 dark:ring-green-800/40' },
          { label: 'Rewards Earned', value: kpis.rewardsEarned, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/50', ring: '', prefix: '$' },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={scaleIn}>
            <Card className={`border-0 shadow-sm hover:shadow-md transition-shadow duration-200 ${kpi.ring}`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">
                    {kpi.prefix || ''}<CountingNumber value={kpi.value} />
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </StaggerGrid>

      {/* ── Main content: My Referrals + Reward Policy sidebar ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">

        {/* My Referrals Table */}
        <div className="lg:col-span-3">
          <motion.div variants={fadeInUp} initial="hidden" animate="visible">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Users className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  My Referrals
                  {myReferrals.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({myReferrals.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReferrals ? (
                  <div className="space-y-3 pt-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                ) : myReferrals.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                      <Users className="h-7 w-7 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      No referrals yet. Generate a referral link above and share it with potential candidates.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Search & Sort Controls */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search by candidate or job..."
                          value={referralSearch}
                          onChange={(e) => setReferralSearch(e.target.value)}
                          className="h-9 pl-8 rounded-lg text-xs"
                        />
                      </div>
                      <Select value={referralSort} onValueChange={setReferralSort}>
                        <SelectTrigger className="h-9 w-[180px] rounded-lg text-xs">
                          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="stage">Stage</SelectItem>
                          <SelectItem value="name">Candidate A-Z</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {filteredSortedReferrals.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-sm text-muted-foreground">No referrals match your search.</p>
                      </div>
                    ) : (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/40 hover:bg-transparent">
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Candidate</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Position</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Stage</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Referred</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Progress</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Reward</TableHead>
                          </TableRow>
                        </TableHeader>
                        <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
                          {referralPagination.pageItems.map((referral) => (
                            <motion.tr
                              key={referral.id}
                              variants={fadeInUp}
                              className="border-b border-border/30 transition-colors hover:bg-muted/30"
                            >
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                    {(referral.candidate_name || '?').split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <span className="font-medium text-sm">{referral.candidate_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{referral.job_title}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${STAGE_COLORS[referral.current_stage] || 'bg-muted text-muted-foreground'}`}
                                >
                                  {referral.current_stage}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground tabular-nums">
                                {new Date(referral.referred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </TableCell>
                              <TableCell>
                                <PipelineProgressBar stage={referral.current_stage} />
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${REWARD_COLORS[referral.reward_status] || 'bg-muted text-muted-foreground'}`}
                                >
                                  {referral.reward_status}
                                  {referral.reward_status === 'Lock-in Period' && referral.lock_in_days_remaining != null && (
                                    <span className="ml-1 opacity-80">({referral.lock_in_days_remaining}d)</span>
                                  )}
                                </Badge>
                              </TableCell>
                            </motion.tr>
                          ))}
                        </motion.tbody>
                      </Table>
                    </div>
                    )}

                    <DataPagination
                      page={referralPagination.page}
                      totalPages={referralPagination.totalPages}
                      total={referralPagination.total}
                      pageSize={referralPagination.pageSize}
                      onPageChange={referralPagination.setPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Reward Policy Sidebar */}
        <div className="lg:col-span-1">
          <motion.div variants={slideInRight} initial="hidden" animate="visible">
            <Card className="sticky top-4 border-0 shadow-sm overflow-hidden">
              {/* emerald accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-green-500" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Reward Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Lock-in Period */}
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Lock-in Period</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{LOCK_IN_PERIOD_DAYS} days after hire date</p>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Reward Amount */}
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 shrink-0">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Reward per Hire</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">${REWARD_PER_HIRE.toLocaleString()}</p>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Eligibility Rules */}
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">Eligibility</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      {[
                        'Candidate must be hired',
                        `Complete ${LOCK_IN_PERIOD_DAYS}-day lock-in`,
                        'No self-referrals',
                        'One reward per candidate',
                      ].map((rule) => (
                        <li key={rule} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Reward Journey Timeline */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Reward Journey
                  </p>
                  <RewardTimeline />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* ── Referral Leaderboard ────────────────────────────────────────── */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Trophy className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              Referral Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLeaderboard ? (
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-16">
                <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-7 w-7 text-amber-400" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  No referral data yet. Be the first to refer a candidate and top the leaderboard!
                </p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="w-16 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Rank</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Referrer</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Referrals</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Hires</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Rewards</TableHead>
                    </TableRow>
                  </TableHeader>
                  <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
                    {leaderboardPagination.pageItems.map((entry, idx) => {
                        const rank = (leaderboardPagination.page - 1) * leaderboardPagination.pageSize + idx + 1;
                        const rewardsEst = (entry.hired_count || 0) * REWARD_PER_HIRE;

                        return (
                          <motion.tr
                            key={entry.user_id ?? idx}
                            variants={fadeInUp}
                            className="border-b border-border/30 transition-colors hover:bg-muted/30"
                          >
                            <TableCell>
                              {rank <= 3 ? (
                                <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold ${
                                  rank === 1
                                    ? 'bg-gradient-to-br from-amber-200 to-amber-300 dark:from-amber-700 dark:to-amber-800 text-amber-800 dark:text-amber-100 shadow-sm'
                                    : rank === 2
                                      ? 'bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                                      : 'bg-gradient-to-br from-orange-200 to-orange-300 dark:from-orange-700 dark:to-orange-800 text-orange-800 dark:text-orange-100 shadow-sm'
                                }`}>
                                  {rank === 1 ? <Trophy className="h-4 w-4" /> : rank}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm pl-2.5 tabular-nums">{rank}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                                  {(entry.referrer_name || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{entry.referrer_name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">{entry.referrer_email || entry.email || ''}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{entry.total_referrals ?? 0}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-0 tabular-nums">
                                {entry.hired_count ?? 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              ${(entry.rewards_earned ?? rewardsEst).toLocaleString()}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                  </motion.tbody>
                </Table>
              </div>
              <DataPagination
                page={leaderboardPagination.page}
                totalPages={leaderboardPagination.totalPages}
                total={leaderboardPagination.total}
                pageSize={leaderboardPagination.pageSize}
                onPageChange={leaderboardPagination.setPage}
              />
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
