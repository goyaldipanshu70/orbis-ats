import { useState } from 'react';
import { ClipboardCheck, Star, Loader2, RefreshCw } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface QuestionScore {
  question_id?: number;
  question: string;
  response?: string;
  score: number;
  reasoning: string;
}

interface ScreeningScoreData {
  question_scores: QuestionScore[];
  overall_score: number;
  scored_at: string;
}

interface Props {
  candidateId: number;
  jdId: number;
}

function renderStars(score: number) {
  const stars = [];
  const fullStars = Math.floor(score);
  const remainder = score - fullStars;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
      );
    } else if (i === fullStars && remainder >= 0.5) {
      stars.push(
        <div key={i} className="relative w-4 h-4">
          <Star className="absolute w-4 h-4 text-slate-400" />
          <div className="absolute overflow-hidden" style={{ width: '50%' }}>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
        </div>
      );
    } else {
      stars.push(
        <Star key={i} className="w-4 h-4 text-slate-400" />
      );
    }
  }
  return stars;
}

function getOverallScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getOverallScoreBg(score: number): React.CSSProperties {
  if (score >= 80) return { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' };
  if (score >= 60) return { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' };
  if (score >= 40) return { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' };
  return { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' };
}

export default function AIScreeningScores({ candidateId, jdId }: Props) {
  const [data, setData] = useState<ScreeningScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const scoreResponses = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await apiClient.scoreScreening({ candidate_id: candidateId, jd_id: jdId }) as any;
      const scored: ScreeningScoreData = {
        question_scores: result.question_scores || [],
        overall_score: result.overall_score ?? 0,
        scored_at: result.scored_at || new Date().toISOString(),
      };
      setData(scored);
      toast({ title: 'Screening responses scored successfully' });
    } catch (err: any) {
      setError(true);
      toast({ title: 'Scoring failed', description: err.message || 'Could not score screening responses', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' }}
      >
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg animate-pulse" style={{ background: 'var(--orbis-hover)' }} />
            <div className="h-5 w-48 rounded animate-pulse" style={{ background: 'var(--orbis-hover)' }} />
          </div>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full animate-pulse" style={{ background: 'var(--orbis-hover)' }} />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 p-4 rounded-xl" style={{ border: '1px solid var(--orbis-border)' }}>
              <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: 'var(--orbis-hover)' }} />
              <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--orbis-border)' }} />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="h-4 w-4 rounded animate-pulse" style={{ background: 'var(--orbis-hover)' }} />
                ))}
              </div>
              <div className="h-12 w-full rounded-lg animate-pulse" style={{ background: 'var(--orbis-border)' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px dashed var(--orbis-border-strong)' }}
      >
        <div className="p-6 text-center">
          <div
            className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(27,142,229,0.1)' }}
          >
            <ClipboardCheck className="w-5 h-5 text-blue-400/60" />
          </div>
          <p className="text-sm font-medium text-white mb-1">AI Screening Analysis</p>
          <p className="text-xs text-slate-400 mb-4">
            Score this candidate's screening responses with AI to get per-question ratings and reasoning.
          </p>
          {error && <p className="text-xs text-red-400 mb-2">Scoring failed. Please try again.</p>}
          <button
            onClick={scoreResponses}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />}
            {loading ? 'Scoring...' : 'Score Responses'}
          </button>
        </div>
      </div>
    );
  }

  const overallScore = Math.round(data.overall_score);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{ background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' }}
    >
      <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-500" />
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(22,118,192,0.15)' }}
            >
              <ClipboardCheck className="w-4.5 h-4.5 text-blue-400" />
            </div>
            AI Screening Analysis
          </div>
          <button
            onClick={scoreResponses}
            disabled={loading}
            className="flex items-center text-xs text-slate-400 hover:text-white transition-colors rounded-lg px-2 py-1"
            style={{ background: 'var(--orbis-input)' }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {loading ? 'Scoring...' : 'Re-score'}
          </button>
        </div>
      </div>
      <div className="px-5 pb-5 space-y-5">
        {/* Overall Score */}
        <div className="flex justify-center">
          <div
            className="inline-flex flex-col items-center p-5 rounded-2xl"
            style={getOverallScoreBg(overallScore)}
          >
            <div className={`text-4xl font-bold ${getOverallScoreColor(overallScore)}`}>
              {overallScore}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-1">Overall Score</div>
            <div className="text-[10px] text-slate-500 mt-0.5">out of 100</div>
          </div>
        </div>

        {/* Per-Question Cards */}
        {data.question_scores.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Response Scores</h4>
            {data.question_scores.map((qs, idx) => (
              <div
                key={qs.question_id ?? idx}
                className="p-4 rounded-xl transition-colors"
                style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
              >
                {/* Question text */}
                <p className="text-sm font-semibold text-white mb-1.5">
                  {idx + 1}. {qs.question}
                </p>

                {/* Candidate response */}
                {qs.response && (
                  <p className="text-xs text-slate-400 mb-2.5 line-clamp-3 leading-relaxed">
                    {qs.response}
                  </p>
                )}

                {/* Score as stars */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex items-center gap-0.5">
                    {renderStars(qs.score)}
                  </div>
                  <span className="text-xs font-semibold text-white">{qs.score}/5</span>
                </div>

                {/* Reasoning */}
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-border)' }}
                >
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {qs.reasoning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {data.scored_at && (
          <p className="text-xs text-slate-500">
            Scored {new Date(data.scored_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}
