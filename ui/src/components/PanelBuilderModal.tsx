import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, X, Search, Loader2, Users } from 'lucide-react';

interface Interviewer {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  specializations: string[];
  seniority: string;
  department: string;
  is_active: boolean;
  total_interviews: number;
}

interface RoundData {
  round_type: string;
  interviewer_ids: number[];
  interviewer_names: string[];
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  meeting_link: string;
}

interface PanelBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  jdId: number;
  candidateName: string;
  jobTitle: string;
  onSuccess: () => void;
}

const ROUND_TYPES = [
  { value: 'technical', label: 'Technical' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'system_design', label: 'System Design' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
];

const DURATIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
];

const emptyRound = (): RoundData => ({
  round_type: '',
  interviewer_ids: [],
  interviewer_names: [],
  scheduled_date: '',
  scheduled_time: '',
  duration_minutes: 60,
  meeting_link: '',
});

export default function PanelBuilderModal({
  isOpen, onClose, candidateId, jdId, candidateName, jobTitle, onSuccess,
}: PanelBuilderModalProps) {
  const { toast } = useToast();
  const [rounds, setRounds] = useState<RoundData[]>([emptyRound()]);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRounds([emptyRound()]);
    setSearchQuery('');
    setActiveDropdown(null);
    apiClient.getInterviewers({ active_only: true }).then(setInterviewers).catch(() => {
      toast({ title: 'Error', description: 'Failed to load interviewers', variant: 'destructive' });
    });
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateRound = (index: number, updates: Partial<RoundData>) => {
    setRounds(prev => prev.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const addRound = () => setRounds(prev => [...prev, emptyRound()]);

  const removeRound = (index: number) => {
    setRounds(prev => prev.filter((_, i) => i !== index));
  };

  const addInterviewer = (roundIndex: number, interviewer: Interviewer) => {
    const round = rounds[roundIndex];
    if (round.interviewer_ids.includes(interviewer.id)) return;
    updateRound(roundIndex, {
      interviewer_ids: [...round.interviewer_ids, interviewer.id],
      interviewer_names: [...round.interviewer_names, interviewer.full_name],
    });
  };

  const removeInterviewer = (roundIndex: number, interviewerId: number) => {
    const round = rounds[roundIndex];
    const idx = round.interviewer_ids.indexOf(interviewerId);
    if (idx === -1) return;
    updateRound(roundIndex, {
      interviewer_ids: round.interviewer_ids.filter((_, i) => i !== idx),
      interviewer_names: round.interviewer_names.filter((_, i) => i !== idx),
    });
  };

  const filteredInterviewers = interviewers.filter(iv =>
    iv.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    iv.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    iv.specializations?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const validate = (): string | null => {
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      if (!r.round_type) return `Round ${i + 1}: select a round type`;
      if (r.interviewer_ids.length === 0) return `Round ${i + 1}: add at least one interviewer`;
      if (!r.scheduled_date) return `Round ${i + 1}: select a date`;
      if (!r.scheduled_time) return `Round ${i + 1}: select a time`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast({ title: 'Validation Error', description: error, variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        candidate_id: candidateId,
        jd_id: jdId,
        rounds: rounds.map((r, i) => ({
          round_number: i + 1,
          round_type: r.round_type,
          interviewer_ids: r.interviewer_ids,
          interviewer_names: r.interviewer_names,
          scheduled_date: r.scheduled_date,
          scheduled_time: r.scheduled_time,
          duration_minutes: r.duration_minutes,
          meeting_link: r.meeting_link || undefined,
        })),
      };
      await apiClient.createInterviewPanel(payload);
      toast({ title: 'Panel Scheduled', description: `${rounds.length} round(s) scheduled for ${candidateName}` });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create interview panel', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Build Interview Panel for {candidateName}
          </DialogTitle>
          <DialogDescription>{jobTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {rounds.map((round, ri) => (
            <div key={ri} className="border rounded-lg p-4 space-y-3 bg-muted/50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Round {ri + 1}</h4>
                {rounds.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => removeRound(ri)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Round Type */}
                <div className="space-y-1">
                  <Label className="text-xs">Round Type</Label>
                  <Select value={round.round_type} onValueChange={v => updateRound(ri, { round_type: v })}>
                    <SelectTrigger className="h-9 bg-card"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {ROUND_TYPES.map(rt => (
                        <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-1">
                  <Label className="text-xs">Duration</Label>
                  <Select value={String(round.duration_minutes)} onValueChange={v => updateRound(ri, { duration_minutes: Number(v) })}>
                    <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map(d => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" className="h-9 bg-card" value={round.scheduled_date} onChange={e => updateRound(ri, { scheduled_date: e.target.value })} />
                </div>

                {/* Time */}
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input type="time" className="h-9 bg-card" value={round.scheduled_time} onChange={e => updateRound(ri, { scheduled_time: e.target.value })} />
                </div>
              </div>

              {/* Meeting Link */}
              <div className="space-y-1">
                <Label className="text-xs">Meeting Link (optional)</Label>
                <Input className="h-9 bg-card" placeholder="https://meet.google.com/..." value={round.meeting_link} onChange={e => updateRound(ri, { meeting_link: e.target.value })} />
              </div>

              {/* Interviewer Selection */}
              <div className="space-y-1.5" ref={activeDropdown === ri ? dropdownRef : undefined}>
                <Label className="text-xs">Interviewers</Label>

                {/* Selected chips */}
                {round.interviewer_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {round.interviewer_ids.map((id, idx) => (
                      <Badge key={id} variant="secondary" className="pl-2 pr-1 py-0.5 gap-1 text-xs">
                        {round.interviewer_names[idx]}
                        <button onClick={() => removeInterviewer(ri, id)} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8 bg-card text-sm"
                    placeholder="Search interviewers..."
                    value={activeDropdown === ri ? searchQuery : ''}
                    onFocus={() => { setActiveDropdown(ri); setSearchQuery(''); }}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Dropdown */}
                {activeDropdown === ri && (
                  <div className="border rounded-md bg-card shadow-md max-h-36 overflow-y-auto">
                    {filteredInterviewers.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 text-center">No interviewers found</p>
                    ) : (
                      filteredInterviewers.map(iv => {
                        const selected = round.interviewer_ids.includes(iv.id);
                        return (
                          <button
                            key={iv.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between ${selected ? 'opacity-50' : ''}`}
                            disabled={selected}
                            onClick={() => addInterviewer(ri, iv)}
                          >
                            <div>
                              <span className="font-medium">{iv.full_name}</span>
                              {iv.specializations?.length > 0 && (
                                <span className="text-xs text-muted-foreground ml-2">{iv.specializations.slice(0, 2).join(', ')}</span>
                              )}
                            </div>
                            {selected && <span className="text-xs text-muted-foreground">Added</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full" onClick={addRound}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Round
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Scheduling...' : 'Schedule All Rounds'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
