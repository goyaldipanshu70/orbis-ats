
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, Clock, User, Award, AlertTriangle, Briefcase,
  GraduationCap, ArrowRight, MessageSquare, ClipboardList,
  BarChart3, PuzzleIcon, Trophy, ChevronLeft, Sparkles,
  TrendingUp, Shield, FileText, Edit3, Loader2, Camera,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
      // Profile may not exist for this candidate
      setCandidateProfile(null);
    }
  };

  const openEditProfile = async () => {
    if (!candidate && !candidateProfile) return;
    // Try to load profile data first, then populate form
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center justify-center h-[60vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="text-base font-medium text-muted-foreground">Loading candidate details...</p>
            </motion.div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!candidate && !candidateProfile) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center justify-center h-[60vh]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-sm"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/60 flex items-center justify-center">
                <ClipboardList className="w-10 h-10 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No evaluation found</h3>
              <p className="text-sm text-muted-foreground mb-6">This candidate hasn't been interviewed yet.</p>
              <Button variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4 mr-1.5" />
                Go Back
              </Button>
            </motion.div>
          </div>
        </div>
      </AppLayout>
    );
  }

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
    if (maxScore === 0) return { label: 'N/A', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' };
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return { label: 'Excellent', className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
    if (percentage >= 60) return { label: 'Good', className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' };
    return { label: 'Needs Work', className: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' };
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Hero Header ─────────────────────────────────────────── */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="visible"
            className="mb-8"
          >
            {/* Back button */}
            <motion.div variants={itemFade} className="mb-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-muted-foreground hover:text-foreground -ml-2 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </motion.div>

            {/* Candidate hero card */}
            <motion.div variants={itemFade}>
              <Card className="border-0 rounded-2xl shadow-lg bg-gradient-to-r from-white via-white to-blue-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                      {/* Avatar */}
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-bold text-primary">
                          {(candidate?.candidate_name || candidateProfile?.full_name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                          {candidate?.candidate_name || candidateProfile?.full_name || 'Unknown'}
                        </h1>
                        <div className="flex items-center gap-2 mt-1.5 text-muted-foreground">
                          <Briefcase className="w-4 h-4" />
                          <span className="text-base font-medium">{candidate?.position || candidateProfile?.current_role || 'Candidate'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {(isAdmin() || isHR()) && (
                        <Button variant="outline" size="sm" onClick={openEditProfile} className="rounded-xl">
                          <Edit3 className="h-4 w-4 mr-1" /> Edit Profile
                        </Button>
                      )}
                      {candidate?.ai_recommendation && (
                        <RecommendationBadge recommendation={candidate.ai_recommendation} className="text-sm px-4 py-1.5" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick actions */}
            <motion.div variants={itemFade} className="mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Actions</span>
                {quickActions.filter(a => a.show).map(action => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={action.onClick}
                    className="rounded-xl border-border/60 hover:bg-accent/60 hover:shadow-sm transition-all text-xs h-8"
                  >
                    <action.icon className="h-3.5 w-3.5 mr-1.5" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* ── AI Fit Summary + Skills Gap ──────────────────────────── */}
          {jobId && candidateId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <AIFitSummaryCard candidateId={Number(candidateId)} jdId={Number(jobId)} />
              <SemanticSkillsGap candidateId={Number(candidateId)} jdId={Number(jobId)} />
            </div>
          )}

          {/* ── AI Screening Scores + Suggested Questions ──────────── */}
          {jobId && candidateId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <AIScreeningScores candidateId={Number(candidateId)} jdId={Number(jobId)} />
              <AISuggestedQuestions candidateId={Number(candidateId)} jdId={Number(jobId)} />
            </div>
          )}

          {/* ── Main Content Grid ───────────────────────────────────── */}
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
                        iconColor: 'text-blue-500',
                        iconBg: 'bg-blue-50 dark:bg-blue-950/40',
                        label: 'Available to Start',
                        value: candidate.available_to_start,
                      },
                      {
                        icon: Clock,
                        iconColor: 'text-emerald-500',
                        iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
                        label: 'Weekend Work',
                        value: candidate.willing_to_work_weekends,
                      },
                      {
                        icon: User,
                        iconColor: 'text-violet-500',
                        iconBg: 'bg-violet-50 dark:bg-violet-950/40',
                        label: 'Cultural Fit',
                        value: null,
                        badge: (
                          <Badge className={
                            candidate.cultural_fit === 'Yes'
                              ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
                              : 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
                          }>
                            {candidate.cultural_fit}
                          </Badge>
                        ),
                      },
                    ].map((tile, i) => (
                      <Card
                        key={i}
                        className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 bg-card"
                      >
                        <CardContent className="p-4 flex items-center gap-3.5">
                          <div className={`w-10 h-10 rounded-xl ${tile.iconBg} flex items-center justify-center flex-shrink-0`}>
                            <tile.icon className={`w-5 h-5 ${tile.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
                            {tile.badge ? (
                              <div className="mt-0.5">{tile.badge}</div>
                            ) : (
                              <p className="text-sm font-semibold text-foreground truncate">{tile.value}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Profile Info — shown when no evaluation but profile exists */}
              {!candidate && candidateProfile && (
                <motion.div variants={itemFade}>
                  <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2.5 text-lg">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                          <User className="w-4.5 h-4.5 text-blue-500" />
                        </div>
                        Candidate Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {candidateProfile.email && (
                          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
                            <p className="text-sm font-medium text-foreground">{candidateProfile.email}</p>
                          </div>
                        )}
                        {candidateProfile.phone && (
                          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Phone</p>
                            <p className="text-sm font-medium text-foreground">{candidateProfile.phone}</p>
                          </div>
                        )}
                        {candidateProfile.location && (
                          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Location</p>
                            <p className="text-sm font-medium text-foreground">{candidateProfile.location}</p>
                          </div>
                        )}
                        {candidateProfile.category && (
                          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
                            <p className="text-sm font-medium text-foreground">{candidateProfile.category}</p>
                          </div>
                        )}
                      </div>
                      {candidateProfile.notes && (
                        <div className="mt-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm text-foreground leading-relaxed">{candidateProfile.notes}</p>
                        </div>
                      )}
                      <div className="mt-4 p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          This candidate has not been evaluated via AI interview yet. Only profile information is available.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Assessment Summary */}
              {candidate && (
                <motion.div variants={itemFade}>
                  <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2.5 text-lg">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                          <Award className="w-4.5 h-4.5 text-blue-500" />
                        </div>
                        Assessment Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Strongest Competency</h4>
                          </div>
                          <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium rounded-lg px-3 py-1">
                            {candidate.strongest_competency}
                          </Badge>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                              <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Area for Development</h4>
                          </div>
                          <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-medium rounded-lg px-3 py-1">
                            {candidate.area_for_development}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          Overall Impression
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{candidate.overall_impression}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Areas of Concern */}
              {candidate?.red_flags && candidate.red_flags.length > 0 && (
                <motion.div variants={itemFade}>
                  <Card className="border border-red-200/60 dark:border-red-900/40 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-red-500 to-rose-500" />
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2.5 text-lg text-red-600 dark:text-red-400">
                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                          <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
                        </div>
                        Areas of Concern
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2.5">
                        {candidate.red_flags.map((flag, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40">
                            <div className="w-5 h-5 rounded-md bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                            </div>
                            <span className="text-sm text-red-800 dark:text-red-300">{flag}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Additional Notes */}
              <motion.div variants={itemFade}>
                <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2.5 text-lg">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FileText className="w-4.5 h-4.5 text-slate-500" />
                      </div>
                      Additional Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(candidate?.notes || candidateProfile?.notes) ? (
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                        <p className="text-sm text-foreground leading-relaxed">{candidate?.notes || candidateProfile?.notes}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No additional notes available</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* ── Right Column - Scores ─────────────────────────────── */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Overall Assessment Ring — only when evaluation exists */}
              {candidate && (
                <motion.div variants={itemFade}>
                  <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card via-card to-blue-50/30 dark:to-blue-950/20 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                    <CardHeader className="text-center pb-2 pt-6">
                      <CardTitle className="text-lg font-semibold">Overall Assessment</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center pb-6 space-y-5">
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
                              stroke="currentColor"
                              className="text-muted/40"
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
                              className="text-primary"
                              stroke="currentColor"
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
                                className="text-3xl font-bold text-foreground"
                              >
                                {Math.round(totalScorePercentage)}%
                              </motion.div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {totalScore?.obtained_score ?? 0}/{totalScore?.max_score ?? 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      <RecommendationBadge recommendation={candidate.ai_recommendation} className="text-sm px-5 py-2" />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Compatibility Score */}
              {compatibilityScore && (
                <motion.div variants={itemFade}>
                  <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card via-card to-violet-50/30 dark:to-violet-950/20 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
                    <CardHeader className="text-center pb-2 pt-5">
                      <CardTitle className="text-base font-semibold flex items-center justify-center gap-2">
                        <PuzzleIcon className="w-4.5 h-4.5 text-violet-500" />
                        Compatibility
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center pb-5 space-y-2">
                      <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {typeof compatibilityScore.score === 'number'
                          ? `${Math.round(compatibilityScore.score)}%`
                          : typeof compatibilityScore === 'number'
                          ? `${Math.round(compatibilityScore)}%`
                          : '--'}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {compatibilityScore.label || 'Job-Candidate Fit'}
                      </div>
                      {compatibilityScore.summary && (
                        <p className="text-xs text-muted-foreground/80 leading-relaxed mt-1 px-2">{compatibilityScore.summary}</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Score Breakdown */}
              {candidate && (
              <motion.div variants={itemFade}>
                <Card className="border border-border/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      Score Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
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
                              <IconComp className="w-3.5 h-3.5 text-muted-foreground/70" />
                              <span className="text-xs font-medium text-muted-foreground">{label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 rounded-md border ${perfBadge.className}`}>
                                {perfBadge.label}
                              </Badge>
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
                  </CardContent>
                </Card>
              </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Candidate Profile</DialogTitle>
            <DialogDescription>Update candidate information and contact details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {(candidateProfile as any)?.photo_url ? (
                  <img src={(candidateProfile as any).photo_url} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    {(editProfileForm.full_name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" className="rounded-xl" asChild disabled={photoUploading}>
                    <span>
                      {photoUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                      {photoUploading ? 'Uploading...' : 'Change Photo'}
                    </span>
                  </Button>
                </Label>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Full Name</Label>
                <Input value={editProfileForm.full_name || ''} onChange={e => setEditProfileForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={editProfileForm.email || ''} onChange={e => setEditProfileForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={editProfileForm.phone || ''} onChange={e => setEditProfileForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Current Role</Label>
                <Input value={editProfileForm.current_role || ''} onChange={e => setEditProfileForm(f => ({ ...f, current_role: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Input value={editProfileForm.category || ''} onChange={e => setEditProfileForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Engineering, Design" />
              </div>
              <div className="grid gap-2">
                <Label>Location</Label>
                <Input value={editProfileForm.location || ''} onChange={e => setEditProfileForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>LinkedIn URL</Label>
              <Input value={editProfileForm.linkedin_url || ''} onChange={e => setEditProfileForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>GitHub URL</Label>
                <Input value={editProfileForm.github_url || ''} onChange={e => setEditProfileForm(f => ({ ...f, github_url: e.target.value }))} placeholder="https://github.com/..." />
              </div>
              <div className="grid gap-2">
                <Label>Portfolio URL</Label>
                <Input value={editProfileForm.portfolio_url || ''} onChange={e => setEditProfileForm(f => ({ ...f, portfolio_url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={editProfileForm.notes || ''} onChange={e => setEditProfileForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile || photoUploading}>
              {isSavingProfile ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CandidateDetail;
