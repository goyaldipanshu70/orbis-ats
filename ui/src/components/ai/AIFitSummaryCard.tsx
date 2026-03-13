import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, Loader2, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface Strength {
  point: string;
  evidence?: string;
}

interface Concern {
  point: string;
  severity?: string;
}

interface FitSummary {
  rating: string;
  strengths: Strength[];
  concerns: Concern[];
  recommendation: string;
  generated_at: string;
}

interface Props {
  candidateId: number;
  jdId: number;
}

function getRatingStyle(rating: string) {
  const r = rating?.toLowerCase() || '';
  if (r === 'strong') return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' };
  if (r === 'good') return { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' };
  if (r === 'moderate') return { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' };
  if (r === 'weak') return { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' };
  return { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' };
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AIFitSummaryCard({ candidateId, jdId }: Props) {
  const [data, setData] = useState<FitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCached();
  }, [candidateId, jdId]);

  const loadCached = async () => {
    setLoading(true);
    setError(false);
    try {
      const cached = await apiClient.getAICache('candidate', candidateId, 'fit-summary') as any;
      if (cached && cached.rating) {
        setData(cached as FitSummary);
      }
    } catch {
      // No cached data — that's fine
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError(false);
    try {
      const result = await apiClient.getCandidateFitSummary({ candidate_id: candidateId, jd_id: jdId }) as any;
      const summary: FitSummary = {
        rating: result.rating,
        strengths: result.strengths || [],
        concerns: result.concerns || [],
        recommendation: result.recommendation || '',
        generated_at: result.generated_at || new Date().toISOString(),
      };
      setData(summary);
      // Cache the result
      try {
        await apiClient.setAICache('candidate', candidateId, 'fit-summary', summary);
      } catch {
        // Cache write failure is non-critical
      }
      toast({ title: 'AI Fit Analysis generated' });
    } catch (err: any) {
      setError(true);
      toast({ title: 'Analysis failed', description: err.message || 'Could not generate fit analysis', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border/50 rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card className="border border-red-200/60 dark:border-red-900/40 rounded-xl shadow-sm">
        <CardContent className="p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">AI analysis unavailable</p>
          <p className="text-xs text-muted-foreground mb-4">Could not load or generate fit analysis.</p>
          <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="rounded-xl">
            {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border border-dashed border-border/60 rounded-xl shadow-sm">
        <CardContent className="p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/5 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">AI Fit Analysis</p>
          <p className="text-xs text-muted-foreground mb-4">Generate an AI-powered analysis of this candidate's fit for the role.</p>
          <Button size="sm" onClick={generate} disabled={generating} className="rounded-xl">
            {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            {generating ? 'Analyzing...' : 'Generate AI Analysis'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ratingStyle = getRatingStyle(data.rating);

  return (
    <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-violet-500" />
            </div>
            AI Fit Analysis
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={generate}
            disabled={generating}
            className="text-xs text-muted-foreground hover:text-foreground rounded-lg h-8"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {generating ? 'Analyzing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating Badge */}
        <div>
          <Badge className={`${ratingStyle.bg} ${ratingStyle.text} ${ratingStyle.border} border text-base font-semibold px-4 py-1.5 rounded-lg`}>
            {data.rating}
          </Badge>
        </div>

        {/* Strengths */}
        {data.strengths && data.strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Strengths
            </h4>
            <div className="space-y-2">
              {data.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {typeof s === 'string' ? s : s.point}
                    </span>
                    {typeof s !== 'string' && s.evidence && (
                      <p className="text-xs text-muted-foreground mt-0.5">{s.evidence}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Concerns */}
        {data.concerns && data.concerns.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Concerns
            </h4>
            <div className="space-y-2">
              {data.concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-amber-800 dark:text-amber-300">
                    {typeof c === 'string' ? c : c.point}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {data.recommendation && (
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Recommendation
            </h4>
            <p className="text-sm text-foreground leading-relaxed">{data.recommendation}</p>
          </div>
        )}

        {/* Timestamp */}
        {data.generated_at && (
          <p className="text-xs text-muted-foreground">
            Updated {timeAgo(data.generated_at)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
