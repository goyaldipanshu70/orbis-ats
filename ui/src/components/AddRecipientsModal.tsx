import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import {
  ClipboardPaste, Upload, Users, FileUp, X, Check, Search,
  AlertCircle, FileSpreadsheet, Loader2,
} from 'lucide-react';

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
    // Simple CSV parse: handle quoted fields
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

  /* ── Tab 1: Paste Emails ────────────────────────────────────────────── */
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

  /* ── Tab 2: Upload File ─────────────────────────────────────────────── */
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
    // Auto-detect email column
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
        // Parse VCF: extract EMAIL and FN fields
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

  // Build recipients from column mapping
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

  /* ── Tab 3: From Talent Pool ────────────────────────────────────────── */
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

  // Load talent pool when tab is activated
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

  /* ── Reset on close ─────────────────────────────────────────────────── */

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      // reset all state after animation
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

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Recipients</DialogTitle>
          <DialogDescription>
            Add recipients to this campaign by pasting emails, uploading a file, or selecting from the talent pool.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="paste" className="flex items-center gap-1.5 text-xs">
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste Emails
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" /> Upload File
            </TabsTrigger>
            <TabsTrigger value="talent" className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> From Talent Pool
            </TabsTrigger>
          </TabsList>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB: Paste Emails                                          */}
          {/* ──────────────────────────────────────────────────────────── */}
          <TabsContent value="paste" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Email Addresses</Label>
              <Textarea
                placeholder="Paste email addresses separated by commas, semicolons, or new lines&#10;&#10;e.g.&#10;john@example.com, jane@example.com&#10;bob@company.org"
                value={pasteText}
                onChange={e => handlePasteChange(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {parsedEmails.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">{validPasteCount}</span>
                  <span className="text-muted-foreground">valid</span>
                </div>
                {invalidPasteCount > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">{invalidPasteCount}</span>
                    <span className="text-muted-foreground">invalid / duplicate</span>
                  </div>
                )}
              </div>
            )}

            {/* Show invalid emails */}
            {invalidPasteCount > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-3">
                <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1.5">
                  Invalid or duplicate emails:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parsedEmails.filter(e => !e.valid).map((e, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[10px] border-red-300 dark:border-red-700 text-red-600 dark:text-red-400"
                    >
                      {e.email}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleAddPastedEmails} disabled={submitting || validPasteCount === 0}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                  </span>
                ) : (
                  `Add All Valid (${validPasteCount})`
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB: Upload File                                           */}
          {/* ──────────────────────────────────────────────────────────── */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            {!uploadedFileName ? (
              /* Drop zone */
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragActive(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                  }
                `}
              >
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">
                  Drop your file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
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
              /* File loaded - show mapping */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">{uploadedFileName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {csvRows.length} rows
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={resetFileState}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <Separator />

                {/* Column mapping */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium mb-1 block">
                      Email Column <span className="text-red-500">*</span>
                    </Label>
                    <Select value={emailColIdx} onValueChange={setEmailColIdx}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map((h, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs">
                            {h || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Name Column</Label>
                    <Select value={nameColIdx} onValueChange={setNameColIdx}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="(optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">None</SelectItem>
                        {csvHeaders.map((h, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs">
                            {h || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Company Column</Label>
                    <Select value={companyColIdx} onValueChange={setCompanyColIdx}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="(optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">None</SelectItem>
                        {csvHeaders.map((h, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs">
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
                      <p className="text-xs text-muted-foreground">
                        Preview (first 5 rows)
                      </p>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-600 dark:text-green-400">{validFileCount}</span>
                        <span className="text-muted-foreground text-xs">contacts found</span>
                      </div>
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs py-1.5">Email</TableHead>
                            {nameColIdx && nameColIdx !== 'none' && <TableHead className="text-xs py-1.5">Name</TableHead>}
                            {companyColIdx && companyColIdx !== 'none' && <TableHead className="text-xs py-1.5">Company</TableHead>}
                            <TableHead className="text-xs py-1.5 w-16">Valid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fileRecipients.slice(0, 5).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs py-1.5 font-mono">{r.email}</TableCell>
                              {nameColIdx && nameColIdx !== 'none' && (
                                <TableCell className="text-xs py-1.5">{r.name || '-'}</TableCell>
                              )}
                              {companyColIdx && companyColIdx !== 'none' && (
                                <TableCell className="text-xs py-1.5">{r.company || '-'}</TableCell>
                              )}
                              <TableCell className="py-1.5">
                                {r.valid ? (
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {fileRecipients.length > 5 && (
                      <p className="text-[11px] text-muted-foreground text-center">
                        ...and {fileRecipients.length - 5} more rows
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleImportFile} disabled={submitting || validFileCount === 0}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                  </span>
                ) : (
                  `Import All (${validFileCount})`
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB: From Talent Pool                                      */}
          {/* ──────────────────────────────────────────────────────────── */}
          <TabsContent value="talent" className="space-y-4 mt-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={talentSearch}
                  onChange={e => setTalentSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTalentSearch(); }}
                  className="pl-9 h-9"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={handleTalentSearch}>
                Search
              </Button>
            </div>

            {loadingTalent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTalent.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
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
                    <Label htmlFor="select-all-talent" className="text-xs text-muted-foreground cursor-pointer">
                      Select all ({filteredTalent.length})
                    </Label>
                  </div>
                  {selectedTalentIds.size > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedTalentIds.size} selected
                    </Badge>
                  )}
                </div>

                {/* Candidate list */}
                <ScrollArea className="h-[280px] rounded-lg border">
                  <div className="p-1">
                    {filteredTalent.map(candidate => (
                      <div
                        key={candidate.id || candidate.email}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors
                          ${selectedTalentIds.has(candidate.id)
                            ? 'bg-primary/5 border border-primary/20'
                            : 'hover:bg-muted/50 border border-transparent'
                          }
                        `}
                        onClick={() => toggleTalentSelection(candidate.id)}
                      >
                        <Checkbox
                          checked={selectedTalentIds.has(candidate.id)}
                          onCheckedChange={() => toggleTalentSelection(candidate.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {candidate.candidate_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {candidate.email}
                          </p>
                        </div>
                        {candidate.current_stage && (
                          <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                            {candidate.current_stage}
                          </Badge>
                        )}
                        {candidate.overall_score != null && (
                          <span className="text-xs font-medium text-muted-foreground shrink-0">
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
              <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button
                onClick={handleAddFromTalentPool}
                disabled={submitting || selectedTalentIds.size === 0}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                  </span>
                ) : (
                  `Add Selected (${selectedTalentIds.size})`
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
