
import { Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { InterviewEvaluation } from '@/types/api';
import ScoreDisplay from '@/components/ScoreDisplay';
import RecommendationBadge from '@/components/RecommendationBadge';

interface TopCandidatesSummaryProps {
  evaluations: InterviewEvaluation[];
}

const TopCandidatesSummary = ({ evaluations }: TopCandidatesSummaryProps) => {
  const topCandidates = [...evaluations]
    .sort((a, b) => {
      const scoreA = a.score_breakdown?.total_score?.obtained_score ?? 0;
      const scoreB = b.score_breakdown?.total_score?.obtained_score ?? 0;
      return scoreB - scoreA;
    })
    .slice(0, 3);

  if (topCandidates.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Award className="w-5 h-5 mr-2 text-amber-500" />
          Top Candidates Spotlight
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {topCandidates.map((evaluation) => (
            <li key={evaluation.evaluation_id} className="p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">{evaluation.candidate_name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-green-600">Strongest:</span> {evaluation.strongest_competency}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <ScoreDisplay 
                    score={evaluation.score_breakdown?.total_score?.obtained_score ?? 0} 
                    maxScore={evaluation.score_breakdown?.total_score?.max_score ?? 100} 
                    size="md" 
                  />
                  <div className="mt-1">
                    <RecommendationBadge recommendation={evaluation.ai_recommendation} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default TopCandidatesSummary;
