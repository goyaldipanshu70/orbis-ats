import { AlertTriangle } from 'lucide-react';
import type { InterviewEvaluation } from '@/types/api';

interface KeyConcernsSummaryProps {
  evaluations: InterviewEvaluation[];
}

const KeyConcernsSummary = ({ evaluations }: KeyConcernsSummaryProps) => {
  const candidatesWithConcerns = evaluations.filter(e => e.red_flags && e.red_flags.length > 0);

  if (candidatesWithConcerns.length === 0) {
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
          <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />
          Key Concerns & Red Flags
        </h3>
      </div>
      <div className="px-6 py-4">
        <ul className="space-y-3">
          {candidatesWithConcerns.map((evaluation) => (
            <li
              key={evaluation.evaluation_id}
              className="p-3 rounded-lg border border-red-500/20 bg-red-500/10"
            >
              <h4 className="font-semibold text-white">{evaluation.candidate_name}</h4>
              <ul className="list-disc list-inside mt-1 text-sm text-red-400">
                {evaluation.red_flags.map((flag, index) => (
                  <li key={index}>{flag}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default KeyConcernsSummary;
