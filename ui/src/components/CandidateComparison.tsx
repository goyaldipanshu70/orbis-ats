import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, 
  TrendingUp, 
  Star, 
  Brain, 
  Target, 
  Award,
  Briefcase,
  Calendar,
  User,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Filter
} from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface Candidate {
  _id: string;
  user_id: string;
  jd_id: string;
  ai_resume_analysis: any;
  created_at: string;
  screening: boolean;
}

interface CandidateComparisonProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

const CandidateComparison: React.FC<CandidateComparisonProps> = ({ jobId, isOpen, onClose }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'recommendation'>('score');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
    }
  }, [isOpen, jobId]);

  const loadCandidates = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getCandidates(jobId);
      setCandidates(response);
    } catch (error) {
      console.error('Error loading candidates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load candidates for comparison.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCandidateSelection = (candidateId: string, checked: boolean) => {
    if (checked) {
      if (selectedCandidates.length < 4) {
        setSelectedCandidates([...selectedCandidates, candidateId]);
      } else {
        toast({
          title: 'Selection Limit',
          description: 'You can compare up to 4 candidates at a time.',
          variant: 'destructive',
        });
      }
    } else {
      setSelectedCandidates(selectedCandidates.filter(id => id !== candidateId));
    }
  };

  const getTotalScore = (candidate: Candidate): number => {
    const scores = candidate.ai_resume_analysis?.category_scores;
    if (!scores) return 0;
    
    // Handle both old and new score formats
    try {
      const scoreValues = Object.values(scores);
      return scoreValues.reduce((sum: number, score: any) => {
        const numScore = typeof score === 'number' ? score : Number(score) || 0;
        return sum + numScore;
      }, 0);
    } catch (error) {
      return 0;
    }
  };

  const getRecommendationPriority = (recommendation: string) => {
    switch (recommendation) {
      case 'Interview Immediately': return 4;
      case 'Interview': return 3;
      case 'Consider': return 2;
      case 'Do Not Recommend': return 1;
      default: return 0;
    }
  };

  const sortedCandidates = [...candidates].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return getTotalScore(b) - getTotalScore(a);
      case 'name':
        return (a.ai_resume_analysis?.metadata?.full_name || '').localeCompare(
          b.ai_resume_analysis?.metadata?.full_name || ''
        );
      case 'recommendation':
        return getRecommendationPriority(b.ai_resume_analysis?.ai_recommendation || '') - 
               getRecommendationPriority(a.ai_resume_analysis?.ai_recommendation || '');
      default:
        return 0;
    }
  });

  const selectedCandidateData = candidates.filter(c => selectedCandidates.includes(c._id));

  const categoryLabels = {
    technical_skills: 'Technical Skills',
    experience_depth: 'Experience Depth',
    role_alignment: 'Role Alignment',
    education_credentials: 'Education',
    industry_expertise: 'Industry Expertise',
    leadership_potential: 'Leadership',
    career_progression: 'Career Growth',
    soft_skills: 'Soft Skills',
    // Legacy format support
    core_skills: 'Core Skills',
    preferred_skills: 'Preferred Skills',
    experience: 'Experience',
    education: 'Education',
    industry_fit: 'Industry Fit'
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'Interview Immediately':
        return 'bg-green-500 text-white';
      case 'Interview':
        return 'bg-blue-500 text-white';
      case 'Consider':
        return 'bg-yellow-500 text-white';
      case 'Do Not Recommend':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">Candidate Comparison</h2>
                <p className="text-muted-foreground">Compare candidates side by side for better hiring decisions</p>
              </div>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading candidates...</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Candidate Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Select Candidates to Compare ({selectedCandidates.length}/4)
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="border border-border rounded-lg px-3 py-1 text-sm"
                    >
                      <option value="score">Sort by Score</option>
                      <option value="name">Sort by Name</option>
                      <option value="recommendation">Sort by Recommendation</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
                {sortedCandidates.map((candidate) => {
                  const totalScore = getTotalScore(candidate);
                  const isSelected = selectedCandidates.includes(candidate._id);
                  
                  return (
                    <div
                      key={candidate._id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-border'
                      }`}
                      onClick={() => handleCandidateSelection(candidate._id, !isSelected)}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={isSelected}
                          onChange={() => {}}
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">
                            {candidate.ai_resume_analysis?.metadata?.full_name || 'Unknown'}
                          </h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-sm text-muted-foreground">Score: {totalScore}</span>
                            <Badge 
                              className={`text-xs ${getRecommendationColor(
                                candidate.ai_resume_analysis?.ai_recommendation || ''
                              )}`}
                            >
                              {candidate.ai_resume_analysis?.ai_recommendation || 'Unknown'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comparison View */}
            {selectedCandidateData.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Comparison Results</h3>

                {/* Overall Scores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Star className="w-5 h-5 mr-2 text-yellow-600" />
                      Overall Scores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {selectedCandidateData.map((candidate) => {
                        const totalScore = getTotalScore(candidate);
                        const percentage = (totalScore / 100) * 100;
                        
                        return (
                          <div key={candidate._id} className="text-center p-4 bg-muted rounded-lg">
                            <h4 className="font-medium text-foreground mb-2">
                              {candidate.ai_resume_analysis?.metadata?.full_name || 'Unknown'}
                            </h4>
                            <div className="text-3xl font-bold text-blue-600 mb-2">
                              {totalScore}
                            </div>
                            <Progress value={percentage} className="mb-2" />
                            <Badge 
                              className={`text-xs ${getRecommendationColor(
                                candidate.ai_resume_analysis?.ai_recommendation || ''
                              )}`}
                            >
                              {candidate.ai_resume_analysis?.ai_recommendation || 'Unknown'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                      Category Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {selectedCandidateData.length > 0 && 
                       Object.keys(selectedCandidateData[0].ai_resume_analysis?.category_scores || {}).map((category) => {
                         const maxScore = category === 'technical_skills' ? 25 : 
                                         category === 'experience_depth' ? 20 :
                                         category === 'role_alignment' ? 15 :
                                         category === 'education_credentials' ? 10 :
                                         category === 'industry_expertise' ? 10 :
                                         category === 'leadership_potential' ? 8 :
                                         category === 'career_progression' ? 7 :
                                         category === 'soft_skills' ? 5 :
                                         category === 'core_skills' ? 40 :
                                         category === 'preferred_skills' ? 20 :
                                         category === 'experience' ? 15 :
                                         category === 'education' ? 10 :
                                         category === 'industry_fit' ? 10 : 5;
                         
                         return (
                           <div key={category} className="space-y-2">
                             <h4 className="font-medium text-foreground">
                               {categoryLabels[category as keyof typeof categoryLabels] || category}
                             </h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                               {selectedCandidateData.map((candidate) => {
                                 const score = candidate.ai_resume_analysis?.category_scores?.[category] || 0;
                                 const percentage = (score / maxScore) * 100;
                                 
                                 return (
                                   <div key={candidate._id} className="flex items-center space-x-2">
                                     <div className="w-20 text-sm text-muted-foreground truncate">
                                       {candidate.ai_resume_analysis?.metadata?.full_name?.split(' ')[0] || 'Unknown'}
                                     </div>
                                     <div className="flex-1">
                                       <Progress value={percentage} className="h-2" />
                                     </div>
                                     <div className="w-12 text-sm font-medium text-foreground">
                                       {score}/{maxScore}
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         );
                       })}
                    </div>
                  </CardContent>
                </Card>

                {/* Key Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Target className="w-5 h-5 mr-2 text-green-600" />
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {selectedCandidateData.map((candidate) => (
                        <div key={candidate._id} className="space-y-3">
                          <h4 className="font-medium text-foreground">
                            {candidate.ai_resume_analysis?.metadata?.full_name || 'Unknown'}
                          </h4>
                          
                          {/* Experience */}
                          <div className="text-sm">
                            <span className="text-muted-foreground">Experience: </span>
                            <span className="font-medium">
                              {candidate.ai_resume_analysis?.metadata?.years_of_experience || 0} years
                            </span>
                          </div>
                          
                          {/* Current Role */}
                          <div className="text-sm">
                            <span className="text-muted-foreground">Current Role: </span>
                            <span className="font-medium">
                              {candidate.ai_resume_analysis?.metadata?.current_role || 'Not specified'}
                            </span>
                          </div>
                          
                          {/* Top Skills */}
                          {candidate.ai_resume_analysis?.highlighted_skills?.length > 0 && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Top Skills: </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {candidate.ai_resume_analysis.highlighted_skills.slice(0, 3).map((skill: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Red Flags */}
                          {candidate.ai_resume_analysis?.red_flags?.length > 0 && (
                            <div className="text-sm">
                              <span className="text-red-600">Red Flags: </span>
                              <span className="text-red-700">
                                {candidate.ai_resume_analysis.red_flags.length}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {selectedCandidateData.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Select candidates to compare
                </h3>
                <p className="text-muted-foreground">
                  Choose up to 4 candidates from the list above to see a detailed comparison
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateComparison;
