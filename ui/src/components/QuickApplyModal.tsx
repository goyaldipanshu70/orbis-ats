import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';

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

  const handleQuickApply = async () => {
    if (!user?.resume_url) {
      toast({ title: 'Profile Incomplete', description: 'Please upload a resume in your profile settings first.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Use the standard apply with stored resume URL
      const formData = new FormData();
      // Fetch the stored resume file and submit
      const response = await fetch(user.resume_url);
      const blob = await response.blob();
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" /> Quick Apply
          </DialogTitle>
          <DialogDescription>
            Apply to <strong>{jobTitle}</strong> using your saved profile and resume.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Name:</strong> {user?.first_name} {user?.last_name}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          {user?.phone && <p><strong>Phone:</strong> {user.phone}</p>}
          {user?.resume_url && <p><strong>Resume:</strong> On file</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleQuickApply} disabled={loading || !user?.profile_complete}>
            {loading ? 'Applying...' : 'Confirm & Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
