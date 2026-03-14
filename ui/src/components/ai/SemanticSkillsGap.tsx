import { useState, useEffect, useCallback } from 'react';
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

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

export default function SemanticSkillsGap({ candidateId, jdId }: Props) {
  const [data, setData] = useState<SkillsGapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const loadCached = useCallback(async () => {
    setData(null);
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
  }, [candidateId]);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

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
      <div className="rounded-xl p-5 space-y-3" style={glassCard}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded bg-white/10" />
          <Skeleton className="h-5 w-44 bg-white/10" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="w-28 h-28 rounded-full bg-white/10" />
        </div>
        <Skeleton className="h-4 w-full bg-white/10" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ ...glassCard, borderStyle: 'dashed' }}>
        <div className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center" style={{ background: 'rgba(27,142,229,0.1)' }}>
          <Target className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-sm font-medium text-white mb-1">Skills Gap Analysis</p>
        <p className="text-xs text-slate-500 mb-4">Analyze how this candidate's skills match the job requirements.</p>
        {error && <p className="text-xs text-rose-400 mb-2">Analysis failed. Please try again.</p>}
        <button
          onClick={analyze}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 16px rgba(27,142,229,0.25)' }}
        >
          {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
          {analyzing ? 'Analyzing...' : 'Analyze Skills'}
        </button>
      </div>
    );
  }

  const matchPct = Math.round(data.match_pct);
  const circumference = 2 * Math.PI * 40;
  const strokeDasharray = `${(matchPct / 100) * circumference} ${circumference}`;

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-300" style={glassCard}>
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #14b8a6, #06b6d4)' }} />
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.1)' }}>
              <Target className="w-4.5 h-4.5 text-teal-400" />
            </div>
            Skills Gap Analysis
          </div>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {analyzing ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>

        {/* Circular Progress Ring */}
        <div className="flex justify-center">
          <div className="w-28 h-28 relative">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="var(--orbis-border)" strokeWidth="6" fill="none" />
              <circle
                cx="50" cy="50" r="40" strokeWidth="6" fill="none" strokeLinecap="round"
                className={matchPct >= 70 ? 'text-emerald-400' : matchPct >= 40 ? 'text-amber-400' : 'text-red-400'}
                stroke="currentColor"
                strokeDasharray={strokeDasharray}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{matchPct}%</div>
                <div className="text-[10px] text-slate-500">Match</div>
              </div>
            </div>
          </div>
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 gap-4">
          {/* Matched Skills */}
          {data.matched && data.matched.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Matched
                <span className="text-[10px] px-1.5 py-0 h-4 ml-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center">{data.matched.length}</span>
              </h4>
              <div className="space-y-2">
                {data.matched.map((m, i) => (
                  <div key={i} className="p-2.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white">
                        <span className="font-medium">{m.required_skill}</span>
                        {m.candidate_skill && m.candidate_skill !== m.required_skill && (
                          <span className="text-slate-500"> &rarr; {m.candidate_skill}</span>
                        )}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-400">
                        {Math.round((m.confidence ?? 1) * 100)}%
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(16,185,129,0.1)' }}>
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
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-400" />
                Missing
                <span className="text-[10px] px-1.5 py-0 h-4 ml-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center">{data.missing.length}</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.missing.map((skill, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bonus Skills */}
          {data.bonus && data.bonus.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-400" />
                Bonus
                <span className="text-[10px] px-1.5 py-0 h-4 ml-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-flex items-center">{data.bonus.length}</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.bonus.map((skill, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timestamp */}
        {data.analyzed_at && (
          <p className="text-xs text-slate-400">
            Analyzed {new Date(data.analyzed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}
