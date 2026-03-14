import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface ApprovalBadgeProps {
  status: string;
}

export default function ApprovalBadge({ status }: ApprovalBadgeProps) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
          <Clock className="w-3 h-3" /> Pending Approval
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          <CheckCircle className="w-3 h-3" /> Approved
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
          <XCircle className="w-3 h-3" /> Rejected
        </span>
      );
    default:
      return null;
  }
}
