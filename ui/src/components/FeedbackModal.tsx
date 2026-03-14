import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

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

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.background = 'var(--orbis-hover)';
    e.target.style.borderColor = '#1B8EE5';
    e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.background = 'var(--orbis-input)';
    e.target.style.borderColor = 'var(--orbis-border)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <DialogTitle className="text-white">Interview Feedback — {candidateName}</DialogTitle>
          <DialogDescription className="text-slate-400">Provide your feedback and rating for this interview.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300">Rating</label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} type="button" onClick={() => setRating(v)} aria-label={`Rate ${v} out of 5`} className="focus:outline-none">
                  <Star className={`w-6 h-6 ${v <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500/40'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Recommendation</label>
            <Select value={recommendation} onValueChange={setRecommendation}>
              <SelectTrigger className="mt-1 border-0 text-white" style={selectDrop}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={selectDrop} className="border-0">
                <SelectItem value="strong_yes">Strong Yes</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="strong_no">Strong No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Strengths</label>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="What impressed you?"
              rows={3}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-all placeholder:text-slate-500"
              style={glassInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Concerns</label>
            <textarea
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              placeholder="Any concerns?"
              rows={3}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-all placeholder:text-slate-500"
              style={glassInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Other observations..."
              rows={3}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-all placeholder:text-slate-500"
              style={glassInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all"
            style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
