import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, scaleIn } from '@/lib/animations';
import { Offer } from '@/types/api';
import { apiClient } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Send, CheckCircle, XCircle, MinusCircle, DollarSign, Calendar } from 'lucide-react';

interface OfferTrackerProps {
  jdId: string;
}

const statusConfig: Record<Offer['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-foreground border-border' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' },
  expired: { label: 'Expired', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700' },
};

function formatSalary(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ${currency || 'USD'}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OfferTracker({ jdId }: OfferTrackerProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchOffers = async () => {
    try {
      const data = await apiClient.getOffersForJob(jdId);
      setOffers(data);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to load offers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [jdId]);

  const handleSend = async (offerId: number) => {
    setActionLoading(offerId);
    try {
      await apiClient.sendOffer(offerId);
      toast({ title: 'Offer sent', description: 'The offer has been sent to the candidate.' });
      await fetchOffers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send offer',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (offerId: number, status: 'accepted' | 'declined' | 'withdrawn') => {
    setActionLoading(offerId);
    try {
      await apiClient.updateOfferStatus(offerId, status);
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      toast({ title: `Offer ${label}`, description: `The offer has been marked as ${status}.` });
      await fetchOffers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update offer status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
        <span className="ml-3 text-sm text-muted-foreground">Loading offers...</span>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <DollarSign className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No offers yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Create an offer for a candidate to get started.
        </p>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
      {offers.map((offer) => {
        const config = statusConfig[offer.status];
        const isActionable = offer.status === 'draft' || offer.status === 'sent';
        const isLoading = actionLoading === offer.id;

        return (
          <motion.div
            key={offer.id}
            variants={scaleIn}
            className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Header: candidate + status */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  Candidate #{offer.candidate_id}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{offer.position_title}</p>
              </div>
              <Badge
                variant="outline"
                className={cn('shrink-0 text-xs font-semibold', config.className)}
              >
                {config.label}
              </Badge>
            </div>

            {/* Details */}
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {formatSalary(offer.salary, offer.salary_currency)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Start: {formatDate(offer.start_date)}
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>Created: {formatTimestamp(offer.created_at)}</span>
              <span>Sent: {formatTimestamp(offer.sent_at)}</span>
              <span>Responded: {formatTimestamp(offer.responded_at)}</span>
            </div>

            {/* Actions */}
            {isActionable && (
              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                {offer.status === 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => handleSend(offer.id)}
                    disabled={isLoading}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                )}
                {offer.status === 'sent' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(offer.id, 'accepted')}
                      disabled={isLoading}
                      className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-950/40"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mark Accepted
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(offer.id, 'declined')}
                      disabled={isLoading}
                      className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/40"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Mark Declined
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(offer.id, 'withdrawn')}
                      disabled={isLoading}
                      className="gap-1.5 text-gray-700 border-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800/40"
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                      Withdraw
                    </Button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
