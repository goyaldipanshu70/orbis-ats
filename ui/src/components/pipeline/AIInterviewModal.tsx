import { useState, useEffect } from 'react';
import { Bot, Loader2, Search, Send, Clock, Code2, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

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
              id: c.id,
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
      <DialogContent className="sm:max-w-[500px] rounded-xl border-0 shadow-2xl bg-background p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 rounded-t-xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                <Bot className="h-4.5 w-4.5" />
              </div>
              AI Interview Invite
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
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
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Candidate</Label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {candidateName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">{candidateName}</p>
                  <p className="text-xs text-muted-foreground">{candidateEmail}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Candidate</Label>
              {candidatesLoading ? (
                <div className="flex items-center gap-2.5 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-500" /> Loading candidates...
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-4 px-3 text-sm text-muted-foreground rounded-xl border border-dashed border-border/50 bg-muted/10 text-center">
                  No candidates found for this job.
                </div>
              ) : (
                <>
                  {candidates.length > 5 && (
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search candidates..."
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        className="pl-8 h-9 text-sm rounded-lg"
                      />
                    </div>
                  )}
                  <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Choose a candidate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCandidates.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.full_name} -- {c.email}
                        </SelectItem>
                      ))}
                      {filteredCandidates.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No matches</div>
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}

          {/* Interview config section */}
          <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Interview Settings
            </p>

            {/* Interview type */}
            <div className="space-y-1.5">
              <Label htmlFor="interview-type" className="text-sm">Interview Type</Label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger id="interview-type" className="rounded-lg">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max questions slider */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Max Questions</Label>
                <Badge variant="secondary" className="text-xs font-mono bg-background border border-border/50">{maxQuestions}</Badge>
              </div>
              <Slider
                min={5}
                max={15}
                step={1}
                value={[maxQuestions]}
                onValueChange={(val) => setMaxQuestions(val[0])}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/60">
                <span>5 questions</span>
                <span>15 questions</span>
              </div>
            </div>

            {/* Time limit */}
            <div className="space-y-1.5">
              <Label htmlFor="time-limit" className="text-sm flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Time Limit
              </Label>
              <Select value={timeLimit} onValueChange={setTimeLimit}>
                <SelectTrigger id="time-limit" className="rounded-lg">
                  <SelectValue placeholder="Select time limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coding challenge section */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex items-center justify-between">
              <Label htmlFor="include-coding" className="text-sm flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" /> Include Coding Challenge
              </Label>
              <Switch
                id="include-coding"
                checked={includeCoding}
                onCheckedChange={setIncludeCoding}
              />
            </div>

            {/* Coding language (conditional) */}
            {includeCoding && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="coding-language" className="text-sm">Coding Language</Label>
                <Select value={codingLanguage} onValueChange={setCodingLanguage}>
                  <SelectTrigger id="coding-language" className="rounded-lg">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
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
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t bg-muted/20 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={loading} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !resolvedCandidate}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-md shadow-cyan-600/20"
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
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
