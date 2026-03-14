import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, AlertTriangle, Loader2 } from 'lucide-react';

interface QuickApplyModalProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  onApplied?: () => void;
}

export default function QuickApplyModal({ open, onClose, jobId, jobTitle, onApplied }: QuickApplyModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hasScreeningQuestions, setHasScreeningQuestions] = useState(false);

  useEffect(() => {
    if (open && jobId) {
      apiClient.getPublicScreeningQuestions(jobId).then((questions: any) => {
        setHasScreeningQuestions(questions && questions.length > 0);
      }).catch(() => setHasScreeningQuestions(false));
    }
  }, [open, jobId]);

  const handleQuickApply = async () => {
    if (!user?.resume_url) {
      toast({ title: 'Profile Incomplete', description: 'Please upload a resume in your profile settings first.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      const response = await fetch(user.resume_url);
      if (!response.ok) throw new Error('Failed to fetch resume file. Please re-upload your resume.');
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Resume file is empty. Please re-upload your resume.');
      formData.append('resume_file', blob, 'resume.pdf');
      formData.append('jd_id', jobId);
      if (user.phone) formData.append('phone', user.phone);

      await apiClient.applyToJob(formData);
      toast({ title: 'Applied successfully!' });
      onApplied?.();
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-amber-400" /> Quick Apply
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Apply to <strong className="text-white">{jobTitle}</strong> using your saved profile and resume.
          </DialogDescription>
        </DialogHeader>
        {hasScreeningQuestions && (
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-300">This job has screening questions</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Quick Apply will skip screening questions. Consider applying through the full application form to improve your chances.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-2 text-sm text-slate-400">
          <p><strong className="text-white">Name:</strong> {user?.first_name} {user?.last_name}</p>
          <p><strong className="text-white">Email:</strong> {user?.email}</p>
          {user?.phone && <p><strong className="text-white">Phone:</strong> {user.phone}</p>}
          {user?.resume_url && <p><strong className="text-white">Resume:</strong> On file</p>}
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 transition-all"
            style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-input)'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleQuickApply}
            disabled={loading || !user?.profile_complete}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 16px rgba(27,142,229,0.25)' }}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</> : 'Confirm & Apply'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
