import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, User, Mail, Phone, Linkedin, Github, Briefcase, ArrowRight, XCircle } from 'lucide-react';

interface ExistingJob {
  job_title: string;
  pipeline_stage: string;
  score?: number | null;
}

interface DuplicateInfo {
  profile_id: number;
  matched_name?: string;
  matched_email?: string;
  match_reasons: string[];
  existing_jobs: ExistingJob[];
  message: string;
}

interface RecruiterDuplicateModalProps {
  isOpen: boolean;
  duplicateInfo: DuplicateInfo;
  onContinue: () => void;
  onCancel: () => void;
  onViewExisting?: () => void;
  /** Pre-check mode: shown before save. Post-merge mode (default): shown after save. */
  mode?: 'pre-check' | 'post-merge';
}

const REASON_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  email: { icon: <Mail className="w-3.5 h-3.5" />, label: 'Email', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
  phone: { icon: <Phone className="w-3.5 h-3.5" />, label: 'Phone', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' },
  linkedin: { icon: <Linkedin className="w-3.5 h-3.5" />, label: 'LinkedIn', color: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800' },
  github: { icon: <Github className="w-3.5 h-3.5" />, label: 'GitHub', color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700' },
  profile: { icon: <User className="w-3.5 h-3.5" />, label: 'Profile', color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' },
};

const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
  screening: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  interview: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  offer: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  hired: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const RecruiterDuplicateModal = ({ isOpen, duplicateInfo, onContinue, onCancel, onViewExisting, mode = 'post-merge' }: RecruiterDuplicateModalProps) => {
  const isPreCheck = mode === 'pre-check';
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-lg bg-gradient-to-br from-white to-amber-50/30 border-0 shadow-2xl">
        <DialogHeader className="space-y-3 pb-4">
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            Existing Candidate Detected
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isPreCheck
              ? 'A candidate with matching information already exists in the talent pool. Choose how to proceed.'
              : 'This resume matches an existing candidate in the system. The profile has been automatically merged with the latest data.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Match Reasons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-1 self-center">Matched by:</span>
            {duplicateInfo.match_reasons.map((reason) => {
              const config = REASON_CONFIG[reason] || REASON_CONFIG.profile;
              return (
                <span
                  key={reason}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.color}`}
                >
                  {config.icon}
                  {config.label}
                </span>
              );
            })}
          </div>

          {/* Existing Candidate Card */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(duplicateInfo.matched_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">
                  {duplicateInfo.matched_name || 'Unknown'}
                </div>
                {duplicateInfo.matched_email && (
                  <div className="text-sm text-muted-foreground truncate">{duplicateInfo.matched_email}</div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">Profile #{duplicateInfo.profile_id}</div>
              </div>
            </div>
          </div>

          {/* Job History */}
          {duplicateInfo.existing_jobs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                Existing Job Applications ({duplicateInfo.existing_jobs.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {duplicateInfo.existing_jobs.map((job, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{job.job_title}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[job.pipeline_stage] || STAGE_COLORS.applied}`}>
                        {job.pipeline_stage.replace(/_/g, ' ')}
                      </span>
                      {job.score != null && (
                        <span className="text-xs text-muted-foreground font-mono">{Math.round(Number(job.score))}pts</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info text */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 dark:bg-blue-950/40 dark:border-blue-800">
            <p className="text-xs text-blue-700 leading-relaxed dark:text-blue-300">
              {isPreCheck
                ? 'Choosing "Merge & Update" will update the existing profile with the new data. You can also view the existing profile first.'
                : 'The candidate\'s profile has been updated with the latest resume data. Proceeding will continue with AI evaluation for the current job position.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="px-5 rounded-lg border-gray-300 hover:bg-gray-50"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            {isPreCheck && onViewExisting && (
              <Button
                variant="outline"
                onClick={onViewExisting}
                className="px-5 rounded-lg border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
              >
                <User className="w-4 h-4 mr-1.5" />
                View Existing
              </Button>
            )}
            <Button
              onClick={onContinue}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 rounded-lg shadow-md"
            >
              {isPreCheck ? 'Merge & Update' : 'Continue with Merge'}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecruiterDuplicateModal;
