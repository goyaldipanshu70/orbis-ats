import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    case 'high':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'medium':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export default function SalaryInsightsCard({ jobTitle, location, country, seniority }: Props) {
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<SalaryEstimate | null>(null);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');
  const { toast } = useToast();

  const fetchEstimate = async (title: string) => {
    if (!title.trim()) return;

    const queryKey = `${title}|${location}|${country}|${seniority}`;
    if (queryKey === lastQueryRef.current && estimate) return;
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
    } catch (err: any) {
      setError(true);
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  };

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
  }, [jobTitle, location, country, seniority]);

  const handleRefresh = () => {
    lastQueryRef.current = '';
    fetchEstimate(jobTitle);
  };

  // Don't render if no job title
  if (!jobTitle.trim() && !loading && !estimate) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50">
            <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-foreground">Salary Insights</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 bg-indigo-50 text-indigo-600 border-indigo-200"
          >
            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            AI-estimated
          </Badge>
          {estimate && !loading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-center justify-between py-1">
            <p className="text-xs text-muted-foreground">Unable to estimate salary for this role.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px] rounded-md"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Data state */}
        {estimate && !loading && (
          <div className="space-y-3">
            {/* Range bar visualization */}
            <div className="relative">
              {/* Track */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #c7d2fe 0%, #6366f1 50%, #c7d2fe 100%)',
                    marginLeft: '10%',
                    width: '80%',
                  }}
                />
              </div>

              {/* Labels below */}
              <div className="flex justify-between mt-2">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">P25</p>
                  <p className="text-xs font-semibold text-foreground">
                    {formatSalary(estimate.p25, estimate.currency)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-indigo-600 uppercase font-bold">Median</p>
                  <p className="text-sm font-bold text-indigo-700">
                    {formatSalary(estimate.p50, estimate.currency)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">P75</p>
                  <p className="text-xs font-semibold text-foreground">
                    {formatSalary(estimate.p75, estimate.currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Confidence indicator */}
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 ${getConfidenceColor(estimate.confidence)}`}
              >
                {estimate.confidence} confidence
              </Badge>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Info className="w-2.5 h-2.5" />
                Estimates may vary by market
              </span>
            </div>
          </div>
        )}

        {/* Empty/waiting state */}
        {!loading && !error && !estimate && jobTitle.trim() && (
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Estimating salary range...
          </div>
        )}
      </div>
    </div>
  );
}
