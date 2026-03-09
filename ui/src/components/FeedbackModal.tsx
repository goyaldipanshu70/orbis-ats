import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  scheduleId: number;
  candidateName: string;
  onSubmitted?: () => void;
}

export default function FeedbackModal({ open, onClose, scheduleId, candidateName, onSubmitted }: FeedbackModalProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(3);
  const [recommendation, setRecommendation] = useState('neutral');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiClient.submitInterviewFeedback(scheduleId, {
        rating,
        recommendation,
        strengths: strengths || undefined,
        concerns: concerns || undefined,
        notes: notes || undefined,
      });
      toast({ title: 'Feedback submitted successfully' });
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Interview Feedback — {candidateName}</DialogTitle>
          <DialogDescription>Provide your feedback and rating for this interview.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} type="button" onClick={() => setRating(v)} aria-label={`Rate ${v} out of 5`} className="focus:outline-none">
                  <Star className={`w-6 h-6 ${v <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Recommendation</Label>
            <Select value={recommendation} onValueChange={setRecommendation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="strong_yes">Strong Yes</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="strong_no">Strong No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Strengths</Label>
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="What impressed you?" />
          </div>
          <div>
            <Label>Concerns</Label>
            <Textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Any concerns?" />
          </div>
          <div>
            <Label>Additional Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Other observations..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
