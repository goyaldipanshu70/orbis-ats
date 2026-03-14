
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, AlertCircle, CheckCircle, XCircle, FileText, User, Mail, Phone, MapPin, Briefcase, Calendar, Star, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import RecommendationBadge from './RecommendationBadge';
import ScoreDisplay from './ScoreDisplay';
import RecruiterDuplicateModal from './RecruiterDuplicateModal';

interface AddCandidateModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CategoryScore {
  obtained_score: number;
  max_score: number;
}

interface CandidateEvaluation {
  metadata: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    current_role: string;
    years_of_experience: number;
  };
  category_scores: {
    core_skills: CategoryScore;
    preferred_skills: CategoryScore;
    experience: CategoryScore;
    education: CategoryScore;
    industry_fit: CategoryScore;
    soft_skills: CategoryScore;
    total_score: CategoryScore;
  };
  red_flags: string[];
  highlighted_skills: string[];
  ai_recommendation: 'Interview Immediately' | 'Interview' | 'Consider' | 'Do Not Recommend' | 'Manual Review Required';
  notes: string;
  candidate_id: string;
  screen: boolean;
  duplicate_info?: any;
}

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const glassInputFocus = {
  background: 'var(--orbis-hover)',
  borderColor: '#1B8EE5',
  boxShadow: '0 0 20px rgba(27,142,229,0.15)',
};

const glassInputBlur = {
  background: 'var(--orbis-input)',
  borderColor: 'var(--orbis-border)',
  boxShadow: 'none',
};

const AddCandidateModal = ({ jobId, isOpen, onClose, onSuccess }: AddCandidateModalProps) => {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [evaluation, setEvaluation] = useState<CandidateEvaluation | null>(null);
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);
  const [pendingResult, setPendingResult] = useState<CandidateEvaluation | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const { toast } = useToast();

  const handleResumeUpload = async () => {
    if (!resumeFile) {
      toast({ title: 'Error', description: 'Please select a resume file.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const result = await apiClient.uploadCandidate(jobId, resumeFile, false);

      if (result.duplicate_info) {
        setPendingResult(result);
        setShowDuplicateModal(true);
      } else {
        setEvaluation(result);
        toast({ title: 'Success', description: 'Resume uploaded and analyzed successfully!' });
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast({ title: 'Error', description: 'Failed to upload and analyze resume.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDuplicateContinue = () => {
    setShowDuplicateModal(false);
    if (pendingResult) {
      setEvaluation(pendingResult);
      setPendingResult(null);
      toast({ title: 'Success', description: 'Resume analyzed. Existing profile was updated with latest data.' });
    }
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateModal(false);
    setPendingResult(null);
    resetForm();
    toast({ title: 'Cancelled', description: 'Upload cancelled. No changes were made.' });
  };

  const handleScreeningDecision = async (screening: boolean) => {
    if (!evaluation) return;
    setIsProcessingDecision(true);
    try {
      await apiClient.screenCandidate(evaluation.candidate_id, screening);
      toast({ title: 'Success', description: `Candidate ${screening ? 'screened' : 'rejected'} successfully!` });
      onSuccess();
      resetForm();
    } catch (error) {
      console.error('Error processing decision:', error);
      toast({ title: 'Error', description: 'Failed to process decision.', variant: 'destructive' });
    } finally {
      setIsProcessingDecision(false);
    }
  };

  const resetForm = () => {
    setResumeFile(null);
    setEvaluation(null);
    setPendingResult(null);
    setShowDuplicateModal(false);
  };

  const handleClose = () => {
    if (!isUploading && !isProcessingDecision) {
      resetForm();
      onClose();
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'Interview Immediately':
      case 'Interview':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'Consider':
      case 'Manual Review Required':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'Do Not Recommend':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  const glassCard = 'rounded-2xl p-6 border border-white/10 bg-white/[0.03] backdrop-blur-sm';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader className="space-y-4 pb-6">
            <DialogTitle className="text-2xl font-bold text-white flex items-center">
              <User className="w-6 h-6 mr-3 text-blue-400" />
              Add New Candidate
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-base">
              Upload candidate resume for AI evaluation and make screening decision
            </DialogDescription>
          </DialogHeader>

          {!evaluation ? (
            <div className="space-y-8">
              <div className={glassCard}>
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Resume Upload</h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="resume-file" className="text-base font-medium text-slate-300 mb-2 block">
                      Resume/CV (Required) *
                    </label>
                    <div className="relative">
                      <input
                        id="resume-file"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                        className="cursor-pointer w-full border-2 border-dashed border-blue-500/30 hover:border-blue-400/50 transition-colors duration-300 bg-white/[0.03] hover:bg-white/[0.05] p-4 text-center rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500/20 file:text-blue-300 file:text-sm file:font-medium"
                        required
                      />
                      {resumeFile && (
                        <div className="mt-3 p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-green-300 font-medium">{resumeFile.name}</span>
                            <span className="text-xs text-green-400">({(resumeFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-2">Upload candidate's resume in PDF or Word format (Max 10MB)</p>
                  </div>
                </div>
              </div>

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
                  onClick={handleResumeUpload}
                  disabled={isUploading || !resumeFile}
                  className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none font-medium"
                >
                  {isUploading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Upload className="w-4 h-4" />
                      <span>Upload & Analyze</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* AI Recommendation Header */}
              <div className="rounded-2xl p-6 border border-blue-500/20 bg-blue-500/10">
                <div className="flex items-center space-x-3 mb-4">
                  {getRecommendationIcon(evaluation.ai_recommendation)}
                  <h4 className="text-lg font-semibold text-white">AI Recommendation</h4>
                </div>
                <div className="flex items-center justify-between">
                  <RecommendationBadge recommendation={evaluation.ai_recommendation} className="text-base px-4 py-2" />
                  <div className="text-sm text-slate-400 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                    Based on resume analysis against job requirements
                  </div>
                </div>
              </div>

              {/* Duplicate merge notice */}
              {evaluation.duplicate_info && (
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-amber-300">Existing Profile Merged</div>
                    <div className="text-sm text-amber-400/80">
                      This candidate was already in the system (matched by {evaluation.duplicate_info.match_reasons?.join(', ')}).
                      Their profile has been updated with the latest resume data.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Candidate Information */}
                <div className={glassCard}>
                  <h4 className="text-lg font-semibold text-white mb-6 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-400" />
                    Candidate Information
                  </h4>
                  <div className="space-y-4">
                    {[
                      { icon: User, color: 'text-blue-400', label: 'Name', value: evaluation.metadata.full_name },
                      { icon: Mail, color: 'text-green-400', label: 'Email', value: evaluation.metadata.email },
                      { icon: Phone, color: 'text-blue-400', label: 'Phone', value: evaluation.metadata.phone },
                      { icon: MapPin, color: 'text-orange-400', label: 'Location', value: evaluation.metadata.location },
                      { icon: Briefcase, color: 'text-blue-400', label: 'Current Role', value: evaluation.metadata.current_role },
                      { icon: Calendar, color: 'text-yellow-400', label: 'Experience', value: `${evaluation.metadata.years_of_experience} years` },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center space-x-3 p-3 bg-white/[0.03] rounded-lg border border-white/5">
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        <div>
                          <span className="text-sm text-slate-500">{item.label}</span>
                          <div className="font-semibold text-white">{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className={glassCard}>
                  <h4 className="text-lg font-semibold text-white mb-6 flex items-center">
                    <Star className="w-5 h-5 mr-2 text-yellow-400" />
                    Score Breakdown
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(evaluation.category_scores).map(([key, { obtained_score, max_score }]) => {
                      const percentage = (obtained_score / max_score) * 100;
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-300">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <span className="text-sm font-bold text-white">
                              {obtained_score} / {max_score}
                            </span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                percentage >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                                percentage >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                                'bg-gradient-to-r from-red-500 to-rose-400'
                              }`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Skills and Red Flags */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {evaluation.highlighted_skills.length > 0 && (
                  <div className="rounded-2xl p-6 border border-green-700/30 bg-green-900/10 backdrop-blur-sm">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Star className="w-5 h-5 mr-2 text-green-400" />
                      Key Skills
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {evaluation.highlighted_skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-green-900/40 text-green-300 rounded-full text-sm font-medium border border-green-700/50 hover:bg-green-900/60 transition-all duration-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {evaluation.red_flags.length > 0 && (
                  <div className="rounded-2xl p-6 border border-red-700/30 bg-red-900/10 backdrop-blur-sm">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Flag className="w-5 h-5 mr-2 text-red-400" />
                      Red Flags
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {evaluation.red_flags.map((flag, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-red-900/40 text-red-300 rounded-full text-sm font-medium border border-red-700/50 hover:bg-red-900/60 transition-all duration-300"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Notes */}
              {evaluation.notes && (
                <div className={glassCard}>
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-slate-400" />
                    AI Analysis Notes
                  </h4>
                  <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5">
                    <p className="text-slate-300 leading-relaxed">{evaluation.notes}</p>
                  </div>
                </div>
              )}

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Decision Buttons */}
              <div className={glassCard}>
                <h4 className="text-lg font-semibold text-white mb-6 text-center">Make Your Decision</h4>
                <div className="flex justify-center space-x-6">
                  <button
                    onClick={() => handleScreeningDecision(true)}
                    disabled={isProcessingDecision}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none font-medium"
                  >
                    {isProcessingDecision ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Screen Candidate</span>
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => handleScreeningDecision(false)}
                    disabled={isProcessingDecision}
                    className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none font-medium"
                  >
                    {isProcessingDecision ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <XCircle className="w-4 h-4" />
                        <span>Reject Candidate</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Detection Modal */}
      {pendingResult?.duplicate_info && (
        <RecruiterDuplicateModal
          isOpen={showDuplicateModal}
          duplicateInfo={pendingResult.duplicate_info}
          onContinue={handleDuplicateContinue}
          onCancel={handleDuplicateCancel}
        />
      )}
    </>
  );
};

export default AddCandidateModal;
