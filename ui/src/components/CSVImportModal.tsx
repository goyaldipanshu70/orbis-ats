import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle, XCircle,
  AlertCircle, Loader2, FileText, Trash2, Eye, Download,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  jdId?: number | null;
  onImported?: () => void;
}

type Step = 1 | 2 | 3 | 4;

const SYSTEM_FIELDS = [
  { value: 'full_name', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'github_url', label: 'GitHub URL' },
  { value: 'portfolio_url', label: 'Portfolio URL' },
  { value: 'current_role', label: 'Current Role' },
  { value: 'notes', label: 'Notes' },
  { value: '__skip__', label: 'Skip (do not import)' },
];

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function CSVImportModal({ open, onClose, jdId, onImported }: CSVImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* -- State ---------------------------------------------------------------- */
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Preview data from backend
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[]>([]);

  // Mapping: csv column header -> system field
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Import results
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  /* -- Reset ---------------------------------------------------------------- */
  const resetAll = () => {
    setStep(1);
    setFile(null);
    setIsDragging(false);
    setPreviewLoading(false);
    setCsvHeaders([]);
    setSampleRows([]);
    setFieldMapping({});
    setImportLoading(false);
    setImportResult(null);
  };

  const handleClose = () => {
    if (importLoading) return;
    resetAll();
    onClose();
  };

  /* -- Drag & Drop ---------------------------------------------------------- */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      toast({ title: 'Invalid file', description: 'Please upload a .csv file', variant: 'destructive' });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.name.endsWith('.csv')) {
      setFile(selected);
    } else if (selected) {
      toast({ title: 'Invalid file', description: 'Please upload a .csv file', variant: 'destructive' });
    }
  };

  /* -- Step 1 -> 2: Upload & Preview ---------------------------------------- */
  const handleUploadPreview = async () => {
    if (!file) return;
    setPreviewLoading(true);
    try {
      const data = await apiClient.previewCSV(file);
      setCsvHeaders(data.headers || []);
      setSampleRows(data.sample_rows || []);

      // Auto-map obvious columns
      const autoMapping: Record<string, string> = {};
      (data.headers || []).forEach((header: string) => {
        const lower = header.toLowerCase().replace(/[\s_-]+/g, '');
        if (lower.includes('name') || lower.includes('fullname')) {
          autoMapping[header] = 'full_name';
        } else if (lower.includes('email') || lower.includes('mail')) {
          autoMapping[header] = 'email';
        } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('tel')) {
          autoMapping[header] = 'phone';
        } else if (lower.includes('linkedin')) {
          autoMapping[header] = 'linkedin_url';
        } else if (lower.includes('github')) {
          autoMapping[header] = 'github_url';
        } else if (lower.includes('portfolio') || lower.includes('website')) {
          autoMapping[header] = 'portfolio_url';
        } else if (lower.includes('role') || lower.includes('title') || lower.includes('position')) {
          autoMapping[header] = 'current_role';
        } else if (lower.includes('note') || lower.includes('comment')) {
          autoMapping[header] = 'notes';
        } else {
          autoMapping[header] = '__skip__';
        }
      });
      setFieldMapping(autoMapping);
      setStep(2);
    } catch {
      toast({ title: 'Error', description: 'Failed to parse CSV file. Please check the format.', variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  /* -- Step 3 -> 4: Import -------------------------------------------------- */
  const handleImport = async () => {
    if (!file) return;

    // Build clean mapping (exclude skipped)
    const cleanMapping: Record<string, string> = {};
    Object.entries(fieldMapping).forEach(([csvCol, sysField]) => {
      if (sysField && sysField !== '__skip__') {
        cleanMapping[csvCol] = sysField;
      }
    });

    if (Object.keys(cleanMapping).length === 0) {
      toast({ title: 'No fields mapped', description: 'Please map at least one CSV column to a system field', variant: 'destructive' });
      return;
    }

    setImportLoading(true);
    try {
      const result = await apiClient.importCSV(jdId ?? null, file, cleanMapping);
      setImportResult(result);
      setStep(4);
      if (result.imported > 0) {
        onImported?.();
      }
      toast({
        title: 'Import complete',
        description: `${result.imported} imported, ${result.skipped} skipped`,
        variant: result.errors.length > 0 ? 'destructive' : 'default',
      });
    } catch {
      toast({ title: 'Error', description: 'CSV import failed', variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  /* -- Get mapped preview data for Step 3 ----------------------------------- */
  const getMappedPreviewRows = () => {
    const mappedFields = Object.entries(fieldMapping).filter(([, v]) => v && v !== '__skip__');
    const previewRows = sampleRows.slice(0, 5).map(row => {
      const mapped: Record<string, string> = {};
      mappedFields.forEach(([csvCol, sysField]) => {
        mapped[sysField] = row[csvCol] ?? '';
      });
      return mapped;
    });
    return { fields: mappedFields.map(([, v]) => v), rows: previewRows };
  };

  /* -- Step indicator ------------------------------------------------------- */
  const STEPS = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Map Fields' },
    { num: 3, label: 'Preview' },
    { num: 4, label: 'Import' },
  ];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border-0 shadow-2xl bg-background p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-t-xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <FileSpreadsheet className="h-4.5 w-4.5" />
              </div>
              CSV Import
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Import candidates from a CSV file in {STEPS.length} easy steps
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  step === s.num
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : step > s.num
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-white/70 dark:bg-white/5 text-muted-foreground border border-border/50'
                }`}>
                  {step > s.num ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <span className="flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold">{s.num}</span>
                  )}
                  {s.label}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-6 h-px mx-1 ${step > s.num ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* ================================================================ */}
          {/*  Step 1: Upload                                                   */}
          {/* ================================================================ */}
          {step === 1 && (
            <div className="space-y-5 pt-5">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 scale-[1.01]'
                    : file
                    ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-700'
                    : 'border-muted-foreground/20 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <FileText className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove file
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Upload className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Drop your CSV file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports .csv files up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={handleClose} className="rounded-lg">Cancel</Button>
                <Button
                  onClick={handleUploadPreview}
                  disabled={!file || previewLoading}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/20"
                >
                  {previewLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Parsing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Next <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/*  Step 2: Field Mapping                                            */}
          {/* ================================================================ */}
          {step === 2 && (
            <div className="space-y-4 pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Map each CSV column to a system field. Unmapped columns will be skipped.
                </p>
                <Badge variant="secondary" className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">
                  {csvHeaders.length} columns detected
                </Badge>
              </div>

              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {csvHeaders.map(header => {
                  const sampleValue = sampleRows[0]?.[header] ?? '';
                  const isMapped = fieldMapping[header] && fieldMapping[header] !== '__skip__';
                  return (
                    <div key={header} className={`flex items-center gap-3 p-3.5 border rounded-xl transition-all duration-150 ${
                      isMapped
                        ? 'bg-blue-50/50 border-blue-200/60 dark:bg-blue-950/20 dark:border-blue-800/40'
                        : 'bg-muted/20 border-border/50 hover:bg-muted/30'
                    }`}>
                      {/* CSV Column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{header}</p>
                          {isMapped && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </div>
                        {sampleValue && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            e.g. "{String(sampleValue).slice(0, 60)}"
                          </p>
                        )}
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />

                      {/* System Field Dropdown */}
                      <Select
                        value={fieldMapping[header] || '__skip__'}
                        onValueChange={v => setFieldMapping(prev => ({ ...prev, [header]: v }))}
                      >
                        <SelectTrigger className="w-[200px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYSTEM_FIELDS.map(f => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-lg">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                </Button>
                <Button onClick={() => setStep(3)} className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/20">
                  <Eye className="h-4 w-4 mr-1.5" /> Preview
                </Button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/*  Step 3: Preview                                                  */}
          {/* ================================================================ */}
          {step === 3 && (() => {
            const { fields, rows } = getMappedPreviewRows();
            const fieldLabels = SYSTEM_FIELDS.reduce<Record<string, string>>((acc, f) => {
              acc[f.value] = f.label;
              return acc;
            }, {});

            return (
              <div className="space-y-4 pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Preview of first {rows.length} rows mapped to system fields
                  </p>
                  <Badge className="text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                    {fields.length} fields mapped
                  </Badge>
                </div>

                {fields.length > 0 && rows.length > 0 ? (
                  <div className="overflow-x-auto border border-border/50 rounded-xl">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-10 text-xs font-semibold">#</TableHead>
                          {fields.map(f => (
                            <TableHead key={f} className="text-xs font-semibold">{fieldLabels[f] || f}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/20">
                            <TableCell className="text-muted-foreground text-xs font-medium">{idx + 1}</TableCell>
                            {fields.map(f => (
                              <TableCell key={f} className="text-sm max-w-[200px] truncate">
                                {row[f] || <span className="text-muted-foreground/50 italic text-xs">empty</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-sm text-muted-foreground rounded-xl border border-dashed border-border/50 bg-muted/10">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                    No fields are mapped. Go back and map at least one column.
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="rounded-lg">
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={importLoading || fields.length === 0}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/20"
                  >
                    {importLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4" /> Import Candidates
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* ================================================================ */}
          {/*  Step 4: Results                                                  */}
          {/* ================================================================ */}
          {step === 4 && importResult && (
            <div className="space-y-5 pt-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/60 text-center dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-800/40">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{importResult.imported}</p>
                  <p className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Imported</p>
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200/60 text-center dark:from-amber-950/30 dark:to-yellow-950/30 dark:border-amber-800/40">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{importResult.skipped}</p>
                  <p className="text-xs font-medium text-amber-600/80 dark:text-amber-400/80 mt-0.5">Skipped</p>
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/60 text-center dark:from-red-950/30 dark:to-rose-950/30 dark:border-red-800/40">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center mx-auto mb-2">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{importResult.errors.length}</p>
                  <p className="text-xs font-medium text-red-600/80 dark:text-red-400/80 mt-0.5">Errors</p>
                </div>
              </div>

              {/* Error Details */}
              {importResult.errors.length > 0 && (
                <div className="border border-red-200/60 rounded-xl p-4 bg-red-50/30 dark:bg-red-950/20 dark:border-red-800/40">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2.5">Error Details</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-2 py-1">
                        <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Button onClick={handleClose} className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/20 px-8">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
