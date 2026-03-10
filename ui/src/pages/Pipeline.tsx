import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import KanbanBoard from '@/components/pipeline/KanbanBoard';
import PipelineStats from '@/components/pipeline/PipelineStats';
import PipelineTable from '@/components/pipeline/PipelineTable';
import FeedbackModal from '@/components/FeedbackModal';
import InterviewScheduleModal from '@/components/pipeline/InterviewScheduleModal';
import OfferModal from '@/components/pipeline/OfferModal';
import { PipelineConfigModal } from '@/components/PipelineConfigModal';
import EmailComposerModal from '@/components/EmailComposerModal';
import AIInterviewModal from '@/components/pipeline/AIInterviewModal';
import AIInterviewResultsSheet from '@/components/pipeline/AIInterviewResultsSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { PipelineSummary, PipelineCandidate, PipelineStage, CandidateDocument, LocationVacancy } from '@/types/api';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { ArrowLeft, RefreshCw, Search, X, SlidersHorizontal, Settings2, Users, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInLeft, fadeInUp } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const EMPTY_PIPELINE: PipelineSummary = {
  applied: [], screening: [], ai_interview: [], interview: [], offer: [], hired: [], rejected: [],
};

export default function Pipeline() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<PipelineSummary>(EMPTY_PIPELINE);
  const [jobTitle, setJobTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackCandidate, setFeedbackCandidate] = useState<PipelineCandidate | null>(null);
  const [feedbackScheduleId, setFeedbackScheduleId] = useState<number | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCandidate | null>(null);
  const [scheduleCandidate, setScheduleCandidate] = useState<{ id: number; name: string } | null>(null);
  const [offerCandidate, setOfferCandidate] = useState<{ id: number; name: string } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<{ email: string; name: string; id: number } | null>(null);
  const [aiInterviewCandidate, setAiInterviewCandidate] = useState<PipelineCandidate | null>(null);
  const [aiResultsSessionId, setAiResultsSessionId] = useState<number | null>(null);
  const [locationVacancies, setLocationVacancies] = useState<LocationVacancy[]>([]);

  // Documents panel state
  const [docsCandidate, setDocsCandidate] = useState<{ id: number; name: string } | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<CandidateDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [recFilter, setRecFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const debouncedScoreMin = useDebounce(scoreMin, 400);
  const debouncedScoreMax = useDebounce(scoreMax, 400);

  // Filtered pipeline data
  const filteredData = useMemo(() => {
    const filterCandidates = (candidates: PipelineCandidate[]) => {
      let result = candidates;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        result = result.filter(c =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      }
      if (recFilter && recFilter !== 'all') {
        result = result.filter(c => c.recommendation === recFilter);
      }
      const min = debouncedScoreMin ? Number(debouncedScoreMin) : null;
      const max = debouncedScoreMax ? Number(debouncedScoreMax) : null;
      if (min !== null) result = result.filter(c => (c.score ?? 0) >= min);
      if (max !== null) result = result.filter(c => (c.score ?? 0) <= max);
      return result;
    };

    const filtered: PipelineSummary = {} as PipelineSummary;
    for (const stage of Object.keys(data) as PipelineStage[]) {
      filtered[stage] = filterCandidates(data[stage]);
    }
    return filtered;
  }, [data, searchTerm, recFilter, debouncedScoreMin, debouncedScoreMax]);

  const hasActiveFilters = searchTerm || recFilter !== 'all' || scoreMin || scoreMax;
  const activeFilterCount = [searchTerm, recFilter !== 'all', scoreMin, scoreMax].filter(Boolean).length;
  const clearFilters = () => { setSearchTerm(''); setRecFilter('all'); setScoreMin(''); setScoreMax(''); };

  const totalCandidates = useMemo(() =>
    Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
  [data]);

  // Keyboard shortcuts: r=rejected, s=screening, i=interview, o=offer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCandidate) return;
      // Don't trigger when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const keyMap: Record<string, PipelineStage> = {
        r: 'rejected',
        s: 'screening',
        a: 'ai_interview',
        i: 'interview',
        o: 'offer',
      };
      const targetStage = keyMap[e.key.toLowerCase()];
      if (!targetStage || selectedCandidate.pipeline_stage === targetStage) return;

      e.preventDefault();

      // AI Interview stage opens config modal instead of direct move
      if (targetStage === 'ai_interview') {
        setAiInterviewCandidate(selectedCandidate);
        return;
      }

      const fromStage = selectedCandidate.pipeline_stage;

      // Optimistic update
      const newData = { ...data };
      newData[fromStage] = data[fromStage].filter(c => c.id !== selectedCandidate.id);
      newData[targetStage] = [...data[targetStage], { ...selectedCandidate, pipeline_stage: targetStage }];
      setData(newData);

      apiClient.moveCandidateStage(selectedCandidate.id, targetStage)
        .then(() => {
          toast({ title: 'Moved', description: `${selectedCandidate.full_name} moved to ${targetStage}` });
          setSelectedCandidate({ ...selectedCandidate, pipeline_stage: targetStage });
        })
        .catch(() => {
          // Rollback
          setData(data);
          toast({ title: 'Error', description: 'Failed to move candidate', variant: 'destructive' });
        });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCandidate, data]);

  const fetchPipeline = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      const [pipeline, job] = await Promise.all([
        apiClient.getPipelineCandidates(jobId),
        apiClient.getJobById(jobId),
      ]);
      setData(pipeline);
      setJobTitle(job.job_title);
      setLocationVacancies(job.location_vacancies || []);
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
      toast({ title: 'Error', description: 'Failed to load pipeline data.', variant: 'destructive' });
    }
    setIsLoading(false);
  }, [jobId]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // Real-time pipeline updates via SSE
  const handleRealtimeEvent = useCallback((eventType: string, data: any) => {
    if (data.jd_id !== undefined && String(data.jd_id) === jobId) {
      fetchPipeline();
    }
  }, [jobId, fetchPipeline]);

  useRealtimeEvents(handleRealtimeEvent, {
    eventTypes: ['pipeline_stage_changed', 'offer_status_changed', 'interview_scheduled', 'candidate_evaluation_complete', 'ai_interview_completed'],
  });

  const handleCardClick = (candidate: PipelineCandidate) => {
    setSelectedCandidate(candidate);
    navigate(`/jobs/${jobId}/interview-evaluations/${candidate.id}/details`);
  };

  const handleFeedbackClick = async (candidate: PipelineCandidate) => {
    try {
      const schedules = await apiClient.getInterviewsForCandidate(candidate.id);
      if (schedules && schedules.length > 0) {
        setFeedbackScheduleId(schedules[schedules.length - 1].id);
        setFeedbackCandidate(candidate);
      } else {
        toast({ title: 'No interview found', description: 'No interview schedule exists for this candidate.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load interview schedule.', variant: 'destructive' });
    }
  };

  const handleScheduleInterview = (candidate: PipelineCandidate) => {
    setScheduleCandidate({ id: candidate.id, name: candidate.full_name });
  };

  const handleSendOffer = (candidate: PipelineCandidate) => {
    setOfferCandidate({ id: candidate.id, name: candidate.full_name });
  };

  const handleGenerateDocument = (candidate: PipelineCandidate) => {
    // Navigate to templates page with candidate context
    navigate(`/templates?candidate=${candidate.id}&job=${jobId}`);
  };

  const handleViewDocuments = async (candidate: PipelineCandidate) => {
    setDocsCandidate({ id: candidate.id, name: candidate.full_name });
    setDocsLoading(true);
    try {
      const res = await apiClient.getCandidateDocuments(candidate.id, jobId ? Number(jobId) : undefined);
      setCandidateDocs(res.documents || []);
    } catch {
      setCandidateDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDocStatusChange = async (doc: CandidateDocument, newStatus: string) => {
    try {
      await apiClient.updateDocumentStatus(doc.candidate_id, doc.id, newStatus);
      toast({ title: 'Updated', description: `Document status changed to ${newStatus}` });
      // Refresh docs
      if (docsCandidate) {
        const res = await apiClient.getCandidateDocuments(docsCandidate.id, jobId ? Number(jobId) : undefined);
        setCandidateDocs(res.documents || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update document status', variant: 'destructive' });
    }
  };

  const handleSendAIInterview = (candidate: PipelineCandidate) => {
    setAiInterviewCandidate(candidate);
  };

  const handleViewAIResults = (candidate: PipelineCandidate) => {
    if (candidate.ai_interview_session_id) {
      setAiResultsSessionId(candidate.ai_interview_session_id);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-muted/40 via-background to-muted/30">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-[1600px] mx-auto px-6 py-6 space-y-6"
        >
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/60 shadow-sm"
          >
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                {/* Left: Back button + title */}
                <motion.div
                  variants={slideInLeft}
                  initial="hidden"
                  animate="visible"
                  className="flex items-start gap-4"
                >
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Go back"
                    onClick={() => navigate(`/jobs/${jobId}`)}
                    className="rounded-xl h-10 w-10 shrink-0 border-border/60 hover:bg-muted/80 transition-all duration-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Pipeline
                      </h1>
                      <Badge
                        variant="secondary"
                        className="rounded-lg px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-0"
                      >
                        {totalCandidates} candidates
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {jobTitle || 'Loading...'}
                    </p>
                  </div>
                </motion.div>

                {/* Right: Action buttons */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/jobs/${jobId}/candidates`)}
                    className="rounded-xl h-9 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Candidates
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfigModal(true)}
                    className="rounded-xl h-9 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Stages
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPipeline}
                    disabled={isLoading}
                    className="rounded-xl h-9 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <StaggerGrid>
              <PipelineStats data={data} locationVacancies={locationVacancies} />
            </StaggerGrid>
          </motion.div>

          {/* Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/60 shadow-sm p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 text-sm rounded-xl border-border/60 bg-muted/30 focus:bg-card transition-colors"
                />
              </div>

              <div className="h-6 w-px bg-border/60 hidden sm:block" />

              <Select value={recFilter} onValueChange={setRecFilter}>
                <SelectTrigger className="w-[200px] h-10 text-sm rounded-xl border-border/60 bg-muted/30">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-2 text-muted-foreground/60" />
                  <SelectValue placeholder="Recommendation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Recommendations</SelectItem>
                  <SelectItem value="Interview Immediately">Interview Immediately</SelectItem>
                  <SelectItem value="Interview">Interview</SelectItem>
                  <SelectItem value="Maybe">Maybe</SelectItem>
                  <SelectItem value="Reject">Reject</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min score"
                  value={scoreMin}
                  onChange={(e) => setScoreMin(e.target.value)}
                  className="w-28 h-10 text-sm rounded-xl border-border/60 bg-muted/30"
                />
                <span className="text-xs text-muted-foreground/60 font-medium">to</span>
                <Input
                  type="number"
                  placeholder="Max score"
                  value={scoreMax}
                  onChange={(e) => setScoreMax(e.target.value)}
                  className="w-28 h-10 text-sm rounded-xl border-border/60 bg-muted/30"
                />
              </div>

              {activeFilterCount > 0 && (
                  <Badge className="h-6 px-2 rounded-full bg-blue-500 text-white text-[10px] font-bold border-0">
                      {activeFilterCount} active
                  </Badge>
              )}
              <AnimatePresence>
                {hasActiveFilters && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-10 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-destructive/10 transition-all duration-200"
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      Clear filters
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Kanban Board */}
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-72 gap-4"
            >
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">Loading pipeline...</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <KanbanBoard
                data={filteredData}
                onDataChange={setData}
                onCardClick={handleCardClick}
                onFeedbackClick={handleFeedbackClick}
                onScheduleInterview={handleScheduleInterview}
                onSendOffer={handleSendOffer}
                onSendAIInterview={handleSendAIInterview}
                onGenerateDocument={handleGenerateDocument}
                onViewDocuments={handleViewDocuments}
                onSendEmail={(c) => setEmailTarget({ email: c.email, name: c.full_name, id: c.id })}
                onViewAIResults={handleViewAIResults}
                selectedCandidateId={selectedCandidate?.id ?? null}
                onSelectCandidate={setSelectedCandidate}
                jdId={jobId ? Number(jobId) : undefined}
                jobTitle={jobTitle}
                onRefresh={fetchPipeline}
              />
            </motion.div>
          )}

          {/* Table View */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <PipelineTable data={filteredData} onRefresh={fetchPipeline} />
          </motion.div>

          {/* Keyboard shortcut hint */}
          <AnimatePresence>
            {selectedCandidate && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
              >
                <div className="flex items-center gap-3 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-lg text-white text-xs px-5 py-3 rounded-2xl shadow-2xl shadow-black/20 border border-white/10">
                  <span className="font-semibold text-white/90">{selectedCandidate.full_name}</span>
                  <div className="h-4 w-px bg-white/20" />
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1">
                      <kbd className="bg-white/15 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border border-white/10">S</kbd>
                      <span className="text-white/60">Screen</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="bg-white/15 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border border-white/10">A</kbd>
                      <span className="text-white/60">AI</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="bg-white/15 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border border-white/10">I</kbd>
                      <span className="text-white/60">Interview</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="bg-white/15 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border border-white/10">O</kbd>
                      <span className="text-white/60">Offer</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="bg-white/15 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border border-white/10">R</kbd>
                      <span className="text-white/60">Reject</span>
                    </span>
                  </div>
                  <div className="h-4 w-px bg-white/20" />
                  <button
                    onClick={() => setSelectedCandidate(null)}
                    aria-label="Deselect candidate"
                    className="text-white/40 hover:text-white hover:bg-white/10 rounded-lg h-6 w-6 flex items-center justify-center transition-all duration-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Feedback Modal */}
      {feedbackCandidate && feedbackScheduleId && (
        <FeedbackModal
          scheduleId={feedbackScheduleId}
          candidateName={feedbackCandidate.full_name}
          open={!!feedbackCandidate}
          onClose={() => { setFeedbackCandidate(null); setFeedbackScheduleId(null); }}
          onSubmitted={() => { setFeedbackCandidate(null); setFeedbackScheduleId(null); fetchPipeline(); }}
        />
      )}

      {/* Interview Schedule Modal */}
      {scheduleCandidate && jobId && (
        <InterviewScheduleModal
          isOpen={!!scheduleCandidate}
          onClose={() => setScheduleCandidate(null)}
          candidateId={scheduleCandidate.id}
          candidateName={scheduleCandidate.name}
          jdId={jobId}
          onScheduled={() => { setScheduleCandidate(null); fetchPipeline(); }}
        />
      )}

      {/* Offer Modal */}
      {offerCandidate && jobId && (
        <OfferModal
          isOpen={!!offerCandidate}
          onClose={() => setOfferCandidate(null)}
          candidateId={offerCandidate.id}
          candidateName={offerCandidate.name}
          jdId={jobId}
          jobTitle={jobTitle}
          onOfferCreated={() => { setOfferCandidate(null); fetchPipeline(); }}
        />
      )}

      {/* Pipeline Config Modal */}
      {jobId && (
        <PipelineConfigModal
          open={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          jdId={Number(jobId)}
          onSaved={fetchPipeline}
        />
      )}

      {/* Email Composer Modal */}
      <EmailComposerModal
        open={!!emailTarget}
        onClose={() => setEmailTarget(null)}
        defaultTo={emailTarget?.email}
        defaultName={emailTarget?.name}
        candidateId={emailTarget?.id}
      />

      {/* AI Interview Config Modal */}
      {aiInterviewCandidate && jobId && (
        <AIInterviewModal
          isOpen={!!aiInterviewCandidate}
          onClose={() => setAiInterviewCandidate(null)}
          candidateId={aiInterviewCandidate.id}
          candidateName={aiInterviewCandidate.full_name}
          candidateEmail={aiInterviewCandidate.email}
          jdId={Number(jobId)}
          onSent={() => { setAiInterviewCandidate(null); fetchPipeline(); }}
        />
      )}

      {/* AI Interview Results Sheet */}
      <AIInterviewResultsSheet
        sessionId={aiResultsSessionId}
        open={aiResultsSessionId !== null}
        onOpenChange={(open) => { if (!open) setAiResultsSessionId(null); }}
      />

      {/* Documents Panel */}
      <Sheet open={!!docsCandidate} onOpenChange={(open) => { if (!open) { setDocsCandidate(null); setCandidateDocs([]); } }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/40">
                <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              Documents
            </SheetTitle>
            <SheetDescription>
              {docsCandidate?.name ? `Documents for ${docsCandidate.name}` : 'Candidate documents'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {docsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Loading documents...</p>
              </div>
            ) : candidateDocs.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-muted/80 mx-auto mb-3">
                  <FileText className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">No documents yet</p>
                <p className="text-xs text-muted-foreground/70 max-w-[280px] mx-auto">
                  Documents are auto-assigned when candidates move through pipeline stages with configured stage rules.
                </p>
              </div>
            ) : (
              candidateDocs.map((doc) => {
                const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
                  pending:   { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
                  generated: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
                  sent:      { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
                  signed:    { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
                };
                const nextStatus: Record<string, string> = {
                  pending: 'generated',
                  generated: 'sent',
                  sent: 'signed',
                };
                const cfg = statusConfig[doc.status] || { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border/60 bg-card/80 p-4 space-y-3 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{doc.template_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Stage: {doc.stage}</p>
                      </div>
                      <Badge
                        className={`shrink-0 text-[10px] font-semibold rounded-lg px-2 py-0.5 border-0 inline-flex items-center gap-1.5 ${cfg.bg} ${cfg.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {doc.status}
                      </Badge>
                    </div>
                    {doc.generated_by && (
                      <p className="text-xs text-muted-foreground/70">
                        Generated by {doc.generated_by}{doc.generated_at ? ` on ${new Date(doc.generated_at).toLocaleDateString()}` : ''}
                      </p>
                    )}
                    {nextStatus[doc.status] && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs w-full rounded-xl border-border/60 hover:bg-primary/5 transition-colors"
                        onClick={() => handleDocStatusChange(doc, nextStatus[doc.status])}
                      >
                        Mark as {nextStatus[doc.status]}
                      </Button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
