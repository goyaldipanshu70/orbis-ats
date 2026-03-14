import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import AISuggestedQuestions from '@/components/ai/AISuggestedQuestions';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

interface InterviewScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
  jdId: string;
  onScheduled: () => void;
}

export default function InterviewScheduleModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  jdId,
  onScheduled,
}: InterviewScheduleModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [interviewType, setInterviewType] = useState<string>('video');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<string>('60');
  const [location, setLocation] = useState('');
  const [interviewerNames, setInterviewerNames] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setInterviewType('video');
    setScheduledDate('');
    setScheduledTime('');
    setDurationMinutes('60');
    setLocation('');
    setInterviewerNames('');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!scheduledDate || !scheduledTime) {
      toast({
        title: 'Missing required fields',
        description: 'Please select a date and time for the interview.',
        variant: 'destructive',
      });
      return;
    }

    if (!interviewerNames.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Please enter at least one interviewer name.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const names = interviewerNames
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

      await apiClient.scheduleInterview({
        candidate_id: candidateId,
        jd_id: Number(jdId),
        interview_type: interviewType as 'phone' | 'video' | 'in_person',
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        duration_minutes: Number(durationMinutes),
        location: location.trim() || null,
        interviewer_names: names,
        notes: notes.trim() || null,
      });

      toast({
        title: 'Interview scheduled',
        description: `Interview for ${candidateName} has been scheduled successfully.`,
      });

      resetForm();
      onScheduled();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Failed to schedule interview',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-0 rounded-2xl shadow-2xl p-0"
        style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
      >
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'rgba(27,142,229,0.08)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Schedule Interview</DialogTitle>
            <DialogDescription className="text-slate-400">
              Schedule an interview for{' '}
              <span className="font-medium text-white">{candidateName}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Interview Type */}
          <div className="space-y-2">
            <label htmlFor="interview-type" className="text-sm font-medium text-slate-300">Interview Type</label>
            <Select value={interviewType} onValueChange={setInterviewType}>
              <SelectTrigger id="interview-type" className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent style={selectDrop}>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="in_person">In Person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="scheduled-date" className="text-sm font-medium text-slate-300">Date</label>
              <input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
                style={glassInput}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="scheduled-time" className="text-sm font-medium text-slate-300">Time</label>
              <input
                id="scheduled-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
                style={glassInput}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label htmlFor="duration" className="text-sm font-medium text-slate-300">Duration</label>
            <Select value={durationMinutes} onValueChange={setDurationMinutes}>
              <SelectTrigger id="duration" className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent style={selectDrop}>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium text-slate-300">
              Location <span className="text-slate-500 text-xs">(optional)</span>
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Conference Room A, Zoom link, etc."
              className="w-full h-10 px-3 rounded-lg text-sm outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
              style={glassInput}
            />
          </div>

          {/* Interviewer Names */}
          <div className="space-y-2">
            <label htmlFor="interviewers" className="text-sm font-medium text-slate-300">Interviewers</label>
            <input
              id="interviewers"
              type="text"
              value={interviewerNames}
              onChange={(e) => setInterviewerNames(e.target.value)}
              placeholder="e.g. John Smith, Jane Doe"
              className="w-full h-10 px-3 rounded-lg text-sm outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
              style={glassInput}
            />
            <p className="text-xs text-slate-500">
              Separate multiple names with commas
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium text-slate-300">
              Notes <span className="text-slate-500 text-xs">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or instructions..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
              style={glassInput}
            />
          </div>

          {/* AI Suggested Questions */}
          <div className="pt-2">
            <AISuggestedQuestions
              candidateId={candidateId}
              jdId={Number(jdId)}
              interviewType={interviewType}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50"
            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            {isLoading ? 'Scheduling...' : 'Schedule Interview'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
