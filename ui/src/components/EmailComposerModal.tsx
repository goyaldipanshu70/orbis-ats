import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { Send, Eye, EyeOff, Variable } from 'lucide-react';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

interface EmailComposerModalProps {
  open: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultName?: string;
  candidateId?: number;
}

const VARIABLES = [
  { key: '{{candidate_name}}', label: 'Candidate Name' },
  { key: '{{job_title}}', label: 'Job Title' },
  { key: '{{company_name}}', label: 'Company Name' },
];

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

export default function EmailComposerModal({ open, onClose, defaultTo, defaultName, candidateId }: EmailComposerModalProps) {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setTo(defaultTo || '');
      setSubject('');
      setBody('');
      setPreview(false);
      // Load email templates
      apiClient.request<any>('/api/admin/templates?category=email')
        .then(data => setTemplates(Array.isArray(data) ? data : data?.items || []))
        .catch(() => {});
    }
  }, [open, defaultTo]);

  const insertVariable = (variable: string) => {
    setBody(prev => prev + variable);
  };

  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find(t => String(t.id) === templateId);
    if (tmpl) {
      setSubject(tmpl.name || tmpl.title || '');
      setBody(tmpl.content || tmpl.body || '');
    }
  };

  const resolveVariables = (text: string) => {
    return text
      .replace(/\{\{candidate_name\}\}/g, defaultName || 'Candidate')
      .replace(/\{\{company_name\}\}/g, 'Orbis')
      .replace(/\{\{job_title\}\}/g, 'Position');
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({ title: 'Missing fields', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      await apiClient.sendAdhocEmail(to, subject, resolveVariables(body), candidateId);
      toast({ title: 'Email sent', description: `Email sent to ${to}` });
      onClose();
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message || 'Failed to send email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Send className="h-4 w-4" /> Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* To */}
          <div>
            <label className="text-xs font-medium text-slate-300">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="email@example.com"
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-500"
              style={glassInput}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-300">Template</label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="mt-1 h-8 text-xs border-0 text-white" style={selectDrop}>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent style={selectDrop} className="border-0">
                  {templates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name || t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-slate-300">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-500"
              style={glassInput}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {/* Variables */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Variable className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 mr-1">Insert:</span>
            {VARIABLES.map(v => (
              <span
                key={v.key}
                className="text-[10px] cursor-pointer px-2 py-0.5 rounded-full transition-colors"
                style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)', color: '#c4b5fd' }}
                onClick={() => insertVariable(v.key)}
              >
                {v.label}
              </span>
            ))}
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">Body</label>
              <button
                className="h-6 px-2 text-[10px] flex items-center gap-1 rounded text-slate-400 transition-colors hover:text-white"
                style={{ background: 'var(--orbis-input)' }}
                onClick={() => setPreview(!preview)}
              >
                {preview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div
                className="rounded-lg p-3 min-h-[160px] text-sm whitespace-pre-wrap text-slate-300"
                style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}
                dangerouslySetInnerHTML={{ __html: resolveVariables(body) }}
              />
            ) : (
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your email..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-all min-h-[160px] placeholder:text-slate-500"
                style={glassInput}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all"
            style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
