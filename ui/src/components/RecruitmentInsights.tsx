import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, scaleIn } from '@/lib/animations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Users, 
  Star, 
  Clock, 
  Target, 
  Brain,
  Award,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Calendar,
  Zap,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface JobInsights {
  job_id: string;
  job_title: string;
  total_candidates: number;
  recommendations: {
    interview_immediately: number;
    interview: number;
    consider: number;
    do_not_recommend: number;
  };
  average_scores: {
    overall: number;
    technical_skills: number;
    experience: number;
    education: number;
  };
  top_skills: string[];
  common_red_flags: string[];
  hiring_velocity: number; // days to fill
  quality_score: number; // 0-100
}

interface RecruitmentInsightsProps {
  isOpen: boolean;
  onClose: () => void;
}

const RecruitmentInsights: React.FC<RecruitmentInsightsProps> = ({ isOpen, onClose }) => {
  const [insights, setInsights] = useState<JobInsights[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadInsights();
    }
  }, [isOpen, timeRange]);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      // Get jobs and candidates
      const [jobs, dashboardStats] = await Promise.all([
        apiClient.getJobs(),
        apiClient.getDashboardStats()
      ]);

      // Process insights for each job
      const jobInsights: JobInsights[] = await Promise.all(
        jobs.map(async (job: any) => {
          const candidates = await apiClient.getCandidates(job.job_id);
          
          // Calculate recommendations breakdown
          const recommendations = {
            interview_immediately: 0,
            interview: 0,
            consider: 0,
            do_not_recommend: 0
          };

          // Calculate average scores
          let totalScores = {
            overall: 0,
            technical_skills: 0,
            experience: 0,
            education: 0
          };

          const skillsMap = new Map<string, number>();
          const redFlagsMap = new Map<string, number>();

          candidates.forEach((candidate: any) => {
            const analysis = candidate.ai_resume_analysis;
            if (!analysis) return;

            // Count recommendations
            const rec = analysis.ai_recommendation?.toLowerCase().replace(/\s+/g, '_') || 'do_not_recommend';
            if (rec.includes('immediately')) recommendations.interview_immediately++;
            else if (rec.includes('interview')) recommendations.interview++;
            else if (rec.includes('consider')) recommendations.consider++;
            else recommendations.do_not_recommend++;

            // Sum scores
            const scores = analysis.category_scores || {};
            const overallScore = Object.values(scores).reduce((sum: number, score: any) => sum + (Number(score) || 0), 0);
            totalScores.overall += Number(overallScore) || 0;
            totalScores.technical_skills += Number(scores.technical_skills || scores.core_skills || 0);
            totalScores.experience += Number(scores.experience_depth || scores.experience || 0);
            totalScores.education += Number(scores.education_credentials || scores.education || 0);

            // Count skills
            (analysis.highlighted_skills || []).forEach((skill: string) => {
              skillsMap.set(skill, (skillsMap.get(skill) || 0) + 1);
            });

            // Count red flags
            (analysis.red_flags || []).forEach((flag: string) => {
              redFlagsMap.set(flag, (redFlagsMap.get(flag) || 0) + 1);
            });
          });

          // Calculate averages
          const candidateCount = candidates.length || 1;
          const avgScores = {
            overall: Math.round(totalScores.overall / candidateCount),
            technical_skills: Math.round(totalScores.technical_skills / candidateCount),
            experience: Math.round(totalScores.experience / candidateCount),
            education: Math.round(totalScores.education / candidateCount)
          };

          // Get top skills and red flags
          const topSkills = Array.from(skillsMap.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([skill]) => skill);

          const commonRedFlags = Array.from(redFlagsMap.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([flag]) => flag);

          // Calculate quality metrics
          const qualityScore = Math.round(
            (recommendations.interview_immediately * 100 + 
             recommendations.interview * 75 + 
             recommendations.consider * 50) / candidateCount
          );

          const hiringVelocity = Math.floor(Math.random() * 20) + 10; // Mock data for now

          return {
            job_id: job.job_id,
            job_title: job.job_title,
            total_candidates: candidates.length,
            recommendations,
            average_scores: avgScores,
            top_skills: topSkills,
            common_red_flags: commonRedFlags,
            hiring_velocity: hiringVelocity,
            quality_score: qualityScore
          };
        })
      );

      setInsights(jobInsights);
    } catch (error) {
      console.error('Error loading insights:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recruitment insights.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInsights = selectedJob === 'all' 
    ? insights 
    : insights.filter(insight => insight.job_id === selectedJob);

  const totalCandidates = filteredInsights.reduce((sum, insight) => sum + insight.total_candidates, 0);
  const averageQuality = filteredInsights.length > 0 
    ? Math.round(filteredInsights.reduce((sum, insight) => sum + insight.quality_score, 0) / filteredInsights.length)
    : 0;

  const overallRecommendations = filteredInsights.reduce((acc, insight) => ({
    interview_immediately: acc.interview_immediately + insight.recommendations.interview_immediately,
    interview: acc.interview + insight.recommendations.interview,
    consider: acc.consider + insight.recommendations.consider,
    do_not_recommend: acc.do_not_recommend + insight.recommendations.do_not_recommend
  }), { interview_immediately: 0, interview: 0, consider: 0, do_not_recommend: 0 });

  const exportInsights = () => {
    const csvContent = [
      ['Job Title', 'Total Candidates', 'Quality Score', 'Avg Overall Score', 'Interview Immediately', 'Interview', 'Consider', 'Do Not Recommend'],
      ...filteredInsights.map(insight => [
        insight.job_title,
        insight.total_candidates,
        insight.quality_score,
        insight.average_scores.overall,
        insight.recommendations.interview_immediately,
        insight.recommendations.interview,
        insight.recommendations.consider,
        insight.recommendations.do_not_recommend
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recruitment-insights-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="w-6 h-6 text-purple-600" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">Recruitment Insights</h2>
                <p className="text-muted-foreground">AI-powered analytics for smarter hiring decisions</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
              </select>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Jobs</option>
                {insights.map(insight => (
                  <option key={insight.job_id} value={insight.job_id}>
                    {insight.job_title}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={loadInsights}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportInsights}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing recruitment data...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Key Metrics */}
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div variants={scaleIn}><Card className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100">Total Candidates</p>
                      <p className="text-3xl font-bold">{totalCandidates}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              </motion.div><motion.div variants={scaleIn}><Card className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100">Quality Score</p>
                      <p className="text-3xl font-bold">{averageQuality}%</p>
                    </div>
                    <Star className="w-8 h-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              </motion.div><motion.div variants={scaleIn}><Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100">Interview Ready</p>
                      <p className="text-3xl font-bold">
                        {overallRecommendations.interview_immediately + overallRecommendations.interview}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>

              </motion.div><motion.div variants={scaleIn}><Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100">Active Jobs</p>
                      <p className="text-3xl font-bold">{insights.length}</p>
                    </div>
                    <Target className="w-8 h-8 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>

            {/* Recommendation Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="w-5 h-5 mr-2 text-blue-600" />
                  Candidate Recommendation Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {overallRecommendations.interview_immediately}
                    </div>
                    <div className="text-sm text-green-700">Interview Immediately</div>
                    <Progress 
                      value={(overallRecommendations.interview_immediately / totalCandidates) * 100} 
                      className="mt-2"
                    />
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {overallRecommendations.interview}
                    </div>
                    <div className="text-sm text-blue-700">Interview</div>
                    <Progress 
                      value={(overallRecommendations.interview / totalCandidates) * 100} 
                      className="mt-2"
                    />
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {overallRecommendations.consider}
                    </div>
                    <div className="text-sm text-yellow-700">Consider</div>
                    <Progress 
                      value={(overallRecommendations.consider / totalCandidates) * 100} 
                      className="mt-2"
                    />
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {overallRecommendations.do_not_recommend}
                    </div>
                    <div className="text-sm text-red-700">Do Not Recommend</div>
                    <Progress 
                      value={(overallRecommendations.do_not_recommend / totalCandidates) * 100} 
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Job Performance Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                  Job Performance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredInsights.map((insight) => (
                    <div key={insight.job_id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-foreground">{insight.job_title}</h4>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            className={`${
                              insight.quality_score >= 80 ? 'bg-green-500' :
                              insight.quality_score >= 60 ? 'bg-yellow-500' :
                              'bg-red-500'
                            } text-white`}
                          >
                            Quality: {insight.quality_score}%
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {insight.total_candidates} candidates
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Score Breakdown</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Overall:</span>
                              <span className="font-medium">{insight.average_scores.overall}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Technical:</span>
                              <span className="font-medium">{insight.average_scores.technical_skills}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Experience:</span>
                              <span className="font-medium">{insight.average_scores.experience}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Top Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {insight.top_skills.slice(0, 3).map((skill, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Common Issues</p>
                          {insight.common_red_flags.length > 0 ? (
                            <div className="space-y-1">
                              {insight.common_red_flags.slice(0, 2).map((flag, index) => (
                                <div key={index} className="flex items-center space-x-1">
                                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                                  <span className="text-xs text-muted-foreground">{flag}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-green-600">No common issues</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actionable Recommendations */}
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center text-indigo-800">
                  <Zap className="w-5 h-5 mr-2" />
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {averageQuality < 60 && (
                    <div className="p-3 bg-orange-100 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-800">
                          Low candidate quality detected. Consider refining job descriptions or expanding search criteria.
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {totalCandidates < 5 && (
                    <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          Low candidate volume. Consider broadening recruitment channels or adjusting requirements.
                        </span>
                      </div>
                    </div>
                  )}

                  {overallRecommendations.interview_immediately > 0 && (
                    <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          {overallRecommendations.interview_immediately} high-priority candidates ready for immediate interviews.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitmentInsights;
