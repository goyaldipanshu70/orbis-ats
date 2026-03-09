
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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

      // Check if duplicate was detected
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
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Consider':
      case 'Manual Review Required':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'Do Not Recommend':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-blue-50 border-0 shadow-2xl">
          <DialogHeader className="space-y-4 pb-6">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent flex items-center">
              <User className="w-6 h-6 mr-3 text-blue-600" />
              Add New Candidate
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-base">
              Upload candidate resume for AI evaluation and make screening decision
            </DialogDescription>
          </DialogHeader>

          {!evaluation ? (
            <div className="space-y-8">
              <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-blue-100 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground">Resume Upload</h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="resume-file" className="text-base font-medium text-foreground mb-2 block">
                      Resume/CV (Required) *
                    </Label>
                    <div className="relative">
                      <Input
                        id="resume-file"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                        className="cursor-pointer border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors duration-300 bg-blue-50/50 hover:bg-blue-50 p-4 text-center rounded-xl"
                        required
                      />
                      {resumeFile && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-800 font-medium">{resumeFile.name}</span>
                            <span className="text-xs text-green-600">({(resumeFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Upload candidate's resume in PDF or Word format (Max 10MB)</p>
                  </div>
                </div>
              </div>

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
                  onClick={handleResumeUpload}
                  disabled={isUploading || !resumeFile}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
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
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* AI Recommendation Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  {getRecommendationIcon(evaluation.ai_recommendation)}
                  <h4 className="text-lg font-semibold text-foreground">AI Recommendation</h4>
                </div>
                <div className="flex items-center justify-between">
                  <RecommendationBadge recommendation={evaluation.ai_recommendation} className="text-base px-4 py-2" />
                  <div className="text-sm text-muted-foreground bg-card/70 px-4 py-2 rounded-lg">
                    Based on resume analysis against job requirements
                  </div>
                </div>
              </div>

              {/* Duplicate merge notice */}
              {evaluation.duplicate_info && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-amber-800">Existing Profile Merged</div>
                    <div className="text-sm text-amber-700">
                      This candidate was already in the system (matched by {evaluation.duplicate_info.match_reasons?.join(', ')}).
                      Their profile has been updated with the latest resume data.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Candidate Information */}
                <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-border shadow-lg">
                  <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-600" />
                    Candidate Information
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                      <User className="w-4 h-4 text-blue-600" />
                      <div>
                        <span className="text-sm text-muted-foreground">Name</span>
                        <div className="font-semibold text-foreground">{evaluation.metadata.full_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                      <Mail className="w-4 h-4 text-green-600" />
                      <div>
                        <span className="text-sm text-muted-foreground">Email</span>
                        <div className="font-semibold text-foreground">{evaluation.metadata.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                      <Phone className="w-4 h-4 text-purple-600" />
                      <div>
                        <span className="text-sm text-muted-foreground">Phone</span>
                        <div className="font-semibold text-foreground">{evaluation.metadata.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      <div>
                        <span className="text-sm text-muted-foreground">Location</span>
                        <div className="font-semibold text-foreground">{evaluation.metadata.location}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      <div>
                        <span className="text-sm text-muted-foreground">Current Role</span>
                        <div className="font-semibold text-foreground">{evaluation.metadata.current_role}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                      <Calendar className="w-4 h-4 text-yellow-600" />
                      <div>
                        <span className="text-sm text-muted-foreground">Experience</span>
                        <div className="font-semibold text-foreground">{evaluation.metadata.years_of_experience} years</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-border shadow-lg">
                  <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center">
                    <Star className="w-5 h-5 mr-2 text-yellow-600" />
                    Score Breakdown
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(evaluation.category_scores).map(([key, { obtained_score, max_score }]) => {
                      const percentage = (obtained_score / max_score) * 100;
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-foreground">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <span className="text-sm font-bold text-foreground">
                              {obtained_score} / {max_score}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                percentage >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                percentage >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                'bg-gradient-to-r from-red-500 to-rose-500'
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
                  <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-green-200 shadow-lg">
                    <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                      <Star className="w-5 h-5 mr-2 text-green-600" />
                      Key Skills
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {evaluation.highlighted_skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-full text-sm font-medium border border-green-200 hover:from-green-200 hover:to-emerald-200 transition-all duration-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {evaluation.red_flags.length > 0 && (
                  <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-red-200 shadow-lg">
                    <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                      <Flag className="w-5 h-5 mr-2 text-red-600" />
                      Red Flags
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {evaluation.red_flags.map((flag, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-gradient-to-r from-red-100 to-rose-100 text-red-800 rounded-full text-sm font-medium border border-red-200 hover:from-red-200 hover:to-rose-200 transition-all duration-300"
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
                <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-border shadow-lg">
                  <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-muted-foreground" />
                    AI Analysis Notes
                  </h4>
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl border border-border">
                    <p className="text-foreground leading-relaxed">{evaluation.notes}</p>
                  </div>
                </div>
              )}

              <Separator className="bg-gradient-to-r from-blue-200 to-indigo-200" />

              {/* Decision Buttons */}
              <div className="bg-card/70 backdrop-blur-sm rounded-2xl p-6 border border-border shadow-lg">
                <h4 className="text-lg font-semibold text-foreground mb-6 text-center">Make Your Decision</h4>
                <div className="flex justify-center space-x-6">
                  <Button
                    onClick={() => handleScreeningDecision(true)}
                    disabled={isProcessingDecision}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
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
                  </Button>

                  <Button
                    onClick={() => handleScreeningDecision(false)}
                    disabled={isProcessingDecision}
                    variant="destructive"
                    className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
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
                  </Button>
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
