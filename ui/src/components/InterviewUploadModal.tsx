
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';

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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Interview Transcript</DialogTitle>
          <DialogDescription>
            Upload interview transcript for {candidateName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="transcript-file">Interview Transcript/Audio *</Label>
            <div className="mt-1">
              <Input
                id="transcript-file"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.m4a"
                onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upload interview transcript or audio recording
            </p>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !transcriptFile}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InterviewUploadModal;
