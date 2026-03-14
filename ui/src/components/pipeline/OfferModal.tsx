import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronRight, ChevronLeft, Send, Save, FileText, Loader2 } from 'lucide-react';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

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
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors"
            style={{
              background: s <= step ? 'linear-gradient(135deg, #1B8EE5, #1676c0)' : 'var(--orbis-border)',
              color: s <= step ? 'white' : '#94a3b8',
            }}
          >
            {s < step ? <Check className="h-4 w-4" /> : s}
          </div>
          {i < 2 && (
            <div
              className="h-0.5 w-8 rounded-full transition-colors"
              style={{ background: s < step ? '#1B8EE5' : 'var(--orbis-hover)' }}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <label htmlFor="position-title" className="text-sm font-medium text-slate-300">Position Title</label>
        <input
          id="position-title"
          value={positionTitle}
          onChange={(e) => setPositionTitle(e.target.value)}
          placeholder="e.g. Senior Software Engineer"
          className="w-full h-10 px-3 rounded-lg text-sm outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
          style={glassInput}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="salary" className="text-sm font-medium text-slate-300">Salary</label>
          <input
            id="salary"
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="e.g. 120000"
            className="w-full h-10 px-3 rounded-lg text-sm outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
            style={glassInput}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="currency" className="text-sm font-medium text-slate-300">Currency</label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
            <SelectTrigger id="currency" className="border-white/10 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={selectDrop}>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (&euro;)</SelectItem>
              <SelectItem value="GBP">GBP (&pound;)</SelectItem>
              <SelectItem value="INR">INR (&rupee;)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="start-date" className="text-sm font-medium text-slate-300">Start Date</label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
          style={glassInput}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="department" className="text-sm font-medium text-slate-300">Department (optional)</label>
        <input
          id="department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="e.g. Engineering"
          className="w-full h-10 px-3 rounded-lg text-sm outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
          style={glassInput}
        />
      </div>

      {/* Template toggle */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <label htmlFor="use-template" className="text-sm font-medium text-slate-300 cursor-pointer">
              Use Document Template
            </label>
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
              <span className="text-xs text-slate-500">Select Template</span>
              {templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading templates...
                </div>
              ) : (
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent style={selectDrop}>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        <span className="flex items-center gap-2">
                          <span>{t.name}</span>
                          <span className="text-xs text-slate-500">
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
              <p className="text-xs text-slate-500 italic">
                {selectedTemplate.description}
              </p>
            )}

            {/* Variable input fields */}
            {templateLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading template details...
              </div>
            )}

            {selectedTemplate && selectedTemplate.variables.length > 0 && !templateLoading && (
              <div className="space-y-2">
                <span className="text-xs text-slate-500">Template Variables</span>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.variables.map((v) => (
                    <div key={v} className="space-y-1">
                      <span className="text-xs text-slate-400">{varLabel(v)}</span>
                      <input
                        placeholder={varLabel(v)}
                        value={varValues[v] || ''}
                        onChange={(e) =>
                          setVarValues((prev) => ({ ...prev, [v]: e.target.value }))
                        }
                        className="w-full h-8 px-2 rounded-lg text-sm outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
                        style={glassInput}
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
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Offer Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Candidate</span>
            <span className="font-medium text-white">{candidateName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Position</span>
            <span className="font-medium text-white">{positionTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Salary</span>
            <span className="font-medium text-white">
              {formatSalary(Number(salary), currency)} {currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Start Date</span>
            <span className="font-medium text-white">
              {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          {department && (
            <div className="flex justify-between">
              <span className="text-slate-400">Department</span>
              <span className="font-medium text-white">{department}</span>
            </div>
          )}
          {useTemplate && selectedTemplate && (
            <div className="flex justify-between">
              <span className="text-slate-400">Template</span>
              <span className="font-medium text-white">{selectedTemplate.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Template content preview */}
      {useTemplate && selectedTemplate && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Document Preview
          </h3>
          <div className="rounded-xl p-4 max-h-60 overflow-y-auto" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-slate-300 font-mono">
              {renderContent(selectedTemplate.content, varValues)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="py-2 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(27,142,229,0.15)' }}>
        <Send className="h-6 w-6 text-blue-400" />
      </div>
      <p className="text-sm text-slate-400">
        You are about to create an offer for{' '}
        <span className="font-medium text-white">{candidateName}</span>.
        {useTemplate && selectedTemplate && (
          <>
            {' '}
            Using the <span className="font-medium text-white">{selectedTemplate.name}</span> template.
          </>
        )}
        {' '}You can save it as a draft to review later, or send it immediately.
      </p>
    </div>
  );

  const renderFooter = () => {
    if (step === 1) {
      return (
        <div className="flex justify-end gap-2.5 px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white"
            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => setStep(2)}
            disabled={!isStep1Valid}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="flex justify-between px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white flex items-center gap-1"
            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => setStep(3)}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 flex items-center gap-1"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex justify-between px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
        <button
          onClick={() => setStep(2)}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50 flex items-center gap-1"
          style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleSaveAsDraft}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50 flex items-center gap-1"
            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={handleSendOffer}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            <Send className="h-4 w-4" />
            {isLoading ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </div>
    );
  };

  const stepTitles: Record<number, string> = {
    1: 'Offer Details',
    2: 'Preview Offer',
    3: 'Confirm & Send',
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={`${useTemplate && step === 2 ? 'sm:max-w-2xl' : 'sm:max-w-lg'} border-0 rounded-2xl shadow-2xl p-0`}
        style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
      >
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'rgba(27,142,229,0.08)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">{stepTitles[step]}</DialogTitle>
            <DialogDescription className="text-slate-400">Create and send an offer to {candidateName}.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pt-4">
          {renderStepIndicator()}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
