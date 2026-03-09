import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, LogIn, Mail } from 'lucide-react';

interface DuplicateInfo {
  match_reasons: string[];
  message: string;
  matched_name?: string;
  matched_email?: string;
}

interface DuplicateDetectedModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateInfo: DuplicateInfo;
}

const REASON_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
};

const DuplicateDetectedModal = ({ isOpen, onClose, duplicateInfo }: DuplicateDetectedModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">Duplicate Detected</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {duplicateInfo.message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex flex-wrap gap-2">
            {duplicateInfo.match_reasons.map(reason => (
              <Badge key={reason} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                {REASON_LABELS[reason] || reason} match
              </Badge>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            If this is your account, please log in instead. If you believe this is an error, contact support.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            onClick={() => { onClose(); navigate('/login'); }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Log in to existing account
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateDetectedModal;
