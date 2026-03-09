import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate as useNav } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { fadeInUp, hoverLift, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { SkillsGapMatrix } from '@/components/SkillsGapMatrix';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  ArrowLeft,
  Trophy,
  MessageSquareText,
  DollarSign,
  PuzzleIcon,
  ClipboardCheck,
  Loader2,
  Copy,
  Check,
  Star,
  Sparkles,
  Zap,
  ChevronRight,
  BrainCircuit,
} from 'lucide-react';
import type { Job } from '@/types/api';
import type {
  CandidateRanking,
  InterviewQuestion,
  SalaryIntelligence,
  SkillsGap,
  ScreeningScore,
} from '@/types/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type ToolId = 'ranking' | 'questions' | 'salary' | 'skills-gap' | 'screening';

interface ToolCard {
  id: ToolId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  gradient: string;
  iconBg: string;
}

const SALARY_COUNTRIES = [
  'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India',
  'Japan', 'Mexico', 'Netherlands', 'Singapore', 'South Korea', 'Spain',
  'Sweden', 'Switzerland', 'United Arab Emirates', 'United Kingdom', 'United States',
];

/* -------------------------------------------------------------------------- */
/*  Animation Variants                                                        */
/* -------------------------------------------------------------------------- */

const containerStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const cardReveal = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const panelSlideIn = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

const resultsFade = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut', delay: 0.1 },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 },
  },
};

/* -------------------------------------------------------------------------- */
/*  Tool Definitions                                                          */
/* -------------------------------------------------------------------------- */

const TOOLS: ToolCard[] = [
  {
    id: 'ranking',
    title: 'Candidate Ranking',
    description: 'AI-powered composite scoring and ranking of all candidates for a job',
    icon: Trophy,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 border-amber-200/60 dark:bg-amber-950/30 dark:border-amber-800/40',
    gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
  },
  {
    id: 'questions',
    title: 'Interview Questions',
    description: 'Generate tailored interview questions based on job requirements and candidate profile',
    icon: MessageSquareText,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 border-violet-200/60 dark:bg-violet-950/30 dark:border-violet-800/40',
    gradient: 'from-violet-500/10 via-purple-500/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-500',
  },
  {
    id: 'salary',
    title: 'Salary Intelligence',
    description: 'Market salary benchmarks with min, median, and max compensation bands',
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/40',
    gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  },
  {
    id: 'skills-gap',
    title: 'Skills Gap Analysis',
    description: 'Compare candidate skills against job requirements to identify gaps and strengths',
    icon: PuzzleIcon,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 border-blue-200/60 dark:bg-blue-950/30 dark:border-blue-800/40',
    gradient: 'from-blue-500/10 via-sky-500/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-blue-500 to-sky-500',
  },
  {
    id: 'screening',
    title: 'Screening Scorer',
    description: 'AI scoring of candidate screening responses with detailed reasoning',
    icon: ClipboardCheck,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 border-rose-200/60 dark:bg-rose-950/30 dark:border-rose-800/40',
    gradient: 'from-rose-500/10 via-pink-500/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-rose-500 to-pink-500',
  },
];

/* -------------------------------------------------------------------------- */
/*  Helper: Score Star Display                                                */
/* -------------------------------------------------------------------------- */

function ScoreStars({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < score
              ? 'text-amber-500 fill-amber-500'
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
      <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
        {score}/{max}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helper: Loading Skeleton                                                  */
/* -------------------------------------------------------------------------- */

function ToolSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="h-6 w-48" />
      </div>
      <Skeleton className="h-4 w-72" />
      <div className="space-y-3 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-component: Job Selector                                               */
/* -------------------------------------------------------------------------- */

function JobSelector({
  jobs,
  loading,
  value,
  onChange,
}: {
  jobs: Job[];
  loading: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  if (loading) return <Skeleton className="h-10 w-72 rounded-xl" />;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-72 rounded-xl bg-background/60 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
        <SelectValue placeholder="Select a job..." />
      </SelectTrigger>
      <SelectContent>
        {jobs.map((j) => (
          <SelectItem key={j.job_id} value={j.job_id}>
            {j.job_title || `Job ${j.job_id}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-component: Candidate Selector                                         */
/* -------------------------------------------------------------------------- */

function CandidateSelector({
  candidates,
  loading,
  value,
  onChange,
  disabled,
}: {
  candidates: { id: number; name: string; email: string }[];
  loading: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (loading) return <Skeleton className="h-10 w-72 rounded-xl" />;
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-72 rounded-xl bg-background/60 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
        <SelectValue placeholder={disabled ? 'Select a job first...' : 'Select a candidate...'} />
      </SelectTrigger>
      <SelectContent>
        {candidates.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.name || c.email || `Candidate #${c.id}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Page                                                                 */
/* -------------------------------------------------------------------------- */

export default function AIToolkit() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Navigation
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);

  // Jobs
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');

  // Candidates (for tools that need them)
  const [candidates, setCandidates] = useState<{ id: number; name: string; email: string }[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  // Track whether we've applied URL params (one-time)
  const [urlParamsApplied, setUrlParamsApplied] = useState(false);

  // Tool results
  const [toolLoading, setToolLoading] = useState(false);
  const [rankings, setRankings] = useState<CandidateRanking[] | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [salary, setSalary] = useState<SalaryIntelligence | null>(null);
  const [skillsGap, setSkillsGap] = useState<SkillsGap | null>(null);
  const [screeningScores, setScreeningScores] = useState<ScreeningScore[] | null>(null);

  // Salary country filter
  const [salaryCountry, setSalaryCountry] = useState('');

  // Copy state for questions
  const [copied, setCopied] = useState(false);

  /* ---- Fetch jobs on mount ---- */
  useEffect(() => {
    const load = async () => {
      setJobsLoading(true);
      try {
        const res = await apiClient.getJobs(1, 100);
        setJobs(res.items ?? []);
      } catch {
        toast({ title: 'Error', description: 'Failed to load jobs', variant: 'destructive' });
      } finally {
        setJobsLoading(false);
      }
    };
    load();
  }, []);

  /* ---- Apply URL params after jobs load ---- */
  useEffect(() => {
    if (urlParamsApplied || jobsLoading || jobs.length === 0) return;
    const toolParam = searchParams.get('tool') as ToolId | null;
    const jobParam = searchParams.get('job');
    const candidateParam = searchParams.get('candidate');

    if (toolParam && TOOLS.some(t => t.id === toolParam)) {
      setSelectedTool(toolParam);
      if (jobParam) {
        setSelectedJobId(jobParam);
        const needsCand = toolParam === 'questions' || toolParam === 'skills-gap' || toolParam === 'screening';
        if (needsCand) {
          fetchCandidates(jobParam).then(() => {
            if (candidateParam) setSelectedCandidateId(candidateParam);
          });
        } else if (toolParam === 'ranking') {
          executeRanking(Number(jobParam));
        } else if (toolParam === 'salary') {
          executeSalary(Number(jobParam));
        }
      }
    }
    setUrlParamsApplied(true);
  }, [jobs, jobsLoading, urlParamsApplied, searchParams]);

  /* ---- Fetch candidates when job changes (for tools that need them) ---- */
  const fetchCandidates = useCallback(async (jobId: string) => {
    setCandidatesLoading(true);
    setSelectedCandidateId('');
    setCandidates([]);
    try {
      const res = await apiClient.getCandidates(jobId, 1, 100);
      const items = (res.items ?? []).map((c: any) => ({
        id: c.id ?? c.candidate_id ?? c._id,
        name: c.full_name ?? c.name ?? c.metadata?.full_name ?? '',
        email: c.email ?? c.metadata?.email ?? '',
      }));
      setCandidates(items);
    } catch {
      toast({ title: 'Error', description: 'Failed to load candidates', variant: 'destructive' });
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  /* ---- Handle job selection ---- */
  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    // Reset results
    setRankings(null);
    setQuestions(null);
    setSalary(null);
    setSkillsGap(null);
    setScreeningScores(null);
    setSelectedCandidateId('');
    setSalaryCountry('');

    // Fetch candidates for tools that need both selectors
    if (selectedTool === 'questions' || selectedTool === 'skills-gap' || selectedTool === 'screening') {
      fetchCandidates(jobId);
    }

    // Auto-execute for single-selector tools
    if (selectedTool === 'ranking') {
      executeRanking(Number(jobId));
    } else if (selectedTool === 'salary') {
      executeSalary(Number(jobId));
    }
  };

  /* ---- Handle candidate selection (auto-execute) ---- */
  const handleCandidateChange = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setQuestions(null);
    setSkillsGap(null);
    setScreeningScores(null);

    const jdId = Number(selectedJobId);
    const cId = Number(candidateId);

    if (selectedTool === 'questions') {
      executeQuestions(jdId, cId);
    } else if (selectedTool === 'skills-gap') {
      executeSkillsGap(jdId, cId);
    } else if (selectedTool === 'screening') {
      executeScreening(jdId, cId);
    }
  };

  /* ---- Reset on tool change ---- */
  const openTool = (toolId: ToolId) => {
    setSelectedTool(toolId);
    setSelectedJobId('');
    setSelectedCandidateId('');
    setSalaryCountry('');
    setCandidates([]);
    setRankings(null);
    setQuestions(null);
    setSalary(null);
    setSkillsGap(null);
    setScreeningScores(null);
  };

  const goBack = () => {
    setSelectedTool(null);
    setSelectedJobId('');
    setSelectedCandidateId('');
    setSalaryCountry('');
    setCandidates([]);
    setRankings(null);
    setQuestions(null);
    setSalary(null);
    setSkillsGap(null);
    setScreeningScores(null);
  };

  /* ---- Execution functions ---- */

  const executeRanking = async (jdId: number) => {
    setToolLoading(true);
    setRankings(null);
    try {
      const data = await apiClient.rankCandidates(jdId);
      const sorted = (data ?? []).sort((a: CandidateRanking, b: CandidateRanking) => b.composite_score - a.composite_score);
      setRankings(sorted);
    } catch {
      toast({ title: 'Error', description: 'Failed to rank candidates', variant: 'destructive' });
    } finally {
      setToolLoading(false);
    }
  };

  const executeQuestions = async (jdId: number, candidateId: number) => {
    setToolLoading(true);
    setQuestions(null);
    try {
      const data = await apiClient.generateInterviewQuestions(jdId, candidateId);
      setQuestions(data ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to generate questions', variant: 'destructive' });
    } finally {
      setToolLoading(false);
    }
  };

  const executeSalary = async (jdId: number, country?: string) => {
    setToolLoading(true);
    setSalary(null);
    try {
      const data = await apiClient.getSalaryIntelligence(jdId, country || undefined);
      setSalary(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load salary data', variant: 'destructive' });
    } finally {
      setToolLoading(false);
    }
  };

  const executeSkillsGap = async (jdId: number, candidateId: number) => {
    setToolLoading(true);
    setSkillsGap(null);
    try {
      const data = await apiClient.getSkillsGap(jdId, candidateId);
      setSkillsGap(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to analyze skills gap', variant: 'destructive' });
    } finally {
      setToolLoading(false);
    }
  };

  const [screeningNotConfigured, setScreeningNotConfigured] = useState(false);

  const executeScreening = async (jdId: number, candidateId: number) => {
    setToolLoading(true);
    setScreeningScores(null);
    setScreeningNotConfigured(false);
    try {
      const data = await apiClient.scoreScreening(jdId, candidateId);
      setScreeningScores(data ?? []);
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.status === 404) {
        setScreeningNotConfigured(true);
      } else {
        toast({ title: 'Error', description: 'Failed to score screening', variant: 'destructive' });
      }
    } finally {
      setToolLoading(false);
    }
  };

  /* ---- Copy all questions ---- */
  const handleCopyQuestions = () => {
    if (!questions) return;
    const text = questions
      .map((q, i) => `${i + 1}. [${q.type}] ${q.question}\n   Rationale: ${q.rationale}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied', description: 'All questions copied to clipboard' });
  };

  /* ---- Does the active tool need candidate selector? ---- */
  const needsCandidate = selectedTool === 'questions' || selectedTool === 'skills-gap' || selectedTool === 'screening';

  /* ---- Current tool metadata ---- */
  const currentTool = TOOLS.find((t) => t.id === selectedTool);

  /* ======================================================================== */
  /*  RENDER: Tool Card Grid                                                  */
  /* ======================================================================== */

  if (!selectedTool) {
    return (
      <AppLayout>
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="relative">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 shadow-sm">
                <BrainCircuit className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Toolkit</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                AI-powered recruiting intelligence at your fingertips
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tool Cards Grid */}
        <motion.div
          variants={containerStagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.div key={tool.id} variants={cardReveal}>
                <Card
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-border"
                  onClick={() => openTool(tool.id)}
                >
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                  <CardHeader className="relative pb-3 pt-6 px-6">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl ${tool.iconBg} shadow-lg shadow-black/10`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-0.5" />
                    </div>
                    <CardTitle className="text-base font-semibold mt-4 tracking-tight">{tool.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="relative px-6 pb-6 pt-0">
                    <CardDescription className="text-sm leading-relaxed text-muted-foreground/80">
                      {tool.description}
                    </CardDescription>
                  </CardContent>

                  {/* Bottom accent line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tool.iconBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </AppLayout>
    );
  }

  /* ======================================================================== */
  /*  RENDER: Tool Panel                                                      */
  /* ======================================================================== */

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={panelSlideIn}
      >
        {/* Header with back button */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground rounded-xl gap-1.5"
            onClick={goBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to AI Toolkit
          </Button>

          <div className="flex items-center gap-4">
            {currentTool && (
              <div className={`p-3 rounded-2xl ${currentTool.iconBg} shadow-lg shadow-black/10`}>
                <currentTool.icon className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{currentTool?.title}</h1>
              <p className="text-sm text-muted-foreground/80 mt-0.5">{currentTool?.description}</p>
            </div>
          </div>
        </div>

        {/* Selectors Card */}
        <Card className="mb-8 rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-6 pb-5">
            <div className="flex flex-wrap items-end gap-5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 block">
                  Job
                </label>
                <JobSelector
                  jobs={jobs}
                  loading={jobsLoading}
                  value={selectedJobId}
                  onChange={handleJobChange}
                />
              </div>
              {selectedTool === 'salary' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 block">
                    Country
                  </label>
                  <Select
                    value={salaryCountry}
                    onValueChange={(val) => {
                      setSalaryCountry(val);
                      if (selectedJobId) {
                        executeSalary(Number(selectedJobId), val === '__default__' ? undefined : val);
                      }
                    }}
                    disabled={!selectedJobId}
                  >
                    <SelectTrigger className="w-[220px] rounded-xl bg-background/60 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
                      <SelectValue placeholder="Job location (default)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__default__">Job location (default)</SelectItem>
                      {(salary?.available_countries ?? SALARY_COUNTRIES).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needsCandidate && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 block">
                    Candidate
                  </label>
                  <CandidateSelector
                    candidates={candidates}
                    loading={candidatesLoading}
                    value={selectedCandidateId}
                    onChange={handleCandidateChange}
                    disabled={!selectedJobId}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading state */}
        {toolLoading && <ToolSkeleton />}

        {/* Results */}
        <AnimatePresence mode="wait">
          {!toolLoading && selectedTool === 'ranking' && rankings && (
            <motion.div key="ranking" variants={resultsFade} initial="hidden" animate="visible" exit="exit">
              <RankingResults rankings={rankings} />
            </motion.div>
          )}
          {!toolLoading && selectedTool === 'questions' && questions && (
            <motion.div key="questions" variants={resultsFade} initial="hidden" animate="visible" exit="exit">
              <QuestionsResults
                questions={questions}
                copied={copied}
                onCopy={handleCopyQuestions}
              />
            </motion.div>
          )}
          {!toolLoading && selectedTool === 'salary' && salary && (
            <motion.div key="salary" variants={resultsFade} initial="hidden" animate="visible" exit="exit">
              <SalaryResults salary={salary} />
            </motion.div>
          )}
          {!toolLoading && selectedTool === 'skills-gap' && skillsGap && (
            <motion.div key="skills-gap" variants={resultsFade} initial="hidden" animate="visible" exit="exit">
              <SkillsGapResults skillsGap={skillsGap} />
            </motion.div>
          )}
          {!toolLoading && selectedTool === 'screening' && screeningScores && (
            <motion.div key="screening" variants={resultsFade} initial="hidden" animate="visible" exit="exit">
              <ScreeningResults scores={screeningScores} />
            </motion.div>
          )}
          {!toolLoading && selectedTool === 'screening' && screeningNotConfigured && selectedJobId && (
            <motion.div key="screening-empty" variants={resultsFade} initial="hidden" animate="visible" exit="exit">
              <Card className="rounded-2xl border-dashed border-2 border-border/50">
                <CardContent className="py-16 text-center">
                  <div className="p-4 rounded-2xl bg-muted/50 w-fit mx-auto mb-4">
                    <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-foreground font-semibold mb-1.5">No screening questions configured</p>
                  <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                    Add screening questions to this job before scoring candidates.
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => window.location.href = `/jobs/${selectedJobId}#screening`}
                  >
                    Configure Screening Questions
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state when no data yet */}
        {!toolLoading && !selectedJobId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="rounded-2xl border-dashed border-2 border-border/40 bg-muted/20">
              <CardContent className="py-20 text-center">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 w-fit mx-auto mb-5">
                  <Zap className="h-8 w-8 text-primary/50" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">
                  Select a job{needsCandidate ? ' and candidate' : ''} above to get started
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* State: job selected, waiting for candidate */}
        {!toolLoading && selectedJobId && needsCandidate && !selectedCandidateId && !candidatesLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="rounded-2xl border-dashed border-2 border-border/40 bg-muted/20">
              <CardContent className="py-20 text-center">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 w-fit mx-auto mb-5">
                  <Sparkles className="h-8 w-8 text-primary/50" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">
                  Now select a candidate to run the analysis
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AppLayout>
  );
}

/* ========================================================================== */
/*  Ranking Results                                                           */
/* ========================================================================== */

function RankingResults({ rankings }: { rankings: CandidateRanking[] }) {
  if (rankings.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-2 border-border/50">
        <CardContent className="py-16 text-center">
          <div className="p-4 rounded-2xl bg-amber-500/5 w-fit mx-auto mb-4">
            <Trophy className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">No candidates found to rank for this job</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border/50 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-500/5 via-transparent to-transparent border-b border-border/30">
        <CardTitle className="text-base flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm">
            <Trophy className="h-3.5 w-3.5 text-white" />
          </div>
          Candidate Rankings
          <Badge variant="secondary" className="ml-1 text-xs rounded-full px-2.5">{rankings.length} candidates</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-12 pl-6">Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-48">Composite Score</TableHead>
              <TableHead className="w-64">Breakdown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankings.map((r, idx) => (
              <TableRow key={r.candidate_id} className="group">
                <TableCell className="pl-6">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                    idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm' :
                    idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm dark:from-slate-500 dark:to-slate-600' :
                    idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white shadow-sm dark:from-orange-600 dark:to-orange-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.email || '--'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Progress value={r.composite_score} className="h-2 flex-1 rounded-full" />
                    <span className="text-sm font-bold w-10 text-right tabular-nums">
                      {Math.round(r.composite_score)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <MiniBar label="Resume" value={r.resume_score} />
                    <MiniBar label="Interview" value={r.interview_score} />
                    <MiniBar label="Feedback" value={r.feedback_score} />
                    <MiniBar label="Screening" value={r.screening_score} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 75 ? 'bg-emerald-500' :
    value >= 50 ? 'bg-amber-500' :
    value >= 25 ? 'bg-orange-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold w-7 text-right tabular-nums">{Math.round(value)}</span>
    </div>
  );
}

/* ========================================================================== */
/*  Questions Results                                                         */
/* ========================================================================== */

function QuestionsResults({
  questions,
  copied,
  onCopy,
}: {
  questions: InterviewQuestion[];
  copied: boolean;
  onCopy: () => void;
}) {
  if (questions.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-2 border-border/50">
        <CardContent className="py-16 text-center">
          <div className="p-4 rounded-2xl bg-violet-500/5 w-fit mx-auto mb-4">
            <MessageSquareText className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">No questions generated</p>
        </CardContent>
      </Card>
    );
  }

  const typeColor: Record<string, string> = {
    technical: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    behavioral: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    situational: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 shadow-sm">
            <MessageSquareText className="h-3.5 w-3.5 text-white" />
          </div>
          Generated Questions
          <Badge variant="secondary" className="text-xs rounded-full px-2.5">{questions.length}</Badge>
        </h3>
        <Button variant="outline" size="sm" onClick={onCopy} className="rounded-xl gap-1.5">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy All
            </>
          )}
        </Button>
      </div>

      <motion.div
        variants={containerStagger}
        initial="hidden"
        animate="visible"
        className="grid gap-3"
      >
        {questions.map((q, i) => (
          <motion.div key={i} variants={cardReveal}>
            <Card className="rounded-xl border-border/50 hover:border-border/80 transition-colors duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted/80 text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 capitalize rounded-full font-semibold ${typeColor[q.type.toLowerCase()] || 'bg-muted text-foreground border-border'}`}
                      >
                        {q.type}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">{q.question}</p>
                    <p className="text-xs text-muted-foreground/70 mt-2.5 italic leading-relaxed">
                      Rationale: {q.rationale}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ========================================================================== */
/*  Salary Results                                                            */
/* ========================================================================== */

const PERCENTILE_COLORS: Record<string, string> = {
  P10: '#94a3b8', P25: '#6366f1', Median: '#10b981', P75: '#f59e0b', P90: '#ef4444',
};

function SalaryResults({ salary }: { salary: SalaryIntelligence }) {
  const [isMonthly, setIsMonthly] = useState(false);
  const divisor = isMonthly ? 12 : 1;

  const fmt = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: salary.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(Math.round(value / divisor));

  const percentileCards = [
    { label: 'P10', value: salary.bands.p10 ?? salary.bands.min, color: PERCENTILE_COLORS.P10 },
    { label: 'P25', value: salary.bands.p25 ?? salary.bands.min, color: PERCENTILE_COLORS.P25 },
    { label: 'Median', value: salary.bands.median, color: PERCENTILE_COLORS.Median },
    { label: 'P75', value: salary.bands.p75 ?? salary.bands.max, color: PERCENTILE_COLORS.P75 },
    { label: 'P90', value: salary.bands.p90 ?? salary.bands.max, color: PERCENTILE_COLORS.P90 },
  ];

  const chartData = percentileCards.map(p => ({ label: p.label, value: Math.round(p.value / divisor) }));

  const demandBadge: Record<string, string> = {
    very_high: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    high: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    moderate: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    low: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent border-b border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
                  <DollarSign className="h-3.5 w-3.5 text-white" />
                </div>
                Salary Intelligence
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 mt-2">
                <span>{salary.job_title}{salary.location && ` - ${salary.location}`}</span>
                {salary.country && <Badge variant="secondary" className="text-xs rounded-full">{salary.country}</Badge>}
                <Badge variant="outline" className="text-xs rounded-full">{salary.currency}</Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 border border-border/30">
              <button
                onClick={() => setIsMonthly(false)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${!isMonthly ? 'bg-card shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Annual
              </button>
              <button
                onClick={() => setIsMonthly(true)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${isMonthly ? 'bg-card shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Percentile cards */}
          <div className="grid grid-cols-5 gap-3">
            {percentileCards.map((p) => (
              <div key={p.label} className="text-center p-4 rounded-xl bg-muted/30 border border-border/40 hover:border-border/60 transition-colors">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{p.label}</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: p.color }}>{fmt(p.value)}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="h-56 rounded-xl bg-muted/10 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                <RechartsTooltip
                  formatter={(value: number) => [fmt(value), 'Salary']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={50}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={Object.values(PERCENTILE_COLORS)[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Total Compensation + Trends + COL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Comp */}
            {salary.total_compensation && (
              <div className="p-5 rounded-xl border border-border/40 bg-card hover:border-border/60 transition-colors">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Total Compensation</p>
                <p className="text-2xl font-bold text-foreground mb-4 tabular-nums">{fmt(salary.total_compensation.total)}</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span className="font-semibold tabular-nums">{fmt(salary.total_compensation.base)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bonus</span><span className="font-semibold tabular-nums">{fmt(salary.total_compensation.bonus)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Equity</span><span className="font-semibold tabular-nums">{fmt(salary.total_compensation.equity)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Benefits</span><span className="font-semibold tabular-nums">{fmt(salary.total_compensation.benefits)}</span></div>
                </div>
              </div>
            )}

            {/* Trends */}
            {salary.trends && (
              <div className="p-5 rounded-xl border border-border/40 bg-card hover:border-border/60 transition-colors">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Market Trends</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">YoY Salary Growth</p>
                    <p className={`text-2xl font-bold tabular-nums ${salary.trends.yoy_growth > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {salary.trends.yoy_growth > 0 ? '+' : ''}{salary.trends.yoy_growth}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Talent Demand</p>
                    <Badge variant="outline" className={`text-xs capitalize rounded-full px-3 ${demandBadge[salary.trends.demand] || demandBadge.moderate}`}>
                      {salary.trends.demand?.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Cost of Living */}
            {salary.cost_of_living && (
              <div className="p-5 rounded-xl border border-border/40 bg-card hover:border-border/60 transition-colors">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cost of Living</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">COL Index</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{salary.cost_of_living.index}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">vs US Baseline</p>
                    <p className={`text-sm font-bold tabular-nums ${salary.cost_of_living.vs_us_pct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {salary.cost_of_living.vs_us_pct > 0 ? '+' : ''}{salary.cost_of_living.vs_us_pct}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Data Sources */}
          {salary.data_sources && salary.data_sources.length > 0 && (
            <div className="pt-5 border-t border-border/30">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Data Sources</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {salary.data_sources.map((src) => (
                  <div key={src.name} className="p-3.5 rounded-xl border border-border/40 bg-muted/20 text-xs hover:border-border/60 transition-colors">
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">{src.name}</a>
                    <p className="text-muted-foreground mt-1.5">{(src.sample_size / 1000).toFixed(0)}k samples</p>
                    <p className="text-muted-foreground">Updated: {src.last_updated}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${src.confidence}%` }} />
                      </div>
                      <span className="text-[10px] font-semibold tabular-nums">{src.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ========================================================================== */
/*  Skills Gap Results                                                        */
/* ========================================================================== */

function SkillsGapResults({ skillsGap }: { skillsGap: SkillsGap }) {
  return (
    <Card className="rounded-2xl border-border/50 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-500/5 via-transparent to-transparent border-b border-border/30">
        <CardTitle className="text-base flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-sky-500 shadow-sm">
            <PuzzleIcon className="h-3.5 w-3.5 text-white" />
          </div>
          Skills Gap Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <SkillsGapMatrix
          matched={skillsGap.matched}
          missing={skillsGap.missing}
          bonus={skillsGap.bonus}
          matchPercentage={skillsGap.match_percentage}
        />
      </CardContent>
    </Card>
  );
}

/* ========================================================================== */
/*  Screening Results                                                         */
/* ========================================================================== */

function ScreeningResults({ scores }: { scores: ScreeningScore[] }) {
  if (scores.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-2 border-border/50">
        <CardContent className="py-16 text-center">
          <div className="p-4 rounded-2xl bg-rose-500/5 w-fit mx-auto mb-4">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">No screening responses to score</p>
        </CardContent>
      </Card>
    );
  }

  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 shadow-sm">
            <ClipboardCheck className="h-3.5 w-3.5 text-white" />
          </div>
          Screening Scores
          <Badge variant="secondary" className="text-xs rounded-full px-2.5">{scores.length} responses</Badge>
        </h3>
        <Badge
          variant="outline"
          className={`text-sm px-4 py-1.5 rounded-full font-semibold ${
            avgScore >= 4 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
            avgScore >= 3 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
          }`}
        >
          Avg: {avgScore.toFixed(1)} / 5
        </Badge>
      </div>

      <motion.div
        variants={containerStagger}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {scores.map((s, i) => (
          <motion.div key={i} variants={cardReveal}>
            <Card className="rounded-xl border-border/50 hover:border-border/80 transition-colors duration-200 overflow-hidden">
              <CardContent className="pt-5 pb-5">
                <div className="space-y-4">
                  {/* Question */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Question {i + 1}</p>
                    <p className="text-sm font-medium">{s.question}</p>
                  </div>

                  {/* Response */}
                  <div className="pl-4 border-l-2 border-primary/20 bg-muted/20 rounded-r-lg py-2.5 pr-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Candidate Response</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{s.response}</p>
                  </div>

                  {/* Score + Reasoning */}
                  <div className="flex items-start justify-between gap-4 pt-3 border-t border-border/30">
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">AI Reasoning</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>
                    </div>
                    <div className="shrink-0">
                      <ScoreStars score={s.score} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
