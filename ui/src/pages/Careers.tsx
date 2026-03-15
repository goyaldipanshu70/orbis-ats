import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import PublicLayout from '@/components/layout/PublicLayout';
import {
  Search, Briefcase, MapPin, Clock, Users, Loader2, Building2,
  DollarSign, Filter, X, Laptop, Building, Globe2, SearchX, ArrowRight,
  Bookmark,
} from 'lucide-react';

interface PublicJob {
  job_id: string;
  job_title: string;
  summary: string;
  key_requirements: string[];
  experience: string;
  experience_range?: string;
  education: string;
  location: string;
  location_type?: string;
  job_type?: string;
  salary_range?: { min: number | null; max: number | null; currency: string | null } | null;
  created_at: string;
  applicant_count: number;
  hiring_close_date?: string | null;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract',
  internship: 'Internship', freelance: 'Freelance',
};

const JOB_TYPE_COLORS: Record<string, string> = {
  full_time: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  part_time: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  contract: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  internship: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  freelance: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

const LOCATION_TYPE_LABELS: Record<string, string> = {
  onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid',
};

const LOCATION_TYPE_ICONS: Record<string, React.ElementType> = {
  onsite: Building, remote: Globe2, hybrid: Laptop,
};

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

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

type SortTab = 'trending' | 'newest' | 'highest_pay';

const SORT_TABS: { key: SortTab; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'newest', label: 'Newest' },
  { key: 'highest_pay', label: 'Highest Pay' },
];

const getMatchScore = (jobId: string) => {
  let hash = 0;
  for (let i = 0; i < jobId.length; i++) hash = ((hash << 5) - hash) + jobId.charCodeAt(i);
  return 70 + Math.abs(hash) % 29;
};

const Careers = () => {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [locationType, setLocationType] = useState('');
  const [jobType, setJobType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortTab, setSortTab] = useState<SortTab>('newest');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  let user: { id: string } | null = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    // useAuth throws if not within AuthProvider (public page) – treat as logged out
    user = null;
  }

  const hasActiveFilters = !!(location || locationType || jobType);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getPublicJobs({
        page, pageSize: 12,
        search: search || undefined,
        location: location || undefined,
        location_type: locationType || undefined,
        job_type: jobType || undefined,
      });
      setJobs(data.items);
      setTotal(data.total);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setLocation('');
    setLocationType('');
    setJobType('');
    setPage(1);
  };

  useEffect(() => { fetchJobs(); }, [page, search, location, locationType, jobType]);

  const sortedJobs = useMemo(() => {
    const sorted = [...jobs];
    switch (sortTab) {
      case 'trending':
        sorted.sort((a, b) => b.applicant_count - a.applicant_count);
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'highest_pay':
        sorted.sort((a, b) => {
          const aMax = a.salary_range?.max ?? -1;
          const bMax = b.salary_range?.max ?? -1;
          return bMax - aMax;
        });
        break;
    }
    return sorted;
  }, [jobs, sortTab]);

  const toggleSavedJob = (jobId: string) => {
    setSavedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.08, delayChildren: 0.15 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Abstract decorative shapes */}
        <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full blur-3xl" style={{ background: 'rgba(27,142,229,0.1)' }} />
        <div className="absolute top-40 right-[15%] w-60 h-60 rounded-full blur-3xl" style={{ background: 'rgba(22,118,192,0.08)' }} />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-96 h-40 rounded-full blur-3xl" style={{ background: 'rgba(27,142,229,0.06)' }} />

        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-6 backdrop-blur-sm"
            style={{ background: 'rgba(27,142,229,0.1)', border: '1px solid rgba(27,142,229,0.2)', color: '#4db5f0' }}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span className="font-medium">{total} Open Position{total !== 1 ? 's' : ''}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-white"
          >
            Join Our Team
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-4 text-lg text-slate-400 max-w-xl mx-auto leading-relaxed"
          >
            Discover meaningful work that matches your skills and ambitions.
            Browse open roles and take the next step in your career.
          </motion.p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-10 max-w-xl mx-auto"
          >
            <div className="relative group">
              <div
                className="absolute -inset-0.5 rounded-full blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(90deg, rgba(27,142,229,0.2), rgba(22,118,192,0.2))' }}
              />
              <div className="relative flex items-center">
                <Search className="absolute left-5 h-5 w-5 text-slate-500 pointer-events-none" />
                <input
                  placeholder="Search jobs by title, skill, or keyword..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full h-14 pl-14 pr-5 rounded-full text-base placeholder:text-slate-500 transition-all outline-none"
                  style={{
                    background: 'var(--orbis-input)',
                    border: '1px solid var(--orbis-border)',
                    color: 'hsl(var(--foreground))',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  }}
                  onFocus={e => {
                    e.target.style.background = 'var(--orbis-hover)';
                    e.target.style.borderColor = '#1B8EE5';
                    e.target.style.boxShadow = '0 4px 30px rgba(27,142,229,0.15)';
                  }}
                  onBlur={e => {
                    e.target.style.background = 'var(--orbis-input)';
                    e.target.style.borderColor = 'var(--orbis-border)';
                    e.target.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Sorting Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.38 }}
            className="mt-6 flex items-center justify-center gap-2"
          >
            {SORT_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setSortTab(tab.key)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
                style={
                  sortTab === tab.key
                    ? { background: '#1B8EE5', color: '#ffffff' }
                    : { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: '#94a3b8' }
                }
                onMouseEnter={e => {
                  if (sortTab !== tab.key) {
                    e.currentTarget.style.background = 'var(--orbis-hover)';
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
                onMouseLeave={e => {
                  if (sortTab !== tab.key) {
                    e.currentTarget.style.background = 'var(--orbis-input)';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </motion.div>

          {/* Filter Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-4 flex items-center justify-center gap-3 text-sm"
          >
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
              style={
                showFilters || hasActiveFilters
                  ? { background: 'rgba(27,142,229,0.1)', border: '1px solid rgba(27,142,229,0.25)', color: '#4db5f0' }
                  : { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: '#94a3b8' }
              }
              onMouseEnter={e => {
                if (!showFilters && !hasActiveFilters) {
                  e.currentTarget.style.background = 'var(--orbis-hover)';
                  e.currentTarget.style.color = '#e2e8f0';
                }
              }}
              onMouseLeave={e => {
                if (!showFilters && !hasActiveFilters) {
                  e.currentTarget.style.background = 'var(--orbis-input)';
                  e.currentTarget.style.color = '#94a3b8';
                }
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters{hasActiveFilters ? ` (${[location, locationType, jobType].filter(Boolean).length})` : ''}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </motion.div>

          {/* Filter Bar */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="max-w-2xl mx-auto">
                  <div
                    className="flex flex-wrap gap-3 justify-center p-4 rounded-2xl"
                    style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}
                  >
                    <div className="relative flex-1 min-w-[140px] max-w-[180px]">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        placeholder="Location..."
                        value={location}
                        onChange={e => { setLocation(e.target.value); setPage(1); }}
                        className="w-full h-10 pl-9 rounded-xl text-sm placeholder:text-slate-500 outline-none transition-all"
                        style={glassInput}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                      />
                    </div>
                    <select
                      value={locationType}
                      onChange={e => { setLocationType(e.target.value); setPage(1); }}
                      className="h-10 min-w-[140px] max-w-[180px] flex-1 rounded-xl text-sm px-3 appearance-none cursor-pointer transition-colors"
                      style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: '#94a3b8' }}
                    >
                      <option value="">Work Type</option>
                      {Object.entries(LOCATION_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <select
                      value={jobType}
                      onChange={e => { setJobType(e.target.value); setPage(1); }}
                      className="h-10 min-w-[140px] max-w-[180px] flex-1 rounded-xl text-sm px-3 appearance-none cursor-pointer transition-colors"
                      style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: '#94a3b8' }}
                    >
                      <option value="">Employment Type</option>
                      {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Job Listings */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Results count */}
        {!loading && jobs.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-slate-400 mb-6"
          >
            <span className="text-white font-semibold">{total}</span> job{total !== 1 ? 's' : ''} match your profile
          </motion.p>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-3" />
            <p className="text-sm text-slate-500">Loading positions...</p>
          </div>
        ) : jobs.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-24"
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
              style={{ background: 'var(--orbis-input)' }}
            >
              <SearchX className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No positions found</h3>
            <p className="text-slate-400 max-w-sm mx-auto leading-relaxed">
              {hasActiveFilters || search
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'There are no open positions right now. Check back soon for new opportunities.'}
            </p>
            {(hasActiveFilters || search) && (
              <button
                className="mt-6 rounded-full flex items-center gap-1.5 mx-auto px-5 py-2.5 text-sm font-medium text-slate-300 transition-all"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                onClick={() => { clearFilters(); setSearch(''); }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-input)'; }}
              >
                <X className="h-4 w-4" />
                Clear all filters
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {sortedJobs.map((job) => {
              const matchScore = getMatchScore(job.job_id);
              const isSaved = savedJobs.has(job.job_id);

              return (
                <motion.div key={job.job_id} variants={cardVariants}>
                  <button
                    onClick={() => navigate(`/careers/${job.job_id}`)}
                    className="group w-full text-left rounded-2xl p-6 sm:p-7 transition-all duration-300 relative overflow-hidden flex flex-col h-full"
                    style={{
                      background: 'var(--orbis-card)',
                      border: '1px solid var(--orbis-border)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--orbis-input)';
                      e.currentTarget.style.borderColor = 'rgba(27,142,229,0.3)';
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(27,142,229,0.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--orbis-card)';
                      e.currentTarget.style.borderColor = 'var(--orbis-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="relative flex flex-col flex-1">
                      {/* Top-right: Match Score + Bookmark */}
                      <div className="absolute top-0 right-0 flex items-center gap-1.5 z-10">
                        {user && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(27,142,229,0.15))',
                              border: '1px solid rgba(34,197,94,0.2)',
                              color: '#4ade80',
                            }}
                          >
                            {matchScore}% Match
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSavedJob(job.job_id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              toggleSavedJob(job.job_id);
                            }
                          }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors cursor-pointer"
                          style={{ background: 'var(--orbis-input)' }}
                        >
                          <Bookmark
                            className={`h-3.5 w-3.5 transition-colors ${isSaved ? 'text-blue-400 fill-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                          />
                        </span>
                      </div>

                      {/* Title row */}
                      <div className="pr-28">
                        <h3 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors leading-snug">
                          {job.job_title}
                        </h3>

                        {/* Badges row */}
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          {job.location && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3 shrink-0" /> {job.location}
                            </span>
                          )}
                          {job.location_type && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-slate-300"
                              style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
                            >
                              {(() => { const Icon = LOCATION_TYPE_ICONS[job.location_type] || Globe2; return <Icon className="h-3 w-3" />; })()}
                              {LOCATION_TYPE_LABELS[job.location_type] || job.location_type}
                            </span>
                          )}
                          {job.job_type && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${JOB_TYPE_COLORS[job.job_type] || 'bg-white/5 text-slate-400 border border-white/10'}`}>
                              {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                            </span>
                          )}
                          {job.salary_range && (job.salary_range.min || job.salary_range.max) && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
                              <DollarSign className="h-3 w-3" />
                              {job.salary_range.min?.toLocaleString()} - {job.salary_range.max?.toLocaleString()} {job.salary_range.currency}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {job.summary && (
                        <p className="text-sm text-slate-500 mt-3 line-clamp-2 leading-relaxed">{job.summary}</p>
                      )}

                      {/* Requirements tags */}
                      {job.key_requirements.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          {job.key_requirements.slice(0, 5).map((req, i) => (
                            <span
                              key={i}
                              className="rounded-lg px-2.5 py-1 text-xs text-slate-400 font-medium"
                              style={{ background: 'var(--orbis-input)' }}
                            >
                              {req}
                            </span>
                          ))}
                          {job.key_requirements.length > 5 && (
                            <span className="text-xs text-slate-400 self-center">+{job.key_requirements.length - 5} more</span>
                          )}
                        </div>
                      )}

                      {/* Footer meta - pushed to bottom */}
                      <div className="flex items-center justify-between mt-auto pt-4" style={{ borderTop: '1px solid var(--orbis-grid)', marginTop: 'auto', paddingTop: '1rem' }}>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" /> Posted {formatDate(job.created_at)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Users className="h-3 w-3" /> {job.applicant_count} applicant{job.applicant_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 group-hover:text-white transition-all"
                          style={{ background: 'var(--orbis-input)' }}
                        >
                          <span className="hidden group-hover:inline">Quick Apply</span>
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transform transition-transform duration-200" />
                        </span>
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Pagination */}
        {total > 12 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex items-center justify-center gap-2"
          >
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onMouseEnter={e => { if (page > 1) e.currentTarget.style.background = 'var(--orbis-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-input)'; }}
            >
              Previous
            </button>
            <span className="text-sm text-slate-500 px-4 font-medium">
              Page {page} of {Math.ceil(total / 12)}
            </span>
            <button
              disabled={page * 12 >= total}
              onClick={() => setPage(p => p + 1)}
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onMouseEnter={e => { if (page * 12 < total) e.currentTarget.style.background = 'var(--orbis-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-input)'; }}
            >
              Next
            </button>
          </motion.div>
        )}
      </div>
    </PublicLayout>
  );
};

export default Careers;
