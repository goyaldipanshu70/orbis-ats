import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

const typeBadgeStyles: Record<string, string> = {
  technical: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  behavioral: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  situational: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  culture: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

function getTypeBadgeStyle(type: string) {
  const key = type?.toLowerCase() || '';
  if (key.includes('technical')) return typeBadgeStyles.technical;
  if (key.includes('behavioral') || key.includes('behaviour')) return typeBadgeStyles.behavioral;
  if (key.includes('situational')) return typeBadgeStyles.situational;
  if (key.includes('culture') || key.includes('cultural')) return typeBadgeStyles.culture;
  return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
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
    <Card className="border border-border/50 rounded-xl shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
      <Collapsible open={isOpen} onOpenChange={handleOpen}>
        <CardHeader className="pb-0">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-violet-500" />
                </div>
                AI Suggested Questions
              </CardTitle>
              <div className="flex items-center gap-2">
                {!data && !loading && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md font-normal text-muted-foreground">
                    Click to generate
                  </Badge>
                )}
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3 rounded-xl border border-border/40 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-md" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            )}

            {data && !loading && (
              <>
                {/* Actions Bar */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {data.questions.length} questions generated
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyAll}
                      className="rounded-lg h-7 text-xs"
                    >
                      {copiedAll ? (
                        <Check className="w-3 h-3 mr-1 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1" />
                      )}
                      {copiedAll ? 'Copied!' : 'Copy All'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={generate}
                      disabled={loading}
                      className="rounded-lg h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-2.5">
                  {data.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="group/item p-3.5 rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Type Badge + Question */}
                          <div className="flex items-start gap-2 mb-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 rounded-md border shrink-0 mt-0.5 ${getTypeBadgeStyle(q.type)}`}
                            >
                              {q.type}
                            </Badge>
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              {q.question}
                            </p>
                          </div>

                          {/* Rationale */}
                          {q.rationale && (
                            <p className="text-xs text-muted-foreground leading-relaxed ml-0.5">
                              {q.rationale}
                            </p>
                          )}
                        </div>

                        {/* Copy Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyQuestion(q.question, idx)}
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity rounded-lg h-7 w-7 p-0 shrink-0"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timestamp */}
                {data.generated_at && (
                  <p className="text-xs text-muted-foreground">
                    Generated {new Date(data.generated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </>
            )}

            {!data && !loading && (
              <div className="text-center py-4">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/5 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-primary/60" />
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Generate AI-powered interview questions tailored to this candidate.
                </p>
                <Button size="sm" onClick={generate} disabled={loading} className="rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generate Questions
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
