import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Clock, CheckCircle2, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { apiClient } from '@/utils/api';

interface InterviewSession {
  id: number;
  status: string;
  interview_type: string;
  overall_score: number | null;
  ai_recommendation: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Props {
  candidateId: number;
  jdId: number;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'completed': return { bg: 'rgba(16,185,129,0.1)', text: 'text-emerald-400', border: '1px solid rgba(16,185,129,0.2)', icon: CheckCircle2 };
    case 'in_progress': return { bg: 'rgba(59,130,246,0.1)', text: 'text-blue-400', border: '1px solid rgba(59,130,246,0.2)', icon: Clock };
    case 'pending': return { bg: 'rgba(245,158,11,0.1)', text: 'text-amber-400', border: '1px solid rgba(245,158,11,0.2)', icon: Clock };
    case 'expired': return { bg: 'var(--orbis-input)', text: 'text-slate-500', border: '1px solid var(--orbis-border)', icon: AlertTriangle };
    case 'cancelled': return { bg: 'rgba(239,68,68,0.1)', text: 'text-red-400', border: '1px solid rgba(239,68,68,0.2)', icon: XCircle };
    default: return { bg: 'var(--orbis-input)', text: 'text-slate-500', border: '1px solid var(--orbis-border)', icon: Clock };
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

export default function AIInterviewResultCard({ candidateId, jdId }: Props) {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionResults, setSessionResults] = useState<Record<number, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAIInterviewSessionsForCandidate(candidateId, jdId);
      setSessions(data || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [candidateId, jdId]);

  useEffect(() => { load(); }, [load]);

  const viewResults = async (sessionId: number) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionId);
    if (!sessionResults[sessionId]) {
      try {
        const results = await apiClient.getAIInterviewResults(sessionId);
        setSessionResults(prev => ({ ...prev, [sessionId]: results }));
      } catch {
        setSessionResults(prev => ({ ...prev, [sessionId]: { error: true } }));
      }
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 space-y-3" style={glassCard}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded bg-white/10" />
          <Skeleton className="h-5 w-44 bg-white/10" />
        </div>
        <Skeleton className="h-16 w-full rounded-lg bg-white/10" />
        <Skeleton className="h-16 w-full rounded-lg bg-white/10" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ ...glassCard, borderStyle: 'dashed' }}>
        <div className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
          <Bot className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-white mb-1">AI Interview</p>
        <p className="text-xs text-slate-500">No AI interview sessions for this candidate.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300" style={glassCard}>
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #1676c0, #a855f7)' }} />
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(22,118,192,0.1)' }}>
            <Bot className="w-4.5 h-4.5 text-blue-400" />
          </div>
          AI Interview Results
          <span className="text-[10px] px-1.5 py-0 h-4 rounded-md inline-flex items-center" style={{ background: 'var(--orbis-input)', color: '#94a3b8', border: '1px solid var(--orbis-border)' }}>{sessions.length}</span>
        </div>

        {/* Sessions */}
        <div className="space-y-3">
          {sessions.map((s) => {
            const style = getStatusStyle(s.status);
            const StatusIcon = style.icon;
            const results = sessionResults[s.id];

            return (
              <div key={s.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--orbis-border)' }}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center ${style.text} text-xs font-semibold px-2 py-0.5 rounded-md`}
                      style={{ background: style.bg, border: style.border }}
                    >
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {s.status.replace('_', ' ')}
                    </span>
                    {s.overall_score != null && (
                      <span className={`text-lg font-bold ${getScoreColor(s.overall_score)}`}>
                        {Math.round(s.overall_score)}<span className="text-xs font-normal text-slate-500 ml-0.5">pts</span>
                      </span>
                    )}
                    {s.ai_recommendation && (
                      <span className="text-[10px] capitalize px-1.5 py-0 rounded-md text-slate-400" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}>
                        {s.ai_recommendation}
                      </span>
                    )}
                  </div>
                  {s.status === 'completed' && (
                    <button
                      onClick={() => viewResults(s.id)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      {expandedSession === s.id ? 'Hide' : 'Details'}
                    </button>
                  )}
                </div>
                <div className="px-3 pb-2 flex items-center gap-3 text-[10px] text-slate-400">
                  <span>Type: {s.interview_type || 'general'}</span>
                  {s.completed_at && <span>Completed: {new Date(s.completed_at).toLocaleDateString()}</span>}
                  {!s.completed_at && s.created_at && <span>Created: {new Date(s.created_at).toLocaleDateString()}</span>}
                </div>

                {expandedSession === s.id && results && !results.error && (
                  <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--orbis-grid)', background: 'var(--orbis-subtle)' }}>
                    {results.evaluation?.score_breakdown && (
                      <div>
                        <p className="text-xs font-medium text-white mb-1">Score Breakdown</p>
                        <div className="grid grid-cols-2 gap-1">
                          {Object.entries(results.evaluation.score_breakdown).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between text-xs px-2 py-1 rounded" style={{ background: 'var(--orbis-card)' }}>
                              <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                              <span className="font-medium text-white">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {results.evaluation?.overall_impression && (
                      <div className="p-2 rounded" style={{ background: 'var(--orbis-card)' }}>
                        <p className="text-xs font-medium text-white mb-0.5">Overall Impression</p>
                        <p className="text-xs text-slate-400">{results.evaluation.overall_impression}</p>
                      </div>
                    )}
                    {results.evaluation?.red_flags && results.evaluation.red_flags.length > 0 && (
                      <div className="p-2 rounded" style={{ background: 'rgba(239,68,68,0.06)' }}>
                        <p className="text-xs font-medium text-red-400 mb-0.5">Red Flags</p>
                        <ul className="space-y-0.5">
                          {results.evaluation.red_flags.map((f: string, i: number) => (
                            <li key={i} className="text-xs text-red-400 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
