import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
          <DialogDescription>
            Schedule an interview for{' '}
            <span className="font-medium text-foreground">{candidateName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Interview Type */}
          <div className="space-y-2">
            <Label htmlFor="interview-type">Interview Type</Label>
            <Select value={interviewType} onValueChange={setInterviewType}>
              <SelectTrigger id="interview-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="in_person">In Person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Date</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-time">Time</Label>
              <Input
                id="scheduled-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Select value={durationMinutes} onValueChange={setDurationMinutes}>
              <SelectTrigger id="duration">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">
              Location <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Conference Room A, Zoom link, etc."
            />
          </div>

          {/* Interviewer Names */}
          <div className="space-y-2">
            <Label htmlFor="interviewers">Interviewers</Label>
            <Input
              id="interviewers"
              type="text"
              value={interviewerNames}
              onChange={(e) => setInterviewerNames(e.target.value)}
              placeholder="e.g. John Smith, Jane Doe"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple names with commas
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or instructions..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Scheduling...' : 'Schedule Interview'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
