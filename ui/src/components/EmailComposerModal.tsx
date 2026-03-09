import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { Send, Eye, EyeOff, Variable } from 'lucide-react';

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
      .replace(/\{\{company_name\}\}/g, 'Intesa')
      .replace(/\{\{job_title\}\}/g, 'Position');
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({ title: 'Missing fields', description: 'Please fill in all fields', variant: 'destructive' });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* To */}
          <div>
            <Label className="text-xs">To</Label>
            <Input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="email@example.com"
              className="mt-1"
            />
          </div>

          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <Label className="text-xs">Template</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name || t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div>
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="mt-1"
            />
          </div>

          {/* Variables */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Variable className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground mr-1">Insert:</span>
            {VARIABLES.map(v => (
              <Badge
                key={v.key}
                variant="outline"
                className="text-[10px] cursor-pointer hover:bg-primary/10"
                onClick={() => insertVariable(v.key)}
              >
                {v.label}
              </Badge>
            ))}
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Body</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={() => setPreview(!preview)}
              >
                {preview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {preview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {preview ? (
              <div
                className="rounded-md border p-3 min-h-[160px] text-sm bg-muted/30 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: resolveVariables(body) }}
              />
            ) : (
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your email..."
                className="min-h-[160px] text-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
