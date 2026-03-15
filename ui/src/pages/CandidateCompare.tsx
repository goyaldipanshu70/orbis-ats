import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
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
  Bot,
} from 'lucide-react';
import type { Job } from '@/types/api';

/* -------------------------------------------------------------------------- */
/*  Design system constants                                                    */
/* -------------------------------------------------------------------------- */

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
const gradientBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
  boxShadow: '0 8px 24px rgba(27,142,229,0.2)',
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
  ai_interview_score: number;
  ai_interview_max: number;
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

function getScoreBgStyle(pct: number): React.CSSProperties {
  if (pct >= 80) return { background: 'rgba(34,197,94,0.10)' };
  if (pct >= 60) return { background: 'rgba(16,185,129,0.10)' };
  if (pct >= 40) return { background: 'rgba(245,158,11,0.10)' };
  return { background: 'rgba(239,68,68,0.10)' };
}

function getScoreTextClass(pct: number): string {
  if (pct >= 80) return 'text-green-400';
  if (pct >= 60) return 'text-emerald-400';
  if (pct >= 40) return 'text-amber-400';
  return 'text-red-400';
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
          stroke="var(--orbis-hover)"
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
        <span className="text-[10px] text-slate-500 font-medium">/ 100</span>
      </div>
    </div>
  );
}

function scoreColor(score: number, maxScore: number): string {
  if (maxScore <= 0) return 'text-slate-500';
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return 'text-green-400 font-semibold';
  if (pct >= 60) return 'text-emerald-400 font-medium';
  if (pct >= 40) return 'text-amber-400 font-medium';
  return 'text-red-400 font-medium';
}

function ScorePill({ score, max, label }: { score: number; max: number; label?: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreTextClass(pct)}`}
      style={getScoreBgStyle(pct)}
    >
      {label && <span>{label}:</span>}
      <span>{typeof score === 'number' ? (Number.isInteger(score) ? score : score.toFixed(1)) : score}</span>
      {max > 0 && <span className="opacity-60">/ {max}</span>}
    </span>
  );
}

const avatarGradients = [
  'from-blue-500 to-blue-600',
  'from-blue-500 to-blue-600',
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
      .rankCandidates({ jd_id: Number(selectedJobId) })
      .then((res: any) => {
        const rankings = res.rankings ?? res ?? [];
        const mapped: CandidateOption[] = rankings.map((c: any) => ({
          id: c.candidate_id ?? c.id,
          name: c.candidate_name ?? c.name ?? c.full_name ?? `Candidate ${c.candidate_id ?? c.id}`,
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
        {/* -- Header -------------------------------------------------- */}
        <motion.div variants={fadeIn} custom={0} className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <GitCompareArrows className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Compare Candidates</h1>
                <p className="text-sm text-slate-400">
                  Side-by-side analysis of up to 4 candidates
                </p>
              </div>
            </div>
          </div>
          {result && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 rounded-full"
              style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-hover)' }}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {result.scorecards.length} candidates compared
            </span>
          )}
        </motion.div>

        {/* -- Controls Card ------------------------------------------- */}
        <motion.div variants={fadeIn} custom={1}>
          <div className="rounded-2xl overflow-hidden" style={glassCard}>
            <div className="p-6 space-y-5">
              {/* Job selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-white">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  Select Job Position
                </label>
                {jobsLoading ? (
                  <div className="h-11 w-full max-w-lg rounded-xl animate-pulse" style={{ background: 'var(--orbis-input)' }} />
                ) : (
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger
                      className="w-full max-w-lg h-11 rounded-xl text-white focus:ring-2 focus:ring-blue-500/30"
                      style={glassInput}
                    >
                      <SelectValue placeholder="Choose a job to compare candidates..." />
                    </SelectTrigger>
                    <SelectContent style={selectDrop}>
                      {jobs.map((j) => (
                        <SelectItem key={j.job_id} value={j.job_id} className={sItemCls}>
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
                      <label className="text-sm font-medium flex items-center gap-2 text-white">
                        <Users className="h-4 w-4 text-slate-400" />
                        Select Candidates
                        <span
                          className="ml-1 text-xs font-normal rounded-full px-2 py-0.5 text-slate-400"
                          style={{ border: '1px solid var(--orbis-border)' }}
                        >
                          {selectedIds.size} / 4
                        </span>
                      </label>
                      {selectedIds.size > 0 && (
                        <button
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors h-7 px-2 rounded-lg"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          <X className="h-3 w-3" />
                          Clear all
                        </button>
                      )}
                    </div>

                    {candidatesLoading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-14 w-full rounded-xl animate-pulse" style={{ background: 'var(--orbis-input)' }} />
                        ))}
                      </div>
                    ) : candidates.length === 0 ? (
                      <div
                        className="text-center py-10 rounded-xl"
                        style={{ border: '1px dashed var(--orbis-border)', background: 'var(--orbis-subtle)' }}
                      >
                        <Users className="h-9 w-9 mx-auto mb-3 text-slate-400" />
                        <p className="text-sm font-medium text-slate-400">No candidates found</p>
                        <p className="text-xs text-slate-500 mt-1">This job has no candidates yet</p>
                      </div>
                    ) : (
                      <>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search candidates..."
                            value={candidateSearch}
                            onChange={(e) => setCandidateSearch(e.target.value)}
                            className="w-full h-9 rounded-xl pl-9 pr-3 text-sm placeholder:text-slate-500 focus:outline-none transition-all"
                            style={glassInput}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
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
                              className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all duration-200"
                              style={
                                isSelected
                                  ? { background: 'rgba(27,142,229,0.12)', border: '1px solid rgba(27,142,229,0.4)' }
                                  : { background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }
                              }
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'var(--orbis-input)';
                                  e.currentTarget.style.borderColor = 'var(--orbis-border)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'var(--orbis-subtle)';
                                  e.currentTarget.style.borderColor = 'var(--orbis-border)';
                                }
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleCandidate(c.id)}
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-slate-600"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-white">{c.name}</p>
                                {c.email && (
                                  <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    {c.email}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                              )}
                            </motion.label>
                          );
                        })}
                      </div>
                    </>
                    )}

                    {/* Compare button */}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleCompare}
                        disabled={comparing || selectedIds.size < 2}
                        className="min-w-[160px] h-10 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:shadow-none hover:scale-[1.03] active:scale-[0.98] inline-flex items-center justify-center"
                        style={gradientBtn}
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
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* -- Error --------------------------------------------------- */}
        <AnimatePresence>
          {error && !comparing && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div
                className="rounded-2xl"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <div className="py-10 text-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full mx-auto mb-3"
                    style={{ background: 'rgba(245,158,11,0.12)' }}
                  >
                    <AlertTriangle className="h-6 w-6 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-amber-300">Something went wrong</p>
                  <p className="text-xs text-amber-400/60 mt-1">{error}</p>
                  <button
                    className="mt-4 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                    style={glassCard}
                    onClick={handleCompare}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -- Comparison Result --------------------------------------- */}
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
                      <div
                        className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg group"
                        style={
                          isTopScorer
                            ? {
                                background: 'var(--orbis-card)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(245,158,11,0.35)',
                                boxShadow: '0 0 30px rgba(245,158,11,0.08)',
                              }
                            : glassCard
                        }
                      >
                        {/* Top accent bar */}
                        <div
                          className="h-1 w-full"
                          style={{
                            background: isTopScorer
                              ? 'linear-gradient(to right, #f59e0b, #f97316)'
                              : 'linear-gradient(to right, rgba(22,118,192,0.3), rgba(129,140,248,0.3))',
                          }}
                        />

                        {isTopScorer && (
                          <div className="absolute top-3 right-3">
                            <span
                              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm"
                              style={{ background: 'linear-gradient(to right, #f59e0b, #f97316)', color: '#451a03' }}
                            >
                              <Trophy className="h-3 w-3" /> Best Match
                            </span>
                          </div>
                        )}

                        <div className="p-6 pt-5">
                          {/* Avatar + Name */}
                          <div className="flex flex-col items-center text-center gap-4 mb-6">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} text-white text-xl font-bold shadow-lg`}>
                              {(sc.candidate_name || '?')[0].toUpperCase()}
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-sm leading-tight text-white">{sc.candidate_name}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1 justify-center">
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
                            {[
                              { icon: Brain, label: 'Resume', value: `${sc.resume_score}/${sc.resume_max}`, sc_score: sc.resume_score, sc_max: sc.resume_max },
                              { icon: TrendingUp, label: 'Interview', value: `${sc.interview_score}/${sc.interview_max}`, sc_score: sc.interview_score, sc_max: sc.interview_max },
                              { icon: Bot, label: 'AI Interview', value: sc.ai_interview_score > 0 ? `${sc.ai_interview_score}/${sc.ai_interview_max}` : 'N/A', sc_score: sc.ai_interview_score, sc_max: sc.ai_interview_max },
                              { icon: MessageSquare, label: 'Feedback', value: sc.feedback_avg > 0 ? sc.feedback_avg.toFixed(1) : 'N/A', sc_score: sc.feedback_avg, sc_max: 5 },
                              { icon: Star, label: 'Skills Match', value: `${sc.skills_match}%`, sc_score: sc.skills_match, sc_max: 100 },
                            ].map((row) => (
                              <div
                                key={row.label}
                                className="flex items-center justify-between p-2.5 rounded-lg transition-colors"
                                style={{ background: 'var(--orbis-card)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--orbis-border)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                              >
                                <span className="flex items-center gap-2 text-sm text-slate-400">
                                  <row.icon className="h-4 w-4" />
                                  {row.label}
                                </span>
                                <span className={`text-sm ${scoreColor(row.sc_score, row.sc_max)}`}>
                                  {row.value}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Recommendation */}
                          {sc.recommendation && (
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                              <p className="text-xs text-slate-500 font-medium mb-1">Recommendation</p>
                              <span
                                className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
                                style={
                                  sc.recommendation.toLowerCase().includes('strong')
                                    ? { background: 'rgba(34,197,94,0.10)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                                    : sc.recommendation.toLowerCase().includes('not')
                                      ? { background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                                      : { background: 'rgba(22,118,192,0.10)', color: '#818cf8', border: '1px solid rgba(22,118,192,0.2)' }
                                }
                              >
                                {sc.recommendation}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Comparison Matrix */}
              {result.comparison_matrix && result.comparison_matrix.length > 0 && (
                <motion.div variants={fadeIn} custom={result.scorecards.length}>
                  <div className="rounded-2xl overflow-hidden" style={glassCard}>
                    <div
                      className="px-6 py-4 flex items-center gap-2.5"
                      style={{ borderBottom: '1px solid var(--orbis-border)' }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="text-base font-semibold text-white">Detailed Comparison Matrix</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow
                            className="hover:bg-transparent"
                            style={{ background: 'var(--orbis-subtle)', borderBottom: '1px solid var(--orbis-border)' }}
                          >
                            <TableHead className="w-52 font-semibold text-xs uppercase tracking-wider text-slate-500 py-3.5">
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
                                  <span className="text-sm truncate max-w-[100px] text-white">{sc.candidate_name}</span>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.comparison_matrix.map((row, idx) => (
                            <TableRow
                              key={idx}
                              className="transition-colors hover:bg-white/[0.02]"
                              style={{ borderBottom: '1px solid var(--orbis-grid)' }}
                            >
                              <TableCell className="font-medium text-sm py-3.5 text-slate-300">
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
                                    className="text-center text-sm py-3.5 transition-colors"
                                    style={
                                      isWinner
                                        ? { background: 'rgba(27,142,229,0.06)' }
                                        : undefined
                                    }
                                  >
                                    <div className="flex items-center justify-center gap-1.5">
                                      {isWinner ? (
                                        <ScorePill
                                          score={typeof val === 'number' ? val : 0}
                                          max={row.max_score}
                                        />
                                      ) : (
                                        <>
                                          <span className="text-slate-400">
                                            {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}
                                          </span>
                                          {row.max_score > 0 && (
                                            <span className="text-xs text-slate-400">/ {row.max_score}</span>
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
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* -- Empty state (no comparison run yet) --------------------- */}
        <AnimatePresence>
          {!result && !comparing && !error && selectedJobId && candidates.length > 0 && selectedIds.size === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <div
                className="rounded-2xl"
                style={{ background: 'var(--orbis-subtle)', border: '1px dashed var(--orbis-hover)' }}
              >
                <div className="py-16 text-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-5"
                    style={{ background: 'rgba(22,118,192,0.1)', border: '1px solid rgba(22,118,192,0.2)' }}
                  >
                    <GitCompareArrows className="h-8 w-8 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Select candidates to compare</h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                    Choose 2 to 4 candidates from the list above, then click Compare for a detailed side-by-side analysis
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
}
