import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Sparkles, Shield, Zap, ArrowUpRight, CheckCircle2, Clock, AlertTriangle, Crown, XCircle,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import RecommendationBadge from "@/components/RecommendationBadge";
import InterviewUploadModal from "@/components/InterviewUploadModal";
import ImportCandidatesModal from "@/components/ImportCandidatesModal";
import BulkCandidateModal from "@/components/BulkCandidateModal";
import AddCandidateModal from "@/components/AddCandidateModal";
import ResumeViewer from "@/components/ResumeViewer";
import { apiClient } from "@/utils/api";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { DataPagination } from "@/components/DataPagination";
import { scaleIn, fadeInUp } from "@/lib/animations";
import { StaggerGrid } from "@/components/ui/stagger-grid";

/* ── Glass Design System ───────────────────────────────── */
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
const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-dropdown, var(--orbis-card))',
  border: '1px solid var(--orbis-border-strong)',
  color: 'hsl(var(--foreground))',
};
const gradientBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
  boxShadow: '0 8px 24px rgba(27,142,229,0.2)',
};
const outlineBtn: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border)',
};

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
      <span className="w-[72px] text-muted-foreground shrink-0 text-right font-medium tracking-tight">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-hover)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`h-full rounded-full ${color} shadow-sm`}
        />
      </div>
      <span className="w-12 text-muted-foreground font-semibold text-right tabular-nums text-[11px]">
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
    className="rounded-xl p-6"
    style={{ ...glassCard }}
  >
    <div className="flex items-start gap-5 animate-pulse">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="h-12 w-12 shrink-0 rounded-xl" style={{ background: 'var(--orbis-hover)' }} />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="h-4 rounded-lg w-36" style={{ background: 'var(--orbis-hover)' }} />
          <div className="flex gap-4">
            <div className="h-3 rounded-lg w-28" style={{ background: 'var(--orbis-border)' }} />
            <div className="h-3 rounded-lg w-24" style={{ background: 'var(--orbis-border)' }} />
            <div className="h-3 rounded-lg w-20" style={{ background: 'var(--orbis-border)' }} />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center shrink-0 w-20">
        <div className="h-14 w-14 rounded-full" style={{ background: 'var(--orbis-border)' }} />
        <div className="h-2 rounded w-10 mt-2" style={{ background: 'var(--orbis-grid)' }} />
      </div>
      <div className="hidden lg:flex flex-col gap-2 w-52 shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-[72px] h-2 rounded" style={{ background: 'var(--orbis-border)' }} />
            <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--orbis-grid)' }} />
            <div className="w-12 h-2 rounded" style={{ background: 'var(--orbis-border)' }} />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 shrink-0 w-36">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span className="text-[11px] font-semibold text-blue-400">Analyzing...</span>
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
  const scoreColor = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 60 ? 'text-blue-600 dark:text-blue-400' : pct >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const bgRingColor = pct >= 80 ? 'rgba(16,185,129,0.15)' : pct >= 60 ? 'rgba(59,130,246,0.15)' : pct >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={bgRingColor} strokeWidth="5"
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
      <span className="text-[10px] text-muted-foreground mt-1 font-medium">of {max}</span>
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
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const { toast } = useToast();
  const [filters, setFilters] = useState({ recommendation: "All", interviewStatus: "All", pipelineStage: "All" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 0, pageSize: 20 });
  const [resumeViewerUrl, setResumeViewerUrl] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [rankings, setRankings] = useState<Record<string, { rank: number; composite: number; breakdown: Record<string, number> }>>({});
  const [isRanking, setIsRanking] = useState(false);
  const [rankLoaded, setRankLoaded] = useState(false);
  const [showBulkReject, setShowBulkReject] = useState(false);
  const [rejectThreshold, setRejectThreshold] = useState(5);
  const [isRejecting, setIsRejecting] = useState(false);

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

  const handleRankCandidates = async () => {
    if (!jobId) return;
    setIsRanking(true);
    try {
      const res = await apiClient.rankCandidates({ jd_id: Number(jobId) });
      const map: typeof rankings = {};
      for (const r of res.rankings || []) {
        map[String(r.candidate_id)] = { rank: r.rank, composite: r.composite, breakdown: r.breakdown };
      }
      setRankings(map);
      setRankLoaded(true);
      setSortConfig(null); // switch to rank-based sort
      toast({ title: "Ranking Complete", description: `${res.rankings?.length || 0} candidates ranked.` });
    } catch {
      toast({ title: "Error", description: "Failed to rank candidates.", variant: "destructive" });
    } finally {
      setIsRanking(false);
    }
  };

  const handleBulkReject = async () => {
    const toReject = sortedCandidates.filter((c) => {
      const r = rankings[String(c.rawCandidateId)];
      return r && r.rank > rejectThreshold && c.pipelineStage !== "rejected";
    });
    if (toReject.length === 0) {
      toast({ title: "No candidates to reject", description: "No candidates below this rank threshold." });
      return;
    }
    setIsRejecting(true);
    try {
      const ids = toReject.map((c) => Number(c.rawCandidateId));
      await apiClient.bulkMoveCandidates(ids, "rejected", `Bulk rejected — below rank #${rejectThreshold}`);
      toast({ title: "Bulk Reject Complete", description: `${ids.length} candidate(s) moved to rejected.` });
    } catch {
      toast({ title: "Error", description: "Failed to reject candidates.", variant: "destructive" });
    } finally {
      setIsRejecting(false);
      setShowBulkReject(false);
      loadCandidates();
    }
  };

  const filteredCandidates = candidates
    .filter((c) => filters.recommendation === "All" || c.recommendation === filters.recommendation)
    .filter((c) => {
      if (filters.interviewStatus === "All") return true;
      return filters.interviewStatus === "Completed" ? c.interviewCompleted : !c.interviewCompleted;
    });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    // Rejected candidates always at the bottom
    const aRej = a.pipelineStage === "rejected" ? 1 : 0;
    const bRej = b.pipelineStage === "rejected" ? 1 : 0;
    if (aRej !== bRej) return aRej - bRej;

    // When rankings are loaded, default sort by rank (ascending)
    if (rankLoaded && !sortConfig) {
      const ra = rankings[String(a.rawCandidateId)]?.rank ?? 9999;
      const rb = rankings[String(b.rawCandidateId)]?.rank ?? 9999;
      return ra - rb;
    }
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
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(27,142,229,0.2)' }} />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 8px 24px rgba(27,142,229,0.25)' }}>
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
      <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 8px 24px rgba(27,142,229,0.2)' }}>
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
              <button
                onClick={handleRankCandidates}
                disabled={isRanking}
                className="inline-flex items-center rounded-xl text-sm font-semibold text-white px-3 h-9 transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 8px 24px rgba(245,158,11,0.2)' }}
              >
                {isRanking ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Crown className="w-3.5 h-3.5 mr-1.5" />}
                {isRanking ? "Ranking..." : "Rank Candidates"}
              </button>
              {rankLoaded && (
                <button
                  onClick={() => setShowBulkReject(true)}
                  className="inline-flex items-center rounded-xl text-sm font-medium text-red-400 hover:text-red-300 px-3 h-9 transition-colors"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Bulk Reject
                </button>
              )}
              <button
                onClick={() => navigate(`/jobs/${jobId}/pipeline`)}
                className="inline-flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground px-3 h-9 transition-colors"
                style={outlineBtn}
              >
                <Kanban className="w-3.5 h-3.5 mr-1.5" /> Pipeline
              </button>
              <button
                onClick={() => setShowAddCandidateModal(true)}
                className="inline-flex items-center rounded-xl text-sm font-semibold text-white px-3 h-9 transition-all hover:brightness-110"
                style={gradientBtn}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Candidate
              </button>
              <button
                onClick={() => setShowBulkUploadModal(true)}
                className="inline-flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground px-3 h-9 transition-colors"
                style={outlineBtn}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Bulk Upload
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground px-3 h-9 transition-colors"
                style={outlineBtn}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Import
              </button>
              <button
                onClick={() => navigate(`/jobs/${jobId}/interview-evaluations`)}
                className="inline-flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground px-3 h-9 transition-colors"
                style={outlineBtn}
              >
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Interviews
              </button>
              <button
                onClick={downloadExcel}
                className="inline-flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground px-3 h-9 transition-colors"
                style={outlineBtn}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </button>
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
                gradient="bg-gradient-to-br from-blue-500 to-blue-600 text-white"
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
            className="rounded-xl p-4 mb-8"
            style={glassCard}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--orbis-hover)' }}>
                  <Filter className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: '#1B8EE5' }}>
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="h-5 w-px hidden sm:block" style={{ background: 'var(--orbis-border)' }} />
              <Select value={filters.recommendation} onValueChange={(v) => { setFilters((p) => ({ ...p, recommendation: v })); setCurrentPage(1); }}>
                <SelectTrigger className="w-48 h-9 rounded-xl text-xs text-foreground border-0" style={{ ...glassInput }}>
                  <SelectValue placeholder="Recommendation" />
                </SelectTrigger>
                <SelectContent style={selectDrop} className="border-0">
                  <SelectItem value="All">All Recommendations</SelectItem>
                  <SelectItem value="Interview Immediately">Interview Immediately</SelectItem>
                  <SelectItem value="Interview">Interview</SelectItem>
                  <SelectItem value="Consider">Consider</SelectItem>
                  <SelectItem value="Do Not Recommend">Do Not Recommend</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.interviewStatus} onValueChange={(v) => { setFilters((p) => ({ ...p, interviewStatus: v })); setCurrentPage(1); }}>
                <SelectTrigger className="w-40 h-9 rounded-xl text-xs text-foreground border-0" style={{ ...glassInput }}>
                  <SelectValue placeholder="Interview" />
                </SelectTrigger>
                <SelectContent style={selectDrop} className="border-0">
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.pipelineStage} onValueChange={(v) => { setFilters((p) => ({ ...p, pipelineStage: v })); setCurrentPage(1); }}>
                <SelectTrigger className="w-44 h-9 rounded-xl text-xs text-foreground border-0" style={{ ...glassInput }}>
                  <SelectValue placeholder="Pipeline Stage" />
                </SelectTrigger>
                <SelectContent style={selectDrop} className="border-0">
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
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 w-52 rounded-xl pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none transition-colors"
                  style={glassInput}
                  onFocus={(e) => { e.target.style.borderColor = '#1B8EE5'; e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--orbis-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <span className="ml-auto text-xs text-muted-foreground font-medium tabular-nums">
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
                    className={`group rounded-xl p-5 lg:p-6 transition-all duration-300 hover:brightness-110 ${c.pipelineStage === "rejected" ? "opacity-60" : ""}`}
                    style={{
                      ...glassCard,
                      ...(c.pipelineStage === "rejected" ? { borderColor: 'rgba(239,68,68,0.3)', background: 'var(--orbis-card)' } : {}),
                    }}
                  >
                    <div className="flex items-start gap-5">

                      {/* Avatar + info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="relative">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg shadow-md ring-2 ring-white/10" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 16px rgba(27,142,229,0.15)' }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          {c.screened && (
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2" style={{ ringColor: 'var(--orbis-page)' }}>
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-foreground truncate">{c.name}</h3>
                            {c.pipelineStage === "rejected" && (
                              <span className="text-[10px] font-semibold rounded-md px-1.5 py-0 h-5 inline-flex items-center gap-1 shrink-0" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                            {c.source === "portal" && (
                              <span className="text-[10px] font-semibold rounded-md px-1.5 py-0 h-5 inline-flex items-center shrink-0" style={{ background: 'rgba(27,142,229,0.15)', color: '#4db5f0', border: '1px solid rgba(27,142,229,0.3)' }}>
                                Portal
                              </span>
                            )}
                            <span className="text-[10px] font-medium rounded-md px-1.5 py-0 h-5 inline-flex items-center shrink-0 text-muted-foreground" style={{ border: '1px solid var(--orbis-border)' }}>
                              {c.currentRole} · {c.experience}yr
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
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

                      {/* Rank badge */}
                      {rankings[String(c.rawCandidateId)] && (
                        <div className="shrink-0 w-14 flex flex-col items-center gap-1">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl font-extrabold text-sm shadow-md ${
                              rankings[String(c.rawCandidateId)].rank === 1
                                ? "text-amber-900"
                                : rankings[String(c.rawCandidateId)].rank === 2
                                ? "text-slate-700"
                                : rankings[String(c.rawCandidateId)].rank === 3
                                ? "text-orange-900"
                                : "text-muted-foreground"
                            }`}
                            style={{
                              background:
                                rankings[String(c.rawCandidateId)].rank === 1
                                  ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                                  : rankings[String(c.rawCandidateId)].rank === 2
                                  ? "linear-gradient(135deg, #e2e8f0, #cbd5e1)"
                                  : rankings[String(c.rawCandidateId)].rank === 3
                                  ? "linear-gradient(135deg, #fdba74, #f97316)"
                                  : "var(--orbis-input)",
                            }}
                          >
                            #{rankings[String(c.rawCandidateId)].rank}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                            {rankings[String(c.rawCandidateId)].composite}pts
                          </span>
                        </div>
                      )}

                      {/* Score ring */}
                      <div className="shrink-0 w-20">
                        <ScoreRing score={c.totalScore.obtained} max={c.totalScore.max} />
                      </div>

                      {/* Score breakdown */}
                      <div className="hidden lg:flex flex-col gap-2 w-56 shrink-0">
                        <ScoreBar label="Core" obtained={c.coreSkills.obtained} max={c.coreSkills.max} color="bg-blue-500" />
                        <ScoreBar label="Preferred" obtained={c.preferredSkills.obtained} max={c.preferredSkills.max} color="bg-teal-500" />
                        <ScoreBar label="Experience" obtained={c.experienceScore.obtained} max={c.experienceScore.max} color="bg-blue-500" />
                        <ScoreBar label="Education" obtained={c.education.obtained} max={c.education.max} color="bg-amber-500" />
                      </div>

                      {/* Recommendation + interview status */}
                      <div className="flex flex-col items-center gap-2.5 shrink-0 w-40">
                        <RecommendationBadge recommendation={c.recommendation} />
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-md font-medium inline-flex items-center ${
                            c.interviewCompleted
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                          style={{
                            background: c.interviewCompleted ? 'rgba(16,185,129,0.1)' : 'var(--orbis-input)',
                            border: c.interviewCompleted ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--orbis-border)',
                          }}
                        >
                          {c.interviewCompleted ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" />Interviewed</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" />Pending</>
                          )}
                        </span>
                      </div>

                      {/* Screen toggle */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <Switch
                          checked={c.screened}
                          onCheckedChange={(val) => handleScreeningToggle(c.id, val)}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                        <span className={`text-[10px] font-medium ${c.screened ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {c.screened ? "Screened" : "Screen"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.screened ? (
                          !c.interviewCompleted ? (
                            <button
                              onClick={() => setSelectedCandidate({ id: c.id, name: c.name })}
                              className="inline-flex items-center rounded-xl text-xs font-medium h-8 px-3 text-blue-400 transition-colors hover:text-blue-300"
                              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
                            >
                              <Upload className="w-3 h-3 mr-1" /> Upload
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/jobs/${jobId}/interview-evaluations/${c.id}/details`)}
                              className="inline-flex items-center rounded-xl text-xs font-medium h-8 px-3 text-emerald-400 transition-colors hover:text-emerald-300"
                              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                            >
                              <Eye className="w-3 h-3 mr-1" /> Details
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic rounded-lg px-2.5 py-1.5 font-medium" style={{ background: 'var(--orbis-input)' }}>Screen first</span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 p-0 rounded-lg transition-colors inline-flex items-center justify-center hover:bg-white/5">
                              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="shadow-xl rounded-xl w-48 p-1 border-0" style={selectDrop}>
                            {c.resumeUrl && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setResumeViewerUrl(c.resumeUrl)}
                                  className="rounded-lg text-xs px-3 py-2 cursor-pointer text-muted-foreground hover:text-foreground"
                                >
                                  <FileText className="w-3.5 h-3.5 mr-2.5 text-blue-400" /> View Resume
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => window.open(c.resumeUrl!, '_blank')}
                                  className="rounded-lg text-xs px-3 py-2 cursor-pointer text-muted-foreground hover:text-foreground"
                                >
                                  <Download className="w-3.5 h-3.5 mr-2.5 text-blue-400" /> Download Resume
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => navigate(`/scorecard/${c.id}${jobId ? `?jd_id=${jobId}` : ''}`)}
                              className="rounded-lg text-xs px-3 py-2 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <ClipboardList className="w-3.5 h-3.5 mr-2.5 text-teal-400" /> View Scorecard
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/jobs/${jobId}/candidates/${c.id}/feedback`)}
                              className="rounded-lg text-xs px-3 py-2 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <ClipboardList className="w-3.5 h-3.5 mr-2.5 text-blue-400" /> View Feedback
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" style={{ background: 'var(--orbis-border)' }} />
                            <DropdownMenuItem
                              onClick={() => handleDeleteCandidate(c.id, c.name)}
                              className="text-red-400 hover:text-red-300 rounded-lg text-xs px-3 py-2 cursor-pointer"
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
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5" style={{ background: 'var(--orbis-input)' }}>
                  <Search className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">No candidates match your filters</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
                  Try adjusting your filter criteria or clear all filters to see all candidates.
                </p>
                {activeFilterCount > 0 && (
                  <button
                    className="mt-4 rounded-xl text-xs px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    style={outlineBtn}
                    onClick={() => { setFilters({ recommendation: "All", interviewStatus: "All", pipelineStage: "All" }); setSearchInput(""); }}
                  >
                    Clear all filters
                  </button>
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
        {showAddCandidateModal && (
          <AddCandidateModal
            jobId={jobId!}
            isOpen={showAddCandidateModal}
            onClose={() => setShowAddCandidateModal(false)}
            onSuccess={() => { setShowAddCandidateModal(false); loadCandidates(); }}
          />
        )}
        {resumeViewerUrl && (
          <ResumeViewer
            url={resumeViewerUrl}
            onClose={() => setResumeViewerUrl(null)}
          />
        )}

        {/* Bulk Reject Modal */}
        <AnimatePresence>
          {showBulkReject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowBulkReject(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl p-6 w-full max-w-md shadow-2xl"
                style={{ background: 'var(--orbis-dropdown)', border: '1px solid var(--orbis-border-strong)' }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Bulk Reject by Rank</h3>
                    <p className="text-xs text-muted-foreground">Reject all candidates ranked below a threshold</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Reject candidates ranked below
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={1}
                        max={Math.max(Object.keys(rankings).length, 2)}
                        value={rejectThreshold}
                        onChange={(e) => setRejectThreshold(Number(e.target.value))}
                        className="flex-1 accent-red-500"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-muted-foreground">#</span>
                        <input
                          type="number"
                          min={1}
                          max={Object.keys(rankings).length}
                          value={rejectThreshold}
                          onChange={(e) => setRejectThreshold(Number(e.target.value) || 0)}
                          onBlur={() => {
                            const max = Object.keys(rankings).length;
                            if (rejectThreshold < 1) setRejectThreshold(1);
                            else if (rejectThreshold > max) setRejectThreshold(max);
                          }}
                          className="h-10 w-16 rounded-xl text-center text-sm font-bold tabular-nums text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'inherit' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl p-3" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-red-400">
                        {sortedCandidates.filter((c) => {
                          const r = rankings[String(c.rawCandidateId)];
                          return r && r.rank > rejectThreshold && c.pipelineStage !== "rejected";
                        }).length}
                      </span>
                      {" "}candidate(s) will be moved to <span className="font-semibold text-foreground">rejected</span> stage.
                      Candidates already rejected will be skipped.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setShowBulkReject(false)}
                      className="flex-1 h-10 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      style={outlineBtn}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkReject}
                      disabled={isRejecting}
                      className="flex-1 h-10 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                      style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 8px 24px rgba(239,68,68,0.2)' }}
                    >
                      {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      {isRejecting ? "Rejecting..." : "Reject Candidates"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default CandidateEvaluation;
