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
      <DialogContent className="max-w-4xl h-[80vh] border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-slate-400">View the candidate's resume document.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-lg" style={{ border: '1px solid var(--orbis-hover)', background: 'var(--orbis-subtle)' }}>
          {isPDF ? (
            <iframe
              src={resumeUrl}
              className="w-full h-full min-h-[60vh]"
              title={title}
            />
          ) : (
            <div className="p-4 text-center text-slate-400">
              <p>Preview not available for this file type.</p>
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline mt-2 inline-block"
                style={{ color: '#1B8EE5' }}
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
