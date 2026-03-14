import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadarScoreChart } from '@/components/RadarScoreChart';
import { EngagementTimeline } from '@/components/EngagementTimeline';
import { fadeInUp, staggerContainer, scaleIn } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { AnimatedProgress } from '@/components/ui/animated-progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  GitCompareArrows,
  Download,
  Star,
  Brain,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  User,
  Mail,
  TrendingUp,
  Award,
  Target,
  Shield,
  ArrowLeft,
  Sparkles,
  Zap,
  BarChart3,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Crown,
  ClipboardCheck,
  CheckCircle2,
  XOctagon,
  Plus,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Dark-glass style constants                                                */
/* -------------------------------------------------------------------------- */

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

const glassCardDashed: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px dashed var(--orbis-border)',
};

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface CategoryScore {
  category: string;
  score: number;
  max_score: number;
}

interface ResumeAI {
  total_score: number;
  max_score: number;
  category_scores: CategoryScore[];
  highlighted_skills: string[];
  red_flags: string[];
  recommendation: string;
}

interface ScoreBreakdown {
  competency: string;
  score: number;
  max_score: number;
}

interface InterviewAI {
  total_score: number;
  max_score: number;
  score_breakdown: ScoreBreakdown[];
  recommendation: string;
  strongest_competency: string;
  area_for_development: string;
  overall_impression: string;
}

interface FeedbackEntry {
  round: string;
  interviewer_name: string;
  rating: number;
  recommendation: string;
  strengths: string;
  concerns: string;
}

interface FeedbackAggregate {
  avg_rating: number;
  total_feedback: number;
  recommendation_distribution: Record<string, number>;
}

interface FeedbackData {
  entries: FeedbackEntry[];
  aggregate: FeedbackAggregate;
}

interface TimelineEvent {
  event_type: string;
  description: string;
  date: string;
  actor: string | null;
}

interface Scorecard {
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  overall_score: number;
  max_overall_score: number;
  resume_ai: ResumeAI | null;
  interview_ai: InterviewAI | null;
  feedback: FeedbackData | null;
  timeline: TimelineEvent[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const PIE_COLORS: Record<string, string> = {
  'strong_hire': '#22c55e',
  'hire': '#10b981',
  'no_hire': '#ef4444',
  'strong_no_hire': '#dc2626',
  'undecided': '#f59e0b',
  'maybe': '#f59e0b',
};

function recommendationColor(rec: string): string {
  const r = rec.toLowerCase().replace(/\s+/g, '_');
  if (r.includes('strong_hire') || r.includes('strongly_recommend')) return 'bg-green-900/40 text-green-300 border border-green-700';
  if (r.includes('hire') || r.includes('recommend')) return 'bg-emerald-900/40 text-emerald-300 border border-emerald-700';
  if (r.includes('no_hire') || r.includes('not_recommend') || r.includes('reject')) return 'bg-red-900/40 text-red-300 border border-red-700';
  return 'bg-yellow-950/40 text-yellow-300 border border-yellow-700';
}

function recommendationGradient(rec: string): string {
  const r = rec.toLowerCase().replace(/\s+/g, '_');
  if (r.includes('strong_hire') || r.includes('strongly_recommend')) return 'from-green-500 to-emerald-600';
  if (r.includes('hire') || r.includes('recommend')) return 'from-emerald-500 to-teal-600';
  if (r.includes('no_hire') || r.includes('not_recommend') || r.includes('reject')) return 'from-red-500 to-rose-600';
  return 'from-amber-500 to-orange-600';
}

function formatLabel(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(pct: number): string {
  if (pct >= 80) return '#34d399';
  if (pct >= 60) return '#3b82f6';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function scoreBarColor(pct: number): string {
  if (pct >= 80) return 'bg-gradient-to-r from-emerald-400 to-emerald-500';
  if (pct >= 60) return 'bg-gradient-to-r from-blue-400 to-blue-500';
  if (pct >= 40) return 'bg-gradient-to-r from-amber-400 to-amber-500';
  return 'bg-gradient-to-r from-red-400 to-red-500';
}

/* -------------------------------------------------------------------------- */
/*  OverallScoreRing                                                         */
/* -------------------------------------------------------------------------- */

function OverallScoreRing({ score, maxScore, size = 120, label }: { score: number; maxScore: number; size?: number; label?: string }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const color = scoreColor(pct);

  return (
    <div className="relative inline-flex flex-col items-center justify-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--orbis-border)"
            strokeWidth={8}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold"
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
      {label && (
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  StarRating                                                               */
/* -------------------------------------------------------------------------- */

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-white/10'}`}
        />
      ))}
      <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{rating}/{max}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CategoryScoreCard                                                        */
/* -------------------------------------------------------------------------- */

function CategoryScoreCard({ category, score, maxScore, index }: { category: string; score: number; maxScore: number; index: number }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl p-4 hover:shadow-md transition-all duration-300"
      style={{ ...glassCard, borderColor: 'var(--orbis-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{formatLabel(category)}</span>
        <span className="text-xs font-bold text-muted-foreground">{score}/{maxScore}</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
        <motion.div
          className={`h-full rounded-full ${scoreBarColor(pct)}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 + index * 0.1 }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground">
          {pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Average' : 'Needs work'}
        </span>
        <span className="text-[10px] font-semibold" style={{ color: scoreColor(pct) }}>{pct}%</span>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CompetencyBar                                                            */
/* -------------------------------------------------------------------------- */

function CompetencyBar({ name, score, maxScore, index }: { name: string; score: number; maxScore: number; index: number }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.08 }}
      className="group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-foreground">{formatLabel(name)}</span>
        <span className="text-xs font-bold" style={{ color: scoreColor(pct) }}>{score}/{maxScore}</span>
      </div>
      <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
        <motion.div
          className={`h-full rounded-full ${scoreBarColor(pct)}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 + index * 0.1 }}
        />
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                           */
/* -------------------------------------------------------------------------- */

export default function CandidateScorecard() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [searchParams] = useSearchParams();
  const jdId = searchParams.get('jd_id');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [screening, setScreening] = useState<any[] | null>(null);
  const [fitSummary, setFitSummary] = useState<any | null>(null);
  const [skillsGap, setSkillsGap] = useState<any | null>(null);
  const [ranking, setRanking] = useState<any | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    setError(null);

    apiClient
      .getCandidateScorecard(
        Number(candidateId),
        jdId ? Number(jdId) : undefined
      )
      .then((data: any) => {
        /* -- Transform API response to match Scorecard interface -- */

        // 1. Map candidate fields
        const candidate = data.candidate || {};
        const candidateName: string = candidate.name || data.candidate_name || '';
        const candidateEmail: string = candidate.email || data.candidate_email || '';
        const candidateIdNum: number = candidate.id || data.candidate_id || Number(candidateId);

        // 2. Transform resume_ai
        let transformedResumeAI: ResumeAI | null = null;
        if (data.resume_ai) {
          const raw = data.resume_ai;
          // category_scores: convert object {key: number} to array [{category, score, max_score}]
          let categoryScores: CategoryScore[] = [];
          if (raw.category_scores) {
            if (Array.isArray(raw.category_scores)) {
              // Already in array format
              categoryScores = raw.category_scores;
            } else {
              // Object format: { core_skills: 0, preferred_skills: 0, ... }
              categoryScores = Object.entries(raw.category_scores).map(
                ([key, value]) => ({
                  category: key,
                  score: value as number,
                  max_score: 100,
                })
              );
            }
          }
          transformedResumeAI = {
            total_score: raw.total_score ?? 0,
            max_score: raw.max_score ?? 100,
            category_scores: categoryScores,
            highlighted_skills: raw.highlighted_skills || [],
            red_flags: raw.red_flags || [],
            recommendation: raw.recommendation || raw.ai_recommendation || '',
          };
        }

        // 3. Transform interview_ai (pass through if present, already matches or is null)
        let transformedInterviewAI: InterviewAI | null = null;
        if (data.interview_ai) {
          const raw = data.interview_ai;
          transformedInterviewAI = {
            total_score: raw.total_score ?? 0,
            max_score: raw.max_score ?? 100,
            score_breakdown: raw.score_breakdown || [],
            recommendation: raw.recommendation || raw.ai_recommendation || '',
            strongest_competency: raw.strongest_competency || '',
            area_for_development: raw.area_for_development || '',
            overall_impression: raw.overall_impression || '',
          };
        }

        // 4. Transform feedback
        let transformedFeedback: FeedbackData | null = null;
        if (data.feedback) {
          const raw = data.feedback;
          const entries: FeedbackEntry[] = (raw.entries || raw.rounds || []).map(
            (r: any) => ({
              round: r.round || r.round_name || '',
              interviewer_name: r.interviewer_name || r.interviewer || '',
              rating: r.rating ?? 0,
              recommendation: r.recommendation || '',
              strengths: r.strengths || r.strength || '',
              concerns: r.concerns || r.concern || '',
            })
          );
          const agg = raw.aggregate || {};
          const aggregate: FeedbackAggregate = {
            avg_rating: agg.avg_rating ?? raw.avg_rating ?? 0,
            total_feedback: agg.total_feedback ?? entries.length,
            recommendation_distribution:
              agg.recommendation_distribution ||
              raw.recommendation_distribution ||
              {},
          };
          transformedFeedback =
            entries.length > 0 ? { entries, aggregate } : null;
        }

        // 5. Compute overall score
        const scores: number[] = [];
        const maxScores: number[] = [];
        if (transformedResumeAI) {
          scores.push(transformedResumeAI.total_score);
          maxScores.push(transformedResumeAI.max_score);
        }
        if (transformedInterviewAI) {
          scores.push(transformedInterviewAI.total_score);
          maxScores.push(transformedInterviewAI.max_score);
        }
        const overallScore =
          data.overall_score ??
          (scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0);
        const maxOverallScore =
          data.max_overall_score ??
          (maxScores.length > 0
            ? Math.round(maxScores.reduce((a, b) => a + b, 0) / maxScores.length)
            : 100);

        // 6. Timeline (pass through)
        const timeline: TimelineEvent[] = (data.timeline || []).map(
          (e: any) => ({
            event_type: e.event_type || '',
            description: e.description || '',
            date: e.date || e.created_at || '',
            actor: e.actor || null,
          })
        );

        const scorecard: Scorecard = {
          candidate_id: candidateIdNum,
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          overall_score: overallScore,
          max_overall_score: maxOverallScore,
          resume_ai: transformedResumeAI,
          interview_ai: transformedInterviewAI,
          feedback: transformedFeedback,
          timeline,
        };

        setScorecard(scorecard);
      })
      .catch((err) => {
        console.error('Failed to load scorecard:', err);
        setError(err.message || 'Failed to load candidate scorecard');
      })
      .finally(() => setLoading(false));
  }, [candidateId, jdId]);

  useEffect(() => {
    if (!candidateId) return;
    // Screening responses
    apiClient.getScreeningResponsesDetailed(Number(candidateId), jdId ? Number(jdId) : undefined)
      .then(setScreening).catch(() => {});
    // Only fetch these if jdId is provided
    if (jdId) {
      apiClient.getCandidateFitSummary({ candidate_id: Number(candidateId), jd_id: Number(jdId) })
        .then(setFitSummary).catch(() => {});
      apiClient.getSkillsGap({ candidate_id: Number(candidateId), jd_id: Number(jdId) })
        .then(setSkillsGap).catch(() => {});
      apiClient.rankCandidates({ jd_id: Number(jdId) })
        .then((res: any) => {
          const match = (res.rankings || []).find((r: any) => r.candidate_id === Number(candidateId));
          if (match) setRanking(match);
        }).catch(() => {});
    }
  }, [candidateId, jdId]);

  const handleExport = async () => {
    if (!candidateId) return;
    setExporting(true);
    try {
      const data = await apiClient.exportCandidate(Number(candidateId));
      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidate-${candidateId}-scorecard.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Export complete', description: 'Candidate data downloaded' });
    } catch {
      toast({ title: 'Export failed', description: 'Could not export candidate data', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
          <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-5 w-24 rounded-lg animate-pulse bg-white/10" />
                <div className="h-8 w-64 rounded-lg animate-pulse bg-white/10" />
                <div className="h-4 w-48 rounded-lg animate-pulse bg-white/10" />
              </div>
              <div className="h-28 w-28 rounded-full animate-pulse bg-white/10" />
            </div>
            <div className="h-12 w-full max-w-lg rounded-xl animate-pulse bg-white/10" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80 rounded-2xl animate-pulse bg-white/10" />
              <div className="h-80 rounded-2xl animate-pulse bg-white/10" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ---- Error state ---- */
  if (error || !scorecard) {
    return (
      <AppLayout>
        <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
          <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Failed to load scorecard</h2>
            <p className="text-sm text-muted-foreground max-w-md text-center leading-relaxed">
              {error || 'Scorecard data is not available for this candidate.'}
            </p>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-foreground transition-colors"
              style={{ ...glassCard }}
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { resume_ai, interview_ai, feedback, timeline } = scorecard;
  const overallPct = scorecard.max_overall_score > 0
    ? Math.round((scorecard.overall_score / scorecard.max_overall_score) * 100)
    : 0;

  /* ---- Radar data for Resume AI ---- */
  const radarData = (resume_ai?.category_scores || []).map((cs) => ({
    category: cs.category,
    score: cs.score,
    maxScore: cs.max_score,
  }));

  /* ---- Bar data for Interview AI ---- */
  const interviewBarData = (interview_ai?.score_breakdown || []).map((sb) => ({
    name: formatLabel(sb.competency),
    score: sb.score,
    maxScore: sb.max_score,
  }));

  /* ---- Feedback pie data ---- */
  const pieData = feedback?.aggregate?.recommendation_distribution
    ? Object.entries(feedback.aggregate.recommendation_distribution).map(([key, value]) => ({
        name: formatLabel(key),
        value,
        fill: PIE_COLORS[key] || '#6b7280',
      }))
    : [];

  // Count available sections for quick stats
  const sectionCount = [resume_ai, interview_ai, feedback, timeline.length > 0].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
        <div className="max-w-[1200px] mx-auto px-6 py-8">

          {/* -- Header ---------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="rounded-2xl p-6" style={glassCard}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Avatar + info */}
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B8EE5] to-blue-600 text-white text-2xl font-bold shadow-lg shadow-blue-600/20">
                    {(scorecard.candidate_name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {scorecard.candidate_name}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{scorecard.candidate_email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-0.5 font-medium text-muted-foreground"
                        style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
                      >
                        <FileText className="h-3 w-3" />
                        {sectionCount} sections available
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-0.5 font-medium"
                        style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)', color: scoreColor(overallPct) }}
                      >
                        <Sparkles className="h-3 w-3" />
                        {overallPct >= 80 ? 'Top Candidate' : overallPct >= 60 ? 'Strong' : overallPct >= 40 ? 'Average' : 'Below Average'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Score + Actions */}
                <div className="flex items-center gap-6">
                  <OverallScoreRing
                    score={scorecard.overall_score}
                    maxScore={scorecard.max_overall_score || 100}
                    size={100}
                    label="Overall"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() =>
                        navigate(jdId ? `/compare?jd_id=${jdId}` : '/compare')
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl text-xs h-9 px-3 font-medium text-foreground transition-colors hover:bg-white/10"
                      style={glassCard}
                    >
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      Compare
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="inline-flex items-center gap-1.5 rounded-xl text-xs h-9 px-3 font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-50"
                      style={glassCard}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {exporting ? 'Exporting...' : 'Export'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* -- Tabs ------------------------------------------------------ */}
          <Tabs defaultValue="overview" className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <TabsList className="w-full justify-start gap-1 rounded-xl p-1 h-auto" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
                <TabsTrigger value="overview" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
                  <Sparkles className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="screening" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
                  <ClipboardCheck className="h-4 w-4" />
                  Screening
                </TabsTrigger>
                <TabsTrigger value="interview" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
                  <Target className="h-4 w-4" />
                  Interviews
                </TabsTrigger>
                <TabsTrigger value="feedback" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
                  <MessageSquare className="h-4 w-4" />
                  Feedback
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
                  <Clock className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
              </TabsList>
            </motion.div>

            {/* -- Tab: Overview ------------------------------------------- */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ---- Left column ---- */}
                <div className="space-y-6">
                  {/* AI Fit Summary */}
                  {fitSummary ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                      <div className="rounded-2xl overflow-hidden" style={glassCard}>
                        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-600" />
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                              <Sparkles className="h-4 w-4 text-blue-500" />
                            </div>
                            AI Fit Summary
                            {fitSummary.rating && (
                              <span className="ml-auto inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-900/40 text-blue-300 border border-blue-700">
                                {formatLabel(fitSummary.rating)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="px-6 pb-6 space-y-4">
                          {/* Strengths */}
                          {fitSummary.strengths && fitSummary.strengths.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-green-400/80 uppercase tracking-wider mb-2">Strengths</p>
                              <div className="space-y-2">
                                {fitSummary.strengths.map((s: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className="mt-1.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                                    <div>
                                      <span className="text-sm font-semibold text-foreground">{typeof s === 'string' ? s : s.point || s.title}</span>
                                      {typeof s !== 'string' && s.evidence && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{s.evidence}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Concerns */}
                          {fitSummary.concerns && fitSummary.concerns.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-amber-400/80 uppercase tracking-wider mb-2">Concerns</p>
                              <div className="space-y-2">
                                {fitSummary.concerns.map((c: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <span className="text-sm text-muted-foreground">{typeof c === 'string' ? c : c.point || c.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Recommendation */}
                          {fitSummary.recommendation && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--orbis-input)' }}>
                              <p className="text-xs text-muted-foreground leading-relaxed">{fitSummary.recommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="rounded-2xl py-12 text-center" style={glassCardDashed}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'var(--orbis-border)' }}>
                          <Sparkles className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No AI Fit Summary</p>
                        <p className="text-xs text-muted-foreground mt-1">Apply with a specific job to see fit analysis.</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Skills Gap */}
                  {skillsGap ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                      <div className="rounded-2xl overflow-hidden" style={glassCard}>
                        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
                              <Target className="h-4 w-4 text-blue-500" />
                            </div>
                            Skills Gap Analysis
                            {skillsGap.match_pct != null && (
                              <span className="ml-auto">
                                <OverallScoreRing score={skillsGap.match_pct} maxScore={100} size={56} />
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="px-6 pb-6 space-y-3">
                          {/* Matched */}
                          {skillsGap.matched && skillsGap.matched.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-bold text-green-400/80 uppercase tracking-wider">Matched Skills</p>
                              <div className="flex flex-wrap gap-1.5">
                                {skillsGap.matched.map((s: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-green-300" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                                    <CheckCircle2 className="h-3 w-3" />{s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Missing */}
                          {skillsGap.missing && skillsGap.missing.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-bold text-red-400/80 uppercase tracking-wider">Missing Skills</p>
                              <div className="flex flex-wrap gap-1.5">
                                {skillsGap.missing.map((s: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    <XOctagon className="h-3 w-3" />{s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Bonus */}
                          {skillsGap.bonus && skillsGap.bonus.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-bold text-blue-400/80 uppercase tracking-wider">Bonus Skills</p>
                              <div className="flex flex-wrap gap-1.5">
                                {skillsGap.bonus.map((s: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-blue-300" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                                    <Plus className="h-3 w-3" />{s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="rounded-2xl py-12 text-center" style={glassCardDashed}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'var(--orbis-border)' }}>
                          <Target className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No Skills Gap Data</p>
                        <p className="text-xs text-muted-foreground mt-1">Apply with a specific job to see skills analysis.</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ---- Right column ---- */}
                <div className="space-y-6">
                  {/* Resume AI Score compact card */}
                  {resume_ai ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                      <div className="rounded-2xl overflow-hidden" style={glassCard}>
                        <div className={`h-1.5 bg-gradient-to-r ${recommendationGradient(resume_ai.recommendation)}`} />
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>
                              <Brain className="h-4 w-4 text-amber-500" />
                            </div>
                            Resume AI Score
                          </div>
                        </div>
                        <div className="px-6 pb-5">
                          <div className="flex items-center gap-5 mb-4">
                            <OverallScoreRing score={resume_ai.total_score} maxScore={resume_ai.max_score} size={90} />
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg ${recommendationColor(resume_ai.recommendation)}`}>
                                {formatLabel(resume_ai.recommendation)}
                              </span>
                              <span className="text-xs text-muted-foreground">{resume_ai.category_scores.length} categories scored</span>
                            </div>
                          </div>
                          {/* Compact category bars */}
                          {resume_ai.category_scores.length > 0 && (
                            <div className="space-y-3">
                              {resume_ai.category_scores.map((cs, idx) => (
                                <CompetencyBar key={cs.category} name={cs.category} score={cs.score} maxScore={cs.max_score} index={idx} />
                              ))}
                            </div>
                          )}
                          {/* Skills tags */}
                          {resume_ai.highlighted_skills.length > 0 && (
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                              <p className="text-[11px] font-bold text-green-400/80 uppercase tracking-wider mb-2">Key Skills</p>
                              <div className="flex flex-wrap gap-1.5">
                                {resume_ai.highlighted_skills.slice(0, 10).map((skill) => (
                                  <span key={skill} className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium text-green-300" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                                    {skill}
                                  </span>
                                ))}
                                {resume_ai.highlighted_skills.length > 10 && (
                                  <span className="text-xs text-muted-foreground">+{resume_ai.highlighted_skills.length - 10} more</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="rounded-2xl py-12 text-center" style={glassCardDashed}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'var(--orbis-border)' }}>
                          <Brain className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No Resume Analysis</p>
                        <p className="text-xs text-muted-foreground mt-1">Resume AI analysis is not available yet.</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Ranking card */}
                  {ranking ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                      <div className="rounded-2xl overflow-hidden" style={glassCard}>
                        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>
                              <Crown className="h-4 w-4 text-amber-500" />
                            </div>
                            Candidate Ranking
                          </div>
                        </div>
                        <div className="px-6 pb-6">
                          <div className="flex items-center gap-4 mb-5">
                            {/* Rank badge */}
                            <div
                              className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black shrink-0"
                              style={{
                                background: ranking.rank === 1
                                  ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                                  : ranking.rank === 2
                                    ? 'linear-gradient(135deg, #e2e8f0, #cbd5e1)'
                                    : ranking.rank === 3
                                      ? 'linear-gradient(135deg, #fdba74, #f97316)'
                                      : 'var(--orbis-input)',
                                color: ranking.rank <= 3 ? '#1e293b' : 'hsl(var(--foreground))',
                              }}
                            >
                              #{ranking.rank}
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-foreground">
                                {(ranking.composite_score ?? ranking.composite) != null ? (ranking.composite_score ?? ranking.composite).toFixed(1) : '--'}
                              </p>
                              <p className="text-xs text-muted-foreground">Composite Score</p>
                            </div>
                          </div>
                          {/* Breakdown bars */}
                          <div className="space-y-3">
                            {[
                              { label: 'Resume', weight: '40%', color: 'from-blue-400 to-blue-500', value: ranking.resume_score ?? ranking.breakdown?.resume },
                              { label: 'Interview', weight: '30%', color: 'from-blue-400 to-blue-500', value: ranking.interview_score ?? ranking.breakdown?.interview },
                              { label: 'Feedback', weight: '20%', color: 'from-emerald-400 to-emerald-500', value: ranking.feedback_score ?? ranking.breakdown?.feedback },
                              { label: 'Screening', weight: '10%', color: 'from-amber-400 to-amber-500', value: ranking.screening_score ?? ranking.breakdown?.screening },
                            ].map((item) => (
                              <div key={item.label}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-foreground">{item.label} <span className="text-muted-foreground">({item.weight})</span></span>
                                  <span className="text-xs font-bold text-muted-foreground">{item.value != null ? item.value.toFixed(1) : '--'}</span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                                  <motion.div
                                    className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.value != null ? Math.min(item.value, 100) : 0}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="rounded-2xl py-12 text-center" style={glassCardDashed}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'var(--orbis-border)' }}>
                          <Crown className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No Ranking Data</p>
                        <p className="text-xs text-muted-foreground mt-1">Ranking is available when applied to a specific job.</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* -- Tab: Screening ------------------------------------------ */}
            <TabsContent value="screening" className="space-y-6 mt-6">
              {!screening || screening.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="rounded-2xl py-16 text-center" style={glassCardDashed}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'var(--orbis-border)' }}>
                      <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No Screening Responses</p>
                    <p className="text-xs text-muted-foreground mt-1">Screening question responses are not available for this candidate.</p>
                  </div>
                </motion.div>
              ) : (() => {
                const totalQuestions = screening.length;
                const answeredCount = screening.filter((q: any) => q.response && q.response.trim().length > 0).length;
                const completionPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
                const avgWordCount = totalQuestions > 0
                  ? Math.round(screening.reduce((sum: number, q: any) => sum + (q.response ? q.response.trim().split(/\s+/).length : 0), 0) / totalQuestions)
                  : 0;
                const qualityPct = Math.min(100, Math.round((avgWordCount / 50) * 100));
                return (
                  <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                        <div className="rounded-2xl p-5" style={glassCard}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.15)' }}>
                              <ClipboardCheck className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Completion Rate</p>
                              <p className="text-xl font-bold text-foreground">{completionPct}%</p>
                              <p className="text-[11px] text-muted-foreground">{answeredCount} / {totalQuestions} questions answered</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
                        <div className="rounded-2xl p-5" style={glassCard}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(34,197,94,0.15)' }}>
                              <TrendingUp className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Quality Score</p>
                              <p className="text-xl font-bold text-foreground">{qualityPct}%</p>
                              <p className="text-[11px] text-muted-foreground">Avg {avgWordCount} words per response</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Q&A list */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                      <div className="rounded-2xl" style={glassCard}>
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                              <ClipboardCheck className="h-4 w-4 text-blue-500" />
                            </div>
                            Screening Responses
                          </div>
                        </div>
                        <div className="px-6 pb-6 space-y-4">
                          {screening.map((item: any, idx: number) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: idx * 0.04 }}
                              className="rounded-xl p-4"
                              style={{ border: '1px solid var(--orbis-border)' }}
                            >
                              {/* Badges row */}
                              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                {item.required ? (
                                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-300 border border-blue-700">Required</span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md text-muted-foreground" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}>Optional</span>
                                )}
                                {item.question_type && (
                                  <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md text-muted-foreground" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}>
                                    {item.question_type.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {item.ai_generated && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-300 border border-blue-700">
                                    <Sparkles className="h-2.5 w-2.5" />AI Generated
                                  </span>
                                )}
                                {item.is_knockout && (
                                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-900/40 text-red-300 border border-red-700">Knockout</span>
                                )}
                              </div>
                              {/* Question */}
                              <p className="text-sm font-semibold text-foreground mb-2">{item.question}</p>
                              {/* Answer */}
                              <div className="rounded-lg p-3" style={{ background: 'var(--orbis-input)' }}>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {item.response && item.response.trim().length > 0 ? item.response : <span className="italic">No response provided</span>}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </>
                );
              })()}
            </TabsContent>

            {/* -- Tab: Interviews ----------------------------------------- */}
            <TabsContent value="interview" className="space-y-6 mt-6">
              {!interview_ai ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="rounded-2xl py-16 text-center" style={glassCardDashed}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'var(--orbis-border)' }}>
                      <Target className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No Interview Analysis</p>
                    <p className="text-xs text-muted-foreground mt-1">Interview AI analysis is not available for this candidate.</p>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Score + Competency Bars */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Score + Recommendation */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="rounded-2xl overflow-hidden h-full" style={glassCard}>
                        <div className={`h-1.5 bg-gradient-to-r ${recommendationGradient(interview_ai.recommendation)}`} />
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                            </div>
                            Interview Score
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-4 pt-2 pb-6 px-6">
                          <OverallScoreRing
                            score={interview_ai.total_score}
                            maxScore={interview_ai.max_score}
                            size={140}
                          />
                          <span
                            className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg ${recommendationColor(interview_ai.recommendation)}`}
                          >
                            {formatLabel(interview_ai.recommendation)}
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Competency Bars */}
                    <motion.div
                      className="lg:col-span-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <div className="rounded-2xl h-full" style={glassCard}>
                        <div className="pb-3 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                            </div>
                            Competency Scores
                          </div>
                        </div>
                        <div className="space-y-4 px-6 pb-6">
                          {interview_ai.score_breakdown.length > 0 ? (
                            interview_ai.score_breakdown.map((sb, idx) => (
                              <CompetencyBar
                                key={sb.competency}
                                name={sb.competency}
                                score={sb.score}
                                maxScore={sb.max_score}
                                index={idx}
                              />
                            ))
                          ) : (
                            <div className="h-80">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={interviewBarData} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-border)" />
                                  <XAxis type="number" domain={[0, 'dataMax']} tick={{ fill: '#94a3b8' }} />
                                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: 'var(--orbis-card)',
                                      border: '1px solid var(--orbis-border-strong)',
                                      borderRadius: '12px',
                                      color: 'hsl(var(--foreground))',
                                    }}
                                    formatter={(value: number, _name: string, props: any) => [
                                      `${value} / ${props.payload.maxScore}`,
                                      'Score',
                                    ]}
                                  />
                                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                                    {interviewBarData.map((_entry, idx) => (
                                      <Cell
                                        key={idx}
                                        fill={['#3b82f6', '#1B8EE5', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'][idx % 6]}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Insight Cards */}
                  <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div variants={fadeInUp}>
                      <div
                        className="rounded-2xl p-5"
                        style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(34,197,94,0.15)' }}>
                            <Shield className="h-5 w-5 text-green-400" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-green-400/80 uppercase tracking-wider">
                              Strongest Competency
                            </p>
                            <p className="text-base font-bold text-foreground mt-1">
                              {formatLabel(interview_ai.strongest_competency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                      <div
                        className="rounded-2xl p-5"
                        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.15)' }}>
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-wider">
                              Area for Development
                            </p>
                            <p className="text-base font-bold text-foreground mt-1">
                              {formatLabel(interview_ai.area_for_development)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </StaggerGrid>

                  {/* Overall Impression */}
                  {interview_ai.overall_impression && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                    >
                      <div className="rounded-2xl" style={glassCard}>
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
                              <HelpCircle className="h-4 w-4 text-blue-500" />
                            </div>
                            Overall Impression
                          </div>
                        </div>
                        <div className="px-6 pb-6">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {interview_ai.overall_impression}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </TabsContent>

            {/* -- Tab 3: Feedback ----------------------------------------- */}
            <TabsContent value="feedback" className="space-y-6 mt-6">
              {!feedback || feedback.entries.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="rounded-2xl py-16 text-center" style={glassCardDashed}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'var(--orbis-border)' }}>
                      <MessageSquare className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No Feedback Yet</p>
                    <p className="text-xs text-muted-foreground mt-1">No feedback has been submitted for this candidate yet.</p>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Aggregate Stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Average Rating */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="rounded-2xl overflow-hidden h-full" style={glassCard}>
                        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>
                              <Star className="h-4 w-4 text-amber-500" />
                            </div>
                            Average Rating
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-3 pt-2 pb-6 px-6">
                          <motion.div
                            className="text-5xl font-bold text-amber-500"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                          >
                            {feedback.aggregate.avg_rating.toFixed(1)}
                          </motion.div>
                          <StarRating rating={Math.round(feedback.aggregate.avg_rating)} />
                          <p className="text-xs text-muted-foreground">
                            Based on {feedback.aggregate.total_feedback} review{feedback.aggregate.total_feedback !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    {/* Recommendation Distribution */}
                    <motion.div
                      className="lg:col-span-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <div className="rounded-2xl h-full" style={glassCard}>
                        <div className="pb-2 pt-5 px-6">
                          <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                            </div>
                            Recommendation Distribution
                          </div>
                        </div>
                        <div className="px-6 pb-6">
                          {pieData.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No recommendation data
                            </p>
                          ) : (
                            <div className="h-56">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, value }) => `${name} (${value})`}
                                  >
                                    {pieData.map((entry, idx) => (
                                      <Cell key={idx} fill={entry.fill} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: 'var(--orbis-card)',
                                      border: '1px solid var(--orbis-border-strong)',
                                      borderRadius: '12px',
                                      color: 'hsl(var(--foreground))',
                                    }}
                                  />
                                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: '#94a3b8' }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Feedback Cards */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      Per-Round Feedback
                    </h3>
                    <StaggerGrid className="space-y-4">
                      {feedback.entries.map((entry, idx) => (
                        <motion.div key={idx} variants={fadeInUp}>
                          <div className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/10" style={glassCard}>
                            <div className={`h-1 bg-gradient-to-r ${recommendationGradient(entry.recommendation)}`} />
                            <div className="p-5">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1B8EE5] to-blue-600 text-white text-sm font-bold shadow-md shadow-blue-600/20">
                                    {(entry.interviewer_name || '?')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-sm text-foreground">{entry.interviewer_name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatLabel(entry.round)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <StarRating rating={entry.rating} />
                                  <span
                                    className={`inline-flex items-center text-[11px] font-semibold rounded-lg px-2 py-0.5 ${recommendationColor(entry.recommendation)}`}
                                  >
                                    {formatLabel(entry.recommendation)}
                                  </span>
                                </div>
                              </div>

                              {(entry.strengths || entry.concerns) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                                  {entry.strengths && (
                                    <div className="rounded-xl p-3.5" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                                        <span className="text-[11px] font-bold text-green-400 uppercase tracking-wider">Strengths</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{entry.strengths}</p>
                                    </div>
                                  )}
                                  {entry.concerns && (
                                    <div className="rounded-xl p-3.5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                                        <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Concerns</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{entry.concerns}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </StaggerGrid>
                  </div>
                </>
              )}
            </TabsContent>

            {/* -- Tab 4: Timeline ----------------------------------------- */}
            <TabsContent value="timeline" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="rounded-2xl" style={glassCard}>
                  <div className="pb-2 pt-5 px-6">
                    <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
                        <Clock className="h-4 w-4 text-blue-500" />
                      </div>
                      Engagement Timeline
                    </div>
                  </div>
                  <div className="px-6 pb-6">
                    <EngagementTimeline events={timeline || []} />
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
