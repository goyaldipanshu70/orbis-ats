import React from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { AnimatedProgress } from '@/components/ui/animated-progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Star, 
  Flag, 
  TrendingUp, 
  Award, 
  Brain,
  Target,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Lightbulb,
  DollarSign,
  MessageSquare
} from 'lucide-react';

interface DetailedAnalysis {
  strengths: string[];
  areas_for_development: string[];
  unique_value_propositions: string[];
  risk_factors: string[];
}

interface EnhancedCategoryScores {
  technical_skills: number;
  experience_depth: number;
  role_alignment: number;
  education_credentials: number;
  industry_expertise: number;
  leadership_potential: number;
  career_progression: number;
  soft_skills: number;
}

interface CandidateMetadata {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  current_role: string;
  years_of_experience: number;
}

interface EnhancedEvaluation {
  metadata: CandidateMetadata;
  category_scores: EnhancedCategoryScores;
  detailed_analysis: DetailedAnalysis;
  red_flags: string[];
  highlighted_skills: string[];
  ai_recommendation: string;
  recommendation_reasoning: string;
  interview_focus_areas: string[];
  salary_expectation_range?: string;
  notes: string;
  candidate_id: string;
}

interface EnhancedCandidateEvaluationProps {
  evaluation: EnhancedEvaluation;
}

const EnhancedCandidateEvaluation: React.FC<EnhancedCandidateEvaluationProps> = ({ evaluation }) => {
  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'Interview Immediately':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      case 'Interview':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      case 'Consider':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
      case 'Do Not Recommend':
        return 'bg-gradient-to-r from-red-500 to-rose-500 text-white';
      default:
        return 'bg-gradient-to-r from-gray-500 to-slate-500 text-white';
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'Interview Immediately':
        return <CheckCircle className="w-5 h-5" />;
      case 'Interview':
        return <CheckCircle className="w-5 h-5" />;
      case 'Consider':
        return <AlertTriangle className="w-5 h-5" />;
      case 'Do Not Recommend':
        return <XCircle className="w-5 h-5" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  const categoryDetails = {
    technical_skills: { icon: Brain, label: 'Technical Skills', max: 25 },
    experience_depth: { icon: Calendar, label: 'Experience Depth', max: 20 },
    role_alignment: { icon: Target, label: 'Role Alignment', max: 15 },
    education_credentials: { icon: Award, label: 'Education & Credentials', max: 10 },
    industry_expertise: { icon: Briefcase, label: 'Industry Expertise', max: 10 },
    leadership_potential: { icon: TrendingUp, label: 'Leadership Potential', max: 8 },
    career_progression: { icon: Star, label: 'Career Progression', max: 7 },
    soft_skills: { icon: User, label: 'Soft Skills', max: 5 }
  };

  const totalScore = Object.values(evaluation.category_scores).reduce((sum, score) => sum + score, 0);
  const totalPossible = Object.values(categoryDetails).reduce((sum, detail) => sum + detail.max, 0);
  const overallPercentage = (totalScore / totalPossible) * 100;

  return (
    <div className="space-y-6">
      {/* Header with Overall Recommendation */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getRecommendationIcon(evaluation.ai_recommendation)}
              <div>
                <CardTitle className="text-xl text-foreground">AI Recommendation</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Overall Score: {totalScore}/{totalPossible} ({overallPercentage.toFixed(1)}%)
                </CardDescription>
              </div>
            </div>
            <Badge className={`${getRecommendationColor(evaluation.ai_recommendation)} px-4 py-2 text-base font-medium`}>
              {evaluation.ai_recommendation}
            </Badge>
          </div>
          <div className="mt-4">
            <Progress value={overallPercentage} className="h-3" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-card/70 rounded-lg p-4">
            <h4 className="font-semibold text-foreground mb-2">Recommendation Reasoning</h4>
            <p className="text-foreground leading-relaxed">{evaluation.recommendation_reasoning}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidate Information */}
        <Card className="bg-card/70 backdrop-blur-sm border-border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg text-foreground">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Candidate Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                <User className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm text-muted-foreground">Name</span>
                  <div className="font-semibold text-foreground">{evaluation.metadata.full_name}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                <Mail className="w-4 h-4 text-green-600" />
                <div>
                  <span className="text-sm text-muted-foreground">Email</span>
                  <div className="font-semibold text-foreground">{evaluation.metadata.email || 'Not provided'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                <Phone className="w-4 h-4 text-purple-600" />
                <div>
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <div className="font-semibold text-foreground">{evaluation.metadata.phone || 'Not provided'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                <MapPin className="w-4 h-4 text-orange-600" />
                <div>
                  <span className="text-sm text-muted-foreground">Location</span>
                  <div className="font-semibold text-foreground">{evaluation.metadata.location || 'Not specified'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="text-sm text-muted-foreground">Current Role</span>
                  <div className="font-semibold text-foreground">{evaluation.metadata.current_role || 'Not specified'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                <Calendar className="w-4 h-4 text-yellow-600" />
                <div>
                  <span className="text-sm text-muted-foreground">Experience</span>
                  <div className="font-semibold text-foreground">{evaluation.metadata.years_of_experience} years</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Score Breakdown */}
        <Card className="bg-card/70 backdrop-blur-sm border-border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg text-foreground">
              <Star className="w-5 h-5 mr-2 text-yellow-600" />
              Detailed Score Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
              {Object.entries(evaluation.category_scores).map(([key, score]) => {
                const detail = categoryDetails[key as keyof typeof categoryDetails];
                const percentage = (score / detail.max) * 100;
                const Icon = detail.icon;

                return (
                  <motion.div key={key} variants={fadeInUp} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{detail.label}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        {score} / {detail.max}
                      </span>
                    </div>
                    <AnimatedProgress
                      value={percentage}
                      className="h-2"
                      barClassName={
                        percentage >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                        percentage >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                        percentage >= 40 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                        'bg-gradient-to-r from-red-500 to-rose-500'
                      }
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        {evaluation.detailed_analysis.strengths.length > 0 && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-green-800">
                <CheckCircle className="w-5 h-5 mr-2" />
                Key Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.detailed_analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-green-800 text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Areas for Development */}
        {evaluation.detailed_analysis.areas_for_development.length > 0 && (
          <Card className="bg-orange-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-orange-800">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Development Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.detailed_analysis.areas_for_development.map((area, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-orange-800 text-sm">{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Unique Value Propositions */}
        {evaluation.detailed_analysis.unique_value_propositions.length > 0 && (
          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-purple-800">
                <Lightbulb className="w-5 h-5 mr-2" />
                Unique Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.detailed_analysis.unique_value_propositions.map((value, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <Lightbulb className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-purple-800 text-sm">{value}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Risk Factors */}
        {evaluation.detailed_analysis.risk_factors.length > 0 && (
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-red-800">
                <Flag className="w-5 h-5 mr-2" />
                Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.detailed_analysis.risk_factors.map((risk, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <Flag className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-red-800 text-sm">{risk}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Skills and Interview Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Highlighted Skills */}
        {evaluation.highlighted_skills.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-blue-800">
                <Star className="w-5 h-5 mr-2" />
                Key Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {evaluation.highlighted_skills.map((skill, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interview Focus Areas */}
        {evaluation.interview_focus_areas.length > 0 && (
          <Card className="bg-indigo-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-indigo-800">
                <Target className="w-5 h-5 mr-2" />
                Interview Focus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.interview_focus_areas.map((area, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <Target className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <span className="text-indigo-800 text-sm">{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salary Expectation */}
        {evaluation.salary_expectation_range && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-green-800">
                <DollarSign className="w-5 h-5 mr-2" />
                Salary Expectation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-800 font-medium">{evaluation.salary_expectation_range}</p>
            </CardContent>
          </Card>
        )}

        {/* Red Flags */}
        {evaluation.red_flags.length > 0 && (
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-red-800">
                <Flag className="w-5 h-5 mr-2" />
                Red Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {evaluation.red_flags.map((flag, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <Flag className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-red-800 text-sm">{flag}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes */}
      {evaluation.notes && (
        <Card className="bg-muted border-border">
          <CardHeader>
            <CardTitle className="flex items-center text-lg text-foreground">
              <MessageSquare className="w-5 h-5 mr-2" />
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-card p-4 rounded-lg">
              <p className="text-foreground leading-relaxed">{evaluation.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedCandidateEvaluation;
