import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Copy, Check, ChevronDown, ChevronRight, Loader2, ClipboardList } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface SuggestedQuestion {
  question: string;
  type: string;
  rationale: string;
}

interface QuestionsData {
  questions: SuggestedQuestion[];
  generated_at: string;
}

interface Props {
  candidateId: number;
  jdId: number;
  interviewType?: string;
}

function getTypeBadgeStyle(type: string): React.CSSProperties {
  const key = type?.toLowerCase() || '';
  if (key.includes('technical')) return { background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' };
  if (key.includes('behavioral') || key.includes('behaviour')) return { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' };
  if (key.includes('situational')) return { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)' };
  if (key.includes('culture') || key.includes('cultural')) return { background: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.25)' };
  return { background: 'var(--orbis-input)', color: '#94a3b8', border: '1px solid var(--orbis-border)' };
}

export default function AISuggestedQuestions({ candidateId, jdId, interviewType }: Props) {
  const [data, setData] = useState<QuestionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const params: { candidate_id: number; jd_id: number; interview_type?: string } = {
        candidate_id: candidateId,
        jd_id: jdId,
      };
      if (interviewType) params.interview_type = interviewType;

      const result = await apiClient.generateInterviewQuestions(params) as any;
      const questions: QuestionsData = {
        questions: result.questions || [],
        generated_at: result.generated_at || new Date().toISOString(),
      };
      setData(questions);
      setIsOpen(true);
      toast({ title: 'Interview questions generated' });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate questions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open && !data && !loading) {
      generate();
    }
  };

  const copyQuestion = async (question: string, index: number) => {
    try {
      await navigator.clipboard.writeText(question);
      setCopiedIndex(index);
      toast({ title: 'Question copied to clipboard' });
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const copyAll = async () => {
    if (!data?.questions.length) return;
    try {
      const text = data.questions
        .map((q, i) => `${i + 1}. [${q.type}] ${q.question}\n   Rationale: ${q.rationale}`)
        .join('\n\n');
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      toast({ title: 'All questions copied to clipboard' });
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' }}
    >
      <div className="h-1 bg-gradient-to-r from-blue-500 to-fuchsia-500" />
      <Collapsible open={isOpen} onOpenChange={handleOpen}>
        <div className="p-5 pb-0">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group">
              <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(27,142,229,0.15)' }}
                >
                  <Sparkles className="w-4.5 h-4.5 text-blue-400" />
                </div>
                AI Suggested Questions
              </div>
              <div className="flex items-center gap-2">
                {!data && !loading && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-md text-slate-400"
                    style={{ border: '1px solid var(--orbis-border)' }}
                  >
                    Click to generate
                  </span>
                )}
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : isOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-5 pt-4 space-y-4">
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3 rounded-xl space-y-2" style={{ border: '1px solid var(--orbis-border)' }}>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-16 rounded-md animate-pulse" style={{ background: 'var(--orbis-hover)' }} />
                      <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: 'var(--orbis-border)' }} />
                    </div>
                    <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--orbis-input)' }} />
                  </div>
                ))}
              </div>
            )}

            {data && !loading && (
              <>
                {/* Actions Bar */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {data.questions.length} questions generated
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyAll}
                      className="flex items-center rounded-lg h-7 px-2.5 text-xs text-slate-300 transition-colors hover:text-white"
                      style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                    >
                      {copiedAll ? (
                        <Check className="w-3 h-3 mr-1 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1" />
                      )}
                      {copiedAll ? 'Copied!' : 'Copy All'}
                    </button>
                    <button
                      onClick={generate}
                      disabled={loading}
                      className="flex items-center rounded-lg h-7 px-2.5 text-xs text-slate-400 hover:text-white transition-colors"
                      style={{ background: 'var(--orbis-card)' }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Regenerate
                    </button>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-2.5">
                  {data.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="group/item p-3.5 rounded-xl transition-colors"
                      style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Type Badge + Question */}
                          <div className="flex items-start gap-2 mb-1.5">
                            <span
                              className="text-[10px] px-1.5 py-0 h-5 rounded-md shrink-0 mt-0.5 inline-flex items-center font-medium"
                              style={getTypeBadgeStyle(q.type)}
                            >
                              {q.type}
                            </span>
                            <p className="text-sm font-medium text-white leading-relaxed">
                              {q.question}
                            </p>
                          </div>

                          {/* Rationale */}
                          {q.rationale && (
                            <p className="text-xs text-slate-400 leading-relaxed ml-0.5">
                              {q.rationale}
                            </p>
                          )}
                        </div>

                        {/* Copy Button */}
                        <button
                          onClick={() => copyQuestion(q.question, idx)}
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity rounded-lg h-7 w-7 flex items-center justify-center shrink-0"
                          style={{ background: 'var(--orbis-input)' }}
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timestamp */}
                {data.generated_at && (
                  <p className="text-xs text-slate-500">
                    Generated {new Date(data.generated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </>
            )}

            {!data && !loading && (
              <div className="text-center py-4">
                <div
                  className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(27,142,229,0.1)' }}
                >
                  <ClipboardList className="w-5 h-5 text-blue-400/60" />
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Generate AI-powered interview questions tailored to this candidate.
                </p>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generate Questions
                </button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
