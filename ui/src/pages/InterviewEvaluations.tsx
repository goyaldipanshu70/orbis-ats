import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#6B7280', '#8B5CF6'];

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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background">
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Loading interview evaluations...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
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
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Interview Evaluations
                </h1>
              </div>
              <p className="text-sm text-muted-foreground pl-11">
                AI-powered interview assessment results for Job <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{jobId}</span>
              </p>
            </div>

            <Button
              onClick={downloadExcel}
              disabled={evaluations.length === 0}
              variant="outline"
              className="rounded-xl gap-2 border-border/60 hover:bg-muted/60 shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
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
            <Card className="rounded-xl border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Interviewed</span>
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">{evaluations.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Candidates assessed</p>
              </CardContent>
            </Card>

            {/* Average Score */}
            <Card className="rounded-xl border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Score</span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">{avgScore}</p>
                <p className="text-xs text-muted-foreground mt-1">Out of 100 points</p>
              </CardContent>
            </Card>

            {/* Strong Candidates */}
            <Card className="rounded-xl border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Strong</span>
                  <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Award className="h-4 w-4 text-violet-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {evaluations.filter(e => e.ai_recommendation === 'Interview' || e.ai_recommendation === 'Interview Immediately').length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Recommended for hiring</p>
              </CardContent>
            </Card>

            {/* Cultural Fit */}
            <Card className="rounded-xl border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Culture Fit</span>
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Heart className="h-4 w-4 text-amber-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {evaluations.filter(e => e.cultural_fit === 'Yes').length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Good cultural alignment</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* ---- Charts Grid ---- */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Bar Chart */}
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  Candidate Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 8px 30px rgba(0,0,0,.08)',
                          fontSize: '13px',
                        }}
                      />
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
              </CardContent>
            </Card>

            {/* Recommendation Pie */}
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <PieChartIcon className="h-4 w-4 text-emerald-500" />
                  Recommendation Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                        stroke="hsl(var(--background))"
                      >
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 8px 30px rgba(0,0,0,.08)',
                          fontSize: '13px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Radar Chart */}
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <RadarIcon className="h-4 w-4 text-violet-500" />
                  Team Competency Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="competency" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 25]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="Average Score"
                        dataKey="score"
                        stroke="#8B5CF6"
                        fill="#8B5CF6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Skills Comparison */}
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Skills Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreComparisonData.slice(0, 5)} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 8px 30px rgba(0,0,0,.08)',
                          fontSize: '13px',
                        }}
                      />
                      <Bar dataKey="technical" fill="#10B981" name="Technical" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="coreQuals" fill="#3B82F6" name="Core Quals" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="communication" fill="#8B5CF6" name="Communication" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="domain" fill="#F59E0B" name="Domain" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ---- Detailed Table ---- */}
          <motion.div variants={itemVariants}>
            <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/40 bg-muted/30">
                <CardTitle className="text-base font-semibold">Detailed Interview Results</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead
                          className="cursor-pointer font-semibold text-xs uppercase tracking-wider"
                          onClick={() => handleSort('candidate_name')}
                        >
                          <div className="flex items-center gap-1">
                            Candidate
                            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer font-semibold text-xs uppercase tracking-wider"
                          onClick={() => handleSort('total_score')}
                        >
                          <div className="flex items-center gap-1">
                            Score
                            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Skills</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Recommendation</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Cultural Fit</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Availability</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Key Insights</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedEvaluations.map((evaluation) => {
                        const totalScore = evaluation.score_breakdown?.total_score;
                        const totalScorePercentage = (totalScore && totalScore.max_score > 0)
                          ? (totalScore.obtained_score / totalScore.max_score) * 100
                          : 0;

                        const scoreColor =
                          totalScorePercentage >= 80
                            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                            : totalScorePercentage >= 60
                              ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                              : 'bg-red-500/10 text-red-700 border-red-200';

                        return (
                          <TableRow
                            key={evaluation.evaluation_id}
                            className="group hover:bg-muted/40 transition-colors duration-150 border-b border-border/30"
                          >
                            {/* Candidate */}
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-sm font-semibold text-primary">
                                    {evaluation.candidate_name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{evaluation.candidate_name}</p>
                                  <p className="text-xs text-muted-foreground">{evaluation.position}</p>
                                </div>
                              </div>
                            </TableCell>

                            {/* Score */}
                            <TableCell>
                              <div className="space-y-2">
                                <Badge variant="outline" className={`rounded-lg px-2.5 py-1 text-sm font-semibold border ${scoreColor}`}>
                                  {totalScore?.obtained_score ?? 0}/{totalScore?.max_score ?? 100}
                                </Badge>
                                <Progress
                                  value={totalScorePercentage}
                                  className="h-1.5 w-20"
                                />
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
                                    <span className="text-muted-foreground">{item.label}</span>
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
                              <Badge
                                variant={evaluation.cultural_fit === 'Yes' ? 'default' : 'destructive'}
                                className="rounded-lg font-medium text-xs"
                              >
                                {evaluation.cultural_fit}
                              </Badge>
                            </TableCell>

                            {/* Availability */}
                            <TableCell>
                              <div className="text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{evaluation.available_to_start}</span>
                                </div>
                                <div className="text-muted-foreground">
                                  Weekends: {evaluation.willing_to_work_weekends}
                                </div>
                              </div>
                            </TableCell>

                            {/* Key Insights */}
                            <TableCell>
                              <div className="text-xs space-y-2 max-w-xs">
                                <div className="flex items-start gap-1.5">
                                  <ChevronRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="font-medium text-emerald-600">Strongest</span>
                                    <p className="text-muted-foreground leading-snug">{evaluation.strongest_competency}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-1.5">
                                  <ChevronRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="font-medium text-amber-600">Development</span>
                                    <p className="text-muted-foreground leading-snug">{evaluation.area_for_development}</p>
                                  </div>
                                </div>
                                {evaluation.red_flags && evaluation.red_flags.length > 0 && (
                                  <div className="flex items-start gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                    <div>
                                      <span className="font-medium text-red-600">Concerns</span>
                                      <p className="text-red-600/80 leading-snug">{evaluation.red_flags.join(', ')}</p>
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
              </CardContent>
            </Card>
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
