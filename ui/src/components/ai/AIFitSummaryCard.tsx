import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, Loader2, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface Strength {
  point: string;
  evidence?: string;
}

interface FitSummary {
  rating: string;
  strengths: Strength[];
  concerns: (string | { point: string; severity?: string })[];
  recommendation: string;
  generated_at: string;
}

interface Props {
  candidateId: number;
  jdId: number;
}

function getRatingStyle(rating: string) {
  const r = rating?.toLowerCase() || '';
  if (r === 'strong') return { bg: 'rgba(16,185,129,0.1)', text: 'text-emerald-400', border: '1px solid rgba(16,185,129,0.2)' };
  if (r === 'good') return { bg: 'rgba(59,130,246,0.1)', text: 'text-blue-400', border: '1px solid rgba(59,130,246,0.2)' };
  if (r === 'moderate') return { bg: 'rgba(245,158,11,0.1)', text: 'text-amber-400', border: '1px solid rgba(245,158,11,0.2)' };
  if (r === 'weak') return { bg: 'rgba(239,68,68,0.1)', text: 'text-red-400', border: '1px solid rgba(239,68,68,0.2)' };
  return { bg: 'var(--orbis-input)', text: 'text-slate-400', border: '1px solid var(--orbis-border)' };
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

  const loadCached = useCallback(async () => {
    setData(null);
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
  }, [candidateId]);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

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

  const glassCard: React.CSSProperties = {
    background: 'var(--orbis-card)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--orbis-border)',
  };

  if (loading) {
    return (
      <div className="rounded-xl p-5 space-y-3" style={glassCard}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded bg-white/10" />
          <Skeleton className="h-5 w-40 bg-white/10" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg bg-white/10" />
        <Skeleton className="h-4 w-full bg-white/10" />
        <Skeleton className="h-4 w-3/4 bg-white/10" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ ...glassCard, borderColor: 'rgba(244,63,94,0.2)' }}>
        <div className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.1)' }}>
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>
        <p className="text-sm font-medium text-white mb-1">AI analysis unavailable</p>
        <p className="text-xs text-slate-500 mb-4">Could not load or generate fit analysis.</p>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ ...glassCard, borderStyle: 'dashed' }}>
        <div className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center" style={{ background: 'rgba(27,142,229,0.1)' }}>
          <Sparkles className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-sm font-medium text-white mb-1">AI Fit Analysis</p>
        <p className="text-xs text-slate-500 mb-4">Generate an AI-powered analysis of this candidate's fit for the role.</p>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 16px rgba(27,142,229,0.25)' }}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? 'Analyzing...' : 'Generate AI Analysis'}
        </button>
      </div>
    );
  }

  const ratingStyle = getRatingStyle(data.rating);

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-300" style={glassCard}>
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #1B8EE5, #1676c0)' }} />
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(27,142,229,0.1)' }}>
              <Sparkles className="w-4.5 h-4.5 text-blue-400" />
            </div>
            AI Fit Analysis
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {generating ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>

        {/* Rating Badge */}
        <div>
          <span
            className={`inline-flex items-center ${ratingStyle.text} text-base font-semibold px-4 py-1.5 rounded-lg`}
            style={{ background: ratingStyle.bg, border: ratingStyle.border }}
          >
            {data.rating}
          </span>
        </div>

        {/* Strengths */}
        {data.strengths && data.strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Strengths
            </h4>
            <div className="space-y-2">
              {data.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-white">
                      {typeof s === 'string' ? s : s.point}
                    </span>
                    {typeof s !== 'string' && s.evidence && (
                      <p className="text-xs text-slate-500 mt-0.5">{s.evidence}</p>
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
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Concerns
            </h4>
            <div className="space-y-2">
              {data.concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-amber-300">
                    {typeof c === 'string' ? c : c.point}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {data.recommendation && (
          <div className="p-3.5 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Recommendation
            </h4>
            <p className="text-sm text-slate-200 leading-relaxed">{data.recommendation}</p>
          </div>
        )}

        {/* Timestamp */}
        {data.generated_at && (
          <p className="text-xs text-slate-400">
            Updated {timeAgo(data.generated_at)}
          </p>
        )}
      </div>
    </div>
  );
}
