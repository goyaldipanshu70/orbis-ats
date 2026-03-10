import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { formatLabel } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { DataPagination } from '@/components/DataPagination';
import type { Job } from '@/types/api';
import type { PaginatedResponse } from '@/types/pagination';
import {
  Briefcase, Zap, Users, ThumbsUp, Calendar,
  Search, Plus, Eye, Trash2, Archive,
  MoreVertical, ChevronDown, SortAsc, Globe, Lock, Kanban,
  MapPin, Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Skeleton } from '@/components/ui/skeleton';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  Open:      { dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  Closed:    { dot: 'bg-red-500',     bg: 'bg-red-50 border-red-200',         text: 'text-red-700'     },
  Draft:     { dot: 'bg-slate-400',   bg: 'bg-muted border-border',           text: 'text-muted-foreground' },
  'On Hold': { dot: 'bg-amber-500',   bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700'   },
  Archived:  { dot: 'bg-amber-500',   bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700'   },
};

function statusPill(status: string) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

const STATUS_FILTERS = ['All', 'Open', 'Closed', 'Draft', 'On Hold'] as const;

const STATUS_PILL_ACTIVE: Record<string, string> = {
  All:        'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white',
  Open:       'bg-emerald-600 text-white border-transparent',
  Closed:     'bg-red-600 text-white border-transparent',
  Draft:      'bg-slate-600 text-white border-transparent',
  'On Hold':  'bg-amber-600 text-white border-transparent',
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

export default function Jobs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);

  const {
    data: jobsData,
    isLoading,
  } = useQuery({
    queryKey: ['jobs', currentPage, debouncedSearch, statusFilter],
    queryFn: async () => {
      const data: PaginatedResponse<Job> = await apiClient.getJobs(currentPage, 20, {
        search: debouncedSearch || undefined,
        status: statusFilter !== 'All' ? (statusFilter === 'On Hold' ? 'Archived' : statusFilter) : undefined,
      });
      return data;
    },
  });

  const jobs = jobsData?.items ?? [];
  const paginationMeta = {
    total: jobsData?.total ?? 0,
    totalPages: jobsData?.total_pages ?? 0,
    pageSize: jobsData?.page_size ?? 20,
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await apiClient.deleteJob(jobId);
      toast({ title: 'Deleted', description: 'Job deleted successfully.' });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete job.', variant: 'destructive' });
    }
  };

  const handleVisibilityToggle = async (jobId: string, currentVisibility: string) => {
    const newVisibility = currentVisibility === 'public' ? 'internal' : 'public';
    try {
      await apiClient.updateJobVisibility(jobId, newVisibility);
      toast({ title: 'Updated', description: `Job is now ${newVisibility === 'public' ? 'public on careers page' : 'internal only'}.` });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to update visibility.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      await apiClient.updateJobStatus(jobId, newStatus);
      toast({ title: 'Updated', description: `Job status changed to ${newStatus}.` });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to update job status.', variant: 'destructive' });
    }
  };

  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
        case 'oldest':
          return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
        case 'most_candidates':
          return (b.statistics?.total_candidates ?? 0) - (a.statistics?.total_candidates ?? 0);
        default:
          return 0;
      }
    });
    return result;
  }, [jobs, sortBy]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const daysOpen = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Jobs</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all job postings</p>
        </div>
        <Button
          onClick={() => navigate('/jobs/create')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 h-10 rounded-lg shadow-sm text-sm font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Job
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 h-9 border-border bg-card text-sm rounded-lg"
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 border ${
                statusFilter === status
                  ? STATUS_PILL_ACTIVE[status]
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted/60'
              }`}
            >
              {status !== 'All' && (
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === status ? 'bg-white/70' : STATUS_STYLES[status]?.dot ?? 'bg-slate-400'}`} />
              )}
              {status}
            </button>
          ))}
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[170px] h-9 bg-card border-border text-sm rounded-lg">
            <SortAsc className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="most_candidates">Most Candidates</SelectItem>
          </SelectContent>
        </Select>

        {(debouncedSearch || statusFilter !== 'All') && (
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap ml-auto">
            {paginationMeta.total} matching jobs
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex gap-4 pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex gap-2 pt-3 border-t border-border">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-5">
            <Briefcase className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No jobs created yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
            Get started by creating your first job posting.
          </p>
          <Button
            onClick={() => navigate('/jobs/create')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-10 rounded-lg text-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create your first job
          </Button>
        </div>
      )}

      {/* No results */}
      {!isLoading && jobs.length > 0 && filteredJobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-border">
          <Search className="w-10 h-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No matching jobs</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Job cards */}
      {!isLoading && filteredJobs.length > 0 && (
        <>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredJobs.map((job) => {
              const status = job.status || 'Draft';
              const totalCandidates = job.statistics?.total_candidates ?? 0;
              const recommendedCount = job.statistics?.recommended_count ?? 0;
              const days = job.created_date ? daysOpen(job.created_date) : 0;
              const location = [job.city, job.country].filter(Boolean).join(', ');

              return (
                <motion.div
                  key={job.job_id}
                  variants={cardVariants}
                  className="group"
                >
                  <div
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="relative bg-card rounded-xl border border-border hover:shadow-lg hover:border-border/80 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer h-full hover:-translate-y-0.5"
                  >
                    <div className="p-5 flex flex-col flex-1">
                      {/* Top: Title + Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {job.job_title || 'Untitled Job'}
                          </h3>
                          {job.position_type && (
                            <span className="inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              {formatLabel(job.position_type)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {statusPill(status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {status === 'Open' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(job.job_id, 'Closed'); }} className="text-amber-600">
                                  <Archive className="w-4 h-4 mr-2" /> Mark as Closed
                                </DropdownMenuItem>
                              )}
                              {status === 'Closed' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(job.job_id, 'Open'); }} className="text-emerald-600">
                                  <Zap className="w-4 h-4 mr-2" /> Re-open
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleVisibilityToggle(job.job_id, job.visibility || 'internal'); }} className="text-blue-600">
                                {job.visibility === 'public' ? <><Lock className="w-4 h-4 mr-2" /> Make Internal</> : <><Globe className="w-4 h-4 mr-2" /> Make Public</>}
                              </DropdownMenuItem>
                              {['Open', 'Closed', 'Draft', 'Archived'].filter((s) => s !== status).map((s) => (
                                <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); handleStatusChange(job.job_id, s); }}>
                                  <span className={`w-2 h-2 rounded-full mr-2 ${STATUS_STYLES[s]?.dot ?? 'bg-slate-400'}`} />
                                  {s}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Info row: location, type, visibility */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                        {location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {location}
                          </span>
                        )}
                        {job.job_type && (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {formatLabel(job.job_type)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          {job.visibility === 'public' ? (
                            <><Globe className="w-3.5 h-3.5" /> Public</>
                          ) : (
                            <><Lock className="w-3.5 h-3.5" /> Internal</>
                          )}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 py-3 border-t border-border mt-auto">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{totalCandidates}</span>
                          <span className="text-[11px] text-muted-foreground">candidates</span>
                        </div>
                        <div className="w-px h-4 bg-border" />
                        <div className="flex items-center gap-1.5">
                          <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm font-semibold text-foreground">{recommendedCount}</span>
                          <span className="text-[11px] text-muted-foreground">rec.</span>
                        </div>
                        <div className="w-px h-4 bg-border" />
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{days}</span>
                          <span className="text-[11px] text-muted-foreground">days</span>
                        </div>
                      </div>

                      {/* Footer buttons */}
                      <div className="flex items-center gap-2 pt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.job_id}`); }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                        <div className="w-px h-4 bg-border" />
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.job_id}/pipeline`); }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors py-1.5"
                        >
                          <Kanban className="w-3.5 h-3.5" /> View Pipeline
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{job.job_title}" and all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteJob(job.job_id)} className="bg-red-600 hover:bg-red-700 text-white">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
          <div className="mt-6">
            <DataPagination
              page={currentPage}
              totalPages={paginationMeta.totalPages}
              total={paginationMeta.total}
              pageSize={paginationMeta.pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}
    </AppLayout>
  );
}
