import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface BiasFlag {
  phrase: string;
  bias_type: string;
  severity?: string;
  suggestion: string;
  explanation?: string;
}

interface BiasResult {
  score: number;
  flags: BiasFlag[];
  summary?: string;
}

interface Props {
  text: string;
  jdId?: number;
  onFixApplied?: (oldPhrase: string, newPhrase: string) => void;
}

const BIAS_TYPE_COLORS: Record<string, string> = {
  gendered: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  age: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  ability: 'bg-red-500/10 text-red-400 border-red-500/20',
  racial: 'bg-red-500/10 text-red-400 border-red-500/20',
  cultural: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  socioeconomic: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  exclusionary: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  aggressive: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  default: 'bg-white/5 text-slate-400 border-white/10',
};

function getScoreColor(score: number) {
  if (score >= 80) return { bg: 'rgba(34,197,94,0.1)', text: 'text-green-400', border: '1px solid rgba(34,197,94,0.2)' };
  if (score >= 50) return { bg: 'rgba(234,179,8,0.1)', text: 'text-yellow-400', border: '1px solid rgba(234,179,8,0.2)' };
  return { bg: 'rgba(239,68,68,0.1)', text: 'text-red-400', border: '1px solid rgba(239,68,68,0.2)' };
}

export default function JDBiasChecker({ text, jdId, onFixApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BiasResult | null>(null);
  const [checked, setChecked] = useState(false);
  const { toast } = useToast();

  const handleCheck = async () => {
    if (!text.trim()) {
      toast({
        title: 'No text to check',
        description: 'Please write a job description first.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await apiClient.checkJDBias({ text: text.trim() }) as any;
      const biasResult: BiasResult = {
        score: res.score ?? res.inclusivity_score ?? 100,
        flags: (res.flags || res.issues || []).map((f: any) => ({
          phrase: f.phrase || f.flagged_phrase || f.text || '',
          bias_type: f.bias_type || f.type || f.category || 'other',
          severity: f.severity,
          suggestion: f.suggestion || f.replacement || f.alternative || '',
          explanation: f.explanation || f.reason || '',
        })),
        summary: res.summary,
      };
      setResult(biasResult);
      setChecked(true);
      if (jdId) {
        try { await apiClient.setAICache('job', jdId, 'bias-check', biasResult); } catch { /* non-critical */ }
      }
    } catch (err: any) {
      toast({
        title: 'Bias Check Failed',
        description: err?.message || 'Could not check for bias. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptFix = (flag: BiasFlag) => {
    if (onFixApplied && flag.suggestion) {
      onFixApplied(flag.phrase, flag.suggestion);
      setResult(prev =>
        prev
          ? { ...prev, flags: prev.flags.filter(f => f.phrase !== flag.phrase) }
          : prev
      );
      toast({
        title: 'Fix Applied',
        description: `Replaced "${flag.phrase}" with "${flag.suggestion}"`,
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Trigger button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          style={{ background: 'rgba(27,142,229,0.08)', border: '1px solid rgba(27,142,229,0.2)', color: '#4db5f0' }}
          onClick={handleCheck}
          disabled={loading || !text.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              Check for Bias
            </>
          )}
        </button>

        {/* Score badge inline when checked */}
        {checked && result && !loading && (() => {
          const sc = getScoreColor(result.score);
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sc.text}`}
              style={{ background: sc.bg, border: sc.border }}
            >
              Inclusivity Score: {result.score}/100
            </span>
          );
        })()}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-32 bg-white/10" />
            <Skeleton className="h-5 w-20 bg-white/10" />
          </div>
          <Skeleton className="h-12 w-full bg-white/10" />
          <Skeleton className="h-12 w-full bg-white/10" />
        </div>
      )}

      {/* Results */}
      {checked && result && !loading && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          {result.flags.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">All clear! No biased language detected.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500 font-medium">
                {result.flags.length} issue{result.flags.length !== 1 ? 's' : ''} found
              </p>
              {result.flags.map((flag, idx) => {
                const typeColor = BIAS_TYPE_COLORS[flag.bias_type] || BIAS_TYPE_COLORS.default;
                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg p-3"
                    style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }}
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {flag.phrase}
                        </span>
                        <span className={`inline-flex items-center text-[10px] px-1.5 py-0 h-5 rounded-md border ${typeColor}`}>
                          {flag.bias_type}
                        </span>
                      </div>
                      {flag.explanation && (
                        <p className="text-[11px] text-slate-500">{flag.explanation}</p>
                      )}
                      {flag.suggestion && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <ArrowRight className="w-3 h-3" />
                          Suggested: <span className="font-medium text-emerald-400">{flag.suggestion}</span>
                        </div>
                      )}
                    </div>
                    {flag.suggestion && onFixApplied && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 h-7 px-3 text-xs font-semibold rounded-lg shrink-0 transition-all"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
                        onClick={() => handleAcceptFix(flag)}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Accept
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
