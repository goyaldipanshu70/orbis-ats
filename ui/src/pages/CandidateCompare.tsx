import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GitCompareArrows,
  Search,
  Users,
  AlertTriangle,
  Trophy,
  TrendingUp,
  Brain,
  MessageSquare,
  Mail,
  Briefcase,
  ChevronRight,
  Sparkles,
  BarChart3,
  X,
  CheckCircle2,
  Star,
} from 'lucide-react';
import type { Job } from '@/types/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface CandidateOption {
  id: number;
  name: string;
  email: string;
}

interface ComparisonScorecard {
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  overall_score: number;
  max_overall_score: number;
  resume_score: number;
  resume_max: number;
  interview_score: number;
  interview_max: number;
  feedback_avg: number;
  skills_match: number;
  recommendation: string;
}

interface MatrixRow {
  metric: string;
  scores: Record<string, number>;
  max_score: number;
  winner_id: number | null;
}

interface ComparisonResult {
  scorecards: ComparisonScorecard[];
  comparison_matrix: MatrixRow[];
}

/* -------------------------------------------------------------------------- */
/*  Animation variants                                                        */
/* -------------------------------------------------------------------------- */

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatLabel(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getScoreColor(pct: number): string {
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#10b981';
  if (pct >= 40) return '#f59e0b';
  if (pct >= 20) return '#f97316';
  return '#ef4444';
}

function getScoreBg(pct: number): string {
  if (pct >= 80) return 'bg-green-50 dark:bg-green-950/30';
  if (pct >= 60) return 'bg-emerald-50 dark:bg-emerald-950/30';
  if (pct >= 40) return 'bg-amber-50 dark:bg-amber-950/30';
  return 'bg-red-50 dark:bg-red-950/30';
}

function getScoreTextClass(pct: number): string {
  if (pct >= 80) return 'text-green-600 dark:text-green-400';
  if (pct >= 60) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function ScoreRing({ score, maxScore, size = 90 }: { score: number; maxScore: number; size?: number }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const color = getScoreColor(pct);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/30"
          strokeWidth={7}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-bold tracking-tight"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {pct}
        </motion.span>
        <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

function scoreColor(score: number, maxScore: number): string {
  if (maxScore <= 0) return 'text-muted-foreground';
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return 'text-green-600 dark:text-green-400 font-semibold';
  if (pct >= 60) return 'text-emerald-600 dark:text-emerald-400 font-medium';
  if (pct >= 40) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-red-600 dark:text-red-400 font-medium';
}

function ScorePill({ score, max, label }: { score: number; max: number; label?: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreBg(pct)} ${getScoreTextClass(pct)}`}>
      {label && <span>{label}:</span>}
      <span>{typeof score === 'number' ? (Number.isInteger(score) ? score : score.toFixed(1)) : score}</span>
      {max > 0 && <span className="opacity-60">/ {max}</span>}
    </div>
  );
}

const avatarGradients = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
];

/* -------------------------------------------------------------------------- */
/*  Main Component                                                           */
/* -------------------------------------------------------------------------- */

export default function CandidateCompare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJdId = searchParams.get('jd_id') || '';
  const { toast } = useToast();

  // State: job selection
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJdId);

  // State: candidate selection
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [candidateSearch, setCandidateSearch] = useState('');

  // State: comparison result
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- Load jobs on mount ---- */
  useEffect(() => {
    setJobsLoading(true);
    apiClient
      .getJobs(1, 100)
      .then((res) => setJobs(res.items || []))
      .catch(() => toast({ title: 'Error', description: 'Failed to load jobs', variant: 'destructive' }))
      .finally(() => setJobsLoading(false));
  }, []);

  /* ---- Load candidates when job changes ---- */
  useEffect(() => {
    if (!selectedJobId) {
      setCandidates([]);
      setSelectedIds(new Set());
      setResult(null);
      return;
    }

    setCandidatesLoading(true);
    setSelectedIds(new Set());
    setCandidateSearch('');
    setResult(null);

    apiClient
      .rankCandidates(Number(selectedJobId))
      .then((res: any) => {
        const rankings = res.rankings ?? res ?? [];
        const mapped: CandidateOption[] = rankings.map((c: any) => ({
          id: c.candidate_id ?? c.id,
          name: c.name ?? c.full_name ?? `Candidate ${c.candidate_id ?? c.id}`,
          email: c.email ?? '',
        }));
        setCandidates(mapped);
      })
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to load candidates', variant: 'destructive' });
        setCandidates([]);
      })
      .finally(() => setCandidatesLoading(false));
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedJobId) {
      setSearchParams({ jd_id: selectedJobId }, { replace: true });
    }
  }, [selectedJobId]);

  /* ---- Toggle candidate selection ---- */
  const toggleCandidate = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      } else {
        toast({
          title: 'Max 4 candidates',
          description: 'You can compare up to 4 candidates at a time',
        });
      }
      return next;
    });
  };

  /* ---- Run comparison ---- */
  const handleCompare = async () => {
    if (selectedIds.size < 2) {
      toast({ title: 'Select candidates', description: 'Please select at least 2 candidates to compare' });
      return;
    }
    if (!selectedJobId) {
      toast({ title: 'Select a job', description: 'Please select a job first' });
      return;
    }

    setComparing(true);
    setError(null);
    try {
      const data = await apiClient.compareCandidates(
        Array.from(selectedIds),
        Number(selectedJobId)
      );
      setResult(data);
    } catch (err: any) {
      console.error('Compare failed:', err);
      setError(err.message || 'Failed to compare candidates');
      toast({ title: 'Error', description: 'Comparison failed', variant: 'destructive' });
    } finally {
      setComparing(false);
    }
  };

  return (
    <AppLayout>
      <motion.div
        className="space-y-8 max-w-[1400px] mx-auto"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <motion.div variants={fadeIn} custom={0} className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                <GitCompareArrows className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Compare Candidates</h1>
                <p className="text-sm text-muted-foreground">
                  Side-by-side analysis of up to 4 candidates
                </p>
              </div>
            </div>
          </div>
          {result && (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs font-medium">
              <BarChart3 className="h-3.5 w-3.5" />
              {result.scorecards.length} candidates compared
            </Badge>
          )}
        </motion.div>

        {/* ── Controls Card ────────────────────────────────────────── */}
        <motion.div variants={fadeIn} custom={1}>
          <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-6 space-y-5">
              {/* Job selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Select Job Position
                </label>
                {jobsLoading ? (
                  <Skeleton className="h-11 w-full max-w-lg rounded-xl" />
                ) : (
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger className="w-full max-w-lg h-11 rounded-xl border-border/60 focus:ring-2 focus:ring-blue-500/20">
                      <SelectValue placeholder="Choose a job to compare candidates..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((j) => (
                        <SelectItem key={j.job_id} value={j.job_id}>
                          {j.job_title || `Job ${j.job_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Candidate multi-select */}
              <AnimatePresence>
                {selectedJobId && (
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Select Candidates
                        <Badge variant="outline" className="ml-1 text-xs font-normal rounded-full px-2">
                          {selectedIds.size} / 4
                        </Badge>
                      </label>
                      {selectedIds.size > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          <X className="h-3 w-3" />
                          Clear all
                        </Button>
                      )}
                    </div>

                    {candidatesLoading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-14 w-full rounded-xl" />
                        ))}
                      </div>
                    ) : candidates.length === 0 ? (
                      <div className="text-center py-10 rounded-xl border border-dashed border-border/60 bg-muted/20">
                        <Users className="h-9 w-9 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">No candidates found</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">This job has no candidates yet</p>
                      </div>
                    ) : (
                      <>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                        <input
                            type="text"
                            placeholder="Search candidates..."
                            value={candidateSearch}
                            onChange={(e) => setCandidateSearch(e.target.value)}
                            className="w-full h-9 rounded-xl border border-border/50 bg-muted/30 pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/40"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                        {candidates.filter((c) => {
                            if (!candidateSearch.trim()) return true;
                            const q = candidateSearch.toLowerCase();
                            return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                        }).map((c) => {
                          const isSelected = selectedIds.has(c.id);
                          return (
                            <motion.label
                              key={c.id}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'border-blue-400/60 bg-blue-50/70 dark:bg-blue-950/20 shadow-sm shadow-blue-500/10'
                                  : 'border-border/50 hover:border-border hover:bg-muted/40'
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleCandidate(c.id)}
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{c.name}</p>
                                {c.email && (
                                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    {c.email}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              )}
                            </motion.label>
                          );
                        })}
                      </div>
                    </>
                    )}

                    {/* Compare button */}
                    <div className="flex justify-end pt-1">
                      <Button
                        onClick={handleCompare}
                        disabled={comparing || selectedIds.size < 2}
                        className="min-w-[160px] h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
                      >
                        {comparing ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Analyzing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Compare ({selectedIds.size})
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Error ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && !comparing && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <Card className="rounded-xl border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto mb-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Something went wrong</p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl"
                    onClick={handleCompare}
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Comparison Result ───────────────────────────────────── */}
        <AnimatePresence>
          {result && (
            <motion.div
              className="space-y-8"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              {/* Side-by-side candidate cards */}
              <div className={`grid gap-5 ${
                result.scorecards.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : result.scorecards.length === 3
                    ? 'grid-cols-1 md:grid-cols-3'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
              }`}>
                {result.scorecards.map((sc, idx) => {
                  const isTopScorer = result.scorecards.every(
                    (other) => sc.overall_score >= other.overall_score
                  );

                  return (
                    <motion.div
                      key={sc.candidate_id}
                      variants={fadeIn}
                      custom={idx}
                    >
                      <Card
                        className={`relative rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg group ${
                          isTopScorer
                            ? 'ring-2 ring-amber-400/70 shadow-md shadow-amber-500/10'
                            : 'border-border/50 hover:border-border shadow-sm'
                        }`}
                      >
                        {/* Top accent bar */}
                        <div className={`h-1 w-full ${isTopScorer ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-blue-400/40 to-indigo-400/40'}`} />

                        {isTopScorer && (
                          <div className="absolute top-3 right-3">
                            <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                              <Trophy className="h-3 w-3" /> Best Match
                            </div>
                          </div>
                        )}

                        <CardContent className="p-6 pt-5">
                          {/* Avatar + Name */}
                          <div className="flex flex-col items-center text-center gap-4 mb-6">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} text-white text-xl font-bold shadow-lg`}>
                              {(sc.candidate_name || '?')[0].toUpperCase()}
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-sm leading-tight">{sc.candidate_name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                                <Mail className="h-3 w-3 shrink-0" />
                                {sc.candidate_email || 'N/A'}
                              </p>
                            </div>
                            <ScoreRing
                              score={sc.overall_score}
                              maxScore={sc.max_overall_score || 100}
                            />
                          </div>

                          {/* Score breakdown */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 transition-colors hover:bg-muted/60">
                              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Brain className="h-4 w-4" />
                                Resume
                              </span>
                              <span className={`text-sm ${scoreColor(sc.resume_score, sc.resume_max)}`}>
                                {sc.resume_score}/{sc.resume_max}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 transition-colors hover:bg-muted/60">
                              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <TrendingUp className="h-4 w-4" />
                                Interview
                              </span>
                              <span className={`text-sm ${scoreColor(sc.interview_score, sc.interview_max)}`}>
                                {sc.interview_score}/{sc.interview_max}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 transition-colors hover:bg-muted/60">
                              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MessageSquare className="h-4 w-4" />
                                Feedback
                              </span>
                              <span className={`text-sm ${scoreColor(sc.feedback_avg, 5)}`}>
                                {sc.feedback_avg > 0 ? sc.feedback_avg.toFixed(1) : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 transition-colors hover:bg-muted/60">
                              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Star className="h-4 w-4" />
                                Skills Match
                              </span>
                              <span className={`text-sm ${scoreColor(sc.skills_match, 100)}`}>
                                {sc.skills_match}%
                              </span>
                            </div>
                          </div>

                          {/* Recommendation */}
                          {sc.recommendation && (
                            <div className="mt-4 pt-4 border-t border-border/40">
                              <p className="text-xs text-muted-foreground font-medium mb-1">Recommendation</p>
                              <Badge
                                variant="secondary"
                                className={`text-xs font-medium ${
                                  sc.recommendation.toLowerCase().includes('strong')
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : sc.recommendation.toLowerCase().includes('not')
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}
                              >
                                {sc.recommendation}
                              </Badge>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Comparison Matrix */}
              {result.comparison_matrix && result.comparison_matrix.length > 0 && (
                <motion.div variants={fadeIn} custom={result.scorecards.length}>
                  <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                      <CardTitle className="text-base flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                          <BarChart3 className="h-4 w-4 text-white" />
                        </div>
                        Detailed Comparison Matrix
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="w-52 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3.5">
                                Metric
                              </TableHead>
                              {result.scorecards.map((sc, idx) => (
                                <TableHead
                                  key={sc.candidate_id}
                                  className="text-center font-semibold min-w-[140px] py-3.5"
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    <div className={`h-6 w-6 rounded-md bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} flex items-center justify-center text-white text-[10px] font-bold`}>
                                      {(sc.candidate_name || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="text-sm truncate max-w-[100px]">{sc.candidate_name}</span>
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.comparison_matrix.map((row, idx) => (
                              <TableRow
                                key={idx}
                                className="hover:bg-muted/20 transition-colors"
                              >
                                <TableCell className="font-medium text-sm py-3.5">
                                  {formatLabel(row.metric)}
                                </TableCell>
                                {result.scorecards.map((sc) => {
                                  const val = row.scores[String(sc.candidate_id)] ?? 0;
                                  const isWinner =
                                    row.winner_id !== null &&
                                    row.winner_id === sc.candidate_id;

                                  return (
                                    <TableCell
                                      key={sc.candidate_id}
                                      className={`text-center text-sm py-3.5 transition-colors ${
                                        isWinner
                                          ? 'bg-green-50/70 dark:bg-green-950/20'
                                          : ''
                                      }`}
                                    >
                                      <div className="flex items-center justify-center gap-1.5">
                                        {isWinner ? (
                                          <ScorePill
                                            score={typeof val === 'number' ? val : 0}
                                            max={row.max_score}
                                          />
                                        ) : (
                                          <>
                                            <span className="text-muted-foreground">
                                              {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}
                                            </span>
                                            {row.max_score > 0 && (
                                              <span className="text-xs text-muted-foreground/60">/ {row.max_score}</span>
                                            )}
                                          </>
                                        )}
                                        {isWinner && (
                                          <Trophy className="h-3.5 w-3.5 text-amber-500 ml-0.5" />
                                        )}
                                      </div>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty state (no comparison run yet) ─────────────────── */}
        <AnimatePresence>
          {!result && !comparing && !error && selectedJobId && candidates.length > 0 && selectedIds.size === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="rounded-xl border-dashed border-border/60 bg-muted/10">
                <CardContent className="py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mx-auto mb-5">
                    <GitCompareArrows className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold">Select candidates to compare</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                    Choose 2 to 4 candidates from the list above, then click Compare for a detailed side-by-side analysis
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
}
