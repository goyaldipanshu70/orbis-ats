import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, RefreshCw, Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface MatchedSkill {
  required_skill: string;
  candidate_skill: string;
  confidence: number;
}

interface SkillsGapData {
  match_pct: number;
  matched: MatchedSkill[];
  missing: string[];
  bonus: string[];
  analyzed_at: string;
}

interface Props {
  candidateId: number;
  jdId: number;
}

export default function SemanticSkillsGap({ candidateId, jdId }: Props) {
  const [data, setData] = useState<SkillsGapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCached();
  }, [candidateId, jdId]);

  const loadCached = async () => {
    setLoading(true);
    setError(false);
    try {
      const cached = await apiClient.getAICache('candidate', candidateId, 'skills-gap') as any;
      if (cached && typeof cached.match_pct === 'number') {
        setData(cached as SkillsGapData);
      }
    } catch {
      // No cached data
    } finally {
      setLoading(false);
    }
  };

  const analyze = async () => {
    setAnalyzing(true);
    setError(false);
    try {
      const result = await apiClient.getSkillsGap({ candidate_id: candidateId, jd_id: jdId }) as any;
      const gap: SkillsGapData = {
        match_pct: result.match_pct ?? 0,
        matched: result.matched || [],
        missing: result.missing || [],
        bonus: result.bonus || [],
        analyzed_at: result.analyzed_at || new Date().toISOString(),
      };
      setData(gap);
      try {
        await apiClient.setAICache('candidate', candidateId, 'skills-gap', gap);
      } catch {
        // Cache write failure is non-critical
      }
      toast({ title: 'Skills gap analysis complete' });
    } catch (err: any) {
      setError(true);
      toast({ title: 'Analysis failed', description: err.message || 'Could not analyze skills gap', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border/50 rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-44" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-center">
            <Skeleton className="w-28 h-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border border-dashed border-border/60 rounded-xl shadow-sm">
        <CardContent className="p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/5 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Skills Gap Analysis</p>
          <p className="text-xs text-muted-foreground mb-4">Analyze how this candidate's skills match the job requirements.</p>
          {error && <p className="text-xs text-red-500 mb-2">Analysis failed. Please try again.</p>}
          <Button size="sm" onClick={analyze} disabled={analyzing} className="rounded-xl">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Target className="w-3.5 h-3.5 mr-1.5" />}
            {analyzing ? 'Analyzing...' : 'Analyze Skills'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const matchPct = Math.round(data.match_pct);
  const circumference = 2 * Math.PI * 40;
  const strokeDasharray = `${(matchPct / 100) * circumference} ${circumference}`;

  return (
    <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center">
              <Target className="w-4.5 h-4.5 text-teal-500" />
            </div>
            Skills Gap Analysis
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={analyze}
            disabled={analyzing}
            className="text-xs text-muted-foreground hover:text-foreground rounded-lg h-8"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {analyzing ? 'Analyzing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Circular Progress Ring */}
        <div className="flex justify-center">
          <div className="w-28 h-28 relative">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                className="text-muted/40"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                className={matchPct >= 70 ? 'text-emerald-500' : matchPct >= 40 ? 'text-amber-500' : 'text-red-500'}
                stroke="currentColor"
                strokeDasharray={strokeDasharray}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{matchPct}%</div>
                <div className="text-[10px] text-muted-foreground">Match</div>
              </div>
            </div>
          </div>
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 gap-4">
          {/* Matched Skills */}
          {data.matched && data.matched.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Matched
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1 rounded-md">{data.matched.length}</Badge>
              </h4>
              <div className="space-y-2">
                {data.matched.map((m, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground">
                        <span className="font-medium">{m.required_skill}</span>
                        {m.candidate_skill && m.candidate_skill !== m.required_skill && (
                          <span className="text-muted-foreground"> &rarr; {m.candidate_skill}</span>
                        )}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {Math.round((m.confidence ?? 1) * 100)}%
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.round((m.confidence ?? 1) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {data.missing && data.missing.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500" />
                Missing
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1 rounded-md">{data.missing.length}</Badge>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.missing.map((skill, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 rounded-md">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bonus Skills */}
          {data.bonus && data.bonus.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-500" />
                Bonus
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1 rounded-md">{data.bonus.length}</Badge>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.bonus.map((skill, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 rounded-md">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timestamp */}
        {data.analyzed_at && (
          <p className="text-xs text-muted-foreground">
            Analyzed {new Date(data.analyzed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
