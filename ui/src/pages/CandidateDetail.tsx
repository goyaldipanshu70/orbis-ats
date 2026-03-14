
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '@/utils/api';
import {
  Calendar, Clock, User, Award, AlertTriangle, Briefcase,
  GraduationCap, ArrowRight, MessageSquare, ClipboardList,
  BarChart3, PuzzleIcon, Trophy, ChevronLeft, Sparkles,
  TrendingUp, Shield, FileText, Edit3, Loader2, Camera,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { CandidateProfile } from '@/types/api';
import AppLayout from '@/components/layout/AppLayout';
import RecommendationBadge from '@/components/RecommendationBadge';
import ScoreDisplay from '@/components/ScoreDisplay';
import { InterviewEvaluationResponse } from '@/types/api';
import { AnimatedProgress } from '@/components/ui/animated-progress';
import AIFitSummaryCard from '@/components/ai/AIFitSummaryCard';
import SemanticSkillsGap from '@/components/ai/SemanticSkillsGap';
import AIScreeningScores from '@/components/ai/AIScreeningScores';
import AISuggestedQuestions from '@/components/ai/AISuggestedQuestions';
import ScreeningQACard from '@/components/ai/ScreeningQACard';
import AIInterviewResultCard from '@/components/ai/AIInterviewResultCard';

/* ── Glass Design System ───────────────────────────────── */
const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};
const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};
const gradientBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
  boxShadow: '0 8px 24px rgba(27,142,229,0.2)',
};
const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

/* ── Framer Motion Variants ─────────────────────────────── */
const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemFade = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const CandidateDetail = () => {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isHR } = useAuth();
  const { toast } = useToast();
  const [candidate, setCandidate] = useState<InterviewEvaluationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [compatibilityScore, setCompatibilityScore] = useState<any>(null);

  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState<Record<string, any>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setIsLoading(false);
      return;
    }
    const promises: Promise<void>[] = [loadCandidateDetails(), loadCandidateProfile()];
    if (jobId) promises.push(loadCompatibility());
    Promise.all(promises);
  }, [jobId, candidateId]);

  const loadCompatibility = async () => {
    if (!jobId || !candidateId) return;
    try {
      const data = await apiClient.getCompatibilityScore(Number(jobId), Number(candidateId));
      setCompatibilityScore(data);
    } catch {
      // Score may not exist for unevaluated candidates
    }
  };

  const loadCandidateDetails = async () => {
    setIsLoading(true);
    try {
      if (!candidateId) return;
      const apiResponse = await apiClient.getCandidateById(candidateId);
      setCandidate(apiResponse);
    } catch {
      // 404 is expected when candidate has no AI evaluation
      setCandidate(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCandidateProfile = async () => {
    if (!candidateId) return;
    try {
      const profile = await apiClient.getCandidateProfile(Number(candidateId));
      setCandidateProfile(profile);
    } catch {
      setCandidateProfile(null);
    }
  };

  const openEditProfile = async () => {
    if (!candidate && !candidateProfile) return;
    let profile = candidateProfile;
    try {
      const p = await apiClient.getCandidateProfile(Number(candidateId));
      setCandidateProfile(p);
      profile = p;
    } catch {
      // Profile may not exist
    }
    setEditProfileForm({
      full_name: profile?.full_name || candidate?.candidate_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      current_role: profile?.current_role || '',
      category: profile?.category || '',
      linkedin_url: (profile as any)?.linkedin_url || '',
      github_url: (profile as any)?.github_url || '',
      portfolio_url: (profile as any)?.portfolio_url || '',
      notes: profile?.notes || candidate?.notes || '',
      location: profile?.location || '',
    });
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!candidateId) return;
    const profileId = candidateProfile?.profile_id || candidateProfile?.id || Number(candidateId);
    setIsSavingProfile(true);
    try {
      await apiClient.updateCandidateProfile(profileId, editProfileForm);
      toast({ title: 'Profile updated successfully' });
      setShowEditProfile(false);
      loadCandidateDetails();
      loadCandidateProfile();
    } catch (err: any) {
      toast({ title: 'Failed to update profile', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !candidateId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Photo must be under 5 MB.', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    const profileId = candidateProfile?.profile_id || candidateProfile?.id || Number(candidateId);
    setPhotoUploading(true);
    try {
      await apiClient.uploadCandidatePhoto(profileId, file);
      toast({ title: 'Photo uploaded successfully' });
      loadCandidateDetails();
      loadCandidateProfile();
    } catch (err: any) {
      toast({ title: 'Failed to upload photo', description: err.message, variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  };

  /* ── Loading State ─────────────────────────────────────── */
  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
          <div className="flex items-center justify-center h-[60vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full" style={{ border: '4px solid rgba(27,142,229,0.2)' }} />
                <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin" style={{ borderTopColor: '#1B8EE5' }} />
              </div>
              <p className="text-base font-medium text-slate-400">Loading candidate details...</p>
            </motion.div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Empty State ───────────────────────────────────────── */
  if (!candidate && !candidateProfile) {
    return (
      <AppLayout>
        <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
          <div className="flex items-center justify-center h-[60vh]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-sm"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
                <ClipboardList className="w-10 h-10 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No evaluation found</h3>
              <p className="text-sm text-slate-400 mb-6">This candidate hasn't been interviewed yet.</p>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                style={glassCard}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
              >
                <ChevronLeft className="h-4 w-4" />
                Go Back
              </button>
            </motion.div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Helpers ───────────────────────────────────────────── */
  const scoreBreakdownLabels = {
    technical_competency: 'Technical Competency',
    core_qualifications: 'Core Qualifications',
    communication_skills: 'Communication Skills',
    problem_solving: 'Problem Solving',
    domain_knowledge: 'Domain Knowledge',
    teamwork_culture_fit: 'Teamwork & Culture Fit'
  };

  const scoreBreakdownIcons: Record<string, typeof TrendingUp> = {
    technical_competency: Sparkles,
    core_qualifications: Shield,
    communication_skills: MessageSquare,
    problem_solving: PuzzleIcon,
    domain_knowledge: GraduationCap,
    teamwork_culture_fit: User,
  };

  const getPerformanceColor = (score: number, maxScore: number) => {
    if (maxScore === 0) return 'bg-gray-400';
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getPerformanceBadge = (score: number, maxScore: number) => {
    if (maxScore === 0) return { label: 'N/A', cls: 'bg-white/5 text-slate-400 border-white/10' };
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return { label: 'Excellent', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (percentage >= 60) return { label: 'Good', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { label: 'Needs Work', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  };

  const totalScore = candidate?.score_breakdown?.total_score;
  const totalScorePercentage = (totalScore && totalScore.max_score > 0) ? (totalScore.obtained_score / totalScore.max_score) * 100 : 0;

  const quickActions = [
    { label: 'Pipeline', icon: ArrowRight, show: !!jobId, onClick: () => navigate(`/jobs/${jobId}/pipeline`) },
    { label: 'Scorecard', icon: ClipboardList, show: !!candidateId, onClick: () => navigate(`/scorecard/${candidateId}${jobId ? `?jd_id=${jobId}` : ''}`) },
    { label: 'Feedback', icon: MessageSquare, show: !!(candidateId && jobId), onClick: () => navigate(`/jobs/${jobId}/candidates/${candidateId}/feedback`) },
    { label: 'AI Ranking', icon: Trophy, show: !!jobId, onClick: () => navigate(`/jobs/${jobId}/pipeline`) },
    { label: 'Analytics', icon: BarChart3, show: !!jobId, onClick: () => navigate(`/analytics?jd_id=${jobId}`) },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen relative" style={{ background: 'var(--orbis-page)' }}>
        {/* Ambient glow */}
        <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(27,142,229,0.04)', filter: 'blur(120px)' }} />
        <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(59,130,246,0.04)', filter: 'blur(120px)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Hero Header ─────────────────────────────────────── */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="visible"
            className="mb-8"
          >
            {/* Back button */}
            <motion.div variants={itemFade} className="mb-5">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-sm font-medium group"
              >
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back
              </button>
            </motion.div>

            {/* Candidate hero card */}
            <motion.div variants={itemFade}>
              <div className="rounded-2xl p-6 sm:p-8 overflow-hidden" style={glassCard}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-5">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(27,142,229,0.15)', border: '1px solid rgba(27,142,229,0.3)' }}>
                      <span className="text-2xl font-bold" style={{ color: '#1B8EE5' }}>
                        {(candidate?.candidate_name || candidateProfile?.full_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {candidate?.candidate_name || candidateProfile?.full_name || 'Unknown'}
                      </h1>
                      <div className="flex items-center gap-2 mt-1.5 text-slate-400">
                        <Briefcase className="w-4 h-4" />
                        <span className="text-base font-medium">{candidate?.position || candidateProfile?.current_role || 'Candidate'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {(isAdmin() || isHR()) && (
                      <button
                        onClick={openEditProfile}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                        style={glassCard}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                      >
                        <Edit3 className="h-4 w-4" /> Edit Profile
                      </button>
                    )}
                    {candidate?.ai_recommendation && (
                      <RecommendationBadge recommendation={candidate.ai_recommendation} className="text-sm px-4 py-1.5" />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick actions */}
            <motion.div variants={itemFade} className="mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">Actions</span>
                {quickActions.filter(a => a.show).map(action => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 transition-all hover:text-white"
                    style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-hover)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-grid)'; }}
                  >
                    <action.icon className="h-3.5 w-3.5" />
                    {action.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* ── AI Fit Summary + Skills Gap ──────────────────────── */}
          {jobId && candidateId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <AIFitSummaryCard candidateId={Number(candidateId)} jdId={Number(jobId)} />
              <SemanticSkillsGap candidateId={Number(candidateId)} jdId={Number(jobId)} />
            </div>
          )}

          {/* ── AI Screening Scores + Suggested Questions ──────── */}
          {jobId && candidateId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <AIScreeningScores candidateId={Number(candidateId)} jdId={Number(jobId)} />
              <AISuggestedQuestions candidateId={Number(candidateId)} jdId={Number(jobId)} />
            </div>
          )}

          {/* ── Screening Q&A + AI Interview Results ──────────── */}
          {jobId && candidateId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ScreeningQACard candidateId={Number(candidateId)} jdId={Number(jobId)} />
              <AIInterviewResultCard candidateId={Number(candidateId)} jdId={Number(jobId)} />
            </div>
          )}

          {/* ── Main Content Grid ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column - Details */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="visible"
              className="lg:col-span-2 space-y-6"
            >
              {/* Key Info Tiles — only when evaluation exists */}
              {candidate && (
                <motion.div variants={itemFade}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        icon: Calendar,
                        iconColor: '#3b82f6',
                        iconBg: 'rgba(59,130,246,0.1)',
                        label: 'Available to Start',
                        value: candidate.available_to_start,
                      },
                      {
                        icon: Clock,
                        iconColor: '#34d399',
                        iconBg: 'rgba(52,211,153,0.1)',
                        label: 'Weekend Work',
                        value: candidate.willing_to_work_weekends,
                      },
                      {
                        icon: User,
                        iconColor: '#4db5f0',
                        iconBg: 'rgba(77,181,240,0.1)',
                        label: 'Cultural Fit',
                        value: null,
                        badge: candidate.cultural_fit,
                      },
                    ].map((tile, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-4 flex items-center gap-3.5 transition-all hover:scale-[1.02]"
                        style={glassCard}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tile.iconBg }}>
                          <tile.icon className="w-5 h-5" style={{ color: tile.iconColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-500">{tile.label}</p>
                          {tile.badge ? (
                            <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded-md border ${
                              tile.badge === 'Yes'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {tile.badge}
                            </span>
                          ) : (
                            <p className="text-sm font-semibold text-white truncate">{tile.value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Profile Info — shown when no evaluation but profile exists */}
              {!candidate && candidateProfile && (
                <motion.div variants={itemFade}>
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div className="p-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="flex items-center gap-2.5 text-lg font-bold text-white">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                        Candidate Profile
                      </h3>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {candidateProfile.email && (
                          <div className="p-3 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                            <p className="text-xs font-medium text-slate-500 mb-1">Email</p>
                            <p className="text-sm font-medium text-white">{candidateProfile.email}</p>
                          </div>
                        )}
                        {candidateProfile.phone && (
                          <div className="p-3 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                            <p className="text-xs font-medium text-slate-500 mb-1">Phone</p>
                            <p className="text-sm font-medium text-white">{candidateProfile.phone}</p>
                          </div>
                        )}
                        {candidateProfile.location && (
                          <div className="p-3 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                            <p className="text-xs font-medium text-slate-500 mb-1">Location</p>
                            <p className="text-sm font-medium text-white">{candidateProfile.location}</p>
                          </div>
                        )}
                        {candidateProfile.category && (
                          <div className="p-3 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                            <p className="text-xs font-medium text-slate-500 mb-1">Category</p>
                            <p className="text-sm font-medium text-white">{candidateProfile.category}</p>
                          </div>
                        )}
                      </div>
                      {candidateProfile.notes && (
                        <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                          <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                          <p className="text-sm text-slate-300 leading-relaxed">{candidateProfile.notes}</p>
                        </div>
                      )}
                      <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                        <p className="text-sm text-amber-400">
                          This candidate has not been evaluated via AI interview yet. Only profile information is available.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Assessment Summary */}
              {candidate && (
                <motion.div variants={itemFade}>
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div className="p-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="flex items-center gap-2.5 text-lg font-bold text-white">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <Award className="w-4 h-4 text-blue-400" />
                        </div>
                        Assessment Summary
                      </h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
                              <Award className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-emerald-400">Strongest Competency</h4>
                          </div>
                          <span className="inline-block text-xs font-bold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {candidate.strongest_competency}
                          </span>
                        </div>
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
                              <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-amber-400">Area for Development</h4>
                          </div>
                          <span className="inline-block text-xs font-bold px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {candidate.area_for_development}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                        <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          Overall Impression
                        </h4>
                        <p className="text-sm text-slate-400 leading-relaxed">{candidate.overall_impression}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Areas of Concern */}
              {candidate?.red_flags && candidate.red_flags.length > 0 && (
                <motion.div variants={itemFade}>
                  <div className="rounded-xl overflow-hidden" style={{ ...glassCard, borderColor: 'rgba(244,63,94,0.2)' }}>
                    <div className="h-1" style={{ background: 'linear-gradient(90deg, #ef4444, #f43f5e)' }} />
                    <div className="p-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="flex items-center gap-2.5 text-lg font-bold text-rose-400">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.1)' }}>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                        </div>
                        Areas of Concern
                      </h3>
                    </div>
                    <div className="p-5 space-y-2.5">
                      {candidate.red_flags.map((flag, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.12)' }}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(244,63,94,0.15)' }}>
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                          </div>
                          <span className="text-sm text-rose-300">{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Additional Notes */}
              <motion.div variants={itemFade}>
                <div className="rounded-xl overflow-hidden" style={glassCard}>
                  <div className="p-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <h3 className="flex items-center gap-2.5 text-lg font-bold text-white">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      Additional Notes
                    </h3>
                  </div>
                  <div className="p-5">
                    {(candidate?.notes || candidateProfile?.notes) ? (
                      <div className="p-4 rounded-xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                        <p className="text-sm text-slate-300 leading-relaxed">{candidate?.notes || candidateProfile?.notes}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No additional notes available</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* ── Right Column - Scores ─────────────────────────── */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Overall Assessment Ring — only when evaluation exists */}
              {candidate && (
                <motion.div variants={itemFade}>
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div className="h-1" style={{ background: 'linear-gradient(90deg, #3b82f6, #1676c0)' }} />
                    <div className="text-center pt-6 pb-2 px-5">
                      <h3 className="text-lg font-bold text-white">Overall Assessment</h3>
                    </div>
                    <div className="text-center pb-6 px-5 space-y-5">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                      >
                        <div className="w-36 h-36 mx-auto relative">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="var(--orbis-border)"
                              strokeWidth="6"
                              fill="none"
                            />
                            <motion.circle
                              cx="50"
                              cy="50"
                              r="40"
                              strokeWidth="6"
                              fill="none"
                              strokeLinecap="round"
                              stroke="#1B8EE5"
                              initial={{ strokeDasharray: '0 251.2' }}
                              animate={{ strokeDasharray: `${totalScorePercentage * 2.512} 251.2` }}
                              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-3xl font-bold text-white"
                              >
                                {Math.round(totalScorePercentage)}%
                              </motion.div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {totalScore?.obtained_score ?? 0}/{totalScore?.max_score ?? 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      <RecommendationBadge recommendation={candidate.ai_recommendation} className="text-sm px-5 py-2" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Compatibility Score */}
              {compatibilityScore && (
                <motion.div variants={itemFade}>
                  <div className="rounded-xl overflow-hidden" style={glassCard}>
                    <div className="h-1" style={{ background: 'linear-gradient(90deg, #1B8EE5, #a855f7)' }} />
                    <div className="text-center pt-5 pb-2 px-5">
                      <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                        <PuzzleIcon className="w-4 h-4 text-blue-400" />
                        Compatibility
                      </h3>
                    </div>
                    <div className="text-center pb-5 px-5 space-y-2">
                      <div className="text-4xl font-bold" style={{ background: 'linear-gradient(135deg, #1B8EE5, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {typeof compatibilityScore.score === 'number'
                          ? `${Math.round(compatibilityScore.score)}%`
                          : typeof compatibilityScore === 'number'
                          ? `${Math.round(compatibilityScore)}%`
                          : '--'}
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        {compatibilityScore.label || 'Job-Candidate Fit'}
                      </div>
                      {compatibilityScore.summary && (
                        <p className="text-xs text-slate-500 leading-relaxed mt-1 px-2">{compatibilityScore.summary}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Score Breakdown */}
              {candidate && (
              <motion.div variants={itemFade}>
                <div className="rounded-xl overflow-hidden" style={glassCard}>
                  <div className="p-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-slate-400" />
                      Score Breakdown
                    </h3>
                  </div>
                  <div className="p-5 space-y-5">
                    {Object.entries(scoreBreakdownLabels).map(([key, label]) => {
                      const scoreKey = key as keyof typeof scoreBreakdownLabels;
                      const score = candidate.score_breakdown?.[scoreKey];

                      if (!score) return null;

                      const percentage = score.max_score > 0 ? (score.obtained_score / score.max_score) * 100 : 0;
                      const perfBadge = getPerformanceBadge(score.obtained_score, score.max_score);
                      const IconComp = scoreBreakdownIcons[key] || TrendingUp;

                      return (
                        <div className="space-y-2" key={key}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <IconComp className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-xs font-medium text-slate-400">{label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0 h-5 inline-flex items-center rounded-md border ${perfBadge.cls}`}>
                                {perfBadge.label}
                              </span>
                              <ScoreDisplay
                                score={score.obtained_score}
                                maxScore={score.max_score}
                                showPercentage={false}
                                size="sm"
                              />
                            </div>
                          </div>
                          <AnimatedProgress
                            value={percentage}
                            className="h-1.5 rounded-full"
                            barClassName={`${getPerformanceColor(score.obtained_score, score.max_score)} rounded-full`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Edit Profile Dialog ─────────────────────────────── */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-bold">Edit Candidate Profile</DialogTitle>
            <DialogDescription className="text-slate-400">Update candidate information and contact details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: 'rgba(27,142,229,0.15)', border: '1px solid rgba(27,142,229,0.3)' }}>
                {(candidateProfile as any)?.photo_url ? (
                  <img src={(candidateProfile as any).photo_url} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold" style={{ color: '#1B8EE5' }}>
                    {(editProfileForm.full_name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <span
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                    style={glassCard}
                  >
                    {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {photoUploading ? 'Uploading...' : 'Change Photo'}
                  </span>
                </label>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">Full Name</label>
                <input
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.full_name || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">Email</label>
                <input
                  type="email"
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.email || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">Phone</label>
                <input
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.phone || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">Current Role</label>
                <input
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.current_role || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, current_role: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">Category</label>
                <input
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.category || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Engineering, Design"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">Location</label>
                <input
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.location || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-300">LinkedIn URL</label>
              <input
                className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                style={glassInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                value={editProfileForm.linkedin_url || ''}
                onChange={e => setEditProfileForm(f => ({ ...f, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">GitHub URL</label>
                <input
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.github_url || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, github_url: e.target.value }))}
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-300">Portfolio URL</label>
                <input
                  className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  value={editProfileForm.portfolio_url || ''}
                  onChange={e => setEditProfileForm(f => ({ ...f, portfolio_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-300">Notes</label>
              <textarea
                className="w-full rounded-xl p-4 text-sm outline-none transition-all resize-none placeholder:text-slate-500"
                style={glassInput}
                onFocus={handleFocus as any}
                onBlur={handleBlur as any}
                rows={3}
                value={editProfileForm.notes || ''}
                onChange={e => setEditProfileForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <button
              onClick={() => setShowEditProfile(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={glassCard}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile || photoUploading}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={gradientBtn}
            >
              {isSavingProfile ? (
                <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span>
              ) : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CandidateDetail;
