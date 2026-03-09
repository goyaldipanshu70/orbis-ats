import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/utils/api';
import PublicLayout from '@/components/layout/PublicLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Briefcase, MapPin, Clock, Users, ChevronRight, Loader2, Building2,
  DollarSign, Filter, X, Laptop, Building, Globe2, SearchX, ArrowRight,
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
  full_time: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  part_time: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  contract: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  internship: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  freelance: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

const LOCATION_TYPE_LABELS: Record<string, string> = {
  onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid',
};

const LOCATION_TYPE_ICONS: Record<string, React.ElementType> = {
  onsite: Building, remote: Globe2, hybrid: Laptop,
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
  const navigate = useNavigate();

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
      <div className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/50 to-white dark:from-background dark:via-blue-950/20 dark:to-background">
        {/* Abstract decorative shapes */}
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-[15%] w-60 h-60 bg-indigo-200/25 dark:bg-indigo-800/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-96 h-40 bg-sky-100/30 dark:bg-sky-900/10 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 px-4 py-1.5 text-sm text-blue-700 dark:text-blue-300 mb-6 backdrop-blur-sm"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span className="font-medium">{total} Open Position{total !== 1 ? 's' : ''}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-foreground"
          >
            Join Our Team
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
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
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-full blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center">
                <Search className="absolute left-5 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search jobs by title, skill, or keyword..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="h-14 pl-13 pr-5 rounded-full border-border/60 bg-card shadow-md shadow-black/[0.04] text-base placeholder:text-muted-foreground/60 focus:shadow-lg focus:border-blue-400/50 transition-all duration-200"
                />
              </div>
            </div>
          </motion.div>

          {/* Filter Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-6 flex items-center justify-center gap-3 text-sm"
          >
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${
                showFilters || hasActiveFilters
                  ? 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 shadow-sm'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters{hasActiveFilters ? ` (${[location, locationType, jobType].filter(Boolean).length})` : ''}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
                  <div className="flex flex-wrap gap-3 justify-center p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
                    <div className="relative flex-1 min-w-[140px] max-w-[180px]">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Location..."
                        value={location}
                        onChange={e => { setLocation(e.target.value); setPage(1); }}
                        className="h-10 pl-9 rounded-xl text-sm border-border/60"
                      />
                    </div>
                    <select
                      value={locationType}
                      onChange={e => { setLocationType(e.target.value); setPage(1); }}
                      className="h-10 min-w-[140px] max-w-[180px] flex-1 rounded-xl border border-border/60 bg-background text-sm px-3 text-foreground appearance-none cursor-pointer hover:border-border transition-colors"
                    >
                      <option value="">Work Type</option>
                      {Object.entries(LOCATION_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <select
                      value={jobType}
                      onChange={e => { setJobType(e.target.value); setPage(1); }}
                      className="h-10 min-w-[140px] max-w-[180px] flex-1 rounded-xl border border-border/60 bg-background text-sm px-3 text-foreground appearance-none cursor-pointer hover:border-border transition-colors"
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
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-muted-foreground">Loading positions...</p>
          </div>
        ) : jobs.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-24"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted/60 mb-6">
              <SearchX className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No positions found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {hasActiveFilters || search
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'There are no open positions right now. Check back soon for new opportunities.'}
            </p>
            {(hasActiveFilters || search) && (
              <Button
                variant="outline"
                className="mt-6 rounded-full"
                onClick={() => { clearFilters(); setSearch(''); }}
              >
                <X className="mr-1.5 h-4 w-4" />
                Clear all filters
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {jobs.map((job) => (
              <motion.div key={job.job_id} variants={cardVariants}>
                <button
                  onClick={() => navigate(`/careers/${job.job_id}`)}
                  className="group w-full text-left rounded-2xl border border-border/60 bg-card p-6 sm:p-7 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:shadow-blue-500/[0.04] transition-all duration-300 relative overflow-hidden"
                >
                  {/* Subtle hover gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/40 group-hover:to-indigo-50/20 dark:group-hover:from-blue-950/20 dark:group-hover:to-indigo-950/10 transition-all duration-300 pointer-events-none" />

                  <div className="relative">
                    {/* Top row: Title + Arrow */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                          {job.job_title}
                        </h3>

                        {/* Badges row */}
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          {job.location && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" /> {job.location}
                            </span>
                          )}
                          {job.location_type && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                              {(() => { const Icon = LOCATION_TYPE_ICONS[job.location_type] || Globe2; return <Icon className="h-3 w-3" />; })()}
                              {LOCATION_TYPE_LABELS[job.location_type] || job.location_type}
                            </span>
                          )}
                          {job.job_type && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${JOB_TYPE_COLORS[job.job_type] || 'bg-muted text-muted-foreground'}`}>
                              {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                            </span>
                          )}
                          {job.salary_range && (job.salary_range.min || job.salary_range.max) && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <DollarSign className="h-3 w-3" />
                              {job.salary_range.min?.toLocaleString()} - {job.salary_range.max?.toLocaleString()} {job.salary_range.currency}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors shrink-0 mt-0.5">
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors group-hover:translate-x-0.5 transform duration-200" />
                      </div>
                    </div>

                    {/* Description */}
                    {job.summary && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">{job.summary}</p>
                    )}

                    {/* Requirements tags */}
                    {job.key_requirements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {job.key_requirements.slice(0, 5).map((req, i) => (
                          <span key={i} className="rounded-lg bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground font-medium">
                            {req}
                          </span>
                        ))}
                        {job.key_requirements.length > 5 && (
                          <span className="text-xs text-muted-foreground/60 self-center">+{job.key_requirements.length - 5} more</span>
                        )}
                      </div>
                    )}

                    {/* Footer meta */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> Posted {formatDate(job.created_at)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {job.applicant_count} applicant{job.applicant_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
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
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-full px-5"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-4 font-medium">
              Page {page} of {Math.ceil(total / 12)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 12 >= total}
              onClick={() => setPage(p => p + 1)}
              className="rounded-full px-5"
            >
              Next
            </Button>
          </motion.div>
        )}
      </div>
    </PublicLayout>
  );
};

export default Careers;
