import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

/* -- Styles --------------------------------------------------------------- */

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};
const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};
const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

const glassInputFocusStyle: React.CSSProperties = {
  background: 'var(--orbis-hover)',
  borderColor: '#1B8EE5',
  boxShadow: '0 0 20px rgba(27,142,229,0.15)',
};

/* -- GlassInput helper ---------------------------------------------------- */

function GlassInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      className={`w-full px-3 rounded-lg text-sm outline-none transition-all duration-200 placeholder:text-slate-500 ${className || ''}`}
      style={focused ? { ...glassInput, ...glassInputFocusStyle } : glassInput}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5 text-blue-400" />
            Build Interview Panel for {candidateName}
          </DialogTitle>
          <DialogDescription className="text-slate-400">{jobTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {rounds.map((round, ri) => (
            <div key={ri} className="border border-white/10 rounded-xl p-4 space-y-3 bg-white/[0.03]">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Round {ri + 1}</h4>
                {rounds.length > 1 && (
                  <button
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    onClick={() => removeRound(ri)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Round Type */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Round Type</label>
                  <Select value={round.round_type} onValueChange={v => updateRound(ri, { round_type: v })}>
                    <SelectTrigger className="h-11 rounded-xl text-white border-0" style={glassInput}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      {ROUND_TYPES.map(rt => (
                        <SelectItem key={rt.value} value={rt.value} className="text-slate-200 focus:bg-white/10 focus:text-white">{rt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Duration</label>
                  <Select value={String(round.duration_minutes)} onValueChange={v => updateRound(ri, { duration_minutes: Number(v) })}>
                    <SelectTrigger className="h-11 rounded-xl text-white border-0" style={glassInput}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      {DURATIONS.map(d => (
                        <SelectItem key={d.value} value={String(d.value)} className="text-slate-200 focus:bg-white/10 focus:text-white">{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Date</label>
                  <GlassInput type="date" className="h-9" value={round.scheduled_date} onChange={e => updateRound(ri, { scheduled_date: e.target.value })} />
                </div>

                {/* Time */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Time</label>
                  <GlassInput type="time" className="h-9" value={round.scheduled_time} onChange={e => updateRound(ri, { scheduled_time: e.target.value })} />
                </div>
              </div>

              {/* Meeting Link */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Meeting Link (optional)</label>
                <GlassInput className="h-9" placeholder="https://meet.google.com/..." value={round.meeting_link} onChange={e => updateRound(ri, { meeting_link: e.target.value })} />
              </div>

              {/* Interviewer Selection */}
              <div className="space-y-1.5" ref={activeDropdown === ri ? dropdownRef : undefined}>
                <label className="text-xs text-slate-300">Interviewers</label>

                {/* Selected chips */}
                {round.interviewer_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {round.interviewer_ids.map((id, idx) => (
                      <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {round.interviewer_names[idx]}
                        <button onClick={() => removeInterviewer(ri, id)} className="ml-0.5 rounded-full hover:bg-blue-500/20 p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <GlassInput
                    className="h-9 pl-8 text-sm"
                    placeholder="Search interviewers..."
                    value={activeDropdown === ri ? searchQuery : ''}
                    onFocus={() => { setActiveDropdown(ri); setSearchQuery(''); }}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Dropdown */}
                {activeDropdown === ri && (
                  <div className="border border-white/10 rounded-lg shadow-md max-h-36 overflow-y-auto" style={{ background: 'var(--orbis-card)' }}>
                    {filteredInterviewers.length === 0 ? (
                      <p className="text-xs text-slate-500 p-3 text-center">No interviewers found</p>
                    ) : (
                      filteredInterviewers.map(iv => {
                        const selected = round.interviewer_ids.includes(iv.id);
                        return (
                          <button
                            key={iv.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between transition-colors ${selected ? 'opacity-50' : ''}`}
                            disabled={selected}
                            onClick={() => addInterviewer(ri, iv)}
                          >
                            <div>
                              <span className="font-medium text-white">{iv.full_name}</span>
                              {iv.specializations?.length > 0 && (
                                <span className="text-xs text-slate-500 ml-2">{iv.specializations.slice(0, 2).join(', ')}</span>
                              )}
                            </div>
                            {selected && <span className="text-xs text-slate-500">Added</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={addRound}
            className="w-full px-4 py-2 rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:border-blue-500/30 hover:text-blue-400 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Round
          </button>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors font-medium text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-5 py-2 rounded-lg shadow-md shadow-blue-600/20 font-medium text-sm disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Scheduling...' : 'Schedule All Rounds'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
