import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Upload, AlertCircle, CheckCircle, XCircle, FileText, User, Trash2, Plus, Clock, Target, GitMerge } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import RecommendationBadge from './RecommendationBadge';
import { Progress } from '@/components/ui/progress';

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

  // Supported file formats
  const supportedFormats = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'];
  const maxFiles = 20;
  const maxFileSize = 10 * 1024 * 1024; // 10MB

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

    // Check total file limit
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

      // Check for duplicates
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
      
      toast({ 
        title: 'Upload Complete', 
        description: `${result.successful_uploads} of ${result.total_files} files processed successfully.`,
        variant: result.failed_uploads > 0 ? 'destructive' : 'default'
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
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return success ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-blue-50 border-0 shadow-2xl">
        <DialogHeader className="space-y-4 pb-6">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent flex items-center">
            <Upload className="w-6 h-6 mr-3 text-blue-600" />
            Bulk Upload Candidates
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-base">
            Upload multiple candidate resumes at once for AI evaluation. Maximum {maxFiles} files, 10MB each.
          </DialogDescription>
        </DialogHeader>

        {!uploadResults ? (
          <div className="space-y-8">
            {/* File Upload Section */}
            <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-blue-100 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground">Resume Upload</h4>
                </div>
                <div className="text-sm text-muted-foreground bg-card/70 px-3 py-1 rounded-full">
                  {files.length} / {maxFiles} files
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resume-files" className="text-base font-medium text-foreground mb-2 block">
                    Select Resume Files
                  </Label>
                  <div className="relative">
                    <Input 
                      id="resume-files" 
                      type="file" 
                      multiple
                      accept={supportedFormats.join(',')}
                      onChange={(e) => handleFileSelect(e.target.files)} 
                      className="cursor-pointer border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors duration-300 bg-blue-50/50 hover:bg-blue-50 p-4 text-center rounded-xl" 
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Supported formats: {supportedFormats.join(', ')} • Max size: 10MB per file • Max files: {maxFiles}
                  </p>
                </div>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-foreground">Selected Files ({files.length})</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setFiles([])}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Clear All
                  </Button>
                </div>
                
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {files.map((fileItem) => (
                    <div key={fileItem.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3 flex-1">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{fileItem.file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(fileItem.file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        {getStatusIcon(fileItem.status)}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeFile(fileItem.id)}
                        disabled={isUploading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-blue-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <h4 className="text-lg font-semibold text-foreground">Processing Files...</h4>
                </div>
                <Progress value={uploadProgress} className="w-full h-3" />
                <p className="text-sm text-muted-foreground mt-2 text-center">{uploadProgress.toFixed(0)}% complete</p>
              </div>
            )}
            
            <Separator className="bg-gradient-to-r from-blue-200 to-indigo-200" />
            
            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose} 
                disabled={isUploading}
                className="px-6 py-3 rounded-xl border-gray-300 hover:bg-muted/50 transition-all duration-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkUpload} 
                disabled={isUploading || files.length === 0}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
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
              </Button>
            </div>
          </div>
        ) : (
          // Results View
          <div className="space-y-8">
            {/* Results Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Target className="w-6 h-6 text-blue-600" />
                <h4 className="text-lg font-semibold text-foreground">Upload Results</h4>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-card/70 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{uploadResults.total_files}</div>
                  <div className="text-sm text-muted-foreground">Total Files</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg dark:bg-green-950/40">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-300">{uploadResults.successful_uploads}</div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg dark:bg-red-950/40">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-300">{uploadResults.failed_uploads}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg dark:bg-amber-950/40">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-300">
                    {uploadResults.results.filter(r => r.success && r.data?.duplicate_info).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Duplicates Merged</div>
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h4 className="text-lg font-semibold text-foreground mb-4">Detailed Results</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {uploadResults.results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center space-x-3 flex-1">
                      {getStatusIcon('', result.success)}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {result.success ? `Candidate ${result.candidate_id.slice(-8)}` : 'Upload Failed'}
                        </div>
                        {result.success && result.data?.metadata?.full_name && (
                          <div className="text-sm text-muted-foreground">{result.data.metadata.full_name}</div>
                        )}
                        {!result.success && result.error && (
                          <div className="text-sm text-red-600">{result.error}</div>
                        )}
                      </div>
                      {result.success && result.data?.duplicate_info && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800">
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
              <Button 
                onClick={resetForm}
                variant="outline"
                className="px-6 py-3 rounded-xl border-gray-300 hover:bg-muted/50 transition-all duration-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload More Files
              </Button>
              <Button 
                onClick={handleClose}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkCandidateModal;
