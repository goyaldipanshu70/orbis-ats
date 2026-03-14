import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, AlertCircle, AlertTriangle, CheckCircle, XCircle, FileText, Trash2, Plus, Clock, Target, GitMerge, Mail, Phone, Linkedin, Github, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import RecommendationBadge from './RecommendationBadge';

interface BulkCandidateModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FileUploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  result?: any;
  error?: string;
}

interface MultipleCandidateResult {
  candidate_id: string;
  success: boolean;
  error?: string;
  data?: any;
}

interface MultipleCandidateUploadResponse {
  total_files: number;
  successful_uploads: number;
  failed_uploads: number;
  results: MultipleCandidateResult[];
}

const BulkCandidateModal = ({ jobId, isOpen, onClose, onSuccess }: BulkCandidateModalProps) => {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<MultipleCandidateUploadResponse | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const supportedFormats = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'];
  const maxFiles = 20;
  const maxFileSize = 10 * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!supportedFormats.includes(fileExtension)) {
      return `Unsupported file format. Supported: ${supportedFormats.join(', ')}`;
    }
    if (file.size > maxFileSize) {
      return `File too large. Maximum size: 10MB`;
    }
    return null;
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: FileUploadItem[] = [];
    const errors: string[] = [];

    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `Maximum ${maxFiles} files allowed. Currently have ${files.length} files.`,
        variant: 'destructive'
      });
      return;
    }

    Array.from(selectedFiles).forEach((file, index) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }
      const isDuplicate = files.some(f => f.file.name === file.name && f.file.size === file.size);
      if (isDuplicate) {
        errors.push(`${file.name}: Duplicate file`);
        return;
      }
      newFiles.push({
        id: `${Date.now()}-${index}`,
        file,
        status: 'pending'
      });
    });

    if (errors.length > 0) {
      toast({
        title: 'File validation errors',
        description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n... and ${errors.length - 3} more` : ''),
        variant: 'destructive'
      });
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      toast({
        title: 'Files added',
        description: `${newFiles.length} files ready for upload.`
      });
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleBulkUpload = async () => {
    if (files.length === 0) {
      toast({ title: 'Error', description: 'Please select files to upload.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('jd_id', jobId);
      formData.append('use_rubric', 'true');

      files.forEach(fileItem => {
        formData.append('resume_files', fileItem.file);
      });

      const result = await apiClient.uploadMultipleCandidates(formData, (progress) => {
        setUploadProgress(progress);
      });

      setUploadResults(result);

      const dupCount = result.results.filter((r: MultipleCandidateResult) => r.success && r.data?.duplicate_info).length;
      toast({
        title: dupCount > 0 ? 'Upload Complete — Duplicates Detected' : 'Upload Complete',
        description: dupCount > 0
          ? `${result.successful_uploads} processed. ${dupCount} existing candidate${dupCount > 1 ? 's were' : ' was'} merged with updated data.`
          : `${result.successful_uploads} of ${result.total_files} files processed successfully.`,
        variant: result.failed_uploads > 0 ? 'destructive' : dupCount > 0 ? 'default' : 'default'
      });

      if (result.successful_uploads > 0) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({ title: 'Error', description: 'Failed to upload files.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFiles([]);
    setUploadResults(null);
    setUploadProgress(0);
  };

  const handleClose = () => {
    if (!isUploading) {
      resetForm();
      onClose();
    }
  };

  const getStatusIcon = (status: string, success?: boolean) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-slate-500" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const glassCard = 'rounded-2xl p-6 border border-white/10 bg-white/[0.03] backdrop-blur-sm';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader className="space-y-4 pb-6">
          <DialogTitle className="text-2xl font-bold text-white flex items-center">
            <Upload className="w-6 h-6 mr-3 text-blue-400" />
            Bulk Upload Candidates
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-base">
            Upload multiple candidate resumes at once for AI evaluation. Maximum {maxFiles} files, 10MB each.
          </DialogDescription>
        </DialogHeader>

        {!uploadResults ? (
          <div className="space-y-8">
            {/* File Upload Section */}
            <div className={glassCard}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Resume Upload</h4>
                </div>
                <div className="text-sm text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {files.length} / {maxFiles} files
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="resume-files" className="text-base font-medium text-slate-300 mb-2 block">
                    Select Resume Files
                  </label>
                  <div className="relative">
                    <input
                      id="resume-files"
                      type="file"
                      multiple
                      accept={supportedFormats.join(',')}
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="cursor-pointer w-full border-2 border-dashed border-blue-500/30 hover:border-blue-400/50 transition-colors duration-300 bg-white/[0.03] hover:bg-white/[0.05] p-4 text-center rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500/20 file:text-blue-300 file:text-sm file:font-medium"
                    />
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Supported formats: {supportedFormats.join(', ')} | Max size: 10MB per file | Max files: {maxFiles}
                  </p>
                </div>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className={glassCard}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Selected Files ({files.length})</h4>
                  <button
                    onClick={() => setFiles([])}
                    className="text-sm px-3 py-1.5 rounded-lg text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {files.map((fileItem) => (
                    <div key={fileItem.id} className="flex items-center justify-between p-3 border border-white/10 bg-white/[0.03] rounded-lg hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center space-x-3 flex-1">
                        <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{fileItem.file.name}</div>
                          <div className="text-xs text-slate-500">
                            {(fileItem.file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        {getStatusIcon(fileItem.status)}
                      </div>
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        disabled={isUploading}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-2 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="rounded-2xl p-6 border border-blue-500/20 bg-blue-500/10">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <h4 className="text-lg font-semibold text-white">Processing Files...</h4>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400 mt-2 text-center">{uploadProgress.toFixed(0)}% complete</p>
              </div>
            )}

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-all duration-300 disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={isUploading || files.length === 0}
                className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none font-medium"
              >
                {isUploading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>Upload & Analyze ({files.length})</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        ) : (
          // Results View
          <div className="space-y-8">
            {/* Results Summary */}
            <div className="rounded-2xl p-6 border border-blue-500/20 bg-blue-500/10">
              <div className="flex items-center space-x-3 mb-4">
                <Target className="w-6 h-6 text-blue-400" />
                <h4 className="text-lg font-semibold text-white">Upload Results</h4>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white/[0.03] rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-white">{uploadResults.total_files}</div>
                  <div className="text-sm text-slate-400">Total Files</div>
                </div>
                <div className="text-center p-4 bg-green-900/20 rounded-lg border border-green-700/30">
                  <div className="text-2xl font-bold text-green-300">{uploadResults.successful_uploads}</div>
                  <div className="text-sm text-slate-400">Successful</div>
                </div>
                <div className="text-center p-4 bg-red-900/20 rounded-lg border border-red-700/30">
                  <div className="text-2xl font-bold text-red-300">{uploadResults.failed_uploads}</div>
                  <div className="text-sm text-slate-400">Failed</div>
                </div>
                <div className="text-center p-4 bg-amber-900/20 rounded-lg border border-amber-700/30">
                  <div className="text-2xl font-bold text-amber-300">
                    {uploadResults.results.filter(r => r.success && r.data?.duplicate_info).length}
                  </div>
                  <div className="text-sm text-slate-400">Duplicates Merged</div>
                </div>
              </div>
            </div>

            {/* Duplicate Warning Banner */}
            {uploadResults.results.some(r => r.success && r.data?.duplicate_info) && (
              <div className="rounded-2xl p-5 border border-amber-600/30 bg-amber-900/15">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-base font-semibold text-amber-300">Existing Candidates Detected</h4>
                    <p className="text-sm text-amber-400/80 mt-0.5">
                      The following candidates already existed in the system. Their profiles have been automatically merged with the latest resume data.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uploadResults.results.filter(r => r.success && r.data?.duplicate_info).map((r, i) => {
                    const dup = r.data.duplicate_info;
                    const reasonIcons: Record<string, React.ReactNode> = {
                      email: <Mail className="w-3 h-3" />,
                      phone: <Phone className="w-3 h-3" />,
                      linkedin: <Linkedin className="w-3 h-3" />,
                      github: <Github className="w-3 h-3" />,
                    };
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-900/20 border border-amber-700/30">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                            {(dup.matched_name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{dup.matched_name || 'Unknown'}</div>
                            {dup.matched_email && <div className="text-xs text-amber-400/70 truncate">{dup.matched_email}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {(dup.match_reasons || []).map((reason: string) => (
                            <span key={reason} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-900/40 text-amber-300 border border-amber-700/40">
                              {reasonIcons[reason] || null}
                              {reason}
                            </span>
                          ))}
                          {dup.existing_jobs?.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-900/30 text-blue-300 border border-blue-700/40">
                              <Briefcase className="w-3 h-3" />
                              {dup.existing_jobs.length} job{dup.existing_jobs.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detailed Results */}
            <div className={glassCard}>
              <h4 className="text-lg font-semibold text-white mb-4">Detailed Results</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {uploadResults.results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-white/10 bg-white/[0.03] rounded-lg">
                    <div className="flex items-center space-x-3 flex-1">
                      {getStatusIcon('', result.success)}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          {result.success ? `Candidate ${result.candidate_id.slice(-8)}` : 'Upload Failed'}
                        </div>
                        {result.success && result.data?.metadata?.full_name && (
                          <div className="text-sm text-slate-400">{result.data.metadata.full_name}</div>
                        )}
                        {!result.success && result.error && (
                          <div className="text-sm text-red-400">{result.error}</div>
                        )}
                      </div>
                      {result.success && result.data?.duplicate_info && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-700/50">
                          <GitMerge className="w-3 h-3" />
                          Merged
                        </span>
                      )}
                      {result.success && result.data?.ai_recommendation && (
                        <RecommendationBadge
                          recommendation={result.data.ai_recommendation}
                          className="text-xs px-2 py-1"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={resetForm}
                className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-all duration-300 font-medium flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload More Files
              </button>
              <button
                onClick={handleClose}
                className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-300 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkCandidateModal;
