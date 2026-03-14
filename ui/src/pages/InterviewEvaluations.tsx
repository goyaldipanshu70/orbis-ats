import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Download, ArrowUpDown, BarChart3, TrendingUp, Users, Award,
  AlertTriangle, FileSpreadsheet, Radar as RadarIcon, PieChart as PieChartIcon,
  Sparkles, CalendarCheck, Heart, ChevronRight, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import AppLayout from '@/components/layout/AppLayout';
import RecommendationBadge from '@/components/RecommendationBadge';
import ScoreDisplay from '@/components/ScoreDisplay';
import { DataPagination } from '@/components/DataPagination';
import { apiClient } from '@/utils/api';
import type { InterviewEvaluation } from '@/types/api';
import TopCandidatesSummary from '@/components/interview/TopCandidatesSummary';
import KeyConcernsSummary from '@/components/interview/KeyConcernsSummary';

/* ---- dark-glass design tokens ---- */
const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const _glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const _selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#6B7280', '#8B5CF6'];

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,.3)',
  fontSize: '13px',
  color: 'hsl(var(--foreground))',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

const InterviewEvaluations = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [evaluations, setEvaluations] = useState<InterviewEvaluation[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 0, pageSize: 20 });

  useEffect(() => {
    loadEvaluations();
  }, [jobId, currentPage]);

  const loadEvaluations = async () => {
    try {
      const data = await apiClient.getInterviewEvaluations(jobId || '', currentPage, 20);
      setEvaluations(data.items || []);
      setPaginationMeta({
        total: data.total,
        totalPages: data.total_pages,
        pageSize: data.page_size,
      });
    } catch (error) {
      console.error('Error loading interview evaluations:', error);
      setEvaluations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedEvaluations = [...evaluations].sort((a, b) => {
    if (!sortConfig) return 0;

    let aValue: any, bValue: any;

    if (sortConfig.key === 'total_score') {
      aValue = a.score_breakdown?.total_score?.obtained_score ?? 0;
      bValue = b.score_breakdown?.total_score?.obtained_score ?? 0;
    } else if (sortConfig.key === 'candidate_name') {
      aValue = a.candidate_name;
      bValue = b.candidate_name;
    } else {
      return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Prepare chart data
  const scoreComparisonData = evaluations.map(evaluation => ({
    name: (evaluation.candidate_name || 'Unknown').split(' ')[0],
    technical: evaluation.score_breakdown?.technical_competency?.obtained_score ?? 0,
    coreQuals: evaluation.score_breakdown?.core_qualifications?.obtained_score ?? 0,
    communication: evaluation.score_breakdown?.communication_skills?.obtained_score ?? 0,
    problemSolving: evaluation.score_breakdown?.problem_solving?.obtained_score ?? 0,
    domain: evaluation.score_breakdown?.domain_knowledge?.obtained_score ?? 0,
    teamwork: evaluation.score_breakdown?.teamwork_culture_fit?.obtained_score ?? 0,
    total: evaluation.score_breakdown?.total_score?.obtained_score ?? 0,
    maxTotal: evaluation.score_breakdown?.total_score?.max_score ?? 100
  }));

  const recommendationData = evaluations.reduce((acc, evaluation) => {
    const rec = evaluation.ai_recommendation;
    if (rec) {
      acc[rec] = (acc[rec] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(recommendationData).map(([key, value]) => ({
    name: key,
    value,
    percentage: evaluations.length > 0 ? Math.round((value / evaluations.length) * 100) : 0
  }));

  const averageScores = evaluations.length > 0 ? {
    technical_competency: Math.round(evaluations.reduce((sum, e) => sum + (e.score_breakdown?.technical_competency?.obtained_score ?? 0), 0) / evaluations.length),
    core_qualifications: Math.round(evaluations.reduce((sum, e) => sum + (e.score_breakdown?.core_qualifications?.obtained_score ?? 0), 0) / evaluations.length),
    communication_skills: Math.round(evaluations.reduce((sum, e) => sum + (e.score_breakdown?.communication_skills?.obtained_score ?? 0), 0) / evaluations.length),
    problem_solving: Math.round(evaluations.reduce((sum, e) => sum + (e.score_breakdown?.problem_solving?.obtained_score ?? 0), 0) / evaluations.length),
    domain_knowledge: Math.round(evaluations.reduce((sum, e) => sum + (e.score_breakdown?.domain_knowledge?.obtained_score ?? 0), 0) / evaluations.length),
    teamwork_culture_fit: Math.round(evaluations.reduce((sum, e) => sum + (e.score_breakdown?.teamwork_culture_fit?.obtained_score ?? 0), 0) / evaluations.length),
  } : null;

  const radarData = averageScores ? [
    { competency: 'Technical', score: averageScores.technical_competency },
    { competency: 'Core Quals', score: averageScores.core_qualifications },
    { competency: 'Communication', score: averageScores.communication_skills },
    { competency: 'Problem Solving', score: averageScores.problem_solving },
    { competency: 'Domain', score: averageScores.domain_knowledge },
    { competency: 'Teamwork', score: averageScores.teamwork_culture_fit },
  ] : [];

  const downloadExcel = () => {
    const csvContent = [
      ['Candidate', 'Position', 'Total Score', 'Recommendation', 'Cultural Fit', 'Available to Start', 'Strongest Competency', 'Development Areas', 'Overall Impression'].join(','),
      ...evaluations.map(e => [
        e.candidate_name,
        e.position,
        e.score_breakdown?.total_score?.obtained_score ?? 'N/A',
        e.ai_recommendation,
        e.cultural_fit,
        e.available_to_start,
        e.strongest_competency,
        `"${e.area_for_development}"`,
        `"${e.overall_impression}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_evaluations_${jobId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, e) => sum + (e.score_breakdown?.total_score?.obtained_score ?? 0), 0) / evaluations.length)
    : 0;

  const scoreColorClass = (pct: number) =>
    pct >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : pct >= 60 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    : pct >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-red-500/10 text-red-400 border-red-500/20';

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen">
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-400">Loading interview evaluations...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen">
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ---- Header ---- */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Interview Evaluations
                </h1>
              </div>
              <p className="text-sm text-slate-400 pl-11">
                AI-powered interview assessment results for Job{' '}
                <span className="font-mono text-xs bg-white/[0.05] px-1.5 py-0.5 rounded text-slate-300">{jobId}</span>
              </p>
            </div>

            <button
              onClick={downloadExcel}
              disabled={evaluations.length === 0}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
              style={{ ...glassCard, cursor: evaluations.length === 0 ? 'not-allowed' : 'pointer', opacity: evaluations.length === 0 ? 0.5 : 1 }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </button>
          </motion.div>

          {/* ---- Candidate Highlights ---- */}
          {evaluations.length > 0 && (
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopCandidatesSummary evaluations={evaluations} />
              <KeyConcernsSummary evaluations={evaluations} />
            </motion.div>
          )}

          {/* ---- KPI Cards ---- */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Interviewed */}
            <div className="rounded-xl hover:brightness-110 transition-all duration-300" style={glassCard}>
              <div className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Interviewed</span>
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-white">{evaluations.length}</p>
                <p className="text-xs text-slate-500 mt-1">Candidates assessed</p>
              </div>
            </div>

            {/* Average Score */}
            <div className="rounded-xl hover:brightness-110 transition-all duration-300" style={glassCard}>
              <div className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Avg Score</span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-white">{avgScore}</p>
                <p className="text-xs text-slate-500 mt-1">Out of 100 points</p>
              </div>
            </div>

            {/* Strong Candidates */}
            <div className="rounded-xl hover:brightness-110 transition-all duration-300" style={glassCard}>
              <div className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Strong</span>
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Award className="h-4 w-4 text-blue-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-white">
                  {evaluations.filter(e => e.ai_recommendation === 'Interview' || e.ai_recommendation === 'Interview Immediately').length}
                </p>
                <p className="text-xs text-slate-500 mt-1">Recommended for hiring</p>
              </div>
            </div>

            {/* Cultural Fit */}
            <div className="rounded-xl hover:brightness-110 transition-all duration-300" style={glassCard}>
              <div className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Culture Fit</span>
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Heart className="h-4 w-4 text-amber-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-white">
                  {evaluations.filter(e => e.cultural_fit === 'Yes').length}
                </p>
                <p className="text-xs text-slate-500 mt-1">Good cultural alignment</p>
              </div>
            </div>
          </motion.div>

          {/* ---- Charts Grid ---- */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Bar Chart */}
            <div className="rounded-xl" style={glassCard}>
              <div className="px-5 pt-5 pb-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  Candidate Performance
                </h3>
              </div>
              <div className="px-5 pb-5">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-border)" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="total" fill="url(#barGrad)" name="Total Score" radius={[6, 6, 0, 0]} />
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recommendation Pie */}
            <div className="rounded-xl" style={glassCard}>
              <div className="px-5 pt-5 pb-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <PieChartIcon className="h-4 w-4 text-emerald-400" />
                  Recommendation Breakdown
                </h3>
              </div>
              <div className="px-5 pb-5">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        strokeWidth={2}
                        stroke="#0f0d2e"
                      >
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="rounded-xl" style={glassCard}>
              <div className="px-5 pt-5 pb-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <RadarIcon className="h-4 w-4 text-blue-400" />
                  Team Competency Profile
                </h3>
              </div>
              <div className="px-5 pb-5">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--orbis-hover)" />
                      <PolarAngleAxis dataKey="competency" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 25]} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Radar
                        name="Average Score"
                        dataKey="score"
                        stroke="#8B5CF6"
                        fill="#8B5CF6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Skills Comparison */}
            <div className="rounded-xl" style={glassCard}>
              <div className="px-5 pt-5 pb-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Skills Comparison
                </h3>
              </div>
              <div className="px-5 pb-5">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreComparisonData.slice(0, 5)} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--orbis-border)" strokeOpacity={0.5} />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="technical" fill="#10B981" name="Technical" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="coreQuals" fill="#3B82F6" name="Core Quals" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="communication" fill="#8B5CF6" name="Communication" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="domain" fill="#F59E0B" name="Domain" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ---- Detailed Table ---- */}
          <motion.div variants={itemVariants}>
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
                <h3 className="text-base font-semibold text-white">Detailed Interview Results</h3>
              </div>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-white/[0.02]" style={{ background: 'var(--orbis-subtle)', borderBottom: '1px solid var(--orbis-grid)' }}>
                        <TableHead
                          className="cursor-pointer font-semibold text-xs uppercase tracking-wider text-slate-500"
                          onClick={() => handleSort('candidate_name')}
                        >
                          <div className="flex items-center gap-1">
                            Candidate
                            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer font-semibold text-xs uppercase tracking-wider text-slate-500"
                          onClick={() => handleSort('total_score')}
                        >
                          <div className="flex items-center gap-1">
                            Score
                            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Skills</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Recommendation</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Cultural Fit</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Availability</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Key Insights</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedEvaluations.map((evaluation) => {
                        const totalScore = evaluation.score_breakdown?.total_score;
                        const totalScorePercentage = (totalScore && totalScore.max_score > 0)
                          ? (totalScore.obtained_score / totalScore.max_score) * 100
                          : 0;

                        return (
                          <TableRow
                            key={evaluation.evaluation_id}
                            className="group hover:bg-white/[0.02] transition-colors duration-150"
                            style={{ borderBottom: '1px solid var(--orbis-grid)' }}
                          >
                            {/* Candidate */}
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <span className="text-sm font-semibold text-blue-400">
                                    {evaluation.candidate_name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-white">{evaluation.candidate_name}</p>
                                  <p className="text-xs text-slate-500">{evaluation.position}</p>
                                </div>
                              </div>
                            </TableCell>

                            {/* Score */}
                            <TableCell>
                              <div className="space-y-2">
                                <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-semibold border ${scoreColorClass(totalScorePercentage)}`}>
                                  {totalScore?.obtained_score ?? 0}/{totalScore?.max_score ?? 100}
                                </span>
                                {/* progress bar replacement */}
                                <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${totalScorePercentage}%`,
                                      background: totalScorePercentage >= 80 ? '#10b981' : totalScorePercentage >= 60 ? '#3b82f6' : totalScorePercentage >= 40 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                              </div>
                            </TableCell>

                            {/* Skills */}
                            <TableCell>
                              <div className="space-y-1.5 text-xs">
                                {[
                                  { label: 'Technical', field: evaluation.score_breakdown?.technical_competency },
                                  { label: 'Core Quals', field: evaluation.score_breakdown?.core_qualifications },
                                  { label: 'Comms', field: evaluation.score_breakdown?.communication_skills },
                                  { label: 'Domain', field: evaluation.score_breakdown?.domain_knowledge },
                                ].map((item) => (
                                  <div key={item.label} className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">{item.label}</span>
                                    <ScoreDisplay
                                      score={item.field?.obtained_score ?? 0}
                                      maxScore={item.field?.max_score ?? 0}
                                      showPercentage={false}
                                      size="sm"
                                    />
                                  </div>
                                ))}
                              </div>
                            </TableCell>

                            {/* Recommendation */}
                            <TableCell>
                              <RecommendationBadge recommendation={evaluation.ai_recommendation} />
                            </TableCell>

                            {/* Cultural Fit */}
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium border ${
                                  evaluation.cultural_fit === 'Yes'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}
                              >
                                {evaluation.cultural_fit}
                              </span>
                            </TableCell>

                            {/* Availability */}
                            <TableCell>
                              <div className="text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <CalendarCheck className="h-3.5 w-3.5 text-slate-500" />
                                  <span className="text-white">{evaluation.available_to_start}</span>
                                </div>
                                <div className="text-slate-500">
                                  Weekends: {evaluation.willing_to_work_weekends}
                                </div>
                              </div>
                            </TableCell>

                            {/* Key Insights */}
                            <TableCell>
                              <div className="text-xs space-y-2 max-w-xs">
                                <div className="flex items-start gap-1.5">
                                  <ChevronRight className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="font-medium text-emerald-400">Strongest</span>
                                    <p className="text-slate-400 leading-snug">{evaluation.strongest_competency}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-1.5">
                                  <ChevronRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="font-medium text-amber-400">Development</span>
                                    <p className="text-slate-400 leading-snug">{evaluation.area_for_development}</p>
                                  </div>
                                </div>
                                {evaluation.red_flags && evaluation.red_flags.length > 0 && (
                                  <div className="flex items-start gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                                    <div>
                                      <span className="font-medium text-red-400">Concerns</span>
                                      <p className="text-red-400/80 leading-snug">{evaluation.red_flags.join(', ')}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ---- Pagination ---- */}
          <motion.div variants={itemVariants}>
            <DataPagination
              page={currentPage}
              totalPages={paginationMeta.totalPages}
              total={paginationMeta.total}
              pageSize={paginationMeta.pageSize}
              onPageChange={setCurrentPage}
            />
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default InterviewEvaluations;
