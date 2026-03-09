import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronRight, ChevronLeft, Send, Save, FileText, Loader2 } from 'lucide-react';

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
  jdId: string;
  jobTitle: string;
  onOfferCreated: () => void;
}

type Currency = 'USD' | 'EUR' | 'GBP' | 'INR';

interface DocumentTemplate {
  id: number;
  name: string;
  category: string;
  description: string;
  content: string;
  variables: string[];
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  INR: '\u20B9',
};

function formatSalary(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOLS[currency]}${amount.toLocaleString()}`;
}

/** Humanize a snake_case variable name */
function varLabel(v: string): string {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Client-side variable substitution for live preview */
function renderContent(content: string, vars: Record<string, string>): string {
  let out = content;
  for (const [k, v] of Object.entries(vars)) {
    if (v) out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

export default function OfferModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  jdId,
  jobTitle,
  onOfferCreated,
}: OfferModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [positionTitle, setPositionTitle] = useState(jobTitle);
  const [salary, setSalary] = useState<number | ''>('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [startDate, setStartDate] = useState('');
  const [department, setDepartment] = useState('');

  // Template state
  const [useTemplate, setUseTemplate] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  // Fetch templates when "Use Template" is toggled on
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      // Fetch all templates (not just offer_letter) so the user can pick any category
      const data = await apiClient.getDocumentTemplates(1, 100);
      setTemplates(data.items);
    } catch (err: any) {
      toast({
        title: 'Failed to load templates',
        description: err.message || 'Could not load document templates.',
        variant: 'destructive',
      });
    } finally {
      setTemplatesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (useTemplate && templates.length === 0 && !templatesLoading) {
      fetchTemplates();
    }
  }, [useTemplate, templates.length, templatesLoading, fetchTemplates]);

  // Fetch full template details when a specific template is selected
  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplate(null);
      setVarValues({});
      return;
    }
    let cancelled = false;
    const fetchDetail = async () => {
      setTemplateLoading(true);
      try {
        const detail = await apiClient.getDocumentTemplate(Number(selectedTemplateId));
        if (!cancelled) {
          setSelectedTemplate(detail);
          // Initialize variable values with empty strings
          const init: Record<string, string> = {};
          (detail.variables || []).forEach((v: string) => {
            init[v] = '';
          });
          setVarValues(init);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast({
            title: 'Failed to load template',
            description: err.message || 'Could not fetch template details.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [selectedTemplateId, toast]);

  const resetForm = () => {
    setStep(1);
    setPositionTitle(jobTitle);
    setSalary('');
    setCurrency('USD');
    setStartDate('');
    setDepartment('');
    setUseTemplate(false);
    setSelectedTemplateId('');
    setSelectedTemplate(null);
    setVarValues({});
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isStep1Valid = positionTitle.trim() !== '' && salary !== '' && salary > 0 && startDate !== '';

  const buildOfferPayload = () => {
    const payload: Record<string, any> = {
      candidate_id: candidateId,
      position_title: positionTitle,
      salary: Number(salary),
      salary_currency: currency,
      start_date: startDate,
      department: department || null,
    };
    if (useTemplate && selectedTemplate) {
      payload.template_id = selectedTemplate.id;
      payload.variables = varValues;
    }
    return payload;
  };

  const handleSaveAsDraft = async () => {
    setIsLoading(true);
    try {
      await apiClient.createOffer(jdId, buildOfferPayload());
      toast({
        title: 'Offer saved as draft',
        description: `Draft offer created for ${candidateName}.`,
      });
      onOfferCreated();
      handleClose();
    } catch (err: any) {
      toast({
        title: 'Failed to save offer',
        description: err.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOffer = async () => {
    setIsLoading(true);
    try {
      const offer = await apiClient.createOffer(jdId, buildOfferPayload());
      await apiClient.sendOffer(offer.id);
      toast({
        title: 'Offer sent',
        description: `Offer has been sent to ${candidateName}.`,
      });
      onOfferCreated();
      handleClose();
    } catch (err: any) {
      toast({
        title: 'Failed to send offer',
        description: err.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 pb-4">
      {[1, 2, 3].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              s < step
                ? 'bg-primary text-primary-foreground'
                : s === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {s < step ? <Check className="h-4 w-4" /> : s}
          </div>
          {i < 2 && (
            <div
              className={`h-0.5 w-8 transition-colors ${
                s < step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="position-title">Position Title</Label>
        <Input
          id="position-title"
          value={positionTitle}
          onChange={(e) => setPositionTitle(e.target.value)}
          placeholder="e.g. Senior Software Engineer"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salary">Salary</Label>
          <Input
            id="salary"
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="e.g. 120000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (&euro;)</SelectItem>
              <SelectItem value="GBP">GBP (&pound;)</SelectItem>
              <SelectItem value="INR">INR (&rupee;)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="start-date">Start Date</Label>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">Department (optional)</Label>
        <Input
          id="department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="e.g. Engineering"
        />
      </div>

      {/* Template toggle */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="use-template" className="text-sm font-medium cursor-pointer">
              Use Document Template
            </Label>
          </div>
          <Switch
            id="use-template"
            checked={useTemplate}
            onCheckedChange={(checked) => {
              setUseTemplate(checked);
              if (!checked) {
                setSelectedTemplateId('');
                setSelectedTemplate(null);
                setVarValues({});
              }
            }}
          />
        </div>

        {useTemplate && (
          <div className="space-y-3 pt-1">
            {/* Template selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Select Template</Label>
              {templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading templates...
                </div>
              ) : (
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        <span className="flex items-center gap-2">
                          <span>{t.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({t.category.replace(/_/g, ' ')})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Template description */}
            {selectedTemplate && selectedTemplate.description && (
              <p className="text-xs text-muted-foreground italic">
                {selectedTemplate.description}
              </p>
            )}

            {/* Variable input fields */}
            {templateLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading template details...
              </div>
            )}

            {selectedTemplate && selectedTemplate.variables.length > 0 && !templateLoading && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Template Variables</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.variables.map((v) => (
                    <div key={v} className="space-y-1">
                      <Label className="text-xs">{varLabel(v)}</Label>
                      <Input
                        placeholder={varLabel(v)}
                        value={varValues[v] || ''}
                        onChange={(e) =>
                          setVarValues((prev) => ({ ...prev, [v]: e.target.value }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="py-2 space-y-4">
      {/* Offer details summary */}
      <div className="rounded-lg border bg-muted/50 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Offer Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Candidate</span>
            <span className="font-medium">{candidateName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position</span>
            <span className="font-medium">{positionTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Salary</span>
            <span className="font-medium">
              {formatSalary(Number(salary), currency)} {currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Start Date</span>
            <span className="font-medium">
              {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          {department && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Department</span>
              <span className="font-medium">{department}</span>
            </div>
          )}
          {useTemplate && selectedTemplate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Template</span>
              <span className="font-medium">{selectedTemplate.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Template content preview */}
      {useTemplate && selectedTemplate && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Document Preview
          </h3>
          <div className="rounded-lg border bg-card p-4 max-h-60 overflow-y-auto">
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground font-mono">
              {renderContent(selectedTemplate.content, varValues)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="py-2 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Send className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">
        You are about to create an offer for{' '}
        <span className="font-medium text-foreground">{candidateName}</span>.
        {useTemplate && selectedTemplate && (
          <>
            {' '}
            Using the <span className="font-medium text-foreground">{selectedTemplate.name}</span> template.
          </>
        )}
        {' '}You can save it as a draft to review later, or send it immediately.
      </p>
    </div>
  );

  const renderFooter = () => {
    if (step === 1) {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </DialogFooter>
      );
    }

    if (step === 2) {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep(1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button onClick={() => setStep(3)}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </DialogFooter>
      );
    }

    return (
      <DialogFooter className="flex gap-2 sm:justify-between">
        <Button variant="outline" onClick={() => setStep(2)} disabled={isLoading}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSaveAsDraft} disabled={isLoading}>
            <Save className="mr-1 h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button onClick={handleSendOffer} disabled={isLoading}>
            <Send className="mr-1 h-4 w-4" />
            {isLoading ? 'Sending...' : 'Send Offer'}
          </Button>
        </div>
      </DialogFooter>
    );
  };

  const stepTitles: Record<number, string> = {
    1: 'Offer Details',
    2: 'Preview Offer',
    3: 'Confirm & Send',
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={useTemplate && step === 2 ? 'sm:max-w-2xl' : 'sm:max-w-lg'}>
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          <DialogDescription>Create and send an offer to {candidateName}.</DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
