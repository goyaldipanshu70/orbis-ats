import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ResumeViewerProps {
  open: boolean;
  onClose: () => void;
  resumeUrl: string;
  title?: string;
}

export default function ResumeViewer({ open, onClose, resumeUrl, title = 'Resume' }: ResumeViewerProps) {
  const isPDF = resumeUrl?.toLowerCase().endsWith('.pdf');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>View the candidate's resume document.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-lg border">
          {isPDF ? (
            <iframe
              src={resumeUrl}
              className="w-full h-full min-h-[60vh]"
              title={title}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p>Preview not available for this file type.</p>
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline mt-2 inline-block"
              >
                Download Resume
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
