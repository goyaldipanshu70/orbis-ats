import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Users, CheckCircle2, MessageSquare, Star, Loader2,
  Inbox, ChevronRight, TrendingUp, BarChart3, UserCircle, Calendar,
  ThumbsUp, ThumbsDown, Minus, Award, AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AppLayout from "@/components/layout/AppLayout";
import { apiClient } from "@/utils/api";

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
const REC_BADGE: Record<string, string> = {
  strong_yes: "bg-emerald-100 text-emerald-700 border-emerald-200",
  yes: "bg-green-100 text-green-700 border-green-200",
  neutral: "bg-gray-100 text-gray-600 border-gray-200",
  no: "bg-orange-100 text-orange-700 border-orange-200",
  strong_no: "bg-red-100 text-red-700 border-red-200",
};
const SCORE_BG: Record<number, string> = {
  5: "bg-green-100 text-green-700", 4: "bg-emerald-100 text-emerald-700",
  3: "bg-yellow-100 text-yellow-700", 2: "bg-orange-100 text-orange-700",
  1: "bg-red-100 text-red-700",
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
      <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
    ))}
  </div>
);

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
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  /* ── Error / empty state ──────────────────────────────── */
  if (error || !data) {
    return (
      <AppLayout>
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <Button variant="ghost" onClick={() => navigate(`/jobs/${jobId}/candidates`)} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Candidates
          </Button>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">{error || "No feedback data available."}</p>
            <p className="text-xs text-muted-foreground mt-1">Try again later or check if feedback has been submitted.</p>
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-50/10 dark:to-blue-950/10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-[1400px] mx-auto px-6 py-8"
        >

          {/* ── Breadcrumb ──────────────────────────────── */}
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
            <button
              onClick={() => navigate(`/jobs/${jobId}/candidates`)}
              className="hover:text-foreground transition-colors"
            >
              Candidates
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Feedback Detail</span>
          </motion.div>

          {/* ── Header ──────────────────────────────────── */}
          <motion.div variants={itemVariants} className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                  <UserCircle className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">Interview Feedback</h1>
                  <p className="text-sm text-muted-foreground">
                    Candidate <span className="font-semibold text-foreground">#{candidateId}</span>
                    <span className="mx-1.5 text-border">|</span>
                    Job <span className="font-semibold text-foreground">#{jobId}</span>
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/jobs/${jobId}/candidates`)}
              className="rounded-lg"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
            </Button>
          </motion.div>

          {/* ── KPI Cards ────────────────────────────────── */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            {[
              { icon: Users, label: "Total Rounds", value: data.total_rounds, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
              { icon: CheckCircle2, label: "Completed", value: data.completed_rounds, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
              { icon: MessageSquare, label: "Total Feedback", value: data.total_feedback, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40" },
              { icon: TrendingUp, label: "Avg Rating", value: data.avg_rating, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
            ].map(({ icon: Icon, label, value, color, bg }, idx) => (
              <motion.div
                key={label}
                variants={itemVariants}
                className="relative rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1.5">
                      {typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Recommendation Distribution ──────────────── */}
          {totalRec > 0 && (
            <motion.div variants={itemVariants} className="rounded-xl border border-border bg-card p-6 mb-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Recommendation Distribution</h3>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-muted/40 mb-4">
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
                  const RecIcon = REC_ICON[key];
                  return (
                    <span key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`w-2 h-2 rounded-full ${REC_COLORS[key]}`} />
                      <span className="capitalize">{key.replace("_", " ")}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </span>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Per-Round Accordion ──────────────────────── */}
          <motion.div variants={itemVariants}>
            <Accordion type="multiple" defaultValue={data.rounds.map((r) => String(r.round_number))} className="space-y-4 mb-10">
              {data.rounds.map((round, roundIdx) => (
                <motion.div key={round.round_number} variants={itemVariants}>
                  <AccordionItem value={String(round.round_number)} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-xs font-bold text-foreground">
                          {round.round_number}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground capitalize">
                            {round.round_type} Round
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{round.scheduled_date}</span>
                          </div>
                        </div>
                        <div className="ml-auto mr-3 flex items-center gap-2">
                          <Badge variant={round.status === "completed" ? "default" : "secondary"} className="text-[10px] rounded-full capitalize">
                            {round.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {round.feedback_count} feedback
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      {round.feedback.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                          <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center mb-3">
                            <Inbox className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-medium">No feedback submitted yet</p>
                          <p className="text-xs mt-0.5">Feedback will appear here once interviewers submit their evaluations.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {round.feedback.map((fb, fbIdx) => (
                            <motion.div
                              key={fb.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: fbIdx * 0.05, duration: 0.3 }}
                            >
                              <Card className="border-border rounded-xl hover:shadow-md transition-shadow">
                                <CardHeader className="pb-3 px-5 pt-5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-xs font-bold text-foreground uppercase">
                                        {fb.interviewer_name.charAt(0)}
                                      </div>
                                      <CardTitle className="text-sm font-semibold">{fb.interviewer_name}</CardTitle>
                                    </div>
                                    <Badge className={`text-[10px] rounded-full capitalize border ${REC_BADGE[fb.recommendation] || REC_BADGE.neutral}`}>
                                      {fb.recommendation?.replace("_", " ")}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <StarRating value={fb.rating} />
                                    <span className="text-xs text-muted-foreground font-medium">{fb.rating}/5</span>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-4 px-5 pb-5">
                                  {/* Criteria scores with colored bars */}
                                  {fb.criteria_scores && Object.keys(fb.criteria_scores).length > 0 && (
                                    <div className="space-y-2.5 pt-1">
                                      {Object.entries(fb.criteria_scores).map(([key, val]) => (
                                        <div key={key} className="space-y-1">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-muted-foreground font-medium">
                                              {CRITERIA_LABELS[key] || key.replace(/_/g, " ")}
                                            </span>
                                            <span className={`text-[11px] font-bold ${val.score >= 4 ? "text-emerald-600" : val.score >= 3 ? "text-yellow-600" : "text-red-600"}`}>
                                              {val.score}/5
                                            </span>
                                          </div>
                                          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
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
                                    <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3">
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <ThumbsUp className="w-3 h-3 text-emerald-600" />
                                        <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Strengths</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-relaxed">{fb.strengths}</p>
                                    </div>
                                  )}
                                  {fb.concerns && (
                                    <div className="rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 p-3">
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <AlertTriangle className="w-3 h-3 text-orange-600" />
                                        <p className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Concerns</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-relaxed">{fb.concerns}</p>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
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
            <motion.div variants={itemVariants} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-5 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground tracking-tight">Comparison Matrix</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Side-by-side criteria scores across all interviewers</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-semibold w-44">Criteria</TableHead>
                      {allFeedback.map((fb) => (
                        <TableHead key={fb.id} className="text-xs font-semibold text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-[10px] font-bold uppercase">
                              {fb.interviewer_name.charAt(0)}
                            </div>
                            <span className="truncate max-w-[80px]">{fb.interviewer_name}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CRITERIA_KEYS.map((key) => (
                      <TableRow key={key} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="text-xs font-medium text-foreground">{CRITERIA_LABELS[key]}</TableCell>
                        {allFeedback.map((fb) => {
                          const score = fb.criteria_scores?.[key]?.score;
                          return (
                            <TableCell key={fb.id} className="text-center">
                              {score != null ? (
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${SCORE_BG[score] || "bg-muted text-muted-foreground"}`}>
                                  {score}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">N/A</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    {/* Overall rating row */}
                    <TableRow className="border-t-2 border-border bg-muted/10">
                      <TableCell className="text-xs font-bold text-foreground">Overall Rating</TableCell>
                      {allFeedback.map((fb) => (
                        <TableCell key={fb.id} className="text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ring-1 ring-border ${SCORE_BG[fb.rating] || "bg-muted text-muted-foreground"}`}>
                            {fb.rating}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                    {/* Recommendation row */}
                    <TableRow className="bg-muted/10">
                      <TableCell className="text-xs font-bold text-foreground">Recommendation</TableCell>
                      {allFeedback.map((fb) => (
                        <TableCell key={fb.id} className="text-center">
                          <Badge className={`text-[10px] rounded-full capitalize border ${REC_BADGE[fb.recommendation] || REC_BADGE.neutral}`}>
                            {fb.recommendation?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default CandidateFeedbackDetail;
