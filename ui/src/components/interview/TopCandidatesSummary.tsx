import { Award } from 'lucide-react';
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
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--orbis-card)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--orbis-border)',
      }}
    >
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
        <h3 className="flex items-center text-lg font-semibold text-white">
          <Award className="w-5 h-5 mr-2 text-amber-400" />
          Top Candidates Spotlight
        </h3>
      </div>
      <div className="px-6 py-4">
        <ul className="space-y-4">
          {topCandidates.map((evaluation) => (
            <li
              key={evaluation.evaluation_id}
              className="p-3 rounded-lg"
              style={{
                background: 'var(--orbis-card)',
                border: '1px solid var(--orbis-border)',
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-white">{evaluation.candidate_name}</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    <span className="font-medium text-emerald-400">Strongest:</span> {evaluation.strongest_competency}
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
      </div>
    </div>
  );
};

export default TopCandidatesSummary;
