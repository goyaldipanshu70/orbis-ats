import { useState, useEffect } from 'react';
import { PipelineStage } from '@/types/api';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  Calendar,
  Briefcase,
  FileText,
  Loader2,
  Send,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface DocumentTemplate {
  id: number;
  name: string;
  category: string;
}

interface OfferStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jdId: number;
  jobTitle: string;
  fromStage: PipelineStage;
  onComplete: (pendingEmailId: number | null) => void;
}

export default function OfferStageModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  candidateEmail,
  jdId,
  jobTitle,
  fromStage,
  onComplete,
}: OfferStageModalProps) {
  const { toast } = useToast();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [salary, setSalary] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [startDate, setStartDate] = useState<string>('');
  const [positionTitle, setPositionTitle] = useState<string>('');

  // Step 2 fields
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset all state and load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSalary('');
      setCurrency('USD');
      setStartDate('');
      setPositionTitle(jobTitle);
      setTemplates([]);
      setSelectedTemplateIds(new Set());
      setIsSubmitting(false);
      loadTemplates();
    }
  }, [isOpen, jobTitle]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await apiClient.getDocumentTemplates(1, 50);
      const items = (response.items || []) as DocumentTemplate[];
      setTemplates(items);

      // Auto-select offer_letter and nda templates
      const autoSelected = new Set<number>();
      items.forEach((t) => {
        if (t.category === 'offer_letter' || t.category === 'nda') {
          autoSelected.add(t.id);
        }
      });
      setSelectedTemplateIds(autoSelected);
    } catch {
      toast({
        title: 'Failed to load templates',
        description: 'Could not fetch document templates.',
        variant: 'destructive',
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  const toggleTemplate = (id: number) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.offerAndMove(candidateId, {
        jd_id: jdId,
        salary: salary ? Number(salary) : undefined,
        salary_currency: currency || undefined,
        start_date: startDate || undefined,
        position_title: positionTitle || undefined,
        template_ids: selectedTemplateIds.size > 0 ? Array.from(selectedTemplateIds) : undefined,
        from_stage: fromStage,
      });
      onComplete(result.pending_email_id ?? null);
    } catch (error: any) {
      toast({
        title: 'Failed to send offer',
        description: error.message || 'An error occurred while sending the offer.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedTemplateIds.size;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Offer to {candidateName}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Enter the offer details for the candidate.'
              : 'Select document templates to include with the offer email.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="salary" className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Salary
              </Label>
              <div className="flex gap-2">
                <Input
                  id="salary"
                  type="number"
                  placeholder="e.g. 120000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="flex-1"
                />
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="positionTitle" className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Position Title
              </Label>
              <Input
                id="positionTitle"
                type="text"
                placeholder="e.g. Senior Engineer"
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No document templates available.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {templates.map((template) => (
                  <label
                    key={template.id}
                    className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedTemplateIds.has(template.id)}
                      onCheckedChange={() => toggleTemplate(template.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{template.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {template.category}
                      </Badge>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Email will be sent to <span className="font-medium">{candidateEmail}</span> with{' '}
              <span className="font-medium">{selectedCount} document{selectedCount !== 1 ? 's' : ''}</span> attached.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex w-full justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Offer
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
