import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, fadeInUp, scaleIn } from '@/lib/animations';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import {
  ArrowLeft,
  Star,
  Loader2,
  Send,
  ClipboardCheck,
  BarChart3,
  ThumbsUp,
  AlertTriangle,
  StickyNote,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Minus,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Target,
  MessageSquare,
  Brain,
  Users,
  Lightbulb,
} from 'lucide-react';

/* -- Types ---------------------------------------------------------------- */

interface CriterionDef {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface CriterionState {
  score: number;
  comment: string;
}

type Recommendation = 'Strong Yes' | 'Yes' | 'Neutral' | 'No' | 'Strong No';

const CRITERIA: CriterionDef[] = [
  { key: 'technical_skills', label: 'Technical Skills', description: 'Domain knowledge, coding ability, system understanding', icon: <Target className="size-5" /> },
  { key: 'communication', label: 'Communication', description: 'Clarity, articulation, active listening', icon: <MessageSquare className="size-5" /> },
  { key: 'problem_solving', label: 'Problem Solving', description: 'Analytical thinking, approach to unknowns', icon: <Brain className="size-5" /> },
  { key: 'culture_fit', label: 'Culture Fit', description: 'Values alignment, collaboration style', icon: <Users className="size-5" /> },
  { key: 'leadership_growth', label: 'Leadership / Growth', description: 'Initiative, learning mindset, mentorship potential', icon: <Lightbulb className="size-5" /> },
];

const RECOMMENDATIONS: { value: Recommendation; icon: React.ReactNode; color: string; bg: string; ring: string; activeBg: string }[] = [
  { value: 'Strong Yes', icon: <ChevronUp className="size-4" />, color: 'text-green-700 dark:text-green-400', bg: 'bg-card border-border hover:border-green-300 dark:hover:border-green-700', ring: 'ring-green-500/30', activeBg: 'bg-green-50 dark:bg-green-950/40 border-green-400 dark:border-green-600' },
  { value: 'Yes', icon: <CheckCircle2 className="size-4" />, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-card border-border hover:border-emerald-300 dark:hover:border-emerald-700', ring: 'ring-emerald-500/30', activeBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600' },
  { value: 'Neutral', icon: <Minus className="size-4" />, color: 'text-gray-700 dark:text-gray-300', bg: 'bg-card border-border hover:border-gray-400 dark:hover:border-gray-600', ring: 'ring-gray-500/30', activeBg: 'bg-gray-100 dark:bg-gray-800/60 border-gray-400 dark:border-gray-500' },
  { value: 'No', icon: <XCircle className="size-4" />, color: 'text-orange-700 dark:text-orange-400', bg: 'bg-card border-border hover:border-orange-300 dark:hover:border-orange-700', ring: 'ring-orange-500/30', activeBg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-400 dark:border-orange-600' },
  { value: 'Strong No', icon: <ChevronDown className="size-4" />, color: 'text-red-700 dark:text-red-400', bg: 'bg-card border-border hover:border-red-300 dark:hover:border-red-700', ring: 'ring-red-500/30', activeBg: 'bg-red-50 dark:bg-red-950/40 border-red-400 dark:border-red-600' },
];

/* -- Score Color Helper --------------------------------------------------- */

function scoreColor(score: number): string {
  if (score >= 4) return 'text-green-500';
  if (score >= 3) return 'text-yellow-500';
  if (score >= 2) return 'text-orange-400';
  if (score >= 1) return 'text-red-400';
  return 'text-muted-foreground/30';
}

function scoreBg(score: number): string {
  if (score >= 4) return 'bg-green-500/10';
  if (score >= 3) return 'bg-yellow-500/10';
  if (score >= 2) return 'bg-orange-400/10';
  if (score >= 1) return 'bg-red-400/10';
  return 'bg-muted/30';
}

/* -- Star Rating ---------------------------------------------------------- */

function StarRating({ value, onChange, size = 22, label }: { value: number; onChange: (v: number) => void; size?: number; label?: string }) {
  const [hover, setHover] = useState(0);

  const getStarColor = (i: number, active: boolean) => {
    if (!active) return 'fill-transparent text-muted-foreground/25';
    const target = hover || value;
    if (target >= 4) return 'fill-green-400 text-green-400';
    if (target >= 3) return 'fill-yellow-400 text-yellow-400';
    if (target >= 2) return 'fill-orange-400 text-orange-400';
    return 'fill-red-400 text-red-400';
  };

  return (
    <div className="flex gap-1" role="group" aria-label={label ? `${label} rating` : 'Star rating'} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= (hover || value);
        return (
          <motion.button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            aria-label={`Rate ${label || 'rating'} ${i} out of 5`}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm p-0.5"
            whileHover={{ scale: 1.25, rotate: active ? 0 : 15 }}
            whileTap={{ scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Star
              size={size}
              className={`transition-colors duration-200 ${getStarColor(i, active)}`}
            />
          </motion.button>
        );
      })}
      {(hover || value) > 0 && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className={`ml-2 text-sm font-semibold tabular-nums ${scoreColor(hover || value)}`}
        >
          {hover || value}/5
        </motion.span>
      )}
    </div>
  );
}

/* -- Section Header ------------------------------------------------------- */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* -- Progress Indicator --------------------------------------------------- */

function CompletionProgress({ criteriaScores, overallRating, recommendation, strengths }: {
  criteriaScores: Record<string, CriterionState>;
  overallRating: number;
  recommendation: Recommendation | '';
  strengths: string;
}) {
  const total = CRITERIA.length + 3; // criteria + overall + recommendation + strengths
  let filled = 0;
  for (const c of CRITERIA) {
    const s = criteriaScores[c.key];
    if (s.score > 0 && s.comment.trim().length >= 20) filled++;
  }
  if (overallRating > 0) filled++;
  if (recommendation) filled++;
  if (strengths.trim().length >= 20) filled++;

  const pct = Math.round((filled / total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
        {filled}/{total} complete
      </span>
    </div>
  );
}

/* -- Main Component ------------------------------------------------------- */

export default function FeedbackForm() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [criteriaScores, setCriteriaScores] = useState<Record<string, CriterionState>>(
    Object.fromEntries(CRITERIA.map((c) => [c.key, { score: 0, comment: '' }]))
  );
  const [overallRating, setOverallRating] = useState(0);
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');
  const [wouldInterviewAgain, setWouldInterviewAgain] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateCriterion = (key: string, field: 'score' | 'comment', value: number | string) => {
    setCriteriaScores((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  /* -- Validation --------------------------------------------------------- */

  function validate(): string[] {
    const errs: string[] = [];
    for (const c of CRITERIA) {
      const s = criteriaScores[c.key];
      if (s.score < 1) errs.push(`${c.label}: rating required`);
      if (s.comment.trim().length < 20) errs.push(`${c.label}: comment must be at least 20 characters`);
    }
    if (overallRating < 1) errs.push('Overall rating is required');
    if (!recommendation) errs.push('Recommendation is required');
    if (strengths.trim().length < 20) errs.push('Strengths must be at least 20 characters');
    return errs;
  }

  /* -- Submit ------------------------------------------------------------- */

  async function handleSubmit() {
    const errs = validate();
    if (errs.length) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      await apiClient.submitEnhancedFeedback(Number(scheduleId), {
        rating: overallRating,
        recommendation: recommendation as string,
        strengths: strengths.trim(),
        concerns: concerns.trim() || undefined,
        notes: notes.trim() || undefined,
        would_interview_again: wouldInterviewAgain,
        criteria_scores: criteriaScores,
      });
      toast({ title: 'Feedback submitted', description: 'Your scorecard has been saved successfully.' });
      navigate('/interviews');
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  /* -- Computed ----------------------------------------------------------- */

  const avgScore = (() => {
    const scored = Object.values(criteriaScores).filter((s) => s.score > 0);
    if (!scored.length) return 0;
    return scored.reduce((sum, s) => sum + s.score, 0) / scored.length;
  })();

  /* -- Render ------------------------------------------------------------- */

  return (
    <AppLayout>
      <motion.div
        className="max-w-3xl mx-auto py-8 px-4 space-y-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                aria-label="Go back"
                onClick={() => navigate('/interviews')}
                className="rounded-xl border-border/60 hover:bg-muted/60 shrink-0"
              >
                <ArrowLeft size={18} />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">Interview Scorecard</h1>
                  <Sparkles className="size-5 text-primary/60" />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Provide structured feedback for interview #{scheduleId}
                </p>
              </div>
            </div>
            {/* Mini score badge */}
            {avgScore > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${scoreBg(avgScore)} border border-border/40`}
              >
                <BarChart3 className={`size-4 ${scoreColor(avgScore)}`} />
                <span className={`text-sm font-bold tabular-nums ${scoreColor(avgScore)}`}>
                  {avgScore.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">avg</span>
              </motion.div>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <CompletionProgress
              criteriaScores={criteriaScores}
              overallRating={overallRating}
              recommendation={recommendation}
              strengths={strengths}
            />
          </div>
        </motion.div>

        {/* ── Validation Errors ───────────────────────────────────────── */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 rounded-xl overflow-hidden">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-red-100 dark:bg-red-900/40 shrink-0 mt-0.5">
                      <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Please fix the following:</p>
                      <ul className="mt-2 space-y-1">
                        {errors.map((e, i) => (
                          <li key={i} className="text-sm text-red-600 dark:text-red-400/80 flex items-start gap-2">
                            <span className="text-red-400 mt-1 shrink-0">&bull;</span>
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Criteria Section ────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <SectionHeader
                icon={<ClipboardCheck className="size-5" />}
                title="Evaluation Criteria"
                subtitle="Rate each area and provide specific examples or observations"
              />
            </div>
            <CardContent className="px-6 pb-6 pt-2">
              <div className="space-y-2">
                {CRITERIA.map((c, idx) => {
                  const state = criteriaScores[c.key];
                  const commentTooShort = state.comment.trim().length > 0 && state.comment.trim().length < 20;
                  const isComplete = state.score > 0 && state.comment.trim().length >= 20;

                  return (
                    <motion.div
                      key={c.key}
                      variants={fadeInUp}
                      className={`rounded-xl border p-4 transition-colors duration-200 ${
                        isComplete
                          ? 'border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-950/10'
                          : 'border-border/50 bg-card hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 mt-0.5 transition-colors ${
                            state.score > 0
                              ? `${scoreBg(state.score)}`
                              : 'bg-muted/40'
                          }`}>
                            <span className={state.score > 0 ? scoreColor(state.score) : 'text-muted-foreground/50'}>
                              {c.icon}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground text-sm">{c.label}</p>
                              {isComplete && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                                  <CheckCircle2 className="size-3.5 text-green-500" />
                                </motion.div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <StarRating value={state.score} onChange={(v) => updateCriterion(c.key, 'score', v)} label={c.label} />
                        </div>
                      </div>
                      <div className="mt-3 ml-12">
                        <Textarea
                          placeholder={`Comments on ${c.label.toLowerCase()} (min 20 characters)...`}
                          value={state.comment}
                          onChange={(e) => updateCriterion(c.key, 'comment', e.target.value)}
                          rows={2}
                          className="resize-none text-sm rounded-lg border-border/50 bg-background/60 focus:bg-background transition-colors"
                        />
                        <AnimatePresence>
                          {commentTooShort && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1"
                            >
                              <AlertTriangle className="size-3" />
                              {20 - state.comment.trim().length} more character{20 - state.comment.trim().length !== 1 ? 's' : ''} needed
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Overall Assessment ──────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <SectionHeader
                icon={<BarChart3 className="size-5" />}
                title="Overall Assessment"
                subtitle="Your overall evaluation and hiring recommendation"
              />
            </div>
            <CardContent className="px-6 pb-6 pt-2 space-y-6">
              {/* Overall Rating */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
                  <Star className="size-4 text-primary/70" />
                  Overall Rating
                </Label>
                <StarRating value={overallRating} onChange={setOverallRating} size={30} label="Overall" />
              </div>

              {/* Recommendation */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ThumbsUp className="size-4 text-primary/70" />
                  Hiring Recommendation
                </Label>
                <div className="grid grid-cols-5 gap-2">
                  {RECOMMENDATIONS.map((r) => {
                    const selected = recommendation === r.value;
                    return (
                      <motion.button
                        key={r.value}
                        type="button"
                        onClick={() => setRecommendation(r.value)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-xs font-medium transition-all duration-200 ${
                          selected
                            ? `${r.activeBg} ${r.color} ring-2 ${r.ring} shadow-sm`
                            : `${r.bg} text-muted-foreground`
                        }`}
                      >
                        <span className={selected ? r.color : 'text-muted-foreground/60'}>{r.icon}</span>
                        <span className="leading-tight text-center">{r.value}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ThumbsUp className="size-4 text-green-500/70" />
                  Strengths <span className="text-red-400 text-xs ml-1">*</span>
                </Label>
                <Textarea
                  placeholder="Key strengths observed during the interview (min 20 characters)..."
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  rows={3}
                  className="resize-none text-sm rounded-lg border-border/50"
                />
                <AnimatePresence>
                  {strengths.trim().length > 0 && strengths.trim().length < 20 && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
                    >
                      <AlertTriangle className="size-3" />
                      {20 - strengths.trim().length} more character{20 - strengths.trim().length !== 1 ? 's' : ''} needed
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Concerns */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <AlertTriangle className="size-4 text-orange-400/70" />
                  Concerns
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  placeholder="Any concerns or areas for improvement..."
                  value={concerns}
                  onChange={(e) => setConcerns(e.target.value)}
                  rows={3}
                  className="resize-none text-sm rounded-lg border-border/50"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <StickyNote className="size-4 text-blue-400/70" />
                  Additional Notes
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  placeholder="Any other observations or context..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none text-sm rounded-lg border-border/50"
                />
              </div>

              {/* Would interview again */}
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 shrink-0">
                    <RefreshCw className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Would you interview this candidate again?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">For a different role or a future opportunity</p>
                  </div>
                </div>
                <Switch checked={wouldInterviewAgain} onCheckedChange={setWouldInterviewAgain} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Submit ──────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="flex items-center justify-between pb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/interviews')}
            className="rounded-xl border-border/60"
          >
            <ArrowLeft className="size-4 mr-2" />
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-2 min-w-[180px] rounded-xl shadow-md hover:shadow-lg transition-shadow"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
