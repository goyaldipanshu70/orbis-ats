import { useEffect, useState } from "react";
import { Bot, Loader2, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import InterviewResults from "@/components/ai-interview/InterviewResults";
import { apiClient } from "@/utils/api";
import { AIInterviewResults } from "@/types/api";

interface AIInterviewResultsSheetProps {
  sessionId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AIInterviewResultsSheet({
  sessionId,
  open,
  onOpenChange,
}: AIInterviewResultsSheetProps) {
  const [data, setData] = useState<AIInterviewResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId === null) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const results = await apiClient.getAIInterviewResults(sessionId);
        if (!cancelled) {
          setData(results);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load AI interview results."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[600px] sm:w-[700px] overflow-y-auto border-0 shadow-2xl p-0"
        style={{ background: 'var(--orbis-card)', borderLeft: '1px solid var(--orbis-border)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'rgba(27,142,229,0.08)' }}>
          <SheetHeader className="space-y-1.5">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                <Bot className="h-4.5 w-4.5" />
              </div>
              AI Interview Results
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-400">
              Detailed results from the AI-conducted interview session.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-6 py-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(6,182,212,0.1)' }}>
                <Loader2 className="h-7 w-7 animate-spin text-cyan-500" />
              </div>
              <p className="text-sm text-slate-400">Loading interview results...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <p className="text-sm font-medium text-white">{error}</p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-[280px]">
                Please try again or contact support if the issue persists.
              </p>
            </div>
          )}

          {!loading && !error && data && (
            <InterviewResults results={data} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
