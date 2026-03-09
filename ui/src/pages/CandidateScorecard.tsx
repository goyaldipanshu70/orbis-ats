import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
} from 'lucide-react';

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
  if (r.includes('strong_hire') || r.includes('strongly_recommend')) return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800';
  if (r.includes('hire') || r.includes('recommend')) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800';
  if (r.includes('no_hire') || r.includes('not_recommend') || r.includes('reject')) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800';
  return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800';
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
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#10b981';
  if (pct >= 40) return '#f59e0b';
  if (pct >= 20) return '#f97316';
  return '#ef4444';
}

function scoreBarColor(pct: number): string {
  if (pct >= 80) return 'bg-gradient-to-r from-green-400 to-emerald-500';
  if (pct >= 60) return 'bg-gradient-to-r from-emerald-400 to-teal-500';
  if (pct >= 40) return 'bg-gradient-to-r from-amber-400 to-yellow-500';
  if (pct >= 20) return 'bg-gradient-to-r from-orange-400 to-amber-500';
  return 'bg-gradient-to-r from-red-400 to-rose-500';
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
            className="stroke-muted/50"
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
          className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}`}
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
      className="rounded-xl border border-border/50 bg-card p-4 hover:shadow-md transition-all duration-300 hover:border-border"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{formatLabel(category)}</span>
        <span className="text-xs font-bold text-muted-foreground">{score}/{maxScore}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
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
      <div className="w-full h-2.5 rounded-full bg-muted/50 overflow-hidden">
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
        /* ── Transform API response to match Scorecard interface ── */

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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-background dark:via-background dark:to-background">
          <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <Skeleton className="h-5 w-24 rounded-lg" />
                <Skeleton className="h-8 w-64 rounded-lg" />
                <Skeleton className="h-4 w-48 rounded-lg" />
              </div>
              <Skeleton className="h-28 w-28 rounded-full" />
            </div>
            <Skeleton className="h-12 w-full max-w-lg rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-background dark:via-background dark:to-background">
          <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Failed to load scorecard</h2>
            <p className="text-sm text-muted-foreground max-w-md text-center leading-relaxed">
              {error || 'Scorecard data is not available for this candidate.'}
            </p>
            <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-background dark:via-background dark:to-background">
        <div className="max-w-[1200px] mx-auto px-6 py-8">

          {/* ── Header ──────────────────────────────────────────────── */}
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

            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Avatar + info */}
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold shadow-lg shadow-blue-600/20">
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
                      <Badge variant="outline" className="text-[11px] rounded-lg gap-1">
                        <FileText className="h-3 w-3" />
                        {sectionCount} sections available
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[11px] rounded-lg gap-1"
                        style={{ color: scoreColor(overallPct) }}
                      >
                        <Sparkles className="h-3 w-3" />
                        {overallPct >= 80 ? 'Top Candidate' : overallPct >= 60 ? 'Strong' : overallPct >= 40 ? 'Average' : 'Below Average'}
                      </Badge>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(jdId ? `/compare?jd_id=${jdId}` : '/compare')
                      }
                      className="rounded-xl text-xs h-9 gap-1.5 hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-700 dark:hover:text-blue-400"
                    >
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      Compare
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={exporting}
                      className="rounded-xl text-xs h-9 gap-1.5 hover:border-green-300 hover:text-green-600 dark:hover:border-green-700 dark:hover:text-green-400"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {exporting ? 'Exporting...' : 'Export'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Tabs ────────────────────────────────────────────────── */}
          <Tabs defaultValue="resume" className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <TabsList className="w-full justify-start gap-1 rounded-xl bg-muted/50 p-1 h-auto">
                <TabsTrigger value="resume" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm data-[state=active]:shadow-sm">
                  <Brain className="h-4 w-4" />
                  Resume AI
                </TabsTrigger>
                <TabsTrigger value="interview" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm data-[state=active]:shadow-sm">
                  <Target className="h-4 w-4" />
                  Interview AI
                </TabsTrigger>
                <TabsTrigger value="feedback" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm data-[state=active]:shadow-sm">
                  <MessageSquare className="h-4 w-4" />
                  Feedback
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm data-[state=active]:shadow-sm">
                  <Clock className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
              </TabsList>
            </motion.div>

            {/* ── Tab 1: Resume AI ──────────────────────────────────── */}
            <TabsContent value="resume" className="space-y-6 mt-6">
              {!resume_ai ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="py-16 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                        <Brain className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No Resume Analysis</p>
                      <p className="text-xs text-muted-foreground mt-1">Resume AI analysis is not available for this candidate.</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <>
                  {/* Score + Recommendation + Radar */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Total Score Card */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Card className="rounded-2xl overflow-hidden h-full">
                        <div className={`h-1.5 bg-gradient-to-r ${recommendationGradient(resume_ai.recommendation)}`} />
                        <CardHeader className="pb-2 pt-5">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                              <Award className="h-4 w-4 text-amber-500" />
                            </div>
                            Resume Score
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4 pt-2 pb-6">
                          <OverallScoreRing score={resume_ai.total_score} maxScore={resume_ai.max_score} size={140} />
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${recommendationColor(resume_ai.recommendation)}`}
                          >
                            {formatLabel(resume_ai.recommendation)}
                          </Badge>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Radar Chart */}
                    <motion.div
                      className="lg:col-span-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <Card className="rounded-2xl h-full">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                            </div>
                            Category Breakdown
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <RadarScoreChart data={radarData} size={320} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Category Score Cards */}
                  {resume_ai.category_scores.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        Score Details
                      </h3>
                      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {resume_ai.category_scores.map((cs, idx) => (
                          <CategoryScoreCard
                            key={cs.category}
                            category={cs.category}
                            score={cs.score}
                            maxScore={cs.max_score}
                            index={idx}
                          />
                        ))}
                      </StaggerGrid>
                    </div>
                  )}

                  {/* Skills + Red Flags */}
                  <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Highlighted Skills */}
                    <motion.div variants={fadeInUp}>
                      <Card className="rounded-2xl h-full">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/30">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                            Highlighted Skills
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {resume_ai.highlighted_skills.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No highlighted skills</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {resume_ai.highlighted_skills.map((skill, idx) => (
                                <motion.div
                                  key={skill}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                                >
                                  <Badge
                                    className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-950/60 rounded-lg px-2.5 py-1 text-xs"
                                    variant="outline"
                                  >
                                    {skill}
                                  </Badge>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Red Flags */}
                    <motion.div variants={fadeInUp}>
                      <Card className="rounded-2xl h-full">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/30">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            </div>
                            Red Flags
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {resume_ai.red_flags.length === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              No red flags detected
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {resume_ai.red_flags.map((flag, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                                >
                                  <div className="flex items-start gap-2.5 rounded-xl bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 p-3">
                                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                    <span className="text-sm text-red-700 dark:text-red-300">{flag}</span>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </StaggerGrid>
                </>
              )}
            </TabsContent>

            {/* ── Tab 2: Interview AI ───────────────────────────────── */}
            <TabsContent value="interview" className="space-y-6 mt-6">
              {!interview_ai ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="py-16 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                        <Target className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No Interview Analysis</p>
                      <p className="text-xs text-muted-foreground mt-1">Interview AI analysis is not available for this candidate.</p>
                    </CardContent>
                  </Card>
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
                      <Card className="rounded-2xl overflow-hidden h-full">
                        <div className={`h-1.5 bg-gradient-to-r ${recommendationGradient(interview_ai.recommendation)}`} />
                        <CardHeader className="pb-2 pt-5">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                            </div>
                            Interview Score
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4 pt-2 pb-6">
                          <OverallScoreRing
                            score={interview_ai.total_score}
                            maxScore={interview_ai.max_score}
                            size={140}
                          />
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${recommendationColor(interview_ai.recommendation)}`}
                          >
                            {formatLabel(interview_ai.recommendation)}
                          </Badge>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Competency Bars */}
                    <motion.div
                      className="lg:col-span-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <Card className="rounded-2xl h-full">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/30">
                              <BarChart3 className="h-4 w-4 text-purple-500" />
                            </div>
                            Competency Scores
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                  <XAxis type="number" domain={[0, 'dataMax']} />
                                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '12px',
                                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
                                        fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'][idx % 6]}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Insight Cards */}
                  <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div variants={fadeInUp}>
                      <Card className="rounded-2xl border-green-200/50 dark:border-green-900/30 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40">
                              <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-green-600/80 dark:text-green-400/80 uppercase tracking-wider">
                                Strongest Competency
                              </p>
                              <p className="text-base font-bold text-foreground mt-1">
                                {formatLabel(interview_ai.strongest_competency)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                      <Card className="rounded-2xl border-amber-200/50 dark:border-amber-900/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider">
                                Area for Development
                              </p>
                              <p className="text-base font-bold text-foreground mt-1">
                                {formatLabel(interview_ai.area_for_development)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </StaggerGrid>

                  {/* Overall Impression */}
                  {interview_ai.overall_impression && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                    >
                      <Card className="rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                              <HelpCircle className="h-4 w-4 text-blue-500" />
                            </div>
                            Overall Impression
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {interview_ai.overall_impression}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── Tab 3: Feedback ───────────────────────────────────── */}
            <TabsContent value="feedback" className="space-y-6 mt-6">
              {!feedback || feedback.entries.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="py-16 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                        <MessageSquare className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No Feedback Yet</p>
                      <p className="text-xs text-muted-foreground mt-1">No feedback has been submitted for this candidate yet.</p>
                    </CardContent>
                  </Card>
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
                      <Card className="rounded-2xl overflow-hidden h-full">
                        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                        <CardHeader className="pb-2 pt-5">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                              <Star className="h-4 w-4 text-amber-500" />
                            </div>
                            Average Rating
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-3 pt-2 pb-6">
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
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Recommendation Distribution */}
                    <motion.div
                      className="lg:col-span-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <Card className="rounded-2xl h-full">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/30">
                              <BarChart3 className="h-4 w-4 text-purple-500" />
                            </div>
                            Recommendation Distribution
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
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
                                  <Tooltip />
                                  <Legend iconType="circle" iconSize={8} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Feedback Cards */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-purple-500" />
                      Per-Round Feedback
                    </h3>
                    <StaggerGrid className="space-y-4">
                      {feedback.entries.map((entry, idx) => (
                        <motion.div key={idx} variants={fadeInUp}>
                          <Card className="rounded-2xl hover:shadow-md transition-all duration-300 overflow-hidden">
                            <div className={`h-1 bg-gradient-to-r ${recommendationGradient(entry.recommendation)}`} />
                            <CardContent className="p-5">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-sm font-bold shadow-md shadow-purple-600/20">
                                    {(entry.interviewer_name || '?')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-sm text-foreground">{entry.interviewer_name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatLabel(entry.round)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <StarRating rating={entry.rating} />
                                  <Badge
                                    variant="outline"
                                    className={`text-[11px] font-semibold rounded-lg ${recommendationColor(entry.recommendation)}`}
                                  >
                                    {formatLabel(entry.recommendation)}
                                  </Badge>
                                </div>
                              </div>

                              {(entry.strengths || entry.concerns) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-border/50">
                                  {entry.strengths && (
                                    <div className="rounded-xl bg-green-50/60 dark:bg-green-950/15 border border-green-200/40 dark:border-green-900/30 p-3.5">
                                      <div className="flex items-center gap-2 mb-2">
                                        <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                                        <span className="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Strengths</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{entry.strengths}</p>
                                    </div>
                                  )}
                                  {entry.concerns && (
                                    <div className="rounded-xl bg-red-50/60 dark:bg-red-950/15 border border-red-200/40 dark:border-red-900/30 p-3.5">
                                      <div className="flex items-center gap-2 mb-2">
                                        <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                                        <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Concerns</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{entry.concerns}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </StaggerGrid>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Tab 4: Timeline ───────────────────────────────────── */}
            <TabsContent value="timeline" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <Clock className="h-4 w-4 text-blue-500" />
                      </div>
                      Engagement Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EngagementTimeline events={timeline || []} />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
