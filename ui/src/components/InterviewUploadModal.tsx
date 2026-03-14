import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

interface InterviewUploadModalProps {
  candidateId: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InterviewUploadModal = ({ candidateId, candidateName, isOpen, onClose, onSuccess }: InterviewUploadModalProps) => {
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!transcriptFile) {
      toast({
        title: 'Error',
        description: 'Please select a transcript file.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      await apiClient.uploadInterview(candidateId, transcriptFile);

      toast({
        title: 'Success',
        description: 'Interview transcript uploaded successfully!',
      });

      onSuccess();
      resetForm();

    } catch (error) {
      console.error('Error uploading transcript:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload interview transcript.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setTranscriptFile(null);
  };

  const handleClose = () => {
    if (!isUploading) {
      resetForm();
      onClose();
    }
  };

  const handleFileFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--orbis-hover)';
    e.target.style.borderColor = '#1B8EE5';
    e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
  };

  const handleFileBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--orbis-input)';
    e.target.style.borderColor = 'var(--orbis-border)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <DialogTitle className="text-white">Upload Interview Transcript</DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload interview transcript for {candidateName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="transcript-file" className="text-sm font-medium text-slate-300">Interview Transcript/Audio *</label>
            <div className="mt-1">
              <input
                id="transcript-file"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.m4a"
                onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg px-3 py-2 text-sm cursor-pointer outline-none transition-all file:mr-3 file:rounded-md file:border-0 file:bg-blue-500/20 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-300"
                style={glassInput}
                onFocus={handleFileFocus}
                onBlur={handleFileBlur}
                required
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Upload interview transcript or audio recording
            </p>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all disabled:opacity-50"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || !transcriptFile}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InterviewUploadModal;
