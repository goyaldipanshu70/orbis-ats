import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, fadeInUp, scaleIn } from '@/lib/animations';
import AppLayout from '@/components/layout/AppLayout';
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

/* -- Shared Styles -------------------------------------------------------- */

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

const RECOMMENDATIONS: { value: Recommendation; icon: React.ReactNode; color: string; activeColor: string; activeBorder: string; activeRing: string; activeBg: string }[] = [
  { value: 'Strong Yes', icon: <ChevronUp className="size-4" />, color: 'text-slate-400', activeColor: 'text-green-400', activeBorder: 'rgba(74,222,128,0.5)', activeRing: '0 0 20px rgba(74,222,128,0.15)', activeBg: 'rgba(74,222,128,0.08)' },
  { value: 'Yes', icon: <CheckCircle2 className="size-4" />, color: 'text-slate-400', activeColor: 'text-emerald-400', activeBorder: 'rgba(52,211,153,0.5)', activeRing: '0 0 20px rgba(52,211,153,0.15)', activeBg: 'rgba(52,211,153,0.08)' },
  { value: 'Neutral', icon: <Minus className="size-4" />, color: 'text-slate-400', activeColor: 'text-gray-300', activeBorder: 'rgba(156,163,175,0.5)', activeRing: '0 0 20px rgba(156,163,175,0.12)', activeBg: 'rgba(156,163,175,0.08)' },
  { value: 'No', icon: <XCircle className="size-4" />, color: 'text-slate-400', activeColor: 'text-orange-400', activeBorder: 'rgba(251,146,60,0.5)', activeRing: '0 0 20px rgba(251,146,60,0.15)', activeBg: 'rgba(251,146,60,0.08)' },
  { value: 'Strong No', icon: <ChevronDown className="size-4" />, color: 'text-slate-400', activeColor: 'text-red-400', activeBorder: 'rgba(248,113,113,0.5)', activeRing: '0 0 20px rgba(248,113,113,0.15)', activeBg: 'rgba(248,113,113,0.08)' },
];

/* -- Score Color Helper --------------------------------------------------- */

function scoreColor(score: number): string {
  if (score >= 4) return 'text-green-500';
  if (score >= 3) return 'text-yellow-500';
  if (score >= 2) return 'text-orange-400';
  if (score >= 1) return 'text-red-400';
  return 'text-slate-400';
}

function scoreBgStyle(score: number): React.CSSProperties {
  if (score >= 4) return { background: 'rgba(34,197,94,0.1)' };
  if (score >= 3) return { background: 'rgba(234,179,8,0.1)' };
  if (score >= 2) return { background: 'rgba(251,146,60,0.1)' };
  if (score >= 1) return { background: 'rgba(248,113,113,0.1)' };
  return { background: 'var(--orbis-card)' };
}

/* -- Focus / Blur Handlers ------------------------------------------------ */

function handleInputFocus(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
}

function handleInputBlur(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
}

/* -- Star Rating ---------------------------------------------------------- */

function StarRating({ value, onChange, size = 22, label }: { value: number; onChange: (v: number) => void; size?: number; label?: string }) {
  const [hover, setHover] = useState(0);

  const getStarColor = (i: number, active: boolean) => {
    if (!active) return 'fill-transparent text-slate-400';
    const target = hover || value;
    if (target >= 4) return 'fill-amber-400 text-amber-400';
    if (target >= 3) return 'fill-amber-400 text-amber-400';
    if (target >= 2) return 'fill-amber-500 text-amber-500';
    return 'fill-amber-500 text-amber-500';
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
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm p-0.5"
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
      <div
        className="flex items-center justify-center size-10 rounded-xl shrink-0"
        style={{ background: 'rgba(27,142,229,0.15)' }}
      >
        <span className="text-blue-400">{icon}</span>
      </div>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
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
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(to right, #1B8EE5, rgba(27,142,229,0.7))' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-medium text-slate-400 tabular-nums whitespace-nowrap">
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
        {/* -- Header -------------------------------------------------------- */}
        <motion.div variants={fadeInUp}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Go back"
                onClick={() => navigate('/interviews')}
                className="flex items-center justify-center size-10 rounded-xl text-slate-300 shrink-0 transition-colors hover:text-white"
                style={{ ...glassCard }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">Interview Scorecard</h1>
                  <Sparkles className="size-5 text-blue-400/60" />
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  Provide structured feedback for interview #{scheduleId}
                </p>
              </div>
            </div>
            {/* Mini score badge */}
            {avgScore > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ ...scoreBgStyle(avgScore), border: '1px solid var(--orbis-hover)' }}
              >
                <BarChart3 className={`size-4 ${scoreColor(avgScore)}`} />
                <span className={`text-sm font-bold tabular-nums ${scoreColor(avgScore)}`}>
                  {avgScore.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500">avg</span>
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

        {/* -- Validation Errors ---------------------------------------------- */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="rounded-xl overflow-hidden py-4 px-5"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center size-8 rounded-lg shrink-0 mt-0.5"
                    style={{ background: 'rgba(239,68,68,0.15)' }}
                  >
                    <AlertTriangle className="size-4 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-400 text-sm">Please fix the following:</p>
                    <ul className="mt-2 space-y-1">
                      {errors.map((e, i) => (
                        <li key={i} className="text-sm text-red-400/80 flex items-start gap-2">
                          <span className="text-red-500 mt-1 shrink-0">&bull;</span>
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -- Criteria Section ----------------------------------------------- */}
        <motion.div variants={fadeInUp}>
          <div className="rounded-xl overflow-hidden" style={glassCard}>
            <div className="px-6 pt-6 pb-2">
              <SectionHeader
                icon={<ClipboardCheck className="size-5" />}
                title="Evaluation Criteria"
                subtitle="Rate each area and provide specific examples or observations"
              />
            </div>
            <div className="px-6 pb-6 pt-2">
              <div className="space-y-2">
                {CRITERIA.map((c, idx) => {
                  const state = criteriaScores[c.key];
                  const commentTooShort = state.comment.trim().length > 0 && state.comment.trim().length < 20;
                  const isComplete = state.score > 0 && state.comment.trim().length >= 20;

                  return (
                    <motion.div
                      key={c.key}
                      variants={fadeInUp}
                      className="rounded-xl p-4 transition-colors duration-200"
                      style={
                        isComplete
                          ? { background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }
                          : { background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="flex items-center justify-center size-9 rounded-lg shrink-0 mt-0.5 transition-colors"
                            style={state.score > 0 ? scoreBgStyle(state.score) : { background: 'var(--orbis-input)' }}
                          >
                            <span className={state.score > 0 ? scoreColor(state.score) : 'text-slate-400'}>
                              {c.icon}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white text-sm">{c.label}</p>
                              {isComplete && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                                  <CheckCircle2 className="size-3.5 text-green-500" />
                                </motion.div>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <StarRating value={state.score} onChange={(v) => updateCriterion(c.key, 'score', v)} label={c.label} />
                        </div>
                      </div>
                      <div className="mt-3 ml-12">
                        <textarea
                          placeholder={`Comments on ${c.label.toLowerCase()} (min 20 characters)...`}
                          value={state.comment}
                          onChange={(e) => updateCriterion(c.key, 'comment', e.target.value)}
                          rows={2}
                          className="w-full resize-none text-sm rounded-lg px-3 py-2 placeholder:text-slate-500 outline-none transition-all duration-200"
                          style={glassInput}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        />
                        <AnimatePresence>
                          {commentTooShort && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-xs text-amber-400 mt-1.5 flex items-center gap-1"
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
            </div>
          </div>
        </motion.div>

        {/* -- Overall Assessment --------------------------------------------- */}
        <motion.div variants={fadeInUp}>
          <div className="rounded-xl overflow-hidden" style={glassCard}>
            <div className="px-6 pt-6 pb-2">
              <SectionHeader
                icon={<BarChart3 className="size-5" />}
                title="Overall Assessment"
                subtitle="Your overall evaluation and hiring recommendation"
              />
            </div>
            <div className="px-6 pb-6 pt-2 space-y-6">
              {/* Overall Rating */}
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }}
              >
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
                  <Star className="size-4 text-blue-400/70" />
                  Overall Rating
                </label>
                <StarRating value={overallRating} onChange={setOverallRating} size={30} label="Overall" />
              </div>

              {/* Recommendation */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <ThumbsUp className="size-4 text-blue-400/70" />
                  Hiring Recommendation
                </label>
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
                        className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                          selected ? r.activeColor : r.color
                        }`}
                        style={
                          selected
                            ? { background: r.activeBg, border: `1px solid ${r.activeBorder}`, boxShadow: r.activeRing }
                            : { ...glassCard }
                        }
                      >
                        <span className={selected ? r.activeColor : 'text-slate-400'}>{r.icon}</span>
                        <span className="leading-tight text-center">{r.value}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <ThumbsUp className="size-4 text-green-500/70" />
                  Strengths <span className="text-red-400 text-xs ml-1">*</span>
                </label>
                <textarea
                  placeholder="Key strengths observed during the interview (min 20 characters)..."
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  rows={3}
                  className="w-full resize-none text-sm rounded-lg px-3 py-2 placeholder:text-slate-500 outline-none transition-all duration-200"
                  style={glassInput}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
                <AnimatePresence>
                  {strengths.trim().length > 0 && strengths.trim().length < 20 && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-xs text-amber-400 flex items-center gap-1"
                    >
                      <AlertTriangle className="size-3" />
                      {20 - strengths.trim().length} more character{20 - strengths.trim().length !== 1 ? 's' : ''} needed
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Concerns */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <AlertTriangle className="size-4 text-orange-400/70" />
                  Concerns
                  <span className="text-xs text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  placeholder="Any concerns or areas for improvement..."
                  value={concerns}
                  onChange={(e) => setConcerns(e.target.value)}
                  rows={3}
                  className="w-full resize-none text-sm rounded-lg px-3 py-2 placeholder:text-slate-500 outline-none transition-all duration-200"
                  style={glassInput}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <StickyNote className="size-4 text-blue-400/70" />
                  Additional Notes
                  <span className="text-xs text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  placeholder="Any other observations or context..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full resize-none text-sm rounded-lg px-3 py-2 placeholder:text-slate-500 outline-none transition-all duration-200"
                  style={glassInput}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>

              {/* Would interview again */}
              <div
                className="flex items-center justify-between rounded-xl px-5 py-4"
                style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center size-9 rounded-lg shrink-0"
                    style={{ background: 'rgba(27,142,229,0.15)' }}
                  >
                    <RefreshCw className="size-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Would you interview this candidate again?</p>
                    <p className="text-xs text-slate-500 mt-0.5">For a different role or a future opportunity</p>
                  </div>
                </div>
                <Switch checked={wouldInterviewAgain} onCheckedChange={setWouldInterviewAgain} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* -- Submit --------------------------------------------------------- */}
        <motion.div variants={fadeInUp} className="flex items-center justify-between pb-8">
          <button
            type="button"
            onClick={() => navigate('/interviews')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-colors hover:text-white"
            style={glassCard}
          >
            <ArrowLeft className="size-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center justify-center gap-2 min-w-[180px] px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #6528d7)' }}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
