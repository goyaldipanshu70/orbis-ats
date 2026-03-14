import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
/*  Styles                                                                     */
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

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[]>([]);

  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border-0 p-0" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20">
                <FileSpreadsheet className="h-4.5 w-4.5" />
              </div>
              CSV Import
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
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
                    ? 'bg-emerald-900/40 text-emerald-300'
                    : 'bg-white/5 text-slate-500 border border-white/10'
                }`}>
                  {step > s.num ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <span className="flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold">{s.num}</span>
                  )}
                  {s.label}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-6 h-px mx-1 ${step > s.num ? 'bg-emerald-700' : 'bg-white/10'}`} />
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
                    ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
                    : file
                    ? 'border-emerald-600/50 bg-emerald-900/10'
                    : 'border-white/10 hover:border-blue-500/30 hover:bg-white/[0.02]'
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
                    <div className="w-14 h-14 rounded-2xl bg-emerald-900/40 flex items-center justify-center">
                      <FileText className="h-7 w-7 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="text-sm px-3 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                      <Upload className="h-7 w-7 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Drop your CSV file here or click to browse</p>
                      <p className="text-xs text-slate-500 mt-1">Supports .csv files up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors font-medium text-sm">Cancel</button>
                <button
                  onClick={handleUploadPreview}
                  disabled={!file || previewLoading}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-5 py-2 shadow-md shadow-blue-600/20 font-medium text-sm disabled:opacity-50 transition-all"
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
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/*  Step 2: Field Mapping                                            */}
          {/* ================================================================ */}
          {step === 2 && (
            <div className="space-y-4 pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Map each CSV column to a system field. Unmapped columns will be skipped.
                </p>
                <span className="text-xs font-medium bg-blue-900/40 text-blue-300 border-0 px-2.5 py-1 rounded-full">
                  {csvHeaders.length} columns detected
                </span>
              </div>

              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {csvHeaders.map(header => {
                  const sampleValue = sampleRows[0]?.[header] ?? '';
                  const isMapped = fieldMapping[header] && fieldMapping[header] !== '__skip__';
                  return (
                    <div key={header} className={`flex items-center gap-3 p-3.5 border rounded-xl transition-all duration-150 ${
                      isMapped
                        ? 'bg-blue-500/5 border-blue-500/20'
                        : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
                    }`}>
                      {/* CSV Column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{header}</p>
                          {isMapped && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </div>
                        {sampleValue && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            e.g. "{String(sampleValue).slice(0, 60)}"
                          </p>
                        )}
                      </div>

                      <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />

                      {/* System Field Dropdown */}
                      <Select
                        value={fieldMapping[header] || '__skip__'}
                        onValueChange={v => setFieldMapping(prev => ({ ...prev, [header]: v }))}
                      >
                        <SelectTrigger className="w-[200px] h-11 rounded-xl text-white border-0" style={glassInput}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-0" style={selectDrop}>
                          {SYSTEM_FIELDS.map(f => (
                            <SelectItem key={f.value} value={f.value} className="text-slate-200 focus:bg-white/10 focus:text-white">
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
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors font-medium text-sm flex items-center gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => setStep(3)} className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-5 py-2 shadow-md shadow-blue-600/20 font-medium text-sm flex items-center gap-1.5 transition-all">
                  <Eye className="h-4 w-4" /> Preview
                </button>
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
                  <p className="text-sm text-slate-400">
                    Preview of first {rows.length} rows mapped to system fields
                  </p>
                  <span className="text-xs font-medium bg-emerald-900/40 text-emerald-300 border-0 px-2.5 py-1 rounded-full">
                    {fields.length} fields mapped
                  </span>
                </div>

                {fields.length > 0 && rows.length > 0 ? (
                  <div className="overflow-x-auto border border-white/10 rounded-xl">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent" style={{ background: 'var(--orbis-input)', borderBottom: '1px solid var(--orbis-border)' }}>
                          <TableHead className="w-10 text-xs font-semibold text-slate-400">#</TableHead>
                          {fields.map(f => (
                            <TableHead key={f} className="text-xs font-semibold text-slate-400">{fieldLabels[f] || f}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-white/[0.03] border-white/5">
                            <TableCell className="text-slate-500 text-xs font-medium">{idx + 1}</TableCell>
                            {fields.map(f => (
                              <TableCell key={f} className="text-sm max-w-[200px] truncate text-white">
                                {row[f] || <span className="text-slate-400 italic text-xs">empty</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-sm text-slate-500 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                    No fields are mapped. Go back and map at least one column.
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-2">
                  <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors font-medium text-sm flex items-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importLoading || fields.length === 0}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-5 py-2 shadow-md shadow-blue-600/20 font-medium text-sm disabled:opacity-50 transition-all"
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
                  </button>
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
                <div className="p-5 rounded-xl text-center bg-emerald-900/20 border border-emerald-700/30">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/50 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-300">{importResult.imported}</p>
                  <p className="text-xs font-medium text-emerald-400/80 mt-0.5">Imported</p>
                </div>
                <div className="p-5 rounded-xl text-center bg-amber-900/20 border border-amber-700/30">
                  <div className="w-10 h-10 rounded-xl bg-amber-900/50 flex items-center justify-center mx-auto mb-2">
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-amber-300">{importResult.skipped}</p>
                  <p className="text-xs font-medium text-amber-400/80 mt-0.5">Skipped</p>
                </div>
                <div className="p-5 rounded-xl text-center bg-red-900/20 border border-red-700/30">
                  <div className="w-10 h-10 rounded-xl bg-red-900/50 flex items-center justify-center mx-auto mb-2">
                    <XCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <p className="text-2xl font-bold text-red-300">{importResult.errors.length}</p>
                  <p className="text-xs font-medium text-red-400/80 mt-0.5">Errors</p>
                </div>
              </div>

              {/* Error Details */}
              {importResult.errors.length > 0 && (
                <div className="border border-red-700/30 rounded-xl p-4 bg-red-900/10">
                  <p className="text-sm font-semibold text-red-300 mb-2.5">Error Details</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="text-xs text-red-400 flex items-start gap-2 py-1">
                        <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <button onClick={handleClose} className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-8 py-2.5 shadow-md shadow-blue-600/20 font-medium text-sm transition-all">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
