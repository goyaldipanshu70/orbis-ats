import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import PublicLayout from '@/components/layout/PublicLayout';
import QuickApplyModal from '@/components/QuickApplyModal';
import DuplicateDetectedModal from '@/components/DuplicateDetectedModal';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, MapPin, ArrowLeft, Upload, FileText, CheckCircle2, Loader2, X,
  ChevronRight, ChevronLeft, Check, Send, Linkedin, Github, Globe, AlertCircle, Zap,
  Clock, ShieldAlert, Building2, Star, Users, Sparkles,
} from 'lucide-react';

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

  const refCode = searchParams.get('ref') || '';
  const utmSource = searchParams.get('utm_source') || '';
  const utmMedium = searchParams.get('utm_medium') || '';

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [step, setStep] = useState(0);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedResumeUrl, setParsedResumeUrl] = useState('');
  const [tempFilename, setTempFilename] = useState('');

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

  const [questions, setQuestions] = useState<ScreeningQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [lockInfo, setLockInfo] = useState<{ locked: boolean; lock_expiry?: string; remaining_days?: number; message?: string } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    Promise.all([
      apiClient.getPublicJobDetail(jobId),
      apiClient.getPublicScreeningQuestions(jobId),
    ])
      .then(([jobData, qs]) => { setJob(jobData); setQuestions(qs || []); })
      .catch(() => navigate('/careers'))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !user || user.role !== 'candidate') return;
    apiClient.checkLockStatus(jobId).then(setLockInfo).catch(() => {});
  }, [jobId, user]);

  useEffect(() => {
    if (user) {
      setFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
      setEmail(user.email || '');
    }
  }, [user]);

  const handleApply = () => {
    if (!user) { navigate('/careers/signup'); return; }
    if (user.role !== 'candidate') { toast.error('Only candidate accounts can apply to jobs'); return; }
    if (user.profile_complete) { setShowQuickApply(true); } else { setShowApplyForm(true); setStep(0); }
  };

  const handleFileSelect = async (file: File) => {
    setResumeFile(file);
    setParseError(null);
    setParsing(true);
    try {
      const result = await apiClient.parseResume(file);
      const m = result.metadata || {};
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
      if (refCode) { formData.append('source', 'referral'); formData.append('referral_code', refCode); }
      else if (utmSource) { formData.append('source', utmSource); }
      else { formData.append('source', 'career_page'); }
      if (utmMedium) formData.append('utm_medium', utmMedium);
      if (Object.keys(answers).length > 0) {
        const responses = Object.entries(answers).map(([qId, response]) => ({
          question_id: parseInt(qId), response,
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
          if (detail?.duplicate_info) { setDuplicateInfo(detail.duplicate_info); setShowDuplicateModal(true); return; }
        } catch {}
      }
      if (err.status === 403) { toast.error('Application locked', { description: 'You are in a rejection lock period for this job.' }); return; }
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32" style={{ background: 'var(--orbis-page)' }}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1B8EE5' }} />
            <p className="text-sm text-slate-400">Loading job details...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!job) return null;

  const hasQuestions = questions.length > 0;
  const effectiveSteps = hasQuestions ? STEPS : STEPS.filter((_, i) => i !== 2);
  const effectiveStep = hasQuestions ? step : (step >= 2 ? step + 1 : step);

  return (
    <PublicLayout>
      <div className="relative min-h-screen" style={{ background: 'var(--orbis-page)' }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 h-72 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(27,142,229,0.12), transparent)' }} />
        <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(27,142,229,0.04)', filter: 'blur(120px)' }} />
        <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(59,130,246,0.04)', filter: 'blur(120px)' }} />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Back nav */}
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => navigate('/careers')}
            className="group flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to all positions
          </motion.button>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* ── LEFT: Job Details ──────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header card */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
                <div className="rounded-2xl p-6" style={glassCard}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 8px 24px rgba(27,142,229,0.3)' }}>
                      <Briefcase className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                        {job.job_title}
                      </h1>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-400">
                        {job.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-blue-400" />
                            {job.location}
                          </span>
                        )}
                        {job.department && (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-blue-400" />
                            {job.department}
                          </span>
                        )}
                        {job.employment_type && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-emerald-400" />
                            {job.employment_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* About */}
              {job.summary && (
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                  <div className="rounded-2xl p-6" style={glassCard}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
                        <Star className="h-4 w-4 text-blue-400" />
                      </div>
                      <h2 className="text-base font-bold text-white">About this role</h2>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{job.summary}</p>
                  </div>
                </motion.div>
              )}

              {/* Requirements */}
              {job.key_requirements?.length > 0 && (
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
                  <div className="rounded-2xl p-6" style={glassCard}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(52,211,153,0.1)' }}>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <h2 className="text-base font-bold text-white">Requirements</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {job.key_requirements.map((req: string, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
                          className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm text-slate-300"
                          style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{req}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Experience */}
              {(job.experience?.description || (typeof job.experience === 'string' && job.experience)) && (
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
                  <div className="rounded-2xl p-6" style={glassCard}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(77,181,240,0.1)' }}>
                        <Users className="h-4 w-4 text-blue-400" />
                      </div>
                      <h2 className="text-base font-bold text-white">Experience</h2>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {typeof job.experience === 'string' ? job.experience : job.experience.description}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── RIGHT: Apply Panel ─────────────────────────── */}
            <motion.div className="lg:col-span-1" variants={fadeUp} initial="hidden" animate="visible" custom={1}>
              <div className="sticky top-24">
                <div className="rounded-2xl overflow-hidden" style={{ ...glassCard, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                  <div className="h-1" style={{ background: 'linear-gradient(90deg, #1B8EE5, #1676c0, #1B8EE5)' }} />

                  <div className="p-6">
                    {!showApplyForm ? (
                      <div className="text-center space-y-5">
                        {lockInfo?.locked ? (
                          <>
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto" style={{ background: 'rgba(251,191,36,0.1)' }}>
                              <ShieldAlert className="h-8 w-8 text-amber-400" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">Reapplication locked</h3>
                              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{lockInfo.message}</p>
                            </div>
                            <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                              <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                                <Clock className="h-4 w-4" />
                                <span>{lockInfo.remaining_days} days remaining</span>
                              </div>
                              {lockInfo.lock_expiry && (
                                <p className="text-xs text-amber-500 mt-1.5">
                                  Unlocks on {new Date(lockInfo.lock_expiry).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto" style={{ background: 'rgba(27,142,229,0.15)', border: '1px solid rgba(27,142,229,0.25)' }}>
                              <Sparkles className="h-8 w-8" style={{ color: '#4db5f0' }} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">Interested in this role?</h3>
                              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                                Submit your application and our AI will review your resume instantly.
                              </p>
                            </div>
                            {user?.profile_complete ? (
                              <div className="space-y-3">
                                <button
                                  onClick={() => setShowQuickApply(true)}
                                  className="w-full h-12 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02]"
                                  style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', boxShadow: '0 8px 24px rgba(5,150,105,0.25)' }}
                                >
                                  <span className="flex items-center justify-center gap-2">
                                    <Zap className="h-4 w-4" /> Quick Apply
                                  </span>
                                </button>
                                <button
                                  onClick={() => { setShowApplyForm(true); setStep(0); }}
                                  className="w-full h-10 rounded-xl text-sm font-bold text-slate-300 transition-all hover:text-white"
                                  style={glassCard}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                                >
                                  Apply with new resume
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={handleApply}
                                className="w-full h-12 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02]"
                                style={gradientBtn}
                              >
                                Apply Now
                              </button>
                            )}

                            {/* Trust badges */}
                            <div className="flex items-center justify-center gap-4 pt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Secure</span>
                              <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> AI-reviewed</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Fast</span>
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
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300`}
                                style={
                                  i < step
                                    ? { background: '#059669', color: 'hsl(var(--foreground))', boxShadow: '0 0 12px rgba(5,150,105,0.3)' }
                                    : i === step
                                    ? { background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', color: 'hsl(var(--foreground))', boxShadow: '0 0 15px rgba(27,142,229,0.4)' }
                                    : { background: 'var(--orbis-input)', color: 'var(--orbis-border-strong)' }
                                }
                              >
                                {i < step ? <Check className="h-4 w-4" /> : i + 1}
                              </div>
                              {i < effectiveSteps.length - 1 && (
                                <div className="w-6 h-0.5 mx-1 rounded-full transition-colors duration-300" style={{ background: i < step ? '#059669' : 'var(--orbis-border)' }} />
                              )}
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-slate-500 text-center font-medium">
                          Step {step + 1} of {effectiveSteps.length}
                          <span className="text-slate-400"> &middot; </span>
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
                                  <label className="text-xs font-medium text-slate-400">Resume *</label>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    className="hidden"
                                    onChange={e => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }}
                                  />
                                  {resumeFile ? (
                                    <div className="flex items-center gap-2 rounded-xl px-4 py-3 mt-1.5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                                      <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                                      <span className="text-sm text-emerald-400 truncate flex-1 font-medium">{resumeFile.name}</span>
                                      <button type="button" onClick={() => { setResumeFile(null); setParseError(null); setParsedResumeUrl(''); setTempFilename(''); }}>
                                        <X className="h-4 w-4 text-slate-500 hover:text-rose-400 transition-colors" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => fileInputRef.current?.click()}
                                      onDrop={handleDrop}
                                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                      onDragLeave={() => setDragOver(false)}
                                      className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-sm transition-all duration-200 mt-1.5"
                                      style={{
                                        borderColor: dragOver ? '#1B8EE5' : 'var(--orbis-border)',
                                        background: dragOver ? 'rgba(27,142,229,0.08)' : 'var(--orbis-subtle)',
                                      }}
                                    >
                                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(27,142,229,0.15)' }}>
                                        <Upload className="h-5 w-5" style={{ color: '#4db5f0' }} />
                                      </div>
                                      <div className="text-center">
                                        <span className="font-medium text-sm block text-slate-300">Drop your resume or click to browse</span>
                                        <span className="text-[11px] text-slate-500 mt-0.5 block">PDF, DOC, DOCX up to 10 MB</span>
                                      </div>
                                    </button>
                                  )}
                                </div>

                                {parsing && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                                    style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
                                  >
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                    <span className="text-xs text-blue-400 font-medium">Extracting resume details... 3-5 seconds</span>
                                  </motion.div>
                                )}

                                {parseError && (
                                  <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                                    <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <span className="text-xs text-amber-400">{parseError}</span>
                                  </div>
                                )}

                                {resumeFile && !parsing && !parseError && (
                                  <p className="text-[11px] text-slate-500 text-center">Your resume will be analyzed by AI after you submit</p>
                                )}
                              </div>
                            )}

                            {/* Step 1: Verify Details */}
                            {effectiveStep === 1 && (
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                {[
                                  { label: 'Full Name *', value: fullName, set: setFullName, placeholder: 'John Doe' },
                                  { label: 'Email *', value: email, set: setEmail, placeholder: 'john@example.com', type: 'email', disabled: !!user },
                                ].map(f => (
                                  <div key={f.label}>
                                    <label className="text-xs font-medium text-slate-400">{f.label}</label>
                                    <input
                                      type={f.type || 'text'}
                                      value={f.value}
                                      onChange={e => f.set(e.target.value)}
                                      placeholder={f.placeholder}
                                      disabled={f.disabled}
                                      className="w-full mt-1 h-9 rounded-lg px-3 text-sm outline-none transition-all placeholder:text-slate-500 disabled:opacity-50"
                                      style={glassInput}
                                      onFocus={handleFocus}
                                      onBlur={handleBlur}
                                    />
                                  </div>
                                ))}
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Phone', value: phone, set: setPhone, placeholder: '+1 (555) 000-0000', type: 'tel' },
                                    { label: 'Location', value: location, set: setLocation, placeholder: 'San Francisco, CA' },
                                  ].map(f => (
                                    <div key={f.label}>
                                      <label className="text-xs font-medium text-slate-400">{f.label}</label>
                                      <input
                                        type={f.type || 'text'}
                                        value={f.value}
                                        onChange={e => f.set(e.target.value)}
                                        placeholder={f.placeholder}
                                        className="w-full mt-1 h-9 rounded-lg px-3 text-sm outline-none transition-all placeholder:text-slate-500"
                                        style={glassInput}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Current Role', value: currentRole, set: setCurrentRole, placeholder: 'Software Engineer' },
                                    { label: 'Years of Exp.', value: yearsExperience, set: setYearsExperience, placeholder: '5', type: 'number' },
                                  ].map(f => (
                                    <div key={f.label}>
                                      <label className="text-xs font-medium text-slate-400">{f.label}</label>
                                      <input
                                        type={f.type || 'text'}
                                        value={f.value}
                                        onChange={e => f.set(e.target.value)}
                                        placeholder={f.placeholder}
                                        className="w-full mt-1 h-9 rounded-lg px-3 text-sm outline-none transition-all placeholder:text-slate-500"
                                        style={glassInput}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                      />
                                    </div>
                                  ))}
                                </div>

                                {/* Professional Links */}
                                <div className="pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                                  <p className="text-xs font-medium text-slate-400 mb-2">
                                    Professional Links <span className="text-slate-400 font-normal">(optional)</span>
                                  </p>
                                  <div className="space-y-2">
                                    {[
                                      { icon: Linkedin, value: linkedinUrl, set: setLinkedinUrl, placeholder: 'linkedin.com/in/yourprofile' },
                                      { icon: Github, value: githubUrl, set: setGithubUrl, placeholder: 'github.com/yourusername' },
                                      { icon: Globe, value: portfolioUrl, set: setPortfolioUrl, placeholder: 'yourportfolio.com' },
                                    ].map((link, i) => (
                                      <div key={i} className="relative">
                                        <link.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                        <input
                                          value={link.value}
                                          onChange={e => link.set(e.target.value)}
                                          placeholder={link.placeholder}
                                          className="w-full h-8 pl-9 pr-3 text-xs rounded-lg outline-none transition-all placeholder:text-slate-500"
                                          style={glassInput}
                                          onFocus={handleFocus}
                                          onBlur={handleBlur}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Skills badges */}
                                {skills.length > 0 && (
                                  <div className="pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                                    <p className="text-xs font-medium text-slate-400 mb-2">Skills extracted from resume</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {skills.map((skill, i) => (
                                        <span
                                          key={i}
                                          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                                          style={{ background: 'rgba(27,142,229,0.1)', color: '#4db5f0', border: '1px solid rgba(27,142,229,0.2)' }}
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Step 2: Screening Questions */}
                            {effectiveStep === 2 && hasQuestions && (
                              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                                {questions.map((q) => (
                                  <div key={q.id} className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">
                                      {q.question} {q.required && <span className="text-rose-400">*</span>}
                                    </label>

                                    {q.question_type === 'text' && (
                                      <textarea
                                        value={answers[q.id] || ''}
                                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        placeholder="Your answer..."
                                        rows={2}
                                        className="w-full rounded-lg p-3 text-sm outline-none transition-all resize-none placeholder:text-slate-500"
                                        style={glassInput}
                                        onFocus={handleFocus as any}
                                        onBlur={handleBlur as any}
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
                                          <label htmlFor={`q${q.id}-yes`} className="text-sm text-slate-300">Yes</label>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <RadioGroupItem value="No" id={`q${q.id}-no`} />
                                          <label htmlFor={`q${q.id}-no`} className="text-sm text-slate-300">No</label>
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
                                            <label htmlFor={`q${q.id}-opt${i}`} className="text-sm text-slate-300">{opt}</label>
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
                                <div className="rounded-xl p-4 space-y-2.5 text-sm" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                                  {[
                                    { label: 'Name', value: fullName },
                                    { label: 'Email', value: email },
                                    phone && { label: 'Phone', value: phone },
                                    location && { label: 'Location', value: location },
                                    currentRole && { label: 'Current Role', value: currentRole },
                                    { label: 'Resume', value: resumeFile?.name, truncate: true },
                                    linkedinUrl && { label: 'LinkedIn', value: linkedinUrl, truncate: true, link: true },
                                    githubUrl && { label: 'GitHub', value: githubUrl, truncate: true, link: true },
                                    portfolioUrl && { label: 'Portfolio', value: portfolioUrl, truncate: true, link: true },
                                  ].filter(Boolean).map((item: any) => (
                                    <div key={item.label} className="flex justify-between">
                                      <span className="text-slate-500">{item.label}</span>
                                      <span className={`font-medium ${item.truncate ? 'truncate max-w-[140px]' : ''} ${item.link ? 'text-blue-400 text-xs' : 'text-white'}`}>
                                        {item.value}
                                      </span>
                                    </div>
                                  ))}
                                  {skills.length > 0 && (
                                    <div className="flex justify-between items-start">
                                      <span className="text-slate-500 shrink-0">Skills</span>
                                      <span className="font-medium text-white text-right text-xs">{skills.slice(0, 5).join(', ')}{skills.length > 5 ? ` +${skills.length - 5}` : ''}</span>
                                    </div>
                                  )}
                                  {hasQuestions && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Questions</span>
                                      <span className="font-medium text-white">
                                        {Object.keys(answers).length}/{questions.length} answered
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-slate-400">Cover Letter (optional)</label>
                                  <textarea
                                    value={coverLetter}
                                    onChange={e => setCoverLetter(e.target.value)}
                                    placeholder="Tell us why you're a great fit..."
                                    rows={3}
                                    className="w-full mt-1 rounded-lg p-3 text-sm outline-none transition-all resize-none placeholder:text-slate-500"
                                    style={glassInput}
                                    onFocus={handleFocus as any}
                                    onBlur={handleBlur as any}
                                  />
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>

                        {/* Navigation */}
                        <div className="flex items-center gap-2 pt-2">
                          {step > 0 && (
                            <button
                              onClick={() => setStep(s => s - 1)}
                              className="flex-1 h-10 rounded-xl text-sm font-bold text-slate-300 transition-all flex items-center justify-center gap-1 hover:text-white"
                              style={glassCard}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                            >
                              <ChevronLeft className="h-4 w-4" /> Back
                            </button>
                          )}

                          {step < effectiveSteps.length - 1 ? (
                            <button
                              onClick={() => setStep(s => s + 1)}
                              disabled={!canProceed()}
                              className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-1 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                              style={gradientBtn}
                            >
                              Next <ChevronRight className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={handleSubmit}
                              disabled={!resumeFile || submitting}
                              className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', boxShadow: '0 8px 24px rgba(5,150,105,0.2)' }}
                            >
                              {submitting ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                              ) : (
                                <><Send className="h-4 w-4" /> Submit Application</>
                              )}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => { setShowApplyForm(false); setStep(0); }}
                          className="w-full text-sm text-slate-500 hover:text-white transition-colors pt-1"
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
          open={showQuickApply}
          onClose={() => setShowQuickApply(false)}
          onApplied={() => {
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
