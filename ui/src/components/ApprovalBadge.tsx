import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface ApprovalBadgeProps {
  status: string;
}

export default function ApprovalBadge({ status }: ApprovalBadgeProps) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
          <Clock className="w-3 h-3 mr-1" /> Pending Approval
        </Badge>
      );
    case 'approved':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <CheckCircle className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    default:
      return null;
  }
}
