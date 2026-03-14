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
} from '@/components/ui/dialog';
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

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};
const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};
const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

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
      <DialogContent
        className="sm:max-w-[520px] border-0 rounded-2xl shadow-2xl p-0"
        style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
      >
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'rgba(27,142,229,0.08)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Send className="h-5 w-5 text-blue-400" />
              Send Offer to {candidateName}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {step === 1
                ? 'Enter the offer details for the candidate.'
                : 'Select document templates to include with the offer email.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="salary" className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-slate-500" />
                  Salary
                </label>
                <div className="flex gap-2">
                  <input
                    id="salary"
                    type="number"
                    placeholder="e.g. 120000"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className="flex-1 h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500"
                    style={glassInput}
                  />
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-[100px] h-11 rounded-xl text-white border-0" style={glassInput}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      <SelectItem value="USD" className="text-slate-200 focus:bg-white/10 focus:text-white">USD</SelectItem>
                      <SelectItem value="EUR" className="text-slate-200 focus:bg-white/10 focus:text-white">EUR</SelectItem>
                      <SelectItem value="GBP" className="text-slate-200 focus:bg-white/10 focus:text-white">GBP</SelectItem>
                      <SelectItem value="INR" className="text-slate-200 focus:bg-white/10 focus:text-white">INR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="startDate" className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Start Date
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none [color-scheme:dark]"
                  style={glassInput}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="positionTitle" className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-slate-500" />
                  Position Title
                </label>
                <input
                  id="positionTitle"
                  type="text"
                  placeholder="e.g. Senior Engineer"
                  value={positionTitle}
                  onChange={(e) => setPositionTitle(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500"
                  style={glassInput}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-500">No document templates available.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {templates.map((template) => (
                    <label
                      key={template.id}
                      className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors"
                      style={{
                        background: selectedTemplateIds.has(template.id) ? 'rgba(27,142,229,0.1)' : 'var(--orbis-card)',
                        border: selectedTemplateIds.has(template.id) ? '1px solid rgba(27,142,229,0.3)' : '1px solid var(--orbis-border)',
                      }}
                    >
                      <Checkbox
                        checked={selectedTemplateIds.has(template.id)}
                        onCheckedChange={() => toggleTemplate(template.id)}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{template.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md shrink-0 text-slate-400" style={{ background: 'var(--orbis-border)' }}>
                          {template.category}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <p className="text-sm text-slate-400">
                Email will be sent to <span className="font-medium text-white">{candidateEmail}</span> with{' '}
                <span className="font-medium text-white">{selectedCount} document{selectedCount !== 1 ? 's' : ''}</span> attached.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          {step === 1 ? (
            <>
              <div />
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 flex items-center gap-1"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50 flex items-center gap-1"
                style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Offer
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
