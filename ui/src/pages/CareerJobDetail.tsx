import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import PublicLayout from '@/components/layout/PublicLayout';
import QuickApplyModal from '@/components/QuickApplyModal';
import DuplicateDetectedModal from '@/components/DuplicateDetectedModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, MapPin, ArrowLeft, Upload, FileText, CheckCircle2, Loader2, X,
  ChevronRight, ChevronLeft, Check, Send, Linkedin, Github, Globe, AlertCircle, Zap,
  Clock, ShieldAlert, Building2, Star, Users, Sparkles,
} from 'lucide-react';
import { Shine } from '@/components/ui/shine';
import { Fade } from '@/components/ui/fade';

interface ScreeningQ {
  id: number;
  question: string;
  question_type: 'text' | 'multiple_choice' | 'yes_no';
  options: string[] | null;
  required: boolean;
  sort_order: number;
}

const STEPS = ['Upload Resume', 'Verify Details', 'Questions', 'Review & Submit'];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const CareerJobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capture referral code and UTM params from URL
  const refCode = searchParams.get('ref') || '';
  const utmSource = searchParams.get('utm_source') || '';
  const utmMedium = searchParams.get('utm_medium') || '';

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [step, setStep] = useState(0);

  // Step 0: Resume upload + parsing
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedResumeUrl, setParsedResumeUrl] = useState('');
  const [tempFilename, setTempFilename] = useState('');

  // Step 1: Verify details (pre-filled from parse)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  // Step 2: Screening questions
  const [questions, setQuestions] = useState<ScreeningQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Step 3: Cover letter & submit
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lock status
  const [lockInfo, setLockInfo] = useState<{ locked: boolean; lock_expiry?: string; remaining_days?: number; message?: string } | null>(null);

  // Duplicate modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    Promise.all([
      apiClient.getPublicJobDetail(jobId),
      apiClient.getPublicScreeningQuestions(jobId),
    ])
      .then(([jobData, qs]) => {
        setJob(jobData);
        setQuestions(qs || []);
      })
      .catch(() => navigate('/careers'))
      .finally(() => setLoading(false));
  }, [jobId]);

  // Check lock status for authenticated candidates
  useEffect(() => {
    if (!jobId || !user || user.role !== 'candidate') return;
    apiClient.checkLockStatus(jobId).then(setLockInfo).catch(() => {});
  }, [jobId, user]);

  // Pre-fill from user account
  useEffect(() => {
    if (user) {
      setFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
      setEmail(user.email || '');
    }
  }, [user]);

  const handleApply = () => {
    if (!user) {
      navigate('/careers/signup');
      return;
    }
    if (user.role !== 'candidate') {
      toast.error('Only candidate accounts can apply to jobs');
      return;
    }
    // If profile is complete, offer quick apply; otherwise use multi-step form
    if (user.profile_complete) {
      setShowQuickApply(true);
    } else {
      setShowApplyForm(true);
      setStep(0);
    }
  };

  const handleFileSelect = async (file: File) => {
    setResumeFile(file);
    setParseError(null);
    setParsing(true);

    try {
      const result = await apiClient.parseResume(file);
      const m = result.metadata || {};

      // Pre-fill fields from extracted metadata
      if (m.full_name) setFullName(m.full_name);
      if (m.email && !user) setEmail(m.email);
      if (m.phone) setPhone(m.phone);
      if (m.location) setLocation(m.location);
      if (m.current_role) setCurrentRole(m.current_role);
      if (m.years_of_experience != null) setYearsExperience(String(m.years_of_experience));
      if (m.linkedin_url) setLinkedinUrl(m.linkedin_url);
      if (m.github_url) setGithubUrl(m.github_url);
      if (m.portfolio_url) setPortfolioUrl(m.portfolio_url);
      if (m.skills?.length) setSkills(m.skills);

      setParsedResumeUrl(result.resume_url || '');
      setTempFilename(result.temp_filename || '');

      // Auto-advance to verify details
      setStep(1);
    } catch (err: any) {
      console.error('Resume parse failed:', err);
      setParseError('Could not extract details automatically. You can fill them in manually.');
    } finally {
      setParsing(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!resumeFile && !parsing;
      case 1: return fullName.trim() && email.trim();
      case 2: {
        const required = questions.filter(q => q.required);
        return required.every(q => answers[q.id]?.trim());
      }
      case 3: return true;
      default: return true;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(pdf|doc|docx)$/i.test(file.name)) {
      handleFileSelect(file);
    } else {
      toast.error('Please upload a PDF or DOC file');
    }
  };

  const handleSubmit = async () => {
    if (!resumeFile || !jobId) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('resume_file', resumeFile);
      formData.append('jd_id', jobId);
      if (phone) formData.append('phone', phone);
      if (linkedinUrl) formData.append('linkedin_url', linkedinUrl);
      if (githubUrl) formData.append('github_url', githubUrl);
      if (portfolioUrl) formData.append('portfolio_url', portfolioUrl);
      if (coverLetter) formData.append('cover_letter', coverLetter);

      // Source attribution
      if (refCode) {
        formData.append('source', 'referral');
        formData.append('referral_code', refCode);
      } else if (utmSource) {
        formData.append('source', utmSource);
      } else {
        formData.append('source', 'career_page');
      }
      if (utmMedium) formData.append('utm_medium', utmMedium);

      if (Object.keys(answers).length > 0) {
        const responses = Object.entries(answers).map(([qId, response]) => ({
          question_id: parseInt(qId),
          response,
        }));
        formData.append('screening_responses', JSON.stringify(responses));
      }

      await apiClient.applyToJob(formData);
      toast.success('Application submitted! Your resume is being reviewed by AI.');
      navigate('/my-applications');
    } catch (err: any) {
      if (err.status === 409) {
        try {
          const detail = JSON.parse(err.message);
          if (detail?.duplicate_info) {
            setDuplicateInfo(detail.duplicate_info);
            setShowDuplicateModal(true);
            return;
          }
        } catch {}
      }
      if (err.status === 403) {
        toast.error('Application locked', { description: 'You are in a rejection lock period for this job.' });
        return;
      }
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Loading job details...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!job) return null;

  // Determine effective steps (skip questions step if none)
  const hasQuestions = questions.length > 0;
  const effectiveSteps = hasQuestions ? STEPS : STEPS.filter((_, i) => i !== 2);
  const effectiveStep = hasQuestions ? step : (step >= 2 ? step + 1 : step);

  return (
    <PublicLayout>
      {/* Hero gradient backdrop */}
      <div className="relative">
        <div className="absolute inset-0 h-72 bg-gradient-to-br from-blue-50 via-indigo-50/60 to-purple-50/40 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-background" />
        <div className="absolute inset-0 h-72 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Back navigation */}
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => navigate('/careers')}
            className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to all positions
          </motion.button>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* ---------- LEFT: Job Details ---------- */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header card */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0}
              >
                <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                      <Briefcase className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                        {job.job_title}
                      </h1>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            {job.location}
                          </span>
                        )}
                        {job.department && (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-purple-500" />
                            {job.department}
                          </span>
                        )}
                        {job.employment_type && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-emerald-500" />
                            {job.employment_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* About section */}
              {job.summary && (
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={1}
                >
                  <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Star className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h2 className="text-base font-semibold text-foreground">About this role</h2>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {job.summary}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Requirements section */}
              {job.key_requirements?.length > 0 && (
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={2}
                >
                  <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h2 className="text-base font-semibold text-foreground">Requirements</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {job.key_requirements.map((req: string, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
                          className="flex items-start gap-2.5 rounded-xl bg-muted/50 px-4 py-3 text-sm text-foreground"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{req}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Experience section */}
              {(job.experience?.description || (typeof job.experience === 'string' && job.experience)) && (
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={3}
                >
                  <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h2 className="text-base font-semibold text-foreground">Experience</h2>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {typeof job.experience === 'string' ? job.experience : job.experience.description}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ---------- RIGHT: Apply Panel ---------- */}
            <motion.div
              className="lg:col-span-1"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              <div className="sticky top-24">
                <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg shadow-black/[0.03] overflow-hidden">
                  {/* Panel header accent bar */}
                  <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                  <div className="p-6">
                    {!showApplyForm ? (
                      <div className="text-center space-y-5">
                        {lockInfo?.locked ? (
                          <>
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 mx-auto">
                              <ShieldAlert className="h-8 w-8" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">Reapplication locked</h3>
                              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{lockInfo.message}</p>
                            </div>
                            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 p-4">
                              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                                <Clock className="h-4 w-4" />
                                <span>{lockInfo.remaining_days} days remaining</span>
                              </div>
                              {lockInfo.lock_expiry && (
                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">
                                  Unlocks on {new Date(lockInfo.lock_expiry).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 mx-auto">
                              <Sparkles className="h-8 w-8" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">Interested in this role?</h3>
                              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                Submit your application and our AI will review your resume instantly.
                              </p>
                            </div>
                            {user?.profile_complete ? (
                              <div className="space-y-3">
                                <Shine>
                                  <Button
                                    onClick={() => setShowQuickApply(true)}
                                    className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25 transition-all duration-200"
                                  >
                                    <Zap className="h-4 w-4 mr-2" /> Quick Apply
                                  </Button>
                                </Shine>
                                <Button
                                  variant="outline"
                                  onClick={() => { setShowApplyForm(true); setStep(0); }}
                                  className="w-full h-10 rounded-xl text-sm border-border/80 hover:bg-muted/60"
                                >
                                  Apply with new resume
                                </Button>
                              </div>
                            ) : (
                              <Shine>
                                <Button
                                  onClick={handleApply}
                                  className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200"
                                >
                                  Apply Now
                                </Button>
                              </Shine>
                            )}

                            {/* Trust badges */}
                            <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3" /> Secure
                              </span>
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" /> AI-reviewed
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Fast
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Step Indicator */}
                        <div className="flex items-center justify-between">
                          {effectiveSteps.map((label, i) => (
                            <div key={label} className="flex items-center">
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                                  i < step
                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                                    : i === step
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/30'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {i < step ? <Check className="h-4 w-4" /> : i + 1}
                              </div>
                              {i < effectiveSteps.length - 1 && (
                                <div className={`w-6 h-0.5 mx-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-emerald-500' : 'bg-border'}`} />
                              )}
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-muted-foreground text-center font-medium">
                          Step {step + 1} of {effectiveSteps.length}
                          <span className="text-foreground/70"> &middot; </span>
                          {effectiveSteps[step]}
                        </p>

                        {/* Step Content */}
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {/* Step 0: Upload Resume */}
                            {effectiveStep === 0 && (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Resume *</Label>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    className="hidden"
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileSelect(file);
                                    }}
                                  />
                                  {resumeFile ? (
                                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3 mt-1.5">
                                      <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                                      <span className="text-sm text-emerald-700 dark:text-emerald-400 truncate flex-1 font-medium">{resumeFile.name}</span>
                                      <button type="button" onClick={() => {
                                        setResumeFile(null);
                                        setParseError(null);
                                        setParsedResumeUrl('');
                                        setTempFilename('');
                                      }}>
                                        <X className="h-4 w-4 text-muted-foreground hover:text-red-500 transition-colors" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => fileInputRef.current?.click()}
                                      onDrop={handleDrop}
                                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                      onDragLeave={() => setDragOver(false)}
                                      className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-sm transition-all duration-200 mt-1.5 ${
                                        dragOver
                                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10 text-blue-600 scale-[1.01]'
                                          : 'border-border bg-muted/40 text-muted-foreground hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/5'
                                      }`}
                                    >
                                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                                        <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <div className="text-center">
                                        <span className="font-medium text-sm block">Drop your resume or click to browse</span>
                                        <span className="text-[11px] text-muted-foreground mt-0.5 block">PDF, DOC, DOCX up to 10 MB</span>
                                      </div>
                                    </button>
                                  )}
                                </div>

                                {/* Parsing state */}
                                {parsing && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 px-4 py-3"
                                  >
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">Extracting resume details... 3-5 seconds</span>
                                  </motion.div>
                                )}

                                {parseError && (
                                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
                                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span className="text-xs text-amber-700 dark:text-amber-400">{parseError}</span>
                                  </div>
                                )}

                                {resumeFile && !parsing && !parseError && (
                                  <p className="text-[11px] text-muted-foreground text-center">Your resume will be analyzed by AI after you submit</p>
                                )}
                              </div>
                            )}

                            {/* Step 1: Verify Details */}
                            {effectiveStep === 1 && (
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Full Name *</Label>
                                  <Input
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    className="mt-1 h-9 text-sm rounded-lg"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Email *</Label>
                                  <Input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="john@example.com"
                                    className="mt-1 h-9 text-sm rounded-lg"
                                    disabled={!!user}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                                    <Input
                                      type="tel"
                                      value={phone}
                                      onChange={e => setPhone(e.target.value)}
                                      placeholder="+1 (555) 000-0000"
                                      className="mt-1 h-9 text-sm rounded-lg"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs font-medium text-muted-foreground">Location</Label>
                                    <Input
                                      value={location}
                                      onChange={e => setLocation(e.target.value)}
                                      placeholder="San Francisco, CA"
                                      className="mt-1 h-9 text-sm rounded-lg"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs font-medium text-muted-foreground">Current Role</Label>
                                    <Input
                                      value={currentRole}
                                      onChange={e => setCurrentRole(e.target.value)}
                                      placeholder="Software Engineer"
                                      className="mt-1 h-9 text-sm rounded-lg"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs font-medium text-muted-foreground">Years of Exp.</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={yearsExperience}
                                      onChange={e => setYearsExperience(e.target.value)}
                                      placeholder="5"
                                      className="mt-1 h-9 text-sm rounded-lg"
                                    />
                                  </div>
                                </div>

                                {/* Professional Links */}
                                <div className="border-t border-border/60 pt-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Professional Links <span className="text-muted-foreground/60 font-normal">(optional)</span>
                                  </p>
                                  <div className="space-y-2">
                                    <div className="relative">
                                      <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                      <Input
                                        value={linkedinUrl}
                                        onChange={e => setLinkedinUrl(e.target.value)}
                                        placeholder="linkedin.com/in/yourprofile"
                                        className="pl-9 h-8 text-xs rounded-lg"
                                      />
                                    </div>
                                    <div className="relative">
                                      <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                      <Input
                                        value={githubUrl}
                                        onChange={e => setGithubUrl(e.target.value)}
                                        placeholder="github.com/yourusername"
                                        className="pl-9 h-8 text-xs rounded-lg"
                                      />
                                    </div>
                                    <div className="relative">
                                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                      <Input
                                        value={portfolioUrl}
                                        onChange={e => setPortfolioUrl(e.target.value)}
                                        placeholder="yourportfolio.com"
                                        className="pl-9 h-8 text-xs rounded-lg"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Skills badges */}
                                {skills.length > 0 && (
                                  <div className="border-t border-border/60 pt-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Skills extracted from resume</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {skills.map((skill, i) => (
                                        <span
                                          key={i}
                                          className="rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 px-2.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Step 2: Screening Questions (only if hasQuestions) */}
                            {effectiveStep === 2 && hasQuestions && (
                              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                {questions.map((q) => (
                                  <div key={q.id} className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">
                                      {q.question} {q.required && <span className="text-red-500">*</span>}
                                    </Label>

                                    {q.question_type === 'text' && (
                                      <Textarea
                                        value={answers[q.id] || ''}
                                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        placeholder="Your answer..."
                                        rows={2}
                                        className="text-sm rounded-lg"
                                      />
                                    )}

                                    {q.question_type === 'yes_no' && (
                                      <RadioGroup
                                        value={answers[q.id] || ''}
                                        onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                                        className="flex gap-4"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <RadioGroupItem value="Yes" id={`q${q.id}-yes`} />
                                          <Label htmlFor={`q${q.id}-yes`} className="text-sm">Yes</Label>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <RadioGroupItem value="No" id={`q${q.id}-no`} />
                                          <Label htmlFor={`q${q.id}-no`} className="text-sm">No</Label>
                                        </div>
                                      </RadioGroup>
                                    )}

                                    {q.question_type === 'multiple_choice' && q.options && (
                                      <RadioGroup
                                        value={answers[q.id] || ''}
                                        onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                                        className="space-y-1.5"
                                      >
                                        {q.options.map((opt, i) => (
                                          <div key={i} className="flex items-center gap-1.5">
                                            <RadioGroupItem value={opt} id={`q${q.id}-opt${i}`} />
                                            <Label htmlFor={`q${q.id}-opt${i}`} className="text-sm">{opt}</Label>
                                          </div>
                                        ))}
                                      </RadioGroup>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Step 3: Review & Submit */}
                            {effectiveStep === 3 && (
                              <div className="space-y-3">
                                {/* Summary */}
                                <div className="rounded-xl bg-muted/50 border border-border/40 p-4 space-y-2.5 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Name</span>
                                    <span className="font-medium text-foreground">{fullName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Email</span>
                                    <span className="font-medium text-foreground">{email}</span>
                                  </div>
                                  {phone && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Phone</span>
                                      <span className="font-medium text-foreground">{phone}</span>
                                    </div>
                                  )}
                                  {location && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Location</span>
                                      <span className="font-medium text-foreground">{location}</span>
                                    </div>
                                  )}
                                  {currentRole && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Current Role</span>
                                      <span className="font-medium text-foreground">{currentRole}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Resume</span>
                                    <span className="font-medium text-foreground truncate max-w-[140px]">{resumeFile?.name}</span>
                                  </div>
                                  {linkedinUrl && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">LinkedIn</span>
                                      <span className="font-medium text-blue-600 truncate max-w-[140px] text-xs">{linkedinUrl}</span>
                                    </div>
                                  )}
                                  {githubUrl && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">GitHub</span>
                                      <span className="font-medium text-blue-600 truncate max-w-[140px] text-xs">{githubUrl}</span>
                                    </div>
                                  )}
                                  {portfolioUrl && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Portfolio</span>
                                      <span className="font-medium text-blue-600 truncate max-w-[140px] text-xs">{portfolioUrl}</span>
                                    </div>
                                  )}
                                  {skills.length > 0 && (
                                    <div className="flex justify-between items-start">
                                      <span className="text-muted-foreground shrink-0">Skills</span>
                                      <span className="font-medium text-foreground text-right text-xs">{skills.slice(0, 5).join(', ')}{skills.length > 5 ? ` +${skills.length - 5}` : ''}</span>
                                    </div>
                                  )}
                                  {hasQuestions && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Questions</span>
                                      <span className="font-medium text-foreground">
                                        {Object.keys(answers).length}/{questions.length} answered
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Cover Letter (optional)</Label>
                                  <Textarea
                                    value={coverLetter}
                                    onChange={e => setCoverLetter(e.target.value)}
                                    placeholder="Tell us why you're a great fit..."
                                    rows={3}
                                    className="mt-1 text-sm rounded-lg"
                                  />
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>

                        {/* Navigation */}
                        <div className="flex items-center gap-2 pt-2">
                          {step > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStep(s => s - 1)}
                              className="flex-1 h-10 text-sm rounded-xl border-border/80 hover:bg-muted/60"
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Back
                            </Button>
                          )}

                          {step < effectiveSteps.length - 1 ? (
                            <Button
                              size="sm"
                              onClick={() => setStep(s => s + 1)}
                              disabled={!canProceed()}
                              className="flex-1 h-10 text-sm rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all duration-200"
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={handleSubmit}
                              disabled={!resumeFile || submitting}
                              className="flex-1 h-10 text-sm rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm transition-all duration-200"
                            >
                              {submitting ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <Send className="h-4 w-4" /> Submit Application
                                </span>
                              )}
                            </Button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => { setShowApplyForm(false); setStep(0); }}
                          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Quick Apply Modal */}
      {showQuickApply && jobId && (
        <QuickApplyModal
          jobId={jobId}
          jobTitle={job?.job_title || ''}
          isOpen={showQuickApply}
          onClose={() => setShowQuickApply(false)}
          onSuccess={() => {
            setShowQuickApply(false);
            toast.success('Application submitted! Your resume is being reviewed by AI.');
            navigate('/my-applications');
          }}
        />
      )}

      {/* Duplicate Detected Modal */}
      {duplicateInfo && (
        <DuplicateDetectedModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          duplicateInfo={duplicateInfo}
        />
      )}
    </PublicLayout>
  );
};

export default CareerJobDetail;
