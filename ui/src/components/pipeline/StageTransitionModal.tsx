import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PipelineStage } from '@/types/api';
import { apiClient } from '@/utils/api';
import { AlertTriangle, FileText, ChevronDown, ChevronUp, ArrowRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StageTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string, saveToTalentPool?: boolean) => void;
  candidateName: string;
  fromStage: PipelineStage;
  toStage: PipelineStage;
  isLoading?: boolean;
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  ai_interview: 'AI Interview',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

const STAGE_DOT_COLORS: Record<PipelineStage, string> = {
  applied: 'bg-blue-500',
  screening: 'bg-amber-500',
  ai_interview: 'bg-violet-500',
  interview: 'bg-purple-500',
  offer: 'bg-emerald-500',
  hired: 'bg-green-500',
  rejected: 'bg-red-500',
};

// Map target stages to relevant template categories
const STAGE_TEMPLATE_MAP: Record<string, string[]> = {
  offer: ['offer_letter', 'offer', 'employment'],
  hired: ['employment_contract', 'onboarding', 'welcome'],
  rejected: ['rejection', 'rejection_letter', 'regret'],
};

export default function StageTransitionModal({
  isOpen, onClose, onConfirm, candidateName, fromStage, toStage, isLoading
}: StageTransitionModalProps) {
  const [notes, setNotes] = useState('');
  const [saveToTalentPool, setSaveToTalentPool] = useState(false);
  const isRejection = toStage === 'rejected';

  // Template suggestions
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const keywords = STAGE_TEMPLATE_MAP[toStage];
    if (!keywords) { setTemplates([]); return; }
    apiClient.getTemplates(1, 50)
      .then((data: any) => {
        const items = data?.items || data || [];
        const matched = items.filter((t: any) => {
          const name = (t.name || t.title || '').toLowerCase();
          const cat = (t.category || '').toLowerCase();
          return keywords.some(k => name.includes(k) || cat.includes(k));
        });
        setTemplates(matched);
      })
      .catch(() => setTemplates([]));
  }, [isOpen, toStage]);

  const handleConfirm = () => {
    if (isRejection && !notes.trim()) return;
    onConfirm(notes, isRejection ? saveToTalentPool : undefined);
    setNotes('');
    setSaveToTalentPool(false);
    setSelectedTemplate(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            {isRejection ? (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            Move Candidate
          </DialogTitle>
          <DialogDescription className="text-sm">
            Confirm the pipeline stage transition for <span className="font-semibold text-foreground">{candidateName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Stage transition indicator */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', STAGE_DOT_COLORS[fromStage])} />
              <span className="text-sm font-semibold text-foreground">{STAGE_LABELS[fromStage]}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', STAGE_DOT_COLORS[toStage])} />
              <span className="text-sm font-semibold text-foreground">{STAGE_LABELS[toStage]}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-semibold">
              {isRejection ? 'Rejection reason (required)' : 'Notes (optional)'}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isRejection ? 'Provide a reason for rejection...' : 'Add notes about this transition...'}
              rows={3}
              className="resize-none rounded-xl"
            />
          </div>

          {isRejection && (
            <label className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={saveToTalentPool}
                onChange={(e) => setSaveToTalentPool(e.target.checked)}
                className="rounded border-border h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium text-foreground block">Save to talent pool</span>
                <span className="text-xs text-muted-foreground">Keep for future opportunities</span>
              </div>
            </label>
          )}

          {/* Template suggestions */}
          {templates.length > 0 && (
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center justify-between w-full px-3.5 py-2.5 text-sm font-semibold text-foreground bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Generate Document
                  <Badge variant="secondary" className="text-[10px] font-bold h-5">{templates.length}</Badge>
                </span>
                {showTemplates ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showTemplates && (
                <div className="p-2 space-y-1 border-t border-border/50">
                  {templates.map((t: any) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-all',
                        selectedTemplate?.id === t.id
                          ? 'bg-blue-50 ring-1 ring-blue-200/60 text-blue-700 dark:bg-blue-950/30 dark:ring-blue-800/40 dark:text-blue-300'
                          : 'hover:bg-muted/40 text-muted-foreground'
                      )}
                    >
                      {selectedTemplate?.id === t.id ? (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate font-medium">{t.name || t.title}</span>
                      {t.category && <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{t.category}</Badge>}
                    </button>
                  ))}
                  {selectedTemplate && (
                    <div className="mt-1.5 p-2.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg text-xs text-muted-foreground border border-blue-100/50 dark:border-blue-900/30">
                      Selected: <span className="font-semibold text-foreground">{selectedTemplate.name || selectedTemplate.title}</span>
                      -- will be auto-generated after transition
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (isRejection && !notes.trim())}
            variant={isRejection ? 'destructive' : 'default'}
            className="rounded-lg font-semibold"
          >
            {isLoading ? 'Moving...' : isRejection ? 'Reject Candidate' : 'Confirm Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
