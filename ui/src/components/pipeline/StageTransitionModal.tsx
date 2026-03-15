import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PipelineStage } from '@/types/api';
import { apiClient } from '@/utils/api';
import { AlertTriangle, FileText, ChevronDown, ChevronUp, ArrowRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  applied: '#3b82f6',
  screening: '#f59e0b',
  ai_interview: '#1B8EE5',
  interview: '#a855f7',
  offer: '#10b981',
  hired: '#22c55e',
  rejected: '#ef4444',
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
      <DialogContent
        className="sm:max-w-md border-0 rounded-2xl shadow-2xl p-0"
        style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
      >
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: isRejection ? 'rgba(239,68,68,0.06)' : 'rgba(27,142,229,0.08)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base text-white">
              {isRejection ? (
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                  <ArrowRight className="h-4 w-4 text-blue-400" />
                </div>
              )}
              Move Candidate
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Confirm the pipeline stage transition for <span className="font-semibold text-white">{candidateName}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Stage transition indicator */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: STAGE_DOT_COLORS[fromStage] }} />
              <span className="text-sm font-semibold text-white">{STAGE_LABELS[fromStage]}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: STAGE_DOT_COLORS[toStage] }} />
              <span className="text-sm font-semibold text-white">{STAGE_LABELS[toStage]}</span>
            </div>
          </div>

          {/* Warning when leaving ai_interview without completion */}
          {fromStage === 'ai_interview' && toStage !== 'rejected' && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                If the AI interview hasn't been completed yet, the candidate will skip that evaluation step. Completed AI interviews auto-advance candidates automatically.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-semibold text-slate-300">
              {isRejection ? 'Rejection reason (required)' : 'Notes (optional)'}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={isRejection ? 'Provide a reason for rejection...' : 'Add notes about this transition...'}
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none placeholder:text-slate-500"
              style={glassInput}
            />
          </div>

          {isRejection && (
            <label
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.03]"
              style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
            >
              <input
                type="checkbox"
                checked={saveToTalentPool}
                onChange={(e) => setSaveToTalentPool(e.target.checked)}
                className="rounded border-white/20 h-4 w-4 accent-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-white block">Save to talent pool</span>
                <span className="text-xs text-slate-500">Keep for future opportunities</span>
              </div>
            </label>
          )}

          {/* Template suggestions */}
          {templates.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--orbis-border)' }}>
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center justify-between w-full px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.03]"
                style={{ background: 'var(--orbis-card)' }}
              >
                <span className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  Generate Document
                  <span className="text-[10px] font-bold h-5 leading-5 px-1.5 rounded-md text-slate-400" style={{ background: 'var(--orbis-border)' }}>{templates.length}</span>
                </span>
                {showTemplates ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
              </button>
              {showTemplates && (
                <div className="p-2 space-y-1" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                  {templates.map((t: any) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-all',
                      )}
                      style={{
                        background: selectedTemplate?.id === t.id ? 'rgba(27,142,229,0.1)' : 'transparent',
                        border: selectedTemplate?.id === t.id ? '1px solid rgba(27,142,229,0.25)' : '1px solid transparent',
                        color: selectedTemplate?.id === t.id ? '#c4b5fd' : '#94a3b8',
                      }}
                    >
                      {selectedTemplate?.id === t.id ? (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate font-medium">{t.name || t.title}</span>
                      {t.category && (
                        <span className="text-[9px] ml-auto shrink-0 px-1.5 py-0.5 rounded-md text-slate-500" style={{ border: '1px solid var(--orbis-hover)' }}>
                          {t.category}
                        </span>
                      )}
                    </button>
                  ))}
                  {selectedTemplate && (
                    <div className="mt-1.5 p-2.5 rounded-lg text-xs text-slate-400" style={{ background: 'rgba(27,142,229,0.06)', border: '1px solid rgba(27,142,229,0.1)' }}>
                      Selected: <span className="font-semibold text-white">{selectedTemplate.name || selectedTemplate.title}</span>
                      -- will be auto-generated after transition
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50"
            style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || (isRejection && !notes.trim())}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isRejection ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #1B8EE5, #1676c0)',
              boxShadow: isRejection ? '0 4px 14px rgba(239,68,68,0.2)' : '0 4px 14px rgba(27,142,229,0.2)',
            }}
          >
            {isLoading ? 'Moving...' : isRejection ? 'Reject Candidate' : 'Confirm Move'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
