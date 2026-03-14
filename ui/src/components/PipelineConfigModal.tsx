import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Settings2, ChevronUp, ChevronDown, Plus, Trash2, RotateCcw, Loader2, GripVertical } from 'lucide-react';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface StageConfig {
  name: string;
  display_name: string;
  sort_order: number;
  color: string;
  is_terminal: boolean;
}

interface PipelineConfigModalProps {
  open: boolean;
  onClose: () => void;
  jdId: number;
  onSaved?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PRESET_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#1B8EE5', label: 'Purple' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#06b6d4', label: 'Cyan' },
];

const DEFAULT_STAGES: StageConfig[] = [
  { name: 'applied', display_name: 'Applied', sort_order: 0, color: '#3b82f6', is_terminal: false },
  { name: 'screening', display_name: 'Screening', sort_order: 1, color: '#f59e0b', is_terminal: false },
  { name: 'ai_interview', display_name: 'AI Interview', sort_order: 2, color: '#1676c0', is_terminal: false },
  { name: 'interview', display_name: 'Interview', sort_order: 3, color: '#1B8EE5', is_terminal: false },
  { name: 'offer', display_name: 'Offer', sort_order: 4, color: '#10b981', is_terminal: false },
  { name: 'hired', display_name: 'Hired', sort_order: 5, color: '#10b981', is_terminal: true },
  { name: 'rejected', display_name: 'Rejected', sort_order: 6, color: '#ef4444', is_terminal: true },
];

const REQUIRED_STAGES = new Set(['applied', 'rejected']);

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function PipelineConfigModal({ open, onClose, jdId, onSaved }: PipelineConfigModalProps) {
  const { toast } = useToast();
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* -- Load current config -------------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient.getPipelineConfig(jdId)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setStages(data.map((s: any, idx: number) => ({
            name: s.name || s.stage_name || `stage_${idx}`,
            display_name: s.display_name || s.name || `Stage ${idx}`,
            sort_order: s.sort_order ?? idx,
            color: s.color || '#3b82f6',
            is_terminal: s.is_terminal ?? false,
          })));
        } else {
          setStages(DEFAULT_STAGES.map(s => ({ ...s })));
        }
      })
      .catch(() => {
        setStages(DEFAULT_STAGES.map(s => ({ ...s })));
      })
      .finally(() => setLoading(false));
  }, [open, jdId]);

  /* -- Handlers ------------------------------------------------------------- */
  const updateStage = (index: number, field: keyof StageConfig, value: any) => {
    setStages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // auto-generate name from display_name
      if (field === 'display_name') {
        next[index].name = String(value).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }
      return next;
    });
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;
    setStages(prev => {
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((s, i) => ({ ...s, sort_order: i }));
    });
  };

  const addStage = () => {
    const newOrder = stages.length;
    setStages(prev => [
      ...prev,
      {
        name: `custom_stage_${newOrder}`,
        display_name: `New Stage`,
        sort_order: newOrder,
        color: '#06b6d4',
        is_terminal: false,
      },
    ]);
  };

  const removeStage = (index: number) => {
    const stage = stages[index];
    if (REQUIRED_STAGES.has(stage.name)) {
      toast({ title: 'Cannot remove', description: `"${stage.display_name}" is a required stage`, variant: 'destructive' });
      return;
    }
    setStages(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i })));
  };

  const resetToDefaults = () => {
    setStages(DEFAULT_STAGES.map(s => ({ ...s })));
    toast({ title: 'Reset', description: 'Pipeline stages reset to defaults' });
  };

  const handleSave = async () => {
    // Validate
    const names = stages.map(s => s.name);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      toast({ title: 'Validation error', description: 'Stage names must be unique', variant: 'destructive' });
      return;
    }
    if (!names.includes('applied') || !names.includes('rejected')) {
      toast({ title: 'Validation error', description: 'Pipeline must include "Applied" and "Rejected" stages', variant: 'destructive' });
      return;
    }
    const hasEmpty = stages.some(s => !s.display_name.trim());
    if (hasEmpty) {
      toast({ title: 'Validation error', description: 'All stages must have a display name', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const orderedStages = stages.map((s, i) => ({ ...s, sort_order: i }));
      await apiClient.setPipelineConfig(jdId, orderedStages);
      toast({ title: 'Saved', description: 'Pipeline configuration updated successfully' });
      onSaved?.();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to save pipeline configuration', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-hover)', background: 'linear-gradient(135deg, rgba(27,142,229,0.15), rgba(99,40,200,0.08))' }}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-md" style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}>
                <Settings2 className="h-4.5 w-4.5" />
              </div>
              Pipeline Configuration
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Customize the hiring pipeline stages for this job. Use arrows to reorder.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
                <p className="text-sm text-slate-400">Loading pipeline...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stages.map((stage, index) => {
                const isRequired = REQUIRED_STAGES.has(stage.name);
                return (
                  <div
                    key={`${stage.name}-${index}`}
                    className="flex items-center gap-2.5 p-3.5 rounded-xl transition-all duration-150 group"
                    style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}
                  >
                    {/* Reorder controls */}
                    <div className="flex flex-col items-center gap-0 shrink-0">
                      <GripVertical className="h-3.5 w-3.5 text-slate-500/40 mb-0.5" />
                      <button
                        className="h-5 w-5 p-0 flex items-center justify-center rounded text-slate-400 hover:text-white transition-colors disabled:opacity-30"
                        onClick={() => moveStage(index, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        className="h-5 w-5 p-0 flex items-center justify-center rounded text-slate-400 hover:text-white transition-colors disabled:opacity-30"
                        onClick={() => moveStage(index, 'down')}
                        disabled={index === stages.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Color indicator bar */}
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />

                    {/* Color picker */}
                    <div className="flex gap-1 shrink-0">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c.value}
                          className={`h-5 w-5 rounded-full border-2 transition-all duration-150 ${
                            stage.color === c.value ? 'border-white scale-110 shadow-sm' : 'border-transparent hover:scale-110 opacity-60 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.value }}
                          onClick={() => updateStage(index, 'color', c.value)}
                          title={c.label}
                        />
                      ))}
                    </div>

                    {/* Stage name input */}
                    <input
                      value={stage.display_name}
                      onChange={e => updateStage(index, 'display_name', e.target.value)}
                      className="flex-1 h-8 text-sm rounded-lg px-3 outline-none transition-all placeholder:text-slate-500"
                      style={glassInput}
                      placeholder="Stage name"
                      disabled={isRequired}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />

                    {/* Terminal toggle */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={stage.is_terminal}
                        onCheckedChange={v => updateStage(index, 'is_terminal', v)}
                        disabled={isRequired}
                      />
                      <label className="text-xs text-slate-400 whitespace-nowrap">Terminal</label>
                    </div>

                    {/* Required badge / Remove button */}
                    {isRequired ? (
                      <span
                        className="text-[10px] shrink-0 px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(27,142,229,0.15)', border: '1px solid rgba(27,142,229,0.3)', color: '#4db5f0' }}
                      >
                        Required
                      </span>
                    ) : (
                      <button
                        className="h-7 w-7 p-0 flex items-center justify-center rounded text-slate-500/50 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                        style={{ background: 'transparent' }}
                        onClick={() => removeStage(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add Stage */}
              <button
                onClick={addStage}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-blue-400 transition-all duration-150"
                style={{ border: '2px dashed var(--orbis-border)', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.4)'; e.currentTarget.style.background = 'rgba(27,142,229,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Plus className="h-4 w-4" /> Add Stage
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-hover)', background: 'var(--orbis-subtle)' }}>
          <div className="flex w-full items-center justify-between">
            <button
              onClick={resetToDefaults}
              disabled={loading || saving}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white flex items-center transition-all disabled:opacity-50"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </button>
            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all disabled:opacity-50"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </span>
                ) : (
                  'Save Configuration'
                )}
              </button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
