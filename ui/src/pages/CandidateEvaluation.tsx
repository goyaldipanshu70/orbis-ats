import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download, Eye, Mail, Phone, MapPin, Upload, BarChart3,
  MoreVertical, Trash2, UserPlus, Star, Calendar, Award,
  TrendingUp, Users, Filter, Loader2, Search, ChevronRight, FileText, ClipboardList, Kanban,
  Sparkles, Shield, Zap, ArrowUpRight, CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import RecommendationBadge from "@/components/RecommendationBadge";
import InterviewUploadModal from "@/components/InterviewUploadModal";
import ImportCandidatesModal from "@/components/ImportCandidatesModal";
import BulkCandidateModal from "@/components/BulkCandidateModal";
import ResumeViewer from "@/components/ResumeViewer";
import { apiClient } from "@/utils/api";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { DataPagination } from "@/components/DataPagination";
import { scaleIn, fadeInUp } from "@/lib/animations";
import { StaggerGrid } from "@/components/ui/stagger-grid";

interface ScorePair { obtained: number; max: number; }

interface CandidateData {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  currentRole: string;
  experience: number;
  coreSkills: ScorePair;
  preferredSkills: ScorePair;
  experienceScore: ScorePair;
  education: ScorePair;
  industryFit: ScorePair;
  softSkills: ScorePair;
  totalScore: ScorePair;
  recommendation: "Interview Immediately" | "Interview" | "Consider" | "Do Not Recommend";
  highlightedSkills: string[];
  redFlags: string[];
  notes: string;
  resumeUrl: string | null;
  interviewCompleted: boolean;
  screened: boolean;
  pipelineStage: string;
  source: "manual" | "portal";
  isProcessing: boolean;
  rawCandidateId: number;
}

/* ── Animated score bar ──────────────────────────────────── */
const ScoreBar = ({ label, obtained, max, color, icon: Icon }: {
  label: string; obtained: number; max: number; color: string;
  icon?: React.ElementType;
}) => {
  const pct = max > 0 ? (obtained / max) * 100 : 0;
  return (
    <div className="group/bar flex items-center gap-2.5 text-xs">
      <span className="w-[72px] text-muted-foreground/80 shrink-0 text-right font-medium tracking-tight">{label}</span>
      <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`h-full rounded-full ${color} shadow-sm`}
        />
      </div>
      <span className="w-12 text-muted-foreground/70 font-semibold text-right tabular-nums text-[11px]">
        {obtained}/{max}
      </span>
    </div>
  );
};

/* ── Stat card component ──────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, sub, gradient, iconBg }: {
  icon: React.ElementType; label: string; value: number; sub: string;
  gradient: string; iconBg: string;
}) => (
  <motion.div
    whileHover={{ y: -2, transition: { duration: 0.2 } }}
    className={`relative overflow-hidden rounded-xl p-5 ${gradient} cursor-default group`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70">{label}</p>
        <p className="text-3xl font-extrabold mt-1.5 tracking-tight">{value}</p>
        <p className="text-[11px] mt-1 opacity-60 font-medium">{sub}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} backdrop-blur-sm`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </motion.div>
);

/* ── Skeleton shimmer card for processing candidates ──── */
const SkeletonCandidateCard = () => (
  <motion.div
    variants={fadeInUp}
    className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
  >
    <div className="flex items-start gap-5 animate-pulse">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-muted/80" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="h-4 bg-muted/80 rounded-lg w-36" />
          <div className="flex gap-4">
            <div className="h-3 bg-muted/60 rounded-lg w-28" />
            <div className="h-3 bg-muted/60 rounded-lg w-24" />
            <div className="h-3 bg-muted/60 rounded-lg w-20" />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center shrink-0 w-20">
        <div className="h-14 w-14 rounded-full bg-muted/60" />
        <div className="h-2 bg-muted/40 rounded w-10 mt-2" />
      </div>
      <div className="hidden lg:flex flex-col gap-2 w-52 shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-[72px] h-2 bg-muted/60 rounded" />
            <div className="flex-1 h-2 bg-muted/40 rounded-full" />
            <div className="w-12 h-2 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 shrink-0 w-36">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Analyzing...</span>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ── Score ring SVG ───────────────────────────────────────── */
const ScoreRing = ({ score, max, size = 56 }: { score: number; max: number; size?: number }) => {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeColor = pct >= 80 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const scoreColor = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 60 ? 'text-blue-600 dark:text-blue-400' : pct >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400';
  const bgRing = pct >= 80 ? 'stroke-emerald-100 dark:stroke-emerald-950/40' : pct >= 60 ? 'stroke-blue-100 dark:stroke-blue-950/40' : pct >= 40 ? 'stroke-amber-100 dark:stroke-amber-950/40' : 'stroke-red-100 dark:stroke-red-950/40';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" className={bgRing} strokeWidth="5"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={strokeColor} strokeWidth="5"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${(pct / 100) * circumference} ${circumference}` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${scoreColor} tabular-nums`}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground/60 mt-1 font-medium">of {max}</span>
    </div>
  );
};

const CandidateEvaluation = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof CandidateData; direction: "asc" | "desc" } | null>({ key: "totalScore", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: string; name: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const { toast } = useToast();
  const [filters, setFilters] = useState({ recommendation: "All", interviewStatus: "All", pipelineStage: "All" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 0, pageSize: 20 });
  const [resumeViewerUrl, setResumeViewerUrl] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    searchDebounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchInput]);

  useEffect(() => { if (jobId) loadCandidates(); }, [jobId, currentPage, filters.pipelineStage, search]);

  // Real-time SSE events for candidate evaluation updates
  const hasProcessing = candidates.some((c) => c.isProcessing);

  const handleRealtimeEvent = useCallback((eventType: string, data: any) => {
    if (eventType === "candidate_evaluation_complete") {
      if (String(data.jd_id) === jobId) {
        loadCandidates();
        toast({ title: "AI Evaluation Complete", description: `${data.full_name || "Candidate"} scored ${data.score}/100` });
      }
    } else if (eventType === "candidate_evaluation_failed") {
      if (String(data.jd_id) === jobId) {
        loadCandidates();
        toast({ title: "Evaluation Failed", description: data.error || "AI scoring failed for a candidate.", variant: "destructive" });
      }
    }
  }, [jobId]);

  const { status: eventStatus } = useRealtimeEvents(handleRealtimeEvent, {
    eventTypes: ["candidate_evaluation_complete", "candidate_evaluation_failed"],
    enabled: hasProcessing,
  });

  // Fallback: slow polling (30s) if SSE is unavailable
  useEffect(() => {
    const processingCandidates = candidates.filter((c) => c.isProcessing);
    if (processingCandidates.length === 0 || eventStatus === "connected") {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    pollingRef.current = setInterval(async () => {
      let anyCompleted = false;
      for (const c of processingCandidates) {
        try {
          const status = await apiClient.getCandidateAIStatus(c.rawCandidateId);
          if (status.ai_status === "completed") { anyCompleted = true; }
        } catch { /* ignore polling errors */ }
      }
      if (anyCompleted) { loadCandidates(); }
    }, 30000);

    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [candidates, eventStatus]);

  const loadCandidates = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getCandidates(jobId, currentPage, 20, {
        pipeline_stage: filters.pipelineStage !== "All" ? filters.pipelineStage : undefined,
        search: search || undefined,
      });
      const backendCandidates = response.items;
      setPaginationMeta({ total: response.total, totalPages: response.total_pages, pageSize: response.page_size });
      const transformedCandidates: CandidateData[] = backendCandidates.map((candidate: any) => {
        const aiAnalysis = candidate.ai_resume_analysis;
        const isProcessing = !aiAnalysis || (typeof aiAnalysis === 'object' && Object.keys(aiAnalysis).length === 0);
        const categoryScores = aiAnalysis?.category_scores || {};
        const totalScoreData = categoryScores.total_score;
        let totalScore = 0;
        if (totalScoreData && typeof totalScoreData === "object") {
          totalScore = totalScoreData.obtained_score ?? totalScoreData.obtained ?? 0;
        }
        let defaultRecommendation: CandidateData["recommendation"] = "Do Not Recommend";
        if (totalScore >= 80) defaultRecommendation = "Interview Immediately";
        else if (totalScore >= 60) defaultRecommendation = "Interview";
        else if (totalScore >= 40) defaultRecommendation = "Consider";
        let recommendation: CandidateData["recommendation"] = defaultRecommendation;
        const aiRec = candidate.ai_resume_analysis?.ai_recommendation?.toLowerCase();
        if (aiRec?.includes("interview immediately")) recommendation = "Interview Immediately";
        else if (aiRec?.includes("interview")) recommendation = "Interview";
        else if (aiRec?.includes("do not recommend")) recommendation = "Do Not Recommend";
        else if (aiRec?.includes("consider")) recommendation = "Consider";
        const getScore = (scoreData: any): ScorePair => {
          if (!scoreData && scoreData !== 0) return { obtained: 0, max: 0 };
          if (typeof scoreData === "number") {
            return { obtained: scoreData, max: 100 };
          }
          if (typeof scoreData === "object") {
            return {
              obtained: Number(scoreData.obtained_score ?? scoreData.obtained ?? 0),
              max: Number(scoreData.max_score ?? scoreData.max ?? 0),
            };
          }
          return { obtained: 0, max: 0 };
        };
        return {
          id: candidate._id,
          name: candidate.full_name || candidate.ai_resume_analysis?.metadata?.full_name || "N/A",
          email: candidate.email || candidate.ai_resume_analysis?.metadata?.email || "N/A",
          phone: candidate.phone || candidate.ai_resume_analysis?.metadata?.phone || "N/A",
          location: candidate.ai_resume_analysis?.metadata?.location || "N/A",
          currentRole: candidate.ai_resume_analysis?.metadata?.current_role || "N/A",
          experience: candidate.ai_resume_analysis?.metadata?.years_of_experience || 0,
          coreSkills: getScore(categoryScores.core_skills),
          preferredSkills: getScore(categoryScores.preferred_skills),
          experienceScore: getScore(categoryScores.experience),
          education: getScore(categoryScores.education),
          industryFit: getScore(categoryScores.industry_fit),
          softSkills: getScore(categoryScores.soft_skills),
          totalScore: getScore(categoryScores.total_score),
          recommendation,
          resumeUrl: candidate.resume_url || candidate.ai_resume_analysis?.resume_file_link || null,
          highlightedSkills: candidate.ai_resume_analysis?.highlighted_skills || [],
          redFlags: candidate.ai_resume_analysis?.red_flags || [],
          notes: candidate.ai_resume_analysis?.notes || "",
          interviewCompleted: candidate.interview_status || false,
          screened: candidate.screening || false,
          pipelineStage: candidate.pipeline_stage || "applied",
          source: candidate.source || "manual",
          isProcessing,
          rawCandidateId: candidate._id,
        };
      });
      setCandidates(transformedCandidates);
    } catch {
      toast({ title: "Error", description: "Failed to load candidates.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScreeningToggle = async (candidateId: string, newScreeningStatus: boolean) => {
    try {
      await apiClient.screenCandidate(candidateId, newScreeningStatus);
      setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, screened: newScreeningStatus } : c)));
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update screening status." });
    }
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to delete candidate "${candidateName}"? This action cannot be undone.`)) return;
    try {
      await apiClient.deleteCandidate(candidateId);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      toast({ title: "Success", description: "Candidate deleted successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to delete candidate.", variant: "destructive" });
    }
  };

  const handleImportCandidates = async (selectedCandidateIds: string[]) => {
    try {
      await apiClient.importCandidates(jobId!, selectedCandidateIds);
      toast({ title: "Success", description: `${selectedCandidateIds.length} candidate(s) imported successfully.` });
      loadCandidates();
    } catch {
      toast({ title: "Error", description: "Failed to import candidates.", variant: "destructive" });
    }
  };

  const filteredCandidates = candidates
    .filter((c) => filters.recommendation === "All" || c.recommendation === filters.recommendation)
    .filter((c) => {
      if (filters.interviewStatus === "All") return true;
      return filters.interviewStatus === "Completed" ? c.interviewCompleted : !c.interviewCompleted;
    });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    if (!sortConfig) return b.totalScore.obtained - a.totalScore.obtained;
    if (sortConfig.key === "totalScore") {
      return sortConfig.direction === "asc"
        ? a.totalScore.obtained - b.totalScore.obtained
        : b.totalScore.obtained - a.totalScore.obtained;
    }
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    return sortConfig.direction === "asc" ? (aVal < bVal ? -1 : 1) : aVal > bVal ? -1 : 1;
  });

  const downloadExcel = () => {
    const csvContent = [
      ["Name", "Email", "Phone", "Current Role", "Total Score", "Core Skills", "Preferred Skills", "Experience", "Education", "Industry Fit", "Soft Skills", "Recommendation", "Interview Completed", "Screened", "Notes"].join(","),
      ...candidates.map((c) =>
        [c.name, c.email, c.phone, c.currentRole, `${c.totalScore.obtained}/${c.totalScore.max}`, `${c.coreSkills.obtained}/${c.coreSkills.max}`, `${c.preferredSkills.obtained}/${c.preferredSkills.max}`, `${c.experienceScore.obtained}/${c.experienceScore.max}`, `${c.education.obtained}/${c.education.max}`, `${c.industryFit.obtained}/${c.industryFit.max}`, `${c.softSkills.obtained}/${c.softSkills.max}`, c.recommendation, c.interviewCompleted ? "Yes" : "No", c.screened ? "Yes" : "No", `"${c.notes.replace(/"/g, '""')}"`].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidates_${jobId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const recommended = candidates.filter((c) => c.screened && (c.recommendation === "Interview" || c.recommendation === "Interview Immediately")).length;
  const interviewDone = candidates.filter((c) => c.screened && c.interviewCompleted).length;
  const interviewPending = candidates.filter((c) => c.screened && !c.interviewCompleted).length;
  const screenedCount = candidates.filter((c) => c.screened).length;

  const activeFilterCount = [
    filters.recommendation !== "All",
    filters.interviewStatus !== "All",
    filters.pipelineStage !== "All",
    search.length > 0,
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Loading evaluations</p>
            <p className="text-xs text-muted-foreground mt-1">Fetching AI-powered assessments...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50/80 via-white to-slate-50/50 dark:from-slate-950 dark:via-background dark:to-slate-950/50">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8">

          {/* ── Header ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-10"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    Candidate Evaluations
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    AI-powered assessment results for Job{" "}
                    <span className="font-semibold text-foreground/80">#{jobId}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => navigate(`/jobs/${jobId}/pipeline`)}
                size="sm"
                variant="outline"
                className="rounded-xl border-border/60 hover:border-purple-300 hover:text-purple-600 dark:hover:border-purple-700 dark:hover:text-purple-400 transition-colors h-9"
              >
                <Kanban className="w-3.5 h-3.5 mr-1.5" /> Pipeline
              </Button>
              <Button
                onClick={() => setShowBulkUploadModal(true)}
                size="sm"
                className="rounded-xl font-semibold text-white shadow-md shadow-blue-600/20 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all h-9"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Bulk Upload
              </Button>
              <Button
                onClick={() => setShowImportModal(true)}
                size="sm"
                variant="outline"
                className="rounded-xl border-border/60 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors h-9"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Import
              </Button>
              <Button
                onClick={() => navigate(`/jobs/${jobId}/interview-evaluations`)}
                size="sm"
                variant="outline"
                className="rounded-xl border-border/60 hover:border-violet-300 hover:text-violet-600 dark:hover:border-violet-700 dark:hover:text-violet-400 transition-colors h-9"
              >
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Interviews
              </Button>
              <Button
                onClick={downloadExcel}
                size="sm"
                variant="outline"
                className="rounded-xl border-border/60 hover:border-emerald-300 hover:text-emerald-600 dark:hover:border-emerald-700 dark:hover:text-emerald-400 transition-colors h-9"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </Button>
            </div>
          </motion.div>

          {/* ── KPI cards ──────────────────────────────────────── */}
          <StaggerGrid className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
            <motion.div variants={scaleIn}>
              <StatCard
                icon={Users} label="Total" value={candidates.length}
                sub="Candidates assessed"
                gradient="bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                iconBg="bg-white/15"
              />
            </motion.div>
            <motion.div variants={scaleIn}>
              <StatCard
                icon={Shield} label="Screened" value={screenedCount}
                sub="Ready for process"
                gradient="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                iconBg="bg-white/15"
              />
            </motion.div>
            <motion.div variants={scaleIn}>
              <StatCard
                icon={TrendingUp} label="Recommended" value={recommended}
                sub="For interview"
                gradient="bg-gradient-to-br from-amber-400 to-amber-500 text-white"
                iconBg="bg-white/15"
              />
            </motion.div>
            <motion.div variants={scaleIn}>
              <StatCard
                icon={CheckCircle2} label="Interviewed" value={interviewDone}
                sub="Completed"
                gradient="bg-gradient-to-br from-violet-500 to-violet-600 text-white"
                iconBg="bg-white/15"
              />
            </motion.div>
            <motion.div variants={scaleIn}>
              <StatCard
                icon={Clock} label="Pending" value={interviewPending}
                sub="Awaiting interview"
                gradient="bg-gradient-to-br from-orange-400 to-orange-500 text-white"
                iconBg="bg-white/15"
              />
            </motion.div>
          </StaggerGrid>

          {/* ── Filter bar ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 mb-8 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/80">
                  <Filter className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold border-0">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              <div className="h-5 w-px bg-border/60 hidden sm:block" />
              <Select value={filters.recommendation} onValueChange={(v) => { setFilters((p) => ({ ...p, recommendation: v })); setCurrentPage(1); }}>
                <SelectTrigger className="w-48 h-9 rounded-xl border-border/50 text-xs bg-background/60 hover:bg-background transition-colors">
                  <SelectValue placeholder="Recommendation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Recommendations</SelectItem>
                  <SelectItem value="Interview Immediately">Interview Immediately</SelectItem>
                  <SelectItem value="Interview">Interview</SelectItem>
                  <SelectItem value="Consider">Consider</SelectItem>
                  <SelectItem value="Do Not Recommend">Do Not Recommend</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.interviewStatus} onValueChange={(v) => { setFilters((p) => ({ ...p, interviewStatus: v })); setCurrentPage(1); }}>
                <SelectTrigger className="w-40 h-9 rounded-xl border-border/50 text-xs bg-background/60 hover:bg-background transition-colors">
                  <SelectValue placeholder="Interview" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.pipelineStage} onValueChange={(v) => { setFilters((p) => ({ ...p, pipelineStage: v })); setCurrentPage(1); }}>
                <SelectTrigger className="w-44 h-9 rounded-xl border-border/50 text-xs bg-background/60 hover:bg-background transition-colors">
                  <SelectValue placeholder="Pipeline Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Stages</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="ai_interview">AI Interview</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="hired">Hired</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 w-52 rounded-xl border border-border/50 bg-background/60 pl-8 pr-3 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/40 hover:bg-background transition-colors"
                />
              </div>
              <span className="ml-auto text-xs text-muted-foreground/70 font-medium tabular-nums">
                {filteredCandidates.length} of {candidates.length} shown
              </span>
            </div>
          </motion.div>

          {/* ── Candidate cards ────────────────────────────────── */}
          <StaggerGrid className="space-y-3">
            {sortedCandidates.length > 0 ? (
              sortedCandidates.map((c) => {
                // Show skeleton card for candidates still being processed by AI
                if (c.isProcessing) {
                  return <SkeletonCandidateCard key={c.id} />;
                }

                const scorePct = c.totalScore.max > 0 ? (c.totalScore.obtained / c.totalScore.max) * 100 : 0;
                const barColor = scorePct >= 80 ? 'bg-emerald-500' : scorePct >= 60 ? 'bg-blue-500' : scorePct >= 40 ? 'bg-amber-500' : 'bg-red-400';

                return (
                  <motion.div
                    key={c.id}
                    variants={fadeInUp}
                    whileHover={{ y: -1 }}
                    className="group rounded-xl border border-border/50 bg-card hover:bg-card/90 p-5 lg:p-6 shadow-sm hover:shadow-lg hover:border-border transition-all duration-300"
                  >
                    <div className="flex items-start gap-5">

                      {/* Avatar + info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="relative">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg shadow-md shadow-blue-500/15 ring-2 ring-white dark:ring-slate-800">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          {c.screened && (
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-foreground truncate">{c.name}</h3>
                            {c.source === "portal" && (
                              <Badge className="text-[10px] font-semibold rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 px-1.5 py-0 h-5 shrink-0">
                                Portal
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] font-medium rounded-md px-1.5 py-0 h-5 shrink-0 border-border/60">
                              {c.currentRole} · {c.experience}yr
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground/70">
                            <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                              <Mail className="w-3 h-3" />{c.email}
                            </span>
                            <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                              <Phone className="w-3 h-3" />{c.phone}
                            </span>
                            <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                              <MapPin className="w-3 h-3" />{c.location}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Score ring */}
                      <div className="shrink-0 w-20">
                        <ScoreRing score={c.totalScore.obtained} max={c.totalScore.max} />
                      </div>

                      {/* Score breakdown */}
                      <div className="hidden lg:flex flex-col gap-2 w-56 shrink-0">
                        <ScoreBar label="Core" obtained={c.coreSkills.obtained} max={c.coreSkills.max} color="bg-blue-500" />
                        <ScoreBar label="Preferred" obtained={c.preferredSkills.obtained} max={c.preferredSkills.max} color="bg-teal-500" />
                        <ScoreBar label="Experience" obtained={c.experienceScore.obtained} max={c.experienceScore.max} color="bg-violet-500" />
                        <ScoreBar label="Education" obtained={c.education.obtained} max={c.education.max} color="bg-amber-500" />
                      </div>

                      {/* Recommendation + interview status */}
                      <div className="flex flex-col items-center gap-2.5 shrink-0 w-40">
                        <RecommendationBadge recommendation={c.recommendation} />
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2.5 py-0.5 rounded-md font-medium border ${
                            c.interviewCompleted
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40"
                              : "bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/40"
                          }`}
                        >
                          {c.interviewCompleted ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" />Interviewed</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" />Pending</>
                          )}
                        </Badge>
                      </div>

                      {/* Screen toggle */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <Switch
                          checked={c.screened}
                          onCheckedChange={(val) => handleScreeningToggle(c.id, val)}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                        <span className={`text-[10px] font-medium ${c.screened ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/60"}`}>
                          {c.screened ? "Screened" : "Screen"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.screened ? (
                          !c.interviewCompleted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedCandidate({ id: c.id, name: c.name })}
                              className="rounded-xl text-xs border-blue-200/60 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 h-8 transition-colors"
                            >
                              <Upload className="w-3 h-3 mr-1" /> Upload
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/jobs/${jobId}/interview-evaluations/${c.id}/details`)}
                              className="rounded-xl text-xs border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-8 transition-colors"
                            >
                              <Eye className="w-3 h-3 mr-1" /> Details
                            </Button>
                          )
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 italic bg-muted/50 rounded-lg px-2.5 py-1.5 font-medium">Screen first</span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-muted/80 transition-colors">
                              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card shadow-xl border border-border/60 rounded-xl w-48 p-1">
                            {c.resumeUrl && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setResumeViewerUrl(c.resumeUrl)}
                                  className="rounded-lg text-xs px-3 py-2 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 mr-2.5 text-blue-500" /> View Resume
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => window.open(c.resumeUrl!, '_blank')}
                                  className="rounded-lg text-xs px-3 py-2 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5 mr-2.5 text-blue-500" /> Download Resume
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => navigate(`/scorecard/${c.id}`)}
                              className="rounded-lg text-xs px-3 py-2 cursor-pointer"
                            >
                              <ClipboardList className="w-3.5 h-3.5 mr-2.5 text-teal-500" /> View Scorecard
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/jobs/${jobId}/candidates/${c.id}/feedback`)}
                              className="rounded-lg text-xs px-3 py-2 cursor-pointer"
                            >
                              <ClipboardList className="w-3.5 h-3.5 mr-2.5 text-violet-500" /> View Feedback
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem
                              onClick={() => handleDeleteCandidate(c.id, c.name)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-lg text-xs px-3 py-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2.5" /> Delete Candidate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-5">
                  <Search className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-semibold text-foreground">No candidates match your filters</p>
                <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-xs">
                  Try adjusting your filter criteria or clear all filters to see all candidates.
                </p>
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl text-xs"
                    onClick={() => { setFilters({ recommendation: "All", interviewStatus: "All", pipelineStage: "All" }); setSearchInput(""); }}
                  >
                    Clear all filters
                  </Button>
                )}
              </motion.div>
            )}
          </StaggerGrid>

          <DataPagination
            page={currentPage}
            totalPages={paginationMeta.totalPages}
            total={paginationMeta.total}
            pageSize={paginationMeta.pageSize}
            onPageChange={setCurrentPage}
          />
        </div>

        {selectedCandidate && (
          <InterviewUploadModal
            candidateId={selectedCandidate.id}
            candidateName={selectedCandidate.name}
            isOpen={!!selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onSuccess={() => { setSelectedCandidate(null); loadCandidates(); }}
          />
        )}
        {showImportModal && (
          <ImportCandidatesModal
            currentJobId={jobId!}
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImport={handleImportCandidates}
          />
        )}
        {showBulkUploadModal && (
          <BulkCandidateModal
            jobId={jobId!}
            isOpen={showBulkUploadModal}
            onClose={() => setShowBulkUploadModal(false)}
            onSuccess={() => { setShowBulkUploadModal(false); loadCandidates(); toast({ title: "Success", description: "Candidates uploaded and analyzed!" }); }}
          />
        )}
        {resumeViewerUrl && (
          <ResumeViewer
            url={resumeViewerUrl}
            onClose={() => setResumeViewerUrl(null)}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default CandidateEvaluation;
