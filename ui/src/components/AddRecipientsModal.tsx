import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import {
  ClipboardPaste, Upload, Users, FileUp, X, Check, Search,
  AlertCircle, FileSpreadsheet, Loader2,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Style constants                                                           */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface ImportedRecipient {
  email: string;
  name?: string;
  company?: string;
  valid: boolean;
}

interface TalentPoolCandidate {
  id: string;
  candidate_name: string;
  email: string;
  current_stage?: string;
  overall_score?: number;
}

interface AddRecipientsModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: number;
  onRecipientsAdded: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): ImportedRecipient[] {
  const tokens = raw
    .split(/[,;\n\r]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  return tokens.map(token => {
    const email = token.toLowerCase();
    const valid = EMAIL_REGEX.test(email) && !seen.has(email);
    if (EMAIL_REGEX.test(email)) seen.add(email);
    return { email: token, valid };
  });
}

function parseCSVRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === '\t') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function AddRecipientsModal({
  open, onClose, campaignId, onRecipientsAdded,
}: AddRecipientsModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('paste');
  const [submitting, setSubmitting] = useState(false);

  /* -- Tab 1: Paste Emails ------------------------------------------------ */
  const [pasteText, setPasteText] = useState('');
  const [parsedEmails, setParsedEmails] = useState<ImportedRecipient[]>([]);

  const handlePasteChange = useCallback((value: string) => {
    setPasteText(value);
    if (value.trim()) {
      setParsedEmails(parseEmails(value));
    } else {
      setParsedEmails([]);
    }
  }, []);

  const validPasteCount = parsedEmails.filter(e => e.valid).length;
  const invalidPasteCount = parsedEmails.filter(e => !e.valid).length;

  const handleAddPastedEmails = async () => {
    const valid = parsedEmails.filter(e => e.valid);
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      await apiClient.addCampaignRecipients(
        campaignId,
        valid.map(e => ({ email: e.email.toLowerCase() })),
      );
      toast({ title: 'Recipients added', description: `${valid.length} recipients added to campaign` });
      setPasteText('');
      setParsedEmails([]);
      onRecipientsAdded();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to add recipients', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  /* -- Tab 2: Upload File ------------------------------------------------- */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [emailColIdx, setEmailColIdx] = useState<string>('');
  const [nameColIdx, setNameColIdx] = useState<string>('');
  const [companyColIdx, setCompanyColIdx] = useState<string>('');
  const [fileRecipients, setFileRecipients] = useState<ImportedRecipient[]>([]);

  const processFileText = (text: string, fileName: string) => {
    const rows = parseCSVRows(text);
    if (rows.length === 0) {
      toast({ title: 'Empty file', description: 'No data found in the uploaded file', variant: 'destructive' });
      return;
    }
    setUploadedFileName(fileName);
    setCsvHeaders(rows[0]);
    setCsvRows(rows.slice(1));
    setFileRecipients([]);
    const headerLower = rows[0].map(h => h.toLowerCase());
    const emailIdx = headerLower.findIndex(h => h.includes('email') || h.includes('e-mail'));
    const nameIdx = headerLower.findIndex(h => h.includes('name') || h.includes('full_name') || h.includes('fullname'));
    const companyIdx = headerLower.findIndex(h => h.includes('company') || h.includes('organization') || h.includes('org'));
    if (emailIdx >= 0) setEmailColIdx(String(emailIdx));
    if (nameIdx >= 0) setNameColIdx(String(nameIdx));
    if (companyIdx >= 0) setCompanyColIdx(String(companyIdx));
  };

  const handleFileUpload = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'tsv', 'txt', 'vcf'].includes(ext || '')) {
      toast({ title: 'Unsupported format', description: 'Please upload a CSV, TSV, or VCF file', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      if (ext === 'vcf') {
        const contacts: string[][] = [['Name', 'Email']];
        const cards = text.split('BEGIN:VCARD');
        for (const card of cards) {
          const emailMatch = card.match(/EMAIL[^:]*:(.+)/i);
          const nameMatch = card.match(/FN:(.+)/i);
          if (emailMatch) {
            contacts.push([nameMatch?.[1]?.trim() || '', emailMatch[1].trim()]);
          }
        }
        processFileText(contacts.map(r => r.join(',')).join('\n'), file.name);
      } else {
        processFileText(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  useEffect(() => {
    if (!emailColIdx || csvRows.length === 0) {
      setFileRecipients([]);
      return;
    }
    const eIdx = Number(emailColIdx);
    const nIdx = nameColIdx ? Number(nameColIdx) : -1;
    const cIdx = companyColIdx ? Number(companyColIdx) : -1;
    const seen = new Set<string>();
    const recipients: ImportedRecipient[] = csvRows
      .filter(row => row[eIdx]?.trim())
      .map(row => {
        const email = row[eIdx].trim().toLowerCase();
        const valid = EMAIL_REGEX.test(email) && !seen.has(email);
        if (EMAIL_REGEX.test(email)) seen.add(email);
        return {
          email,
          name: nIdx >= 0 ? row[nIdx]?.trim() : undefined,
          company: cIdx >= 0 ? row[cIdx]?.trim() : undefined,
          valid,
        };
      });
    setFileRecipients(recipients);
  }, [emailColIdx, nameColIdx, companyColIdx, csvRows]);

  const validFileCount = fileRecipients.filter(r => r.valid).length;

  const handleImportFile = async () => {
    const valid = fileRecipients.filter(r => r.valid);
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      await apiClient.addCampaignRecipients(
        campaignId,
        valid.map(r => ({ email: r.email, name: r.name, company: r.company })),
      );
      toast({ title: 'Recipients imported', description: `${valid.length} recipients imported from ${uploadedFileName}` });
      resetFileState();
      onRecipientsAdded();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to import recipients', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetFileState = () => {
    setUploadedFileName('');
    setCsvRows([]);
    setCsvHeaders([]);
    setEmailColIdx('');
    setNameColIdx('');
    setCompanyColIdx('');
    setFileRecipients([]);
  };

  /* -- Tab 3: From Talent Pool -------------------------------------------- */
  const [talentSearch, setTalentSearch] = useState('');
  const [talentCandidates, setTalentCandidates] = useState<TalentPoolCandidate[]>([]);
  const [loadingTalent, setLoadingTalent] = useState(false);
  const [talentLoaded, setTalentLoaded] = useState(false);
  const [selectedTalentIds, setSelectedTalentIds] = useState<Set<string>>(new Set());

  const loadTalentPool = useCallback(async (search?: string) => {
    setLoadingTalent(true);
    try {
      const result = await apiClient.getTalentPool({ page: 1, pageSize: 100, search });
      const items = (result?.items ?? []).map((c: any) => ({ ...c, id: String(c.id ?? c.email) }));
      setTalentCandidates(items);
      setTalentLoaded(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to load talent pool', variant: 'destructive' });
    } finally {
      setLoadingTalent(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'talent' && !talentLoaded) {
      loadTalentPool();
    }
  }, [activeTab, talentLoaded, loadTalentPool]);

  const handleTalentSearch = () => {
    loadTalentPool(talentSearch || undefined);
  };

  const toggleTalentSelection = (id: string) => {
    setSelectedTalentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTalent = () => {
    if (selectedTalentIds.size === filteredTalent.length) {
      setSelectedTalentIds(new Set());
    } else {
      setSelectedTalentIds(new Set(filteredTalent.map(c => c.id)));
    }
  };

  const filteredTalent = talentCandidates.filter(c =>
    c.email && (
      !talentSearch ||
      c.candidate_name?.toLowerCase().includes(talentSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(talentSearch.toLowerCase())
    ),
  );

  const handleAddFromTalentPool = async () => {
    const selected = talentCandidates.filter(c => selectedTalentIds.has(c.id));
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      await apiClient.addCampaignRecipients(
        campaignId,
        selected.map(c => ({ email: c.email, name: c.candidate_name })),
      );
      toast({ title: 'Recipients added', description: `${selected.length} recipients added from talent pool` });
      setSelectedTalentIds(new Set());
      onRecipientsAdded();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to add recipients', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  /* -- Reset on close ----------------------------------------------------- */

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      setTimeout(() => {
        setPasteText('');
        setParsedEmails([]);
        resetFileState();
        setTalentSearch('');
        setSelectedTalentIds(new Set());
        setActiveTab('paste');
      }, 200);
    }
  };

  /* -- Render ------------------------------------------------------------- */

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <DialogTitle className="text-white">Add Recipients</DialogTitle>
          <DialogDescription className="text-slate-400">
            Add recipients to this campaign by pasting emails, uploading a file, or selecting from the talent pool.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-3 rounded-xl" style={{ background: 'var(--orbis-input)' }}>
            <TabsTrigger value="paste" className="flex items-center gap-1.5 text-xs text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 rounded-lg">
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste Emails
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 rounded-lg">
              <Upload className="h-3.5 w-3.5" /> Upload File
            </TabsTrigger>
            <TabsTrigger value="talent" className="flex items-center gap-1.5 text-xs text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 rounded-lg">
              <Users className="h-3.5 w-3.5" /> From Talent Pool
            </TabsTrigger>
          </TabsList>

          {/* TAB: Paste Emails */}
          <TabsContent value="paste" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Email Addresses</label>
              <textarea
                placeholder={"Paste email addresses separated by commas, semicolons, or new lines\n\ne.g.\njohn@example.com, jane@example.com\nbob@company.org"}
                value={pasteText}
                onChange={e => handlePasteChange(e.target.value)}
                rows={8}
                className="w-full font-mono text-sm rounded-xl px-3 py-2 placeholder:text-slate-500 focus:outline-none"
                style={glassInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {parsedEmails.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">{validPasteCount}</span>
                  <span className="text-slate-500">valid</span>
                </div>
                {invalidPasteCount > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">{invalidPasteCount}</span>
                    <span className="text-slate-500">invalid / duplicate</span>
                  </div>
                )}
              </div>
            )}

            {invalidPasteCount > 0 && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-xs font-medium text-rose-300 mb-1.5">
                  Invalid or duplicate emails:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parsedEmails.filter(e => !e.valid).map((e, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    >
                      {e.email}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <button
                onClick={onClose}
                disabled={submitting}
                className="text-slate-300 rounded-xl h-11 px-5 font-semibold"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPastedEmails}
                disabled={submitting || validPasteCount === 0}
                className="text-white font-semibold rounded-xl h-11 px-5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                  </span>
                ) : (
                  `Add All Valid (${validPasteCount})`
                )}
              </button>
            </DialogFooter>
          </TabsContent>

          {/* TAB: Upload File */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            {!uploadedFileName ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragActive(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  rounded-xl p-8 text-center cursor-pointer transition-colors
                  ${dragActive ? 'border-[#1B8EE5]' : ''}
                `}
                style={{
                  border: dragActive ? '2px dashed #1B8EE5' : '2px dashed var(--orbis-border-strong)',
                  background: dragActive ? 'rgba(27,142,229,0.05)' : 'var(--orbis-subtle)',
                }}
              >
                <FileUp className="h-10 w-10 mx-auto text-slate-500 mb-3" />
                <p className="text-sm font-medium text-white mb-1">
                  Drop your file here or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  Supports CSV, TSV, and VCF files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.vcf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-medium text-white">{uploadedFileName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      {csvRows.length} rows
                    </span>
                  </div>
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    onClick={resetFileState}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--orbis-border)' }} />

                {/* Column mapping */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      Email Column <span className="text-rose-400">*</span>
                    </label>
                    <Select value={emailColIdx} onValueChange={setEmailColIdx}>
                      <SelectTrigger className="h-9 rounded-xl text-white border-0 text-xs" style={glassInput}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-0" style={selectDrop}>
                        {csvHeaders.map((h, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs text-slate-200 focus:bg-white/10 focus:text-white">
                            {h || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">Name Column</label>
                    <Select value={nameColIdx} onValueChange={setNameColIdx}>
                      <SelectTrigger className="h-9 rounded-xl text-white border-0 text-xs" style={glassInput}>
                        <SelectValue placeholder="(optional)" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-0" style={selectDrop}>
                        <SelectItem value="none" className="text-xs text-slate-200 focus:bg-white/10 focus:text-white">None</SelectItem>
                        {csvHeaders.map((h, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs text-slate-200 focus:bg-white/10 focus:text-white">
                            {h || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">Company Column</label>
                    <Select value={companyColIdx} onValueChange={setCompanyColIdx}>
                      <SelectTrigger className="h-9 rounded-xl text-white border-0 text-xs" style={glassInput}>
                        <SelectValue placeholder="(optional)" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-0" style={selectDrop}>
                        <SelectItem value="none" className="text-xs text-slate-200 focus:bg-white/10 focus:text-white">None</SelectItem>
                        {csvHeaders.map((h, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs text-slate-200 focus:bg-white/10 focus:text-white">
                            {h || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview table */}
                {emailColIdx && csvRows.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">Preview (first 5 rows)</p>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="font-medium text-emerald-400">{validFileCount}</span>
                        <span className="text-slate-500 text-xs">contacts found</span>
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--orbis-border)' }}>
                      <table className="w-full text-left">
                        <thead>
                          <tr style={{ background: 'var(--orbis-subtle)' }}>
                            <th className="text-xs text-slate-500 py-1.5 px-3 font-medium">Email</th>
                            {nameColIdx && nameColIdx !== 'none' && <th className="text-xs text-slate-500 py-1.5 px-3 font-medium">Name</th>}
                            {companyColIdx && companyColIdx !== 'none' && <th className="text-xs text-slate-500 py-1.5 px-3 font-medium">Company</th>}
                            <th className="text-xs text-slate-500 py-1.5 px-3 font-medium w-16">Valid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fileRecipients.slice(0, 5).map((r, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]" style={{ borderTop: '1px solid var(--orbis-grid)' }}>
                              <td className="text-xs py-1.5 px-3 font-mono text-slate-300">{r.email}</td>
                              {nameColIdx && nameColIdx !== 'none' && (
                                <td className="text-xs py-1.5 px-3 text-slate-300">{r.name || '-'}</td>
                              )}
                              {companyColIdx && companyColIdx !== 'none' && (
                                <td className="text-xs py-1.5 px-3 text-slate-300">{r.company || '-'}</td>
                              )}
                              <td className="py-1.5 px-3">
                                {r.valid ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {fileRecipients.length > 5 && (
                      <p className="text-[11px] text-slate-500 text-center">
                        ...and {fileRecipients.length - 5} more rows
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              <button
                onClick={onClose}
                disabled={submitting}
                className="text-slate-300 rounded-xl h-11 px-5 font-semibold"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportFile}
                disabled={submitting || validFileCount === 0}
                className="text-white font-semibold rounded-xl h-11 px-5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                  </span>
                ) : (
                  `Import All (${validFileCount})`
                )}
              </button>
            </DialogFooter>
          </TabsContent>

          {/* TAB: From Talent Pool */}
          <TabsContent value="talent" className="space-y-4 mt-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  placeholder="Search by name or email..."
                  value={talentSearch}
                  onChange={e => setTalentSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTalentSearch(); }}
                  className="w-full h-9 pl-9 pr-3 rounded-xl text-sm placeholder:text-slate-500 focus:outline-none"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
              <button
                onClick={handleTalentSearch}
                className="text-slate-300 rounded-xl h-9 px-4 text-sm font-medium"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                Search
              </button>
            </div>

            {loadingTalent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : filteredTalent.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-8 w-8 mx-auto text-slate-500 mb-2" />
                <p className="text-sm text-slate-500">
                  {talentLoaded ? 'No candidates found in talent pool' : 'Loading talent pool...'}
                </p>
              </div>
            ) : (
              <>
                {/* Select all */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all-talent"
                      checked={selectedTalentIds.size === filteredTalent.length && filteredTalent.length > 0}
                      onCheckedChange={toggleAllTalent}
                    />
                    <label htmlFor="select-all-talent" className="text-xs text-slate-400 cursor-pointer">
                      Select all ({filteredTalent.length})
                    </label>
                  </div>
                  {selectedTalentIds.size > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {selectedTalentIds.size} selected
                    </span>
                  )}
                </div>

                {/* Candidate list */}
                <ScrollArea className="h-[280px] rounded-xl" style={{ border: '1px solid var(--orbis-border)' }}>
                  <div className="p-1">
                    {filteredTalent.map(candidate => (
                      <div
                        key={candidate.id || candidate.email}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
                          ${selectedTalentIds.has(candidate.id)
                            ? 'bg-blue-500/10 border border-blue-500/20'
                            : 'hover:bg-white/[0.03] border border-transparent'
                          }
                        `}
                        onClick={() => toggleTalentSelection(candidate.id)}
                      >
                        <Checkbox
                          checked={selectedTalentIds.has(candidate.id)}
                          onCheckedChange={() => toggleTalentSelection(candidate.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {candidate.candidate_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {candidate.email}
                          </p>
                        </div>
                        {candidate.current_stage && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 capitalize shrink-0">
                            {candidate.current_stage}
                          </span>
                        )}
                        {candidate.overall_score != null && (
                          <span className="text-xs font-medium text-slate-500 shrink-0">
                            {Math.round(candidate.overall_score)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            <DialogFooter>
              <button
                onClick={onClose}
                disabled={submitting}
                className="text-slate-300 rounded-xl h-11 px-5 font-semibold"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddFromTalentPool}
                disabled={submitting || selectedTalentIds.size === 0}
                className="text-white font-semibold rounded-xl h-11 px-5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                  </span>
                ) : (
                  `Add Selected (${selectedTalentIds.size})`
                )}
              </button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
