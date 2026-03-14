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
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};
const sItemCls = 'text-slate-200 focus:bg-white/10 focus:text-white';

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCandidate) return;
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const keyMap: Record<string, PipelineStage> = {
        r: 'rejected', s: 'screening', a: 'ai_interview', i: 'interview', o: 'offer',
      };
      const targetStage = keyMap[e.key.toLowerCase()];
      if (!targetStage || selectedCandidate.pipeline_stage === targetStage) return;

      e.preventDefault();

      if (targetStage === 'ai_interview') {
        setAiInterviewCandidate(selectedCandidate);
        return;
      }

      const fromStage = selectedCandidate.pipeline_stage;
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

  const statusCfg: Record<string, { bg: string; text: string; dot: string }> = {
    pending:   { bg: 'rgba(251,191,36,0.08)', text: 'text-amber-400', dot: 'bg-amber-500' },
    generated: { bg: 'rgba(59,130,246,0.08)', text: 'text-blue-400', dot: 'bg-blue-500' },
    sent:      { bg: 'rgba(22,118,192,0.08)', text: 'text-blue-400', dot: 'bg-blue-500' },
    signed:    { bg: 'rgba(34,197,94,0.08)', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  };
  const nextStatus: Record<string, string> = {
    pending: 'generated', generated: 'sent', sent: 'signed',
  };

  return (
    <AppLayout>
      <div className="min-h-screen relative" style={{ background: 'var(--orbis-page)' }}>
        {/* Ambient glow */}
        <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(27,142,229,0.04)', filter: 'blur(120px)' }} />
        <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(59,130,246,0.04)', filter: 'blur(120px)' }} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-[1600px] mx-auto px-6 py-6 space-y-6"
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl p-5"
            style={glassCard}
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left */}
              <div className="flex items-start gap-4">
                <button
                  onClick={() => navigate(`/jobs/${jobId}`)}
                  aria-label="Go back"
                  className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all hover:scale-105"
                  style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-input)'; }}
                >
                  <ArrowLeft className="h-4 w-4 text-slate-300" />
                </button>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tight text-white">Pipeline</h1>
                    <span className="rounded-lg px-2.5 py-0.5 text-xs font-bold" style={{ background: 'rgba(27,142,229,0.15)', color: '#4db5f0' }}>
                      {totalCandidates} candidates
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {jobTitle || 'Loading...'}
                  </p>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-2 shrink-0">
                {[
                  { label: 'Candidates', icon: Users, onClick: () => navigate(`/jobs/${jobId}/candidates`) },
                  { label: 'Stages', icon: Settings2, onClick: () => setShowConfigModal(true) },
                  { label: 'Refresh', icon: RefreshCw, onClick: fetchPipeline, spin: isLoading },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    disabled={btn.label === 'Refresh' && isLoading}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-bold text-slate-300 transition-all hover:text-white disabled:opacity-50"
                    style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-hover)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-grid)'; }}
                  >
                    <btn.icon className={`h-4 w-4 ${btn.spin ? 'animate-spin' : ''}`} />
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Stats ───────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <PipelineStats data={data} locationVacancies={locationVacancies} />
          </motion.div>

          {/* ── Filter Bar ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl p-4"
            style={glassCard}
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 text-sm rounded-xl outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <div className="h-6 w-px hidden sm:block" style={{ background: 'var(--orbis-border)' }} />

              {/* Recommendation filter */}
              <Select value={recFilter} onValueChange={setRecFilter}>
                <SelectTrigger className="w-[200px] h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  <SelectValue placeholder="Recommendation" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  <SelectItem className={sItemCls} value="all">All Recommendations</SelectItem>
                  <SelectItem className={sItemCls} value="Interview Immediately">Interview Immediately</SelectItem>
                  <SelectItem className={sItemCls} value="Interview">Interview</SelectItem>
                  <SelectItem className={sItemCls} value="Maybe">Maybe</SelectItem>
                  <SelectItem className={sItemCls} value="Reject">Reject</SelectItem>
                </SelectContent>
              </Select>

              {/* Score range */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min score"
                  value={scoreMin}
                  onChange={(e) => setScoreMin(e.target.value)}
                  className="w-28 h-10 px-3 text-sm rounded-xl outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <span className="text-xs text-slate-500 font-medium">to</span>
                <input
                  type="number"
                  placeholder="Max score"
                  value={scoreMax}
                  onChange={(e) => setScoreMax(e.target.value)}
                  className="w-28 h-10 px-3 text-sm rounded-xl outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {activeFilterCount > 0 && (
                <span className="h-6 px-2 rounded-full text-[10px] font-bold inline-flex items-center" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                  {activeFilterCount} active
                </span>
              )}

              <AnimatePresence>
                {hasActiveFilters && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={clearFilters}
                      className="h-10 px-3 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 transition-all"
                      style={{ background: 'var(--orbis-card)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                    >
                      <X className="w-3.5 h-3.5 mr-1.5 inline" />
                      Clear filters
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── Kanban Board ─────────────────────────────────────── */}
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-72 gap-4"
            >
              <div className="relative">
                <div className="h-10 w-10 rounded-full" style={{ border: '2px solid rgba(27,142,229,0.2)' }} />
                <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#1B8EE5' }} />
              </div>
              <p className="text-sm text-slate-400 animate-pulse">Loading pipeline...</p>
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

          {/* ── Table View ───────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <PipelineTable data={filteredData} onRefresh={fetchPipeline} />
          </motion.div>

          {/* ── Keyboard Shortcut Hint ───────────────────────────── */}
          <AnimatePresence>
            {selectedCandidate && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
              >
                <div
                  className="flex items-center gap-3 text-xs px-5 py-3 rounded-2xl"
                  style={{ background: 'var(--orbis-dropdown)', backdropFilter: 'blur(16px)', border: '1px solid var(--orbis-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
                >
                  <span className="font-semibold text-white/90">{selectedCandidate.full_name}</span>
                  <div className="h-4 w-px bg-white/20" />
                  <div className="flex items-center gap-2.5">
                    {[
                      { key: 'S', label: 'Screen' },
                      { key: 'A', label: 'AI' },
                      { key: 'I', label: 'Interview' },
                      { key: 'O', label: 'Offer' },
                      { key: 'R', label: 'Reject' },
                    ].map(k => (
                      <span key={k.key} className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}>{k.key}</kbd>
                        <span className="text-white/50">{k.label}</span>
                      </span>
                    ))}
                  </div>
                  <div className="h-4 w-px bg-white/20" />
                  <button
                    onClick={() => setSelectedCandidate(null)}
                    aria-label="Deselect candidate"
                    className="text-white/40 hover:text-white rounded-lg h-6 w-6 flex items-center justify-center transition-all"
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-border)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {feedbackCandidate && feedbackScheduleId && (
        <FeedbackModal
          scheduleId={feedbackScheduleId}
          candidateName={feedbackCandidate.full_name}
          open={!!feedbackCandidate}
          onClose={() => { setFeedbackCandidate(null); setFeedbackScheduleId(null); }}
          onSubmitted={() => { setFeedbackCandidate(null); setFeedbackScheduleId(null); fetchPipeline(); }}
        />
      )}

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

      {jobId && (
        <PipelineConfigModal
          open={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          jdId={Number(jobId)}
          onSaved={fetchPipeline}
        />
      )}

      <EmailComposerModal
        open={!!emailTarget}
        onClose={() => setEmailTarget(null)}
        defaultTo={emailTarget?.email}
        defaultName={emailTarget?.name}
        candidateId={emailTarget?.id}
      />

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

      <AIInterviewResultsSheet
        sessionId={aiResultsSessionId}
        open={aiResultsSessionId !== null}
        onOpenChange={(open) => { if (!open) setAiResultsSessionId(null); }}
      />

      {/* ── Documents Panel ─────────────────────────────────── */}
      <Sheet open={!!docsCandidate} onOpenChange={(open) => { if (!open) { setDocsCandidate(null); setCandidateDocs([]); } }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto border-0" style={{ background: 'var(--orbis-card)', borderLeft: '1px solid var(--orbis-border)' }}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2.5 text-white">
              <div className="flex items-center justify-center h-8 w-8 rounded-xl" style={{ background: 'rgba(22,118,192,0.15)' }}>
                <FileText className="h-4 w-4 text-blue-400" />
              </div>
              Documents
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              {docsCandidate?.name ? `Documents for ${docsCandidate.name}` : 'Candidate documents'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {docsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                <p className="text-xs text-slate-500">Loading documents...</p>
              </div>
            ) : candidateDocs.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl mx-auto mb-3" style={{ background: 'var(--orbis-input)' }}>
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-400 mb-1">No documents yet</p>
                <p className="text-xs text-slate-500 max-w-[280px] mx-auto">
                  Documents are auto-assigned when candidates move through pipeline stages with configured stage rules.
                </p>
              </div>
            ) : (
              candidateDocs.map((doc) => {
                const cfg = statusCfg[doc.status] || { bg: 'var(--orbis-card)', text: 'text-slate-400', dot: 'bg-slate-500' };
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-4 space-y-3 transition-all"
                    style={glassCard}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{doc.template_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Stage: {doc.stage}</p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold rounded-lg px-2 py-0.5 inline-flex items-center gap-1.5 ${cfg.text}`}
                        style={{ background: cfg.bg }}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {doc.status}
                      </span>
                    </div>
                    {doc.generated_by && (
                      <p className="text-xs text-slate-500">
                        Generated by {doc.generated_by}{doc.generated_at ? ` on ${new Date(doc.generated_at).toLocaleDateString()}` : ''}
                      </p>
                    )}
                    {nextStatus[doc.status] && (
                      <button
                        className="h-8 text-xs w-full rounded-xl font-bold text-slate-300 transition-all hover:text-white"
                        style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-hover)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(27,142,229,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-grid)'; }}
                        onClick={() => handleDocStatusChange(doc, nextStatus[doc.status])}
                      >
                        Mark as {nextStatus[doc.status]}
                      </button>
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
