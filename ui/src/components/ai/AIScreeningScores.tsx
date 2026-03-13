import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, Star, Loader2, RefreshCw } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface QuestionScore {
  question_id?: number;
  question: string;
  response?: string;
  score: number;
  reasoning: string;
}

interface ScreeningScoreData {
  question_scores: QuestionScore[];
  overall_score: number;
  scored_at: string;
}

interface Props {
  candidateId: number;
  jdId: number;
}

function renderStars(score: number) {
  const stars = [];
  const fullStars = Math.floor(score);
  const remainder = score - fullStars;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
      );
    } else if (i === fullStars && remainder >= 0.5) {
      stars.push(
        <div key={i} className="relative w-4 h-4">
          <Star className="absolute w-4 h-4 text-slate-200 dark:text-slate-700" />
          <div className="absolute overflow-hidden" style={{ width: '50%' }}>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
        </div>
      );
    } else {
      stars.push(
        <Star key={i} className="w-4 h-4 text-slate-200 dark:text-slate-700" />
      );
    }
  }
  return stars;
}

function getOverallScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getOverallScoreBg(score: number) {
  if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
  if (score >= 60) return 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800';
  if (score >= 40) return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
  return 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800';
}

export default function AIScreeningScores({ candidateId, jdId }: Props) {
  const [data, setData] = useState<ScreeningScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const scoreResponses = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await apiClient.scoreScreening({ candidate_id: candidateId, jd_id: jdId }) as any;
      const scored: ScreeningScoreData = {
        question_scores: result.question_scores || [],
        overall_score: result.overall_score ?? 0,
        scored_at: result.scored_at || new Date().toISOString(),
      };
      setData(scored);
      toast({ title: 'Screening responses scored successfully' });
    } catch (err: any) {
      setError(true);
      toast({ title: 'Scoring failed', description: err.message || 'Could not score screening responses', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border/50 rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 p-4 rounded-xl border border-border/40">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Skeleton key={s} className="h-4 w-4 rounded" />
                ))}
              </div>
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border border-dashed border-border/60 rounded-xl shadow-sm">
        <CardContent className="p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/5 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">AI Screening Analysis</p>
          <p className="text-xs text-muted-foreground mb-4">
            Score this candidate's screening responses with AI to get per-question ratings and reasoning.
          </p>
          {error && <p className="text-xs text-red-500 mb-2">Scoring failed. Please try again.</p>}
          <Button size="sm" onClick={scoreResponses} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />}
            {loading ? 'Scoring...' : 'Score Responses'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const overallScore = Math.round(data.overall_score);

  return (
    <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
              <ClipboardCheck className="w-4.5 h-4.5 text-indigo-500" />
            </div>
            AI Screening Analysis
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={scoreResponses}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground rounded-lg h-8"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {loading ? 'Scoring...' : 'Re-score'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall Score */}
        <div className="flex justify-center">
          <div className={`inline-flex flex-col items-center p-5 rounded-2xl border ${getOverallScoreBg(overallScore)}`}>
            <div className={`text-4xl font-bold ${getOverallScoreColor(overallScore)}`}>
              {overallScore}
            </div>
            <div className="text-xs font-medium text-muted-foreground mt-1">Overall Score</div>
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">out of 100</div>
          </div>
        </div>

        {/* Per-Question Cards */}
        {data.question_scores.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Response Scores</h4>
            {data.question_scores.map((qs, idx) => (
              <div
                key={qs.question_id ?? idx}
                className="p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors"
              >
                {/* Question text */}
                <p className="text-sm font-semibold text-foreground mb-1.5">
                  {idx + 1}. {qs.question}
                </p>

                {/* Candidate response */}
                {qs.response && (
                  <p className="text-xs text-muted-foreground mb-2.5 line-clamp-3 leading-relaxed">
                    {qs.response}
                  </p>
                )}

                {/* Score as stars */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex items-center gap-0.5">
                    {renderStars(qs.score)}
                  </div>
                  <span className="text-xs font-semibold text-foreground">{qs.score}/5</span>
                </div>

                {/* Reasoning */}
                <div className="p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {qs.reasoning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {data.scored_at && (
          <p className="text-xs text-muted-foreground">
            Scored {new Date(data.scored_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
