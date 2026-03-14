import { useState, useEffect, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  UserPlus, Search, Briefcase, User, Clock, X, Loader2, Users, AlertCircle,
  Filter, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/utils/api';

/* -- Types ---------------------------------------------------------------- */

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
  Engineering: 'bg-blue-900/40 text-blue-300 border-blue-700',
  HR: 'bg-blue-900/40 text-blue-300 border-blue-700',
  Finance: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
  Marketing: 'bg-orange-900/40 text-orange-300 border-orange-700',
  Sales: 'bg-cyan-900/40 text-cyan-300 border-cyan-700',
  IT: 'bg-blue-900/40 text-blue-300 border-blue-700',
  Product: 'bg-amber-900/40 text-amber-300 border-amber-700',
  Design: 'bg-pink-900/40 text-pink-300 border-pink-700',
  Other: 'bg-white/5 text-slate-400 border-white/10',
};

/* -- Styles --------------------------------------------------------------- */

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const glassInputFocusStyle: React.CSSProperties = {
  background: 'var(--orbis-hover)',
  borderColor: '#1B8EE5',
  boxShadow: '0 0 20px rgba(27,142,229,0.15)',
};

const glassInputBlurStyle: React.CSSProperties = {
  background: 'var(--orbis-input)',
  borderColor: 'var(--orbis-border)',
  boxShadow: 'none',
};

/* -- Helpers -------------------------------------------------------------- */

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

/* -- GlassInput component ------------------------------------------------- */

function GlassInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      className={`w-full h-10 px-3 rounded-lg text-sm outline-none transition-all duration-200 placeholder:text-slate-500 ${className || ''}`}
      style={focused ? { ...glassInput, ...glassInputFocusStyle } : glassInput}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

/* -- Main Component ------------------------------------------------------- */

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

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen || mode !== 'job' || selectedJob) return;
    setIsSearchingJobs(true);
    apiClient.searchJobsForImport(debouncedJobQuery, currentJobId)
      .then(setJobResults)
      .catch(() => setJobResults([]))
      .finally(() => setIsSearchingJobs(false));
  }, [debouncedJobQuery, isOpen, mode, selectedJob, currentJobId]);

  useEffect(() => {
    if (!selectedJob) { setJobCandidates([]); return; }
    setIsLoadingCandidates(true);
    apiClient.getCandidatesForImport(selectedJob.job_id, categoryFilter || undefined)
      .then((data: any[]) => setJobCandidates(data.map(normalizeCandidate)))
      .catch(() => setJobCandidates([]))
      .finally(() => setIsLoadingCandidates(false));
  }, [selectedJob, categoryFilter]);

  useEffect(() => {
    if (!isOpen || mode !== 'candidate') return;
    if (!debouncedCandidateQuery.trim()) { setGlobalCandidates([]); return; }
    setIsSearchingCandidates(true);
    apiClient.searchCandidatesGlobal(debouncedCandidateQuery, currentJobId, 20, categoryFilter || undefined)
      .then((data: any[]) => setGlobalCandidates(data.map(normalizeCandidate)))
      .catch(() => setGlobalCandidates([]))
      .finally(() => setIsSearchingCandidates(false));
  }, [debouncedCandidateQuery, isOpen, mode, currentJobId, categoryFilter]);

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
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-[900px] rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border-0"
          style={{ maxHeight: 'min(85vh, 720px)', background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* -- Header ---------------------------------------------------- */}
          <div className="px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Import Candidates</h2>
                  <p className="text-sm text-slate-400">
                    Candidates are imported as profiles -- AI evaluation runs against the new job
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="shrink-0 -mt-1 -mr-2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode toggle + category filter */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex rounded-lg p-1 w-fit" style={{ background: 'var(--orbis-input)' }}>
                <button
                  onClick={() => setMode('job')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === 'job'
                      ? 'bg-blue-600 shadow-sm text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  From Job
                </button>
                <button
                  onClick={() => setMode('candidate')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === 'candidate'
                      ? 'bg-blue-600 shadow-sm text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Direct Search
                </button>
              </div>

              {/* Category filter */}
              <div className="relative">
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                    categoryFilter
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {categoryFilter || 'All Categories'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showCategoryDropdown && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowCategoryDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 z-[70] w-44 rounded-lg shadow-lg py-1" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                      <button
                        onClick={() => { setCategoryFilter(''); setShowCategoryDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/5 transition-colors ${
                          !categoryFilter ? 'font-medium text-blue-400' : 'text-slate-300'
                        }`}
                      >
                        All Categories
                      </button>
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 ${
                            categoryFilter === cat ? 'font-medium text-blue-400' : 'text-slate-300'
                          }`}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full ${CATEGORY_COLORS[cat]?.split(' ')[0] || 'bg-gray-700'}`} />
                          {cat}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* -- Body ------------------------------------------------------ */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-6 py-4 space-y-4">

              {/* MODE: From Job */}
              {mode === 'job' && (
                <>
                  {!selectedJob ? (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-slate-400">Search source job</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <GlassInput
                          placeholder="Type to search jobs by title..."
                          value={jobQuery}
                          onChange={e => setJobQuery(e.target.value)}
                          className="pl-9"
                          autoFocus
                        />
                        {isSearchingJobs && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />
                        )}
                      </div>
                      {jobResults.length > 0 && (
                        <div className="mt-2 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto border border-white/10">
                          {jobResults.map(job => (
                            <button
                              key={job.job_id}
                              onClick={() => { setSelectedJob(job); setJobQuery(''); setJobResults([]); }}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Briefcase className="h-4 w-4 text-slate-500 shrink-0" />
                                <span className="text-sm font-medium text-white truncate">{job.job_title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-400">{job.status}</span>
                                <span className="text-xs text-slate-500 whitespace-nowrap">{job.candidate_count} candidates</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!isSearchingJobs && jobResults.length === 0 && debouncedJobQuery.trim() && (
                        <p className="text-sm text-slate-500 mt-3 text-center">No jobs found matching "{debouncedJobQuery}"</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-slate-400">Source job</label>
                      <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg px-3 py-2 text-sm font-medium">
                        <Briefcase className="h-4 w-4" />
                        <span>{selectedJob.job_title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10">{selectedJob.status}</span>
                        <span className="text-blue-400 text-xs">{selectedJob.candidate_count} candidates</span>
                        <button
                          onClick={() => { setSelectedJob(null); setJobCandidates([]); setSelectedCandidates(new Set()); }}
                          className="ml-1 hover:bg-blue-500/20 rounded p-0.5"
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
                    <label className="text-sm font-medium mb-1.5 block text-slate-400">Search candidates</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <GlassInput
                        placeholder="Search by name or email..."
                        value={candidateQuery}
                        onChange={e => setCandidateQuery(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                      {isSearchingCandidates && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />
                      )}
                    </div>
                  </div>

                  {!debouncedCandidateQuery.trim() ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
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

          {/* -- Footer ---------------------------------------------------- */}
          <div className="px-6 py-3 flex items-center justify-between shrink-0 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
            <span className="text-sm text-slate-500">
              {selectedCandidates.size > 0
                ? `${selectedCandidates.size} candidate${selectedCandidates.size === 1 ? '' : 's'} selected`
                : 'No candidates selected'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                disabled={isImporting}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors font-medium text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || selectedCandidates.size === 0}
                className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-5 py-2 rounded-lg shadow-md shadow-blue-600/20 font-medium text-sm disabled:opacity-50 transition-all"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                    Importing...
                  </>
                ) : (
                  `Import ${selectedCandidates.size || ''} Candidate${selectedCandidates.size === 1 ? '' : 's'}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* -- Candidate List Sub-Component ----------------------------------------- */

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
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
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
          className="text-xs text-blue-400 hover:text-blue-300 font-medium"
        >
          {selected.size === candidates.length ? 'Deselect All' : 'Select All'}
        </button>
        <span className="text-xs text-slate-500">
          {selected.size} of {candidates.length} selected
        </span>
      </div>

      <div className="border border-white/10 rounded-lg divide-y divide-white/5 max-h-[340px] overflow-y-auto">
        {candidates.map(c => (
          <label
            key={c.candidate_id}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
              selected.has(c.candidate_id)
                ? 'bg-blue-500/10'
                : 'hover:bg-white/[0.03]'
            }`}
          >
            <Checkbox
              checked={selected.has(c.candidate_id)}
              onCheckedChange={() => onToggle(c.candidate_id)}
              className="shrink-0 border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />

            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600/40 to-blue-600/40 text-slate-300 text-xs font-bold">
              {(c.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{c.name}</span>
                <span className={`text-[10px] shrink-0 px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other}`}>
                  {c.category}
                </span>
                {showSourceJob && c.source_job_title && (
                  <span className="text-[10px] shrink-0 max-w-[180px] truncate px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-400">
                    from: {c.source_job_title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-500 truncate">{c.email}</span>
                {c.currentRole !== 'N/A' && (
                  <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                    <User className="h-3 w-3" /> {c.currentRole}
                  </span>
                )}
                {c.experience > 0 && (
                  <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
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
