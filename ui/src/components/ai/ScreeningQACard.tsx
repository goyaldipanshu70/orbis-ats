import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/utils/api';

interface Props {
  candidateId: number;
  jdId: number;
}

interface DetailedResponse {
  id: number;
  question_id: number;
  question: string;
  question_type: string;
  is_knockout: boolean;
  knockout_condition: string | null;
  response: string;
  is_disqualified: boolean;
  created_at: string;
}

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

export default function ScreeningQACard({ candidateId, jdId }: Props) {
  const [responses, setResponses] = useState<DetailedResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getScreeningResponsesDetailed(candidateId, jdId);
      setResponses(data || []);
    } catch {
      setResponses([]);
    } finally {
      setLoading(false);
    }
  }, [candidateId, jdId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl p-5 space-y-3" style={glassCard}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded bg-white/10" />
          <Skeleton className="h-5 w-44 bg-white/10" />
        </div>
        <Skeleton className="h-4 w-full bg-white/10" />
        <Skeleton className="h-4 w-3/4 bg-white/10" />
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ ...glassCard, borderStyle: 'dashed' }}>
        <div className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
          <ClipboardList className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-white mb-1">Screening Responses</p>
        <p className="text-xs text-slate-500">No screening responses recorded for this candidate.</p>
      </div>
    );
  }

  const disqualifiedCount = responses.filter(r => r.is_disqualified).length;

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300" style={glassCard}>
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <ClipboardList className="w-4.5 h-4.5 text-amber-400" />
            </div>
            Screening Responses
            <span className="text-[10px] px-1.5 py-0 h-4 rounded-md inline-flex items-center" style={{ background: 'var(--orbis-input)', color: '#94a3b8', border: '1px solid var(--orbis-border)' }}>{responses.length}</span>
          </div>
          {disqualifiedCount > 0 && (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
              <ShieldAlert className="w-3 h-3 mr-1" />
              {disqualifiedCount} Knockout{disqualifiedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Responses */}
        <div className="space-y-3">
          {responses.map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-lg"
              style={r.is_disqualified
                ? { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }
                : { background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }
              }
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-white">{r.question}</p>
                {r.is_knockout && (
                  <span className={`inline-flex items-center text-[9px] px-1 py-0 shrink-0 rounded-md border font-semibold ${
                    r.is_disqualified
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {r.is_disqualified ? <XCircle className="w-2.5 h-2.5 mr-0.5" /> : <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                    {r.is_disqualified ? 'Failed' : 'Passed'}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 mt-1">{r.response}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
