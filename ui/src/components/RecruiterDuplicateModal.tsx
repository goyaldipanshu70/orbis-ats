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

const REASON_CONFIG: Record<string, { icon: React.ReactNode; label: string; bg: string; text: string; border: string }> = {
  email: { icon: <Mail className="w-3.5 h-3.5" />, label: 'Email', bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  phone: { icon: <Phone className="w-3.5 h-3.5" />, label: 'Phone', bg: 'rgba(27,142,229,0.15)', text: '#c4b5fd', border: 'rgba(27,142,229,0.3)' },
  linkedin: { icon: <Linkedin className="w-3.5 h-3.5" />, label: 'LinkedIn', bg: 'rgba(14,165,233,0.15)', text: '#7dd3fc', border: 'rgba(14,165,233,0.3)' },
  github: { icon: <Github className="w-3.5 h-3.5" />, label: 'GitHub', bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', border: 'rgba(148,163,184,0.3)' },
  profile: { icon: <User className="w-3.5 h-3.5" />, label: 'Profile', bg: 'rgba(251,191,36,0.15)', text: '#fcd34d', border: 'rgba(251,191,36,0.3)' },
};

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  applied: { bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1' },
  screening: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd' },
  interview: { bg: 'rgba(22,118,192,0.15)', text: '#a5b4fc' },
  offer: { bg: 'rgba(34,197,94,0.15)', text: '#86efac' },
  hired: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5' },
};

const RecruiterDuplicateModal = ({ isOpen, duplicateInfo, onContinue, onCancel, onViewExisting, mode = 'post-merge' }: RecruiterDuplicateModalProps) => {
  const isPreCheck = mode === 'pre-check';
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-lg border-0 rounded-2xl shadow-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        <DialogHeader className="space-y-3 pb-4">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            Existing Candidate Detected
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isPreCheck
              ? 'A candidate with matching information already exists in the talent pool. Choose how to proceed.'
              : 'This resume matches an existing candidate in the system. The profile has been automatically merged with the latest data.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Match Reasons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-400 mr-1 self-center">Matched by:</span>
            {duplicateInfo.match_reasons.map((reason) => {
              const config = REASON_CONFIG[reason] || REASON_CONFIG.profile;
              return (
                <span
                  key={reason}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: config.bg, color: config.text, border: `1px solid ${config.border}` }}
                >
                  {config.icon}
                  {config.label}
                </span>
              );
            })}
          </div>

          {/* Existing Candidate Card */}
          <div className="rounded-xl p-4" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)' }}>
                {(duplicateInfo.matched_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {duplicateInfo.matched_name || 'Unknown'}
                </div>
                {duplicateInfo.matched_email && (
                  <div className="text-sm text-slate-400 truncate">{duplicateInfo.matched_email}</div>
                )}
                <div className="text-xs text-slate-500 mt-0.5">Profile #{duplicateInfo.profile_id}</div>
              </div>
            </div>
          </div>

          {/* Job History */}
          {duplicateInfo.existing_jobs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2.5 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-slate-400" />
                Existing Job Applications ({duplicateInfo.existing_jobs.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {duplicateInfo.existing_jobs.map((job, i) => {
                  const stageStyle = STAGE_COLORS[job.pipeline_stage] || STAGE_COLORS.applied;
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{job.job_title}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: stageStyle.bg, color: stageStyle.text }}
                        >
                          {job.pipeline_stage.replace(/_/g, ' ')}
                        </span>
                        {job.score != null && (
                          <span className="text-xs text-slate-500 font-mono">{Math.round(Number(job.score))}pts</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info text */}
          <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs leading-relaxed" style={{ color: '#93c5fd' }}>
              {isPreCheck
                ? 'Choosing "Merge & Update" will update the existing profile with the new data. You can also view the existing profile first.'
                : 'The candidate\'s profile has been updated with the latest resume data. Proceeding will continue with AI evaluation for the current job position.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onCancel}
              className="px-5 flex items-center gap-1.5 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
            {isPreCheck && onViewExisting && (
              <button
                onClick={onViewExisting}
                className="px-5 flex items-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}
              >
                <User className="w-4 h-4" />
                View Existing
              </button>
            )}
            <button
              onClick={onContinue}
              className="px-5 flex items-center gap-1.5 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #6a2bd4)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}
            >
              {isPreCheck ? 'Merge & Update' : 'Continue with Merge'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecruiterDuplicateModal;
