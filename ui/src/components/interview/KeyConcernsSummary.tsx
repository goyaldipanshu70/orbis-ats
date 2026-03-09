
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
          Key Concerns & Red Flags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {candidatesWithConcerns.map((evaluation) => (
            <li key={evaluation.evaluation_id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-semibold">{evaluation.candidate_name}</h4>
              <ul className="list-disc list-inside mt-1 text-sm text-red-700">
                {evaluation.red_flags.map((flag, index) => (
                  <li key={index}>{flag}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default KeyConcernsSummary;
