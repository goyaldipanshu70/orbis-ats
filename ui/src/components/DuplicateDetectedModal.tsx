import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, LogIn } from 'lucide-react';

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
      <DialogContent className="sm:max-w-md border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }}>
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <DialogTitle className="text-lg text-white">Duplicate Detected</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-400">
            {duplicateInfo.message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex flex-wrap gap-2">
            {duplicateInfo.match_reasons.map(reason => (
              <span
                key={reason}
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}
              >
                {REASON_LABELS[reason] || reason} match
              </span>
            ))}
          </div>

          <p className="text-sm text-slate-400">
            If this is your account, please log in instead. If you believe this is an error, contact support.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <button
            onClick={() => { onClose(); navigate('/login'); }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}
          >
            <LogIn className="h-4 w-4" />
            Log in to existing account
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all"
            style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateDetectedModal;
