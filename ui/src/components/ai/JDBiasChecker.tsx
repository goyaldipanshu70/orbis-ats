import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  onFixApplied?: (oldPhrase: string, newPhrase: string) => void;
}

const BIAS_TYPE_COLORS: Record<string, string> = {
  gendered: 'bg-pink-50 text-pink-700 border-pink-200',
  age: 'bg-orange-50 text-orange-700 border-orange-200',
  ability: 'bg-red-50 text-red-700 border-red-200',
  racial: 'bg-red-50 text-red-700 border-red-200',
  cultural: 'bg-amber-50 text-amber-700 border-amber-200',
  socioeconomic: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  default: 'bg-slate-50 text-slate-700 border-slate-200',
};

function getScoreColor(score: number) {
  if (score >= 80) return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', ring: 'ring-green-500/20' };
  if (score >= 50) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', ring: 'ring-yellow-500/20' };
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', ring: 'ring-red-500/20' };
}

export default function JDBiasChecker({ text, onFixApplied }: Props) {
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
      // Remove this flag from results
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs rounded-lg gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
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
        </Button>

        {/* Score badge inline when checked */}
        {checked && result && !loading && (
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreColor(result.score).bg} ${getScoreColor(result.score).text} ${getScoreColor(result.score).border}`}>
            Inclusivity Score: {result.score}/100
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {/* Results */}
      {checked && result && !loading && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          {result.flags.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">All clear! No biased language detected.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground font-medium">
                {result.flags.length} issue{result.flags.length !== 1 ? 's' : ''} found
              </p>
              {result.flags.map((flag, idx) => {
                const typeColor = BIAS_TYPE_COLORS[flag.bias_type] || BIAS_TYPE_COLORS.default;
                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {flag.phrase}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-5 ${typeColor}`}
                        >
                          {flag.bias_type}
                        </Badge>
                      </div>
                      {flag.explanation && (
                        <p className="text-[11px] text-muted-foreground">{flag.explanation}</p>
                      )}
                      {flag.suggestion && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ArrowRight className="w-3 h-3" />
                          Suggested: <span className="font-medium text-green-700">{flag.suggestion}</span>
                        </div>
                      )}
                    </div>
                    {flag.suggestion && onFixApplied && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs rounded-lg shrink-0 border-green-200 text-green-700 hover:bg-green-50"
                        onClick={() => handleAcceptFix(flag)}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Accept
                      </Button>
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
