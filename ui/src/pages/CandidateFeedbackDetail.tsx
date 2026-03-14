import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Users, CheckCircle2, MessageSquare, Star, Loader2,
  Inbox, ChevronRight, TrendingUp, BarChart3, UserCircle, Calendar,
  ThumbsUp, ThumbsDown, Minus, Award, AlertTriangle, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import AppLayout from "@/components/layout/AppLayout";
import { apiClient } from "@/utils/api";

/* ── Glass Design System ───────────────────────────────── */
const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

/* ── Types ──────────────────────────────────────────────── */
interface CriteriaScore { score: number; comment?: string }
interface FeedbackEntry {
  id: number; interviewer_name: string; rating: number;
  recommendation: string; strengths: string | null; concerns: string | null;
  criteria_scores: Record<string, CriteriaScore> | null;
  rubric_scores: any; created_at: string;
}
interface Round {
  schedule_id: number; round_number: number; round_type: string;
  status: string; scheduled_date: string; interviewer_names: string[];
  feedback_count: number; feedback: FeedbackEntry[];
}
interface AggregateData {
  total_rounds: number; completed_rounds: number; total_feedback: number;
  avg_rating: number;
  recommendation_distribution: Record<string, number>;
  rounds: Round[];
}

const CRITERIA_KEYS = ["technical_skills", "communication", "problem_solving", "culture_fit", "leadership_growth"];
const CRITERIA_LABELS: Record<string, string> = {
  technical_skills: "Technical Skills", communication: "Communication",
  problem_solving: "Problem Solving", culture_fit: "Culture Fit",
  leadership_growth: "Leadership & Growth",
};

const REC_COLORS: Record<string, string> = {
  strong_yes: "bg-emerald-500", yes: "bg-green-500", neutral: "bg-gray-400",
  no: "bg-orange-500", strong_no: "bg-red-500",
};
const REC_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  strong_yes: { bg: "rgba(16,185,129,0.1)", text: "#34d399", border: "rgba(16,185,129,0.2)" },
  yes:        { bg: "rgba(34,197,94,0.1)",  text: "#4ade80", border: "rgba(34,197,94,0.2)" },
  neutral:    { bg: "rgba(148,163,184,0.1)", text: "#94a3b8", border: "rgba(148,163,184,0.2)" },
  no:         { bg: "rgba(249,115,22,0.1)", text: "#fb923c", border: "rgba(249,115,22,0.2)" },
  strong_no:  { bg: "rgba(239,68,68,0.1)",  text: "#f87171", border: "rgba(239,68,68,0.2)" },
};

const SCORE_BG: Record<number, { bg: string; text: string }> = {
  5: { bg: "rgba(34,197,94,0.1)", text: "#4ade80" },
  4: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  3: { bg: "rgba(234,179,8,0.1)", text: "#facc15" },
  2: { bg: "rgba(249,115,22,0.1)", text: "#fb923c" },
  1: { bg: "rgba(239,68,68,0.1)", text: "#f87171" },
};

const SCORE_BAR_COLOR: Record<number, string> = {
  5: "bg-green-500", 4: "bg-emerald-500",
  3: "bg-yellow-500", 2: "bg-orange-500",
  1: "bg-red-500",
};

const REC_ICON: Record<string, typeof ThumbsUp> = {
  strong_yes: Award, yes: ThumbsUp, neutral: Minus,
  no: ThumbsDown, strong_no: AlertTriangle,
};

/* ── Animation variants ─────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const StarRating = ({ value }: { value: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-slate-400"}`} />
    ))}
  </div>
);

/* Helper: dark-glass recommendation badge */
const RecBadge = ({ rec }: { rec: string }) => {
  const style = REC_BADGE[rec] || REC_BADGE.neutral;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {rec?.replace("_", " ")}
    </span>
  );
};

/* Helper: dark-glass score pill */
const ScorePill = ({ score }: { score: number }) => {
  const style = SCORE_BG[score] || { bg: "var(--orbis-input)", text: "#94a3b8" };
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold"
      style={{ background: style.bg, color: style.text }}
    >
      {score}
    </span>
  );
};

/* ── Main Component ──────────────────────────────────────── */
const CandidateFeedbackDetail = () => {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId || !jobId) return;
    setLoading(true);
    apiClient.getAggregateFeedback(Number(candidateId), Number(jobId))
      .then(setData)
      .catch(() => setError("Failed to load feedback data."))
      .finally(() => setLoading(false));
  }, [candidateId, jobId]);

  /* ── Loading skeleton ─────────────────────────────────── */
  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
          <div className="h-5 w-64 rounded-md animate-pulse" style={{ background: 'var(--orbis-border)' }} />
          <div className="h-8 w-48 rounded-md animate-pulse" style={{ background: 'var(--orbis-border)' }} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--orbis-grid)' }} />
            ))}
          </div>
          <div className="h-10 w-full rounded-xl animate-pulse" style={{ background: 'var(--orbis-grid)' }} />
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--orbis-grid)' }} />
          ))}
        </div>
      </AppLayout>
    );
  }

  /* ── Error / empty state ──────────────────────────────── */
  if (error || !data) {
    return (
      <AppLayout>
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <button
            onClick={() => navigate(`/jobs/${jobId}/candidates`)}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 transition-colors hover:text-white"
            style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Candidates
          </button>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-20 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--orbis-input)' }}
            >
              <Inbox className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-white">{error || "No feedback data available."}</p>
            <p className="text-xs text-slate-500 mt-1">Try again later or check if feedback has been submitted.</p>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  const recDist = data.recommendation_distribution || {};
  const totalRec = Object.values(recDist).reduce((s, v) => s + v, 0);

  /* Collect all interviewers with feedback for the comparison matrix */
  const allFeedback = data.rounds.flatMap((r) => r.feedback);

  return (
    <AppLayout>
      <div className="min-h-screen">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-[1400px] mx-auto px-6 py-8"
        >

          {/* ── Breadcrumb ──────────────────────────────── */}
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs text-slate-500 mb-5">
            <button
              onClick={() => navigate(`/jobs/${jobId}/candidates`)}
              className="hover:text-white transition-colors"
            >
              Candidates
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white font-medium">Feedback Detail</span>
          </motion.div>

          {/* ── Header ──────────────────────────────────── */}
          <motion.div variants={itemVariants} className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1B8EE5] to-[#1676c0] flex items-center justify-center text-white">
                  <UserCircle className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Interview Feedback</h1>
                  <p className="text-sm text-slate-400">
                    Candidate <span className="font-semibold text-white">#{candidateId}</span>
                    <span className="mx-1.5" style={{ color: 'var(--orbis-border)' }}>|</span>
                    Job <span className="font-semibold text-white">#{jobId}</span>
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate(`/jobs/${jobId}/candidates`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </motion.div>

          {/* ── KPI Cards ────────────────────────────────── */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            {[
              { icon: Users, label: "Total Rounds", value: data.total_rounds, color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
              { icon: CheckCircle2, label: "Completed", value: data.completed_rounds, color: "#34d399", bg: "rgba(52,211,153,0.1)" },
              { icon: MessageSquare, label: "Total Feedback", value: data.total_feedback, color: "#4db5f0", bg: "rgba(77,181,240,0.1)" },
              { icon: TrendingUp, label: "Avg Rating", value: data.avg_rating, color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <motion.div
                key={label}
                variants={itemVariants}
                className="relative rounded-xl p-5 transition-shadow hover:shadow-lg hover:shadow-blue-500/5"
                style={glassCard}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className="text-3xl font-bold text-white mt-1.5">
                      {typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value}
                    </p>
                  </div>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: bg }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Recommendation Distribution ──────────────── */}
          {totalRec > 0 && (
            <motion.div variants={itemVariants} className="rounded-xl p-6 mb-8" style={glassCard}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-white">Recommendation Distribution</h3>
              </div>
              <div
                className="flex h-3 rounded-full overflow-hidden mb-4"
                style={{ background: 'var(--orbis-border)' }}
              >
                {(["strong_yes", "yes", "neutral", "no", "strong_no"] as const).map((key) => {
                  const count = recDist[key] || 0;
                  if (!count) return null;
                  const pct = (count / totalRec) * 100;
                  return (
                    <div
                      key={key}
                      className={`${REC_COLORS[key]} transition-all first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${pct}%` }}
                      title={`${key.replace("_", " ")}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(["strong_yes", "yes", "neutral", "no", "strong_no"] as const).map((key) => {
                  const count = recDist[key] || 0;
                  return (
                    <span key={key} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className={`w-2 h-2 rounded-full ${REC_COLORS[key]}`} />
                      <span className="capitalize">{key.replace("_", " ")}</span>
                      <span className="font-semibold text-white">{count}</span>
                    </span>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Per-Round Accordion ──────────────────────── */}
          <motion.div variants={itemVariants}>
            <Accordion type="multiple" defaultValue={data.rounds.map((r) => String(r.round_number))} className="space-y-4 mb-10">
              {data.rounds.map((round) => (
                <motion.div key={round.round_number} variants={itemVariants}>
                  <AccordionItem
                    value={String(round.round_number)}
                    className="rounded-xl overflow-hidden"
                    style={{ ...glassCard, borderBottom: '1px solid var(--orbis-border)' }}
                  >
                    <AccordionTrigger className="px-6 py-4 hover:no-underline transition-colors" style={{ borderBottom: 'none' }}>
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{ background: 'var(--orbis-hover)' }}
                        >
                          {round.round_number}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white capitalize">
                            {round.round_type} Round
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span className="text-[11px] text-slate-500">{round.scheduled_date}</span>
                          </div>
                        </div>
                        <div className="ml-auto mr-3 flex items-center gap-2">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                            style={
                              round.status === "completed"
                                ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
                                : { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }
                            }
                          >
                            {round.status}
                          </span>
                          <span className="text-xs text-slate-500">
                            {round.feedback_count} feedback
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      {round.feedback.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                            style={{ background: 'var(--orbis-input)' }}
                          >
                            <Inbox className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-medium text-slate-400">No feedback submitted yet</p>
                          <p className="text-xs mt-0.5 text-slate-500">Feedback will appear here once interviewers submit their evaluations.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {round.feedback.map((fb, fbIdx) => (
                            <motion.div
                              key={fb.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: fbIdx * 0.05, duration: 0.3 }}
                              className="rounded-xl p-5 transition-shadow hover:shadow-lg hover:shadow-blue-500/5"
                              style={glassCard}
                            >
                              {/* Card header */}
                              <div className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white uppercase"
                                      style={{ background: 'linear-gradient(135deg, var(--orbis-hover), var(--orbis-grid))' }}
                                    >
                                      {fb.interviewer_name.charAt(0)}
                                    </div>
                                    <span className="text-sm font-semibold text-white">{fb.interviewer_name}</span>
                                  </div>
                                  <RecBadge rec={fb.recommendation} />
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <StarRating value={fb.rating} />
                                  <span className="text-xs text-slate-500 font-medium">{fb.rating}/5</span>
                                </div>
                              </div>

                              {/* Card body */}
                              <div className="space-y-4">
                                {/* Criteria scores with colored bars */}
                                {fb.criteria_scores && Object.keys(fb.criteria_scores).length > 0 && (
                                  <div className="space-y-2.5 pt-1">
                                    {Object.entries(fb.criteria_scores).map(([key, val]) => (
                                      <div key={key} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[11px] text-slate-500 font-medium">
                                            {CRITERIA_LABELS[key] || key.replace(/_/g, " ")}
                                          </span>
                                          <span
                                            className="text-[11px] font-bold"
                                            style={{ color: val.score >= 4 ? '#34d399' : val.score >= 3 ? '#facc15' : '#f87171' }}
                                          >
                                            {val.score}/5
                                          </span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                                          <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(val.score / 5) * 100}%` }}
                                            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                                            className={`h-full rounded-full ${SCORE_BAR_COLOR[val.score] || "bg-blue-500"}`}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {fb.strengths && (
                                  <div
                                    className="rounded-lg p-3"
                                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <ThumbsUp className="w-3 h-3 text-emerald-400" />
                                      <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Strengths</p>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">{fb.strengths}</p>
                                  </div>
                                )}
                                {fb.concerns && (
                                  <div
                                    className="rounded-lg p-3"
                                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <AlertTriangle className="w-3 h-3 text-orange-400" />
                                      <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">Concerns</p>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">{fb.concerns}</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </motion.div>

          {/* ── Comparison Matrix ────────────────────────── */}
          {allFeedback.length > 0 && (
            <motion.div variants={itemVariants} className="rounded-xl overflow-hidden mb-8" style={glassCard}>
              <div
                className="px-6 py-5"
                style={{ borderBottom: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-white tracking-tight">Comparison Matrix</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">Side-by-side criteria scores across all interviewers</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--orbis-border)', background: 'var(--orbis-card)' }}>
                      <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-400 w-44">Criteria</th>
                      {allFeedback.map((fb) => (
                        <th key={fb.id} className="h-12 px-4 text-center align-middle text-xs font-semibold text-slate-400">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold uppercase text-white"
                              style={{ background: 'linear-gradient(135deg, var(--orbis-hover), var(--orbis-grid))' }}
                            >
                              {fb.interviewer_name.charAt(0)}
                            </div>
                            <span className="truncate max-w-[80px]">{fb.interviewer_name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CRITERIA_KEYS.map((key) => (
                      <tr
                        key={key}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid var(--orbis-border)' }}
                      >
                        <td className="p-4 align-middle text-xs font-medium text-white">{CRITERIA_LABELS[key]}</td>
                        {allFeedback.map((fb) => {
                          const score = fb.criteria_scores?.[key]?.score;
                          return (
                            <td key={fb.id} className="p-4 align-middle text-center">
                              {score != null ? (
                                <ScorePill score={score} />
                              ) : (
                                <span className="text-xs text-slate-400">N/A</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Overall rating row */}
                    <tr style={{ borderTop: '2px solid var(--orbis-border)', borderBottom: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
                      <td className="p-4 align-middle text-xs font-bold text-white">Overall Rating</td>
                      {allFeedback.map((fb) => (
                        <td key={fb.id} className="p-4 align-middle text-center">
                          <ScorePill score={fb.rating} />
                        </td>
                      ))}
                    </tr>
                    {/* Recommendation row */}
                    <tr style={{ background: 'var(--orbis-subtle)' }}>
                      <td className="p-4 align-middle text-xs font-bold text-white">Recommendation</td>
                      {allFeedback.map((fb) => (
                        <td key={fb.id} className="p-4 align-middle text-center">
                          <RecBadge rec={fb.recommendation} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default CandidateFeedbackDetail;
