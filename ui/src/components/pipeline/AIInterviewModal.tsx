import { useState, useEffect } from 'react';
import { Bot, Loader2, Search, Send, Clock, Code2, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

interface AIInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId?: number;
  candidateName?: string;
  candidateEmail?: string;
  jdId: number;
  onSent: () => void;
}

interface CandidateOption {
  id: number;
  full_name: string;
  email: string;
}

export default function AIInterviewModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  candidateEmail,
  jdId,
  onSent,
}: AIInterviewModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Candidate selection state (used when no candidate is pre-selected)
  const hasPreselected = !!(candidateId && candidateId > 0 && candidateEmail);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [candidateSearch, setCandidateSearch] = useState('');

  // Interview config
  const [interviewType, setInterviewType] = useState('mixed');
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState('30');
  const [includeCoding, setIncludeCoding] = useState(false);
  const [codingLanguage, setCodingLanguage] = useState('python');

  // Fetch candidates when modal opens without a pre-selected candidate
  useEffect(() => {
    if (!isOpen || hasPreselected) return;
    let cancelled = false;
    (async () => {
      setCandidatesLoading(true);
      try {
        const res = await apiClient.getCandidates(String(jdId), 1, 100);
        if (!cancelled) {
          setCandidates(
            (res.items || []).map((c: any) => ({
              id: c.id ?? Number(c._id) ?? c.profile_id,
              full_name: c.full_name || c.name || 'Unknown',
              email: c.email || '',
            }))
          );
        }
      } catch {
        /* empty */
      }
      if (!cancelled) setCandidatesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen, hasPreselected, jdId]);

  // Derived values for selected candidate
  const resolvedCandidate = hasPreselected
    ? { id: candidateId!, name: candidateName || '', email: candidateEmail! }
    : candidates.find((c) => String(c.id) === selectedCandidateId)
      ? { id: Number(selectedCandidateId), name: candidates.find((c) => String(c.id) === selectedCandidateId)!.full_name, email: candidates.find((c) => String(c.id) === selectedCandidateId)!.email }
      : null;

  const filteredCandidates = candidateSearch
    ? candidates.filter(
        (c) =>
          c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
          c.email.toLowerCase().includes(candidateSearch.toLowerCase())
      )
    : candidates;

  const handleSubmit = async () => {
    if (!resolvedCandidate) {
      toast({ title: 'Select a Candidate', description: 'Please select a candidate to send the invite to.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await apiClient.sendAIInterviewInvite(resolvedCandidate.id, jdId, {
        email: resolvedCandidate.email,
        interview_type: interviewType,
        max_questions: maxQuestions,
        time_limit_minutes: parseInt(timeLimit, 10),
        include_coding: includeCoding,
        coding_language: includeCoding ? codingLanguage : undefined,
      });
      toast({
        title: 'AI Interview Invite Sent',
        description: `Invite sent to ${resolvedCandidate.name} at ${resolvedCandidate.email}.`,
      });
      onSent();
      onClose();
    } catch {
      toast({
        title: 'Failed to Send Invite',
        description: 'An error occurred while sending the AI interview invite. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-[500px] border-0 rounded-2xl shadow-2xl p-0"
        style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'rgba(27,142,229,0.08)' }}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                <Bot className="h-4.5 w-4.5" />
              </div>
              AI Interview Invite
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              {hasPreselected
                ? `Configure and send an AI-powered interview invite to ${candidateName}.`
                : 'Select a candidate and configure the AI interview.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Candidate selection */}
          {hasPreselected ? (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Candidate</span>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {candidateName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{candidateName}</p>
                  <p className="text-xs text-slate-400">{candidateEmail}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Select Candidate</span>
              {candidatesLoading ? (
                <div className="flex items-center gap-2.5 py-3 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-500" /> Loading candidates...
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-4 px-3 text-sm text-slate-500 rounded-xl text-center" style={{ border: '1px dashed var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
                  No candidates found for this job.
                </div>
              ) : (
                <>
                  {candidates.length > 5 && (
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                      <input
                        placeholder="Search candidates..."
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        className="w-full pl-8 h-9 text-sm rounded-lg outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
                        style={glassInput}
                      />
                    </div>
                  )}
                  <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                    <SelectTrigger className="rounded-lg border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Choose a candidate..." />
                    </SelectTrigger>
                    <SelectContent style={selectDrop}>
                      {filteredCandidates.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.full_name} -- {c.email}
                        </SelectItem>
                      ))}
                      {filteredCandidates.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-slate-500">No matches</div>
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}

          {/* Interview config section */}
          <div className="space-y-4 p-4 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Interview Settings
            </p>

            {/* Interview type */}
            <div className="space-y-1.5">
              <label htmlFor="interview-type" className="text-sm text-slate-300 font-medium">Interview Type</label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger id="interview-type" className="rounded-lg border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent style={selectDrop}>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max questions slider */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300 font-medium">Max Questions</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md text-slate-300" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-hover)' }}>{maxQuestions}</span>
              </div>
              <Slider
                min={5}
                max={15}
                step={1}
                value={[maxQuestions]}
                onValueChange={(val) => setMaxQuestions(val[0])}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>5 questions</span>
                <span>15 questions</span>
              </div>
            </div>

            {/* Time limit */}
            <div className="space-y-1.5">
              <label htmlFor="time-limit" className="text-sm text-slate-300 font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" /> Time Limit
              </label>
              <Select value={timeLimit} onValueChange={setTimeLimit}>
                <SelectTrigger id="time-limit" className="rounded-lg border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Select time limit" />
                </SelectTrigger>
                <SelectContent style={selectDrop}>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coding challenge section */}
          <div className="space-y-3 p-4 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <div className="flex items-center justify-between">
              <label htmlFor="include-coding" className="text-sm text-slate-300 font-medium flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-slate-500" /> Include Coding Challenge
              </label>
              <Switch
                id="include-coding"
                checked={includeCoding}
                onCheckedChange={setIncludeCoding}
              />
            </div>

            {/* Coding language (conditional) */}
            {includeCoding && (
              <div className="space-y-1.5 pt-1">
                <label htmlFor="coding-language" className="text-sm text-slate-300 font-medium">Coding Language</label>
                <Select value={codingLanguage} onValueChange={setCodingLanguage}>
                  <SelectTrigger id="coding-language" className="rounded-lg border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent style={selectDrop}>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                    <SelectItem value="rust">Rust</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50"
            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !resolvedCandidate}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" /> Send Invite
              </span>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
