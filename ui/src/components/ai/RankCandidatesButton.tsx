import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Loader2 } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface Props {
  jdId: number;
  onRanked?: (rankings: any[]) => void;
}

export default function RankCandidatesButton({ jdId, onRanked }: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRank = async () => {
    setLoading(true);
    try {
      const result = await apiClient.rankCandidates({ jd_id: jdId }) as any;
      const rankings = result.rankings || [];

      // Cache ranking for each candidate
      for (const r of rankings) {
        try {
          await apiClient.setAICache('candidate', r.candidate_id, 'ranking', {
            rank: r.rank,
            composite: r.composite,
            breakdown: r.breakdown,
            weights: r.weights,
            ranked_at: result.ranked_at || new Date().toISOString(),
          });
        } catch {
          // Cache write failure is non-critical
        }
      }

      toast({ title: 'Candidates ranked', description: `${rankings.length} candidate(s) ranked successfully.` });
      onRanked?.(rankings);
    } catch (err: any) {
      toast({ title: 'Ranking failed', description: err.message || 'Could not rank candidates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRank}
      disabled={loading}
      className="rounded-lg text-xs h-8"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5 mr-1.5" />}
      {loading ? 'Ranking...' : 'Rank Candidates'}
    </Button>
  );
}
