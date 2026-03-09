import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  UserPlus, Search, Briefcase, User, Clock, X, Loader2, Users, AlertCircle,
  Filter, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/utils/api';

/* ── Types ────────────────────────────────────────────────────────── */

interface Job {
  job_id: string;
  job_title: string;
  status: string;
  candidate_count: number;
}

interface CandidateForImport {
  candidate_id: string;
  name: string;
  email: string;
  currentRole: string;
  experience: number;
  category: string;
  resume_url?: string;
  source_job_id?: string;
  source_job_title?: string;
}

interface ImportCandidatesModalProps {
  currentJobId: string;
  isOpen: boolean;
  onClose: () => void;
  onImport: (candidateIds: string[]) => void;
}

type ImportMode = 'job' | 'candidate';

const CATEGORIES = [
  'Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'IT', 'Product', 'Design', 'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  HR: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  Finance: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  Marketing: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  Sales: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  IT: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  Product: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  Design: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800',
  Other: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700',
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function normalizeCandidate(raw: any): CandidateForImport {
  return {
    candidate_id: raw.candidate_id,
    name: raw.name || 'N/A',
    email: raw.email || 'N/A',
    currentRole: raw.currentRole || 'N/A',
    experience: raw.experience || 0,
    category: raw.category || 'Other',
    resume_url: raw.resume_url,
    source_job_id: raw.source_job_id,
    source_job_title: raw.source_job_title,
  };
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ── Main Component ───────────────────────────────────────────────── */

const ImportCandidatesModal = ({ currentJobId, isOpen, onClose, onImport }: ImportCandidatesModalProps) => {
  const [mode, setMode] = useState<ImportMode>('job');

  // Job mode
  const [jobQuery, setJobQuery] = useState('');
  const [jobResults, setJobResults] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobCandidates, setJobCandidates] = useState<CandidateForImport[]>([]);
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Candidate mode
  const [candidateQuery, setCandidateQuery] = useState('');
  const [globalCandidates, setGlobalCandidates] = useState<CandidateForImport[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);

  // Shared
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const debouncedJobQuery = useDebounce(jobQuery, 250);
  const debouncedCandidateQuery = useDebounce(candidateQuery, 250);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    setMode('job');
    setJobQuery('');
    setJobResults([]);
    setSelectedJob(null);
    setJobCandidates([]);
    setCandidateQuery('');
    setGlobalCandidates([]);
    setSelectedCandidates(new Set());
    setCategoryFilter('');
    setShowCategoryDropdown(false);
    onClose();
  }, [isImporting, onClose]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // Search jobs
  useEffect(() => {
    if (!isOpen || mode !== 'job' || selectedJob) return;
    setIsSearchingJobs(true);
    apiClient.searchJobsForImport(debouncedJobQuery, currentJobId)
      .then(setJobResults)
      .catch(() => setJobResults([]))
      .finally(() => setIsSearchingJobs(false));
  }, [debouncedJobQuery, isOpen, mode, selectedJob, currentJobId]);

  // Load candidates for selected job (with category filter)
  useEffect(() => {
    if (!selectedJob) { setJobCandidates([]); return; }
    setIsLoadingCandidates(true);
    apiClient.getCandidatesForImport(selectedJob.job_id, categoryFilter || undefined)
      .then((data: any[]) => setJobCandidates(data.map(normalizeCandidate)))
      .catch(() => setJobCandidates([]))
      .finally(() => setIsLoadingCandidates(false));
  }, [selectedJob, categoryFilter]);

  // Search candidates globally (with category filter)
  useEffect(() => {
    if (!isOpen || mode !== 'candidate') return;
    if (!debouncedCandidateQuery.trim()) { setGlobalCandidates([]); return; }
    setIsSearchingCandidates(true);
    apiClient.searchCandidatesGlobal(debouncedCandidateQuery, currentJobId, 20, categoryFilter || undefined)
      .then((data: any[]) => setGlobalCandidates(data.map(normalizeCandidate)))
      .catch(() => setGlobalCandidates([]))
      .finally(() => setIsSearchingCandidates(false));
  }, [debouncedCandidateQuery, isOpen, mode, currentJobId, categoryFilter]);

  // Clear selection when switching modes or changing filter
  useEffect(() => { setSelectedCandidates(new Set()); }, [mode, categoryFilter]);

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const currentList = mode === 'job' ? jobCandidates : globalCandidates;

  const toggleAll = () => {
    if (selectedCandidates.size === currentList.length && currentList.length > 0) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(currentList.map(c => c.candidate_id)));
    }
  };

  const handleImport = async () => {
    if (selectedCandidates.size === 0) {
      toast.error('Please select at least one candidate to import.');
      return;
    }
    setIsImporting(true);
    try {
      await onImport(Array.from(selectedCandidates));
      handleClose();
    } catch {
      // Parent handles error
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-[900px] bg-background rounded-xl shadow-2xl border flex flex-col animate-in fade-in zoom-in-95 duration-200"
          style={{ maxHeight: 'min(85vh, 720px)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <div className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Import Candidates</h2>
                  <p className="text-sm text-muted-foreground">
                    Candidates are imported as profiles — AI evaluation runs against the new job
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} className="shrink-0 -mt-1 -mr-2">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Mode toggle + category filter */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex bg-muted rounded-lg p-1 w-fit">
                <button
                  onClick={() => setMode('job')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === 'job'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  From Job
                </button>
                <button
                  onClick={() => setMode('candidate')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === 'candidate'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Direct Search
                </button>
              </div>

              {/* Category filter */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={`gap-1.5 text-xs ${categoryFilter ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {categoryFilter || 'All Categories'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
                {showCategoryDropdown && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowCategoryDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 z-[70] w-44 bg-background border rounded-lg shadow-lg py-1">
                      <button
                        onClick={() => { setCategoryFilter(''); setShowCategoryDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                          !categoryFilter ? 'font-medium text-blue-600' : ''
                        }`}
                      >
                        All Categories
                      </button>
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                            categoryFilter === cat ? 'font-medium text-blue-600' : ''
                          }`}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full ${CATEGORY_COLORS[cat]?.split(' ')[0] || 'bg-gray-200'}`} />
                          {cat}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-6 py-4 space-y-4">

              {/* MODE: From Job */}
              {mode === 'job' && (
                <>
                  {!selectedJob ? (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Search source job</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Type to search jobs by title..."
                          value={jobQuery}
                          onChange={e => setJobQuery(e.target.value)}
                          className="pl-9"
                          autoFocus
                        />
                        {isSearchingJobs && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {jobResults.length > 0 && (
                        <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                          {jobResults.map(job => (
                            <button
                              key={job.job_id}
                              onClick={() => { setSelectedJob(job); setJobQuery(''); setJobResults([]); }}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium truncate">{job.job_title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <Badge variant="outline" className="text-[10px]">{job.status}</Badge>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{job.candidate_count} candidates</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!isSearchingJobs && jobResults.length === 0 && debouncedJobQuery.trim() && (
                        <p className="text-sm text-muted-foreground mt-3 text-center">No jobs found matching "{debouncedJobQuery}"</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Source job</label>
                      <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 text-sm font-medium dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                        <Briefcase className="h-4 w-4" />
                        <span>{selectedJob.job_title}</span>
                        <Badge variant="outline" className="text-[10px] border-blue-300">{selectedJob.status}</Badge>
                        <span className="text-blue-600 text-xs">{selectedJob.candidate_count} candidates</span>
                        <button
                          onClick={() => { setSelectedJob(null); setJobCandidates([]); setSelectedCandidates(new Set()); }}
                          className="ml-1 hover:bg-blue-100 rounded p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedJob && (
                    <CandidateList
                      candidates={jobCandidates}
                      selected={selectedCandidates}
                      onToggle={toggleCandidate}
                      onToggleAll={toggleAll}
                      isLoading={isLoadingCandidates}
                      showSourceJob={false}
                    />
                  )}
                </>
              )}

              {/* MODE: Direct Search */}
              {mode === 'candidate' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Search candidates</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={candidateQuery}
                        onChange={e => setCandidateQuery(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                      {isSearchingCandidates && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {!debouncedCandidateQuery.trim() ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Search className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm">Start typing to search candidates across all jobs</p>
                    </div>
                  ) : (
                    <CandidateList
                      candidates={globalCandidates}
                      selected={selectedCandidates}
                      onToggle={toggleCandidate}
                      onToggleAll={toggleAll}
                      isLoading={isSearchingCandidates}
                      showSourceJob={true}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────── */}
          <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between shrink-0 rounded-b-xl">
            <span className="text-sm text-muted-foreground">
              {selectedCandidates.size > 0
                ? `${selectedCandidates.size} candidate${selectedCandidates.size === 1 ? '' : 's'} selected`
                : 'No candidates selected'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || selectedCandidates.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${selectedCandidates.size || ''} Candidate${selectedCandidates.size === 1 ? '' : 's'}`
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ── Candidate List Sub-Component ─────────────────────────────────── */

function CandidateList({
  candidates,
  selected,
  onToggle,
  onToggleAll,
  isLoading,
  showSourceJob,
}: {
  candidates: CandidateForImport[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  isLoading: boolean;
  showSourceJob: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No candidates found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onToggleAll}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {selected.size === candidates.length ? 'Deselect All' : 'Select All'}
        </button>
        <span className="text-xs text-muted-foreground">
          {selected.size} of {candidates.length} selected
        </span>
      </div>

      <div className="border rounded-lg divide-y max-h-[340px] overflow-y-auto">
        {candidates.map(c => (
          <label
            key={c.candidate_id}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
              selected.has(c.candidate_id)
                ? 'bg-blue-50/60 dark:bg-blue-950/30'
                : 'hover:bg-muted/40'
            }`}
          >
            <Checkbox
              checked={selected.has(c.candidate_id)}
              onCheckedChange={() => onToggle(c.candidate_id)}
              className="shrink-0"
            />

            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-muted-foreground text-xs font-bold">
              {(c.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{c.name}</span>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other}`}>
                  {c.category}
                </Badge>
                {showSourceJob && c.source_job_title && (
                  <Badge variant="outline" className="text-[10px] shrink-0 max-w-[180px] truncate">
                    from: {c.source_job_title}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                {c.currentRole !== 'N/A' && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <User className="h-3 w-3" /> {c.currentRole}
                  </span>
                )}
                {c.experience > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" /> {c.experience}y exp
                  </span>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default ImportCandidatesModal;
