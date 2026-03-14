import { useState, useEffect, useRef, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, RefreshCw, Loader2, TrendingUp, Info } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface SalaryEstimate {
  p25: number;
  p50: number;
  p75: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  source?: string;
}

interface Props {
  jobTitle: string;
  jdId?: number;
  location?: string;
  country?: string;
  seniority?: string;
}

function formatSalary(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getConfidenceColor(confidence: string) {
  switch (confidence) {
    case 'high': return { bg: 'rgba(34,197,94,0.1)', text: 'text-green-400', border: '1px solid rgba(34,197,94,0.2)' };
    case 'medium': return { bg: 'rgba(234,179,8,0.1)', text: 'text-yellow-400', border: '1px solid rgba(234,179,8,0.2)' };
    case 'low': return { bg: 'rgba(249,115,22,0.1)', text: 'text-orange-400', border: '1px solid rgba(249,115,22,0.2)' };
    default: return { bg: 'var(--orbis-input)', text: 'text-slate-400', border: '1px solid var(--orbis-border)' };
  }
}

export default function SalaryInsightsCard({ jobTitle, jdId, location, country, seniority }: Props) {
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<SalaryEstimate | null>(null);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');
  const { toast } = useToast();

  const fetchEstimate = useCallback(async (title: string) => {
    if (!title.trim()) return;

    const queryKey = `${title}|${location}|${country}|${seniority}`;
    if (queryKey === lastQueryRef.current) return;
    lastQueryRef.current = queryKey;

    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.estimateSalary({
        job_title: title.trim(),
        location: location || undefined,
        country: country || undefined,
        seniority: seniority || undefined,
      }) as any;

      const data: SalaryEstimate = {
        p25: res.p25 ?? res.percentile_25 ?? 0,
        p50: res.p50 ?? res.median ?? res.percentile_50 ?? 0,
        p75: res.p75 ?? res.percentile_75 ?? 0,
        currency: res.currency || 'USD',
        confidence: res.confidence || 'medium',
        source: res.source,
      };
      setEstimate(data);
      if (jdId) {
        try { await apiClient.setAICache('job', jdId, 'salary', data); } catch { /* non-critical */ }
      }
    } catch (err: any) {
      setError(true);
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [location, country, seniority, jdId]);

  // Auto-trigger with debounce when jobTitle changes
  useEffect(() => {
    if (!jobTitle.trim()) {
      setEstimate(null);
      setError(false);
      lastQueryRef.current = '';
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEstimate(jobTitle);
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [jobTitle, fetchEstimate]);

  const handleRefresh = () => {
    lastQueryRef.current = '';
    fetchEstimate(jobTitle);
  };

  // Don't render if no job title
  if (!jobTitle.trim() && !loading && !estimate) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: 'rgba(22,118,192,0.1)' }}>
            <DollarSign className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-white">Salary Insights</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center text-[10px] px-1.5 py-0 h-5 rounded-md font-semibold"
            style={{ background: 'rgba(22,118,192,0.1)', color: '#818cf8', border: '1px solid rgba(22,118,192,0.2)' }}
          >
            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            AI-estimated
          </span>
          {estimate && !loading && (
            <button
              type="button"
              onClick={handleRefresh}
              className="h-6 w-6 flex items-center justify-center text-slate-500 hover:text-white transition-colors rounded-md"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-28 bg-white/10" />
            <Skeleton className="h-3 w-full bg-white/10" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-white/10" />
              <Skeleton className="h-4 w-24 bg-white/10" />
              <Skeleton className="h-4 w-20 bg-white/10" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-center justify-between py-1">
            <p className="text-xs text-slate-500">Unable to estimate salary for this role.</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-md text-slate-300 transition-colors"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}

        {/* Data state */}
        {estimate && !loading && (
          <div className="space-y-3">
            {/* Range bar visualization */}
            <div className="relative">
              {/* Track */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, rgba(27,142,229,0.3) 0%, #1B8EE5 50%, rgba(27,142,229,0.3) 100%)',
                    marginLeft: '10%',
                    width: '80%',
                  }}
                />
              </div>

              {/* Labels below */}
              <div className="flex justify-between mt-2">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-medium">P25</p>
                  <p className="text-xs font-semibold text-slate-300">
                    {formatSalary(estimate.p25, estimate.currency)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold" style={{ color: '#4db5f0' }}>Median</p>
                  <p className="text-sm font-bold" style={{ color: '#4db5f0' }}>
                    {formatSalary(estimate.p50, estimate.currency)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-medium">P75</p>
                  <p className="text-xs font-semibold text-slate-300">
                    {formatSalary(estimate.p75, estimate.currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Confidence indicator */}
            <div className="flex items-center justify-between">
              {(() => {
                const cc = getConfidenceColor(estimate.confidence);
                return (
                  <span
                    className={`inline-flex items-center text-[10px] px-1.5 py-0 h-5 rounded-md font-semibold ${cc.text}`}
                    style={{ background: cc.bg, border: cc.border }}
                  >
                    {estimate.confidence} confidence
                  </span>
                );
              })()}
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Info className="w-2.5 h-2.5" />
                Estimates may vary by market
              </span>
            </div>
          </div>
        )}

        {/* Empty/waiting state */}
        {!loading && !error && !estimate && jobTitle.trim() && (
          <div className="flex items-center gap-2 py-1 text-xs text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Estimating salary range...
          </div>
        )}
      </div>
    </div>
  );
}
