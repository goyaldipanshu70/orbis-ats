import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { apiClient } from '@/utils/api';
import { toast } from 'sonner';
import {
  Upload, FileText, CheckCircle2, Loader2, X, ChevronRight, ChevronLeft,
  Linkedin, Briefcase, GraduationCap, Sparkles, MapPin, DollarSign,
  Clock, Building2, User, Plus, Minus, Check, Edit3, AlertCircle,
} from 'lucide-react';

/* ── Design System ──────────────────────────────────────────────────── */

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

/* ── Types ──────────────────────────────────────────────────────────── */

interface SkillEntry {
  name: string;
  proficiency: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
}

interface ProfileData {
  resume_file: File | null;
  resume_url: string;
  current_role: string;
  years_of_experience: string;
  education: string;
  skills: SkillEntry[];
  summary: string;
  work_type: 'Remote' | 'Hybrid' | 'On-site' | '';
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  availability: string;
  preferred_locations: string[];
  job_types: string[];
}

const STEPS = [
  { label: 'Upload Resume', icon: Upload },
  { label: 'Skills & Experience', icon: Sparkles },
  { label: 'Work Preferences', icon: Building2 },
  { label: 'Review Profile', icon: CheckCircle2 },
];

const PROFICIENCY_LEVELS: SkillEntry['proficiency'][] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const PROFICIENCY_COLORS: Record<string, string> = {
  Beginner: '#64748b',
  Intermediate: '#3b82f6',
  Advanced: '#8b5cf6',
  Expert: '#f59e0b',
};

const AVAILABILITY_OPTIONS = ['Immediate', '2 weeks', '1 month', '3 months'];

const JOB_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Freelance'];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];

/* ── Helpers ────────────────────────────────────────────────────────── */

function computeCompletion(profile: ProfileData): number {
  let filled = 0;
  let total = 10;
  if (profile.resume_file || profile.resume_url) filled++;
  if (profile.current_role.trim()) filled++;
  if (profile.years_of_experience.trim()) filled++;
  if (profile.education.trim()) filled++;
  if (profile.skills.length > 0) filled++;
  if (profile.summary.trim()) filled++;
  if (profile.work_type) filled++;
  if (profile.salary_min || profile.salary_max) filled++;
  if (profile.availability) filled++;
  if (profile.preferred_locations.length > 0) filled++;
  return Math.round((filled / total) * 100);
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function CandidateOnboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skillInput, setSkillInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  const [profile, setProfile] = useState<ProfileData>({
    resume_file: null,
    resume_url: '',
    current_role: '',
    years_of_experience: '',
    education: '',
    skills: [],
    summary: '',
    work_type: '',
    salary_min: '',
    salary_max: '',
    salary_currency: 'USD',
    availability: '',
    preferred_locations: [],
    job_types: [],
  });

  const updateProfile = useCallback(<K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  }, []);

  /* ── Resume parsing ────────────────────────────────────────────────── */

  const handleFile = useCallback(async (file: File) => {
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please upload PDF, DOC, or DOCX.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    updateProfile('resume_file', file);
    setIsParsing(true);

    try {
      const result = await apiClient.parseResume(file);
      if (result?.metadata) {
        const m = result.metadata;
        setProfile(prev => ({
          ...prev,
          resume_url: result.resume_url || '',
          current_role: m.current_role || prev.current_role,
          years_of_experience: m.years_of_experience != null ? String(m.years_of_experience) : prev.years_of_experience,
          skills: m.skills?.length
            ? m.skills.map(s => ({ name: s, proficiency: 'Intermediate' as const }))
            : prev.skills,
          summary: prev.summary,
        }));
        toast.success('Resume parsed successfully! We extracted your details.');
      }
    } catch {
      toast.error('Could not parse resume automatically. Please fill in your details manually.');
    } finally {
      setIsParsing(false);
    }
  }, [updateProfile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ── Skills management ─────────────────────────────────────────────── */

  const addSkill = useCallback(() => {
    const name = skillInput.trim();
    if (!name) return;
    if (profile.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Skill already added.');
      return;
    }
    updateProfile('skills', [...profile.skills, { name, proficiency: 'Intermediate' }]);
    setSkillInput('');
  }, [skillInput, profile.skills, updateProfile]);

  const removeSkill = useCallback((idx: number) => {
    updateProfile('skills', profile.skills.filter((_, i) => i !== idx));
  }, [profile.skills, updateProfile]);

  const updateSkillProficiency = useCallback((idx: number, proficiency: SkillEntry['proficiency']) => {
    const updated = [...profile.skills];
    updated[idx] = { ...updated[idx], proficiency };
    updateProfile('skills', updated);
  }, [profile.skills, updateProfile]);

  /* ── Location tags ─────────────────────────────────────────────────── */

  const addLocation = useCallback(() => {
    const loc = locationInput.trim();
    if (!loc) return;
    if (profile.preferred_locations.includes(loc)) {
      toast.error('Location already added.');
      return;
    }
    updateProfile('preferred_locations', [...profile.preferred_locations, loc]);
    setLocationInput('');
  }, [locationInput, profile.preferred_locations, updateProfile]);

  const removeLocation = useCallback((idx: number) => {
    updateProfile('preferred_locations', profile.preferred_locations.filter((_, i) => i !== idx));
  }, [profile.preferred_locations, updateProfile]);

  /* ── Job type toggles ──────────────────────────────────────────────── */

  const toggleJobType = useCallback((jt: string) => {
    const current = profile.job_types;
    if (current.includes(jt)) {
      updateProfile('job_types', current.filter(t => t !== jt));
    } else {
      updateProfile('job_types', [...current, jt]);
    }
  }, [profile.job_types, updateProfile]);

  /* ── Submit ────────────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        current_role: profile.current_role,
        years_of_experience: profile.years_of_experience ? Number(profile.years_of_experience) : undefined,
        education: profile.education,
        skills: profile.skills.map(s => ({ name: s.name, proficiency: s.proficiency })),
        summary: profile.summary,
        work_type: profile.work_type || undefined,
        salary_min: profile.salary_min ? Number(profile.salary_min) : undefined,
        salary_max: profile.salary_max ? Number(profile.salary_max) : undefined,
        salary_currency: profile.salary_currency,
        availability: profile.availability || undefined,
        preferred_locations: profile.preferred_locations,
        job_types: profile.job_types,
        resume_url: profile.resume_url || undefined,
      };
      await apiClient.request('/api/candidates/profile', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success('Profile completed successfully!');
      navigate('/my-applications');
    } catch {
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [profile, navigate]);

  /* ── Navigation ────────────────────────────────────────────────────── */

  const canContinue = () => {
    if (currentStep === 0) return true;
    if (currentStep === 1) return true;
    if (currentStep === 2) return true;
    return true;
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1);
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  /* ── Completion ring ───────────────────────────────────────────────── */

  const completion = computeCompletion(profile);
  const circumference = 2 * Math.PI * 42;
  const strokeDash = (completion / 100) * circumference;

  /* ── Step content ──────────────────────────────────────────────────── */

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepResume
          profile={profile}
          dragOver={dragOver}
          setDragOver={setDragOver}
          handleDrop={handleDrop}
          handleFileInput={handleFileInput}
          fileInputRef={fileInputRef}
          isParsing={isParsing}
        />;
      case 1:
        return <StepSkills
          profile={profile}
          updateProfile={updateProfile}
          skillInput={skillInput}
          setSkillInput={setSkillInput}
          addSkill={addSkill}
          removeSkill={removeSkill}
          updateSkillProficiency={updateSkillProficiency}
        />;
      case 2:
        return <StepPreferences
          profile={profile}
          updateProfile={updateProfile}
          locationInput={locationInput}
          setLocationInput={setLocationInput}
          addLocation={addLocation}
          removeLocation={removeLocation}
          toggleJobType={toggleJobType}
        />;
      case 3:
        return <StepReview
          profile={profile}
          completion={completion}
          circumference={circumference}
          strokeDash={strokeDash}
          goToStep={setCurrentStep}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
        />;
      default:
        return null;
    }
  };

  return (
    <CandidateLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Complete Your Profile</h1>
          <p className="text-slate-400 text-sm md:text-base">Build your profile to get matched with the best jobs</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Sidebar (desktop: vertical, mobile: horizontal) ────────── */}
          <div className="lg:w-[240px] shrink-0">
            {/* Desktop sidebar */}
            <div className="hidden lg:block rounded-xl p-5" style={glassCard}>
              <div className="space-y-1">
                {STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <button
                      key={idx}
                      onClick={() => idx <= currentStep && setCurrentStep(idx)}
                      disabled={idx > currentStep}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all duration-200"
                      style={{
                        background: isCurrent ? 'rgba(27,142,229,0.12)' : 'transparent',
                        cursor: idx > currentStep ? 'default' : 'pointer',
                      }}
                    >
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-all duration-300"
                        style={{
                          background: isCompleted
                            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                            : isCurrent
                              ? 'linear-gradient(135deg, #1B8EE5, #1676c0)'
                              : 'var(--orbis-input)',
                          color: isCompleted || isCurrent ? '#fff' : '#94a3b8',
                          border: !isCompleted && !isCurrent ? '1px solid var(--orbis-border)' : 'none',
                        }}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span
                        className="text-sm font-medium transition-colors duration-200"
                        style={{
                          color: isCurrent ? '#1B8EE5' : isCompleted ? '#22c55e' : '#64748b',
                        }}
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile horizontal steps */}
            <div className="lg:hidden rounded-xl p-4" style={glassCard}>
              <div className="flex items-center justify-between">
                {STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div key={idx} className="flex items-center">
                      <button
                        onClick={() => idx <= currentStep && setCurrentStep(idx)}
                        disabled={idx > currentStep}
                        className="flex flex-col items-center gap-1.5"
                        style={{ cursor: idx > currentStep ? 'default' : 'pointer' }}
                      >
                        <div
                          className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-all duration-300"
                          style={{
                            background: isCompleted
                              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                              : isCurrent
                                ? 'linear-gradient(135deg, #1B8EE5, #1676c0)'
                                : 'var(--orbis-input)',
                            color: isCompleted || isCurrent ? '#fff' : '#94a3b8',
                            border: !isCompleted && !isCurrent ? '1px solid var(--orbis-border)' : 'none',
                          }}
                        >
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <span className="text-[10px] text-slate-500 hidden sm:block">{step.label}</span>
                      </button>
                      {idx < STEPS.length - 1 && (
                        <div
                          className="w-6 sm:w-10 h-px mx-1"
                          style={{
                            background: idx < currentStep
                              ? '#22c55e'
                              : 'var(--orbis-border)',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Main content ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="p-6 md:p-8"
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>

              {/* ── Bottom bar ──────────────────────────────────────── */}
              <div
                className="px-6 md:px-8 py-4 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--orbis-border)' }}
              >
                <div className="flex items-center gap-4">
                  {currentStep > 0 && (
                    <button
                      onClick={goBack}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Progress indicator */}
                  <span className="text-xs text-slate-500 hidden sm:block">
                    Step {currentStep + 1} of {STEPS.length}
                  </span>

                  {/* Progress bar */}
                  <div className="w-20 h-1.5 rounded-full hidden sm:block" style={{ background: 'var(--orbis-input)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #1B8EE5, #1676c0)' }}
                      initial={false}
                      animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </div>

                  <button
                    onClick={() => navigate('/my-applications')}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
                  >
                    Skip for now
                  </button>

                  {currentStep < STEPS.length - 1 && (
                    <button
                      onClick={goNext}
                      disabled={!canContinue()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                      style={gradientBtn}
                    >
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CandidateLayout>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Step 1 — Upload Resume
 * ════════════════════════════════════════════════════════════════════════ */

interface StepResumeProps {
  profile: ProfileData;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isParsing: boolean;
}

function StepResume({ profile, dragOver, setDragOver, handleDrop, handleFileInput, fileInputRef, isParsing }: StepResumeProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Upload Your Resume</h2>
        <p className="text-sm text-slate-400">Start by uploading your resume and we'll auto-extract your information</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="relative rounded-xl p-10 text-center cursor-pointer transition-all duration-300"
        style={{
          border: `2px dashed ${dragOver ? '#1B8EE5' : 'var(--orbis-border-strong)'}`,
          background: dragOver ? 'rgba(27,142,229,0.06)' : 'var(--orbis-input)',
          boxShadow: dragOver ? '0 0 40px rgba(27,142,229,0.1)' : 'none',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileInput}
          className="hidden"
        />

        {isParsing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-[#1B8EE5] animate-spin" />
            <p className="text-sm text-slate-300">Parsing your resume...</p>
            <p className="text-xs text-slate-500">Extracting skills, experience, and education</p>
          </div>
        ) : profile.resume_file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-full" style={{ background: 'rgba(34,197,94,0.15)' }}>
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{profile.resume_file.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(profile.resume_file.size / 1024).toFixed(0)} KB — Click or drag to replace
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-full transition-colors duration-200"
              style={{ background: dragOver ? 'rgba(27,142,229,0.2)' : 'rgba(27,142,229,0.1)' }}
            >
              <Upload className="w-7 h-7 text-[#1B8EE5]" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Drag & drop your resume or <span className="text-[#1B8EE5]">click to browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">PDF, DOCX, DOC (Max 5MB)</p>
            </div>
          </div>
        )}
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: 'var(--orbis-border)' }} />
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Or</span>
        <div className="flex-1 h-px" style={{ background: 'var(--orbis-border)' }} />
      </div>

      {/* LinkedIn import */}
      <button
        className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
        style={{
          background: 'linear-gradient(135deg, #0A66C2, #004182)',
          boxShadow: '0 8px 24px rgba(10,102,194,0.2)',
        }}
      >
        <Linkedin className="w-5 h-5" />
        Import from LinkedIn
      </button>

      {/* Helper text */}
      <div className="flex items-start gap-3 rounded-lg p-4" style={{ background: 'rgba(27,142,229,0.06)', border: '1px solid rgba(27,142,229,0.15)' }}>
        <Sparkles className="w-4 h-4 text-[#1B8EE5] mt-0.5 shrink-0" />
        <p className="text-xs text-slate-400 leading-relaxed">
          We'll auto-extract your skills, experience, and education from your resume or LinkedIn profile to build your candidate profile.
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Step 2 — Skills & Experience
 * ════════════════════════════════════════════════════════════════════════ */

interface StepSkillsProps {
  profile: ProfileData;
  updateProfile: <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => void;
  skillInput: string;
  setSkillInput: (v: string) => void;
  addSkill: () => void;
  removeSkill: (idx: number) => void;
  updateSkillProficiency: (idx: number, prof: SkillEntry['proficiency']) => void;
}

function StepSkills({ profile, updateProfile, skillInput, setSkillInput, addSkill, removeSkill, updateSkillProficiency }: StepSkillsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Skills & Experience</h2>
        <p className="text-sm text-slate-400">
          {profile.resume_file ? 'Review and edit the information extracted from your resume' : 'Tell us about your professional background'}
        </p>
      </div>

      {/* Current role */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Briefcase className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Current Role
        </label>
        <input
          type="text"
          value={profile.current_role}
          onChange={(e) => updateProfile('current_role', e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="e.g. Senior Frontend Engineer"
          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200"
          style={glassInput}
        />
      </div>

      {/* Years of experience */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Clock className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Years of Experience
        </label>
        <input
          type="number"
          min="0"
          max="50"
          value={profile.years_of_experience}
          onChange={(e) => updateProfile('years_of_experience', e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="e.g. 5"
          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200"
          style={glassInput}
        />
      </div>

      {/* Education */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <GraduationCap className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Education
        </label>
        <input
          type="text"
          value={profile.education}
          onChange={(e) => updateProfile('education', e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="e.g. B.S. Computer Science, Stanford University"
          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200"
          style={glassInput}
        />
      </div>

      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Skills
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Type a skill and press Enter"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200"
            style={glassInput}
          />
          <button
            onClick={addSkill}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-white shrink-0 transition-all hover:brightness-110"
            style={gradientBtn}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Skill chips */}
        {profile.skills.length > 0 && (
          <div className="space-y-2">
            {profile.skills.map((skill, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{skill.name}</span>

                {/* Proficiency selector */}
                <div className="flex gap-1 shrink-0">
                  {PROFICIENCY_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => updateSkillProficiency(idx, level)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-200"
                      style={{
                        background: skill.proficiency === level
                          ? PROFICIENCY_COLORS[level]
                          : 'transparent',
                        color: skill.proficiency === level ? '#fff' : '#64748b',
                        border: skill.proficiency === level
                          ? 'none'
                          : '1px solid var(--orbis-border)',
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => removeSkill(idx)}
                  className="text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {profile.skills.length === 0 && (
          <p className="text-xs text-slate-500 mt-1">No skills added yet. Add your key technical and soft skills.</p>
        )}
      </div>

      {/* Summary / Bio */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <User className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Professional Summary
        </label>
        <textarea
          value={profile.summary}
          onChange={(e) => updateProfile('summary', e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Write a brief summary of your professional background, strengths, and career goals..."
          rows={4}
          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200 resize-none"
          style={glassInput}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Step 3 — Work Preferences
 * ════════════════════════════════════════════════════════════════════════ */

interface StepPreferencesProps {
  profile: ProfileData;
  updateProfile: <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => void;
  locationInput: string;
  setLocationInput: (v: string) => void;
  addLocation: () => void;
  removeLocation: (idx: number) => void;
  toggleJobType: (jt: string) => void;
}

function StepPreferences({ profile, updateProfile, locationInput, setLocationInput, addLocation, removeLocation, toggleJobType }: StepPreferencesProps) {
  const workTypes: ProfileData['work_type'][] = ['Remote', 'Hybrid', 'On-site'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Work Preferences</h2>
        <p className="text-sm text-slate-400">Let us know what kind of opportunities you're looking for</p>
      </div>

      {/* Work type preference */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          <Building2 className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Work Type Preference
        </label>
        <div className="flex gap-2">
          {workTypes.map((wt) => (
            <button
              key={wt}
              onClick={() => updateProfile('work_type', wt)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: profile.work_type === wt
                  ? 'linear-gradient(135deg, #1B8EE5, #1676c0)'
                  : 'var(--orbis-input)',
                color: profile.work_type === wt ? '#fff' : '#94a3b8',
                border: profile.work_type === wt ? 'none' : '1px solid var(--orbis-border)',
                boxShadow: profile.work_type === wt ? '0 4px 16px rgba(27,142,229,0.2)' : 'none',
              }}
            >
              {wt}
            </button>
          ))}
        </div>
      </div>

      {/* Salary range */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          <DollarSign className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Expected Salary Range (Annual)
        </label>
        <div className="flex gap-3 items-center">
          <select
            value={profile.salary_currency}
            onChange={(e) => updateProfile('salary_currency', e.target.value)}
            className="rounded-lg px-3 py-2.5 text-sm outline-none cursor-pointer"
            style={glassInput}
          >
            {CURRENCY_OPTIONS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            value={profile.salary_min}
            onChange={(e) => updateProfile('salary_min', e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Min"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200"
            style={glassInput}
          />
          <span className="text-slate-500 text-sm">to</span>
          <input
            type="number"
            value={profile.salary_max}
            onChange={(e) => updateProfile('salary_max', e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Max"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200"
            style={glassInput}
          />
        </div>
      </div>

      {/* Availability */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          <Clock className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Availability
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => updateProfile('availability', opt)}
              className="py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: profile.availability === opt
                  ? 'linear-gradient(135deg, #1B8EE5, #1676c0)'
                  : 'var(--orbis-input)',
                color: profile.availability === opt ? '#fff' : '#94a3b8',
                border: profile.availability === opt ? 'none' : '1px solid var(--orbis-border)',
                boxShadow: profile.availability === opt ? '0 4px 16px rgba(27,142,229,0.2)' : 'none',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred locations */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <MapPin className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Preferred Locations
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocation(); } }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="e.g. San Francisco, London, Remote"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200"
            style={glassInput}
          />
          <button
            onClick={addLocation}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-white shrink-0 transition-all hover:brightness-110"
            style={gradientBtn}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {profile.preferred_locations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.preferred_locations.map((loc, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-200 transition-all"
                style={{ background: 'rgba(27,142,229,0.12)', border: '1px solid rgba(27,142,229,0.25)' }}
              >
                <MapPin className="w-3 h-3 text-[#1B8EE5]" />
                {loc}
                <button onClick={() => removeLocation(idx)} className="text-slate-400 hover:text-rose-400 transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Job type preference */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          <Briefcase className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
          Job Type Preference
        </label>
        <div className="grid grid-cols-2 gap-2">
          {JOB_TYPE_OPTIONS.map((jt) => {
            const active = profile.job_types.includes(jt);
            return (
              <button
                key={jt}
                onClick={() => toggleJobType(jt)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: active ? 'rgba(27,142,229,0.12)' : 'var(--orbis-input)',
                  border: `1px solid ${active ? 'rgba(27,142,229,0.4)' : 'var(--orbis-border)'}`,
                  color: active ? '#1B8EE5' : '#94a3b8',
                }}
              >
                <div
                  className="flex items-center justify-center w-5 h-5 rounded shrink-0 transition-all duration-200"
                  style={{
                    background: active ? '#1B8EE5' : 'transparent',
                    border: active ? 'none' : '1.5px solid var(--orbis-border-strong)',
                  }}
                >
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
                {jt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Step 4 — Review Profile
 * ════════════════════════════════════════════════════════════════════════ */

interface StepReviewProps {
  profile: ProfileData;
  completion: number;
  circumference: number;
  strokeDash: number;
  goToStep: (step: number) => void;
  isSubmitting: boolean;
  handleSubmit: () => void;
}

function StepReview({ profile, completion, circumference, strokeDash, goToStep, isSubmitting, handleSubmit }: StepReviewProps) {
  const sectionCard: React.CSSProperties = {
    background: 'var(--orbis-input)',
    border: '1px solid var(--orbis-border)',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Review Your Profile</h2>
          <p className="text-sm text-slate-400">Review everything before completing your profile</p>
        </div>

        {/* Completion ring */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="var(--orbis-border)"
              strokeWidth="6"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="#1B8EE5"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - strokeDash }}
              transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white">{completion}%</span>
            <span className="text-[9px] text-slate-500">Complete</span>
          </div>
        </div>
      </div>

      {/* Resume section */}
      <div className="rounded-lg p-4" style={sectionCard}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#1B8EE5]" />
            Resume
          </h3>
          <button onClick={() => goToStep(0)} className="text-[#1B8EE5] text-xs font-medium hover:underline flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Edit
          </button>
        </div>
        {profile.resume_file ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-sm text-slate-300">{profile.resume_file.name}</span>
            <span className="text-xs text-slate-500">({(profile.resume_file.size / 1024).toFixed(0)} KB)</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No resume uploaded</p>
        )}
      </div>

      {/* Skills & Experience section */}
      <div className="rounded-lg p-4" style={sectionCard}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1B8EE5]" />
            Skills & Experience
          </h3>
          <button onClick={() => goToStep(1)} className="text-[#1B8EE5] text-xs font-medium hover:underline flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Edit
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0">Current Role</span>
            <span className="text-sm text-slate-300">{profile.current_role || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0">Experience</span>
            <span className="text-sm text-slate-300">
              {profile.years_of_experience ? `${profile.years_of_experience} years` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0">Education</span>
            <span className="text-sm text-slate-300">{profile.education || '—'}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0 mt-1">Skills</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.length > 0 ? profile.skills.map((s, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    background: `${PROFICIENCY_COLORS[s.proficiency]}20`,
                    color: PROFICIENCY_COLORS[s.proficiency],
                    border: `1px solid ${PROFICIENCY_COLORS[s.proficiency]}40`,
                  }}
                >
                  {s.name}
                </span>
              )) : <span className="text-sm text-slate-500">—</span>}
            </div>
          </div>
          {profile.summary && (
            <div className="flex items-start gap-2 mt-1">
              <span className="text-xs text-slate-500 w-28 shrink-0 mt-1">Summary</span>
              <p className="text-sm text-slate-400 leading-relaxed">{profile.summary}</p>
            </div>
          )}
        </div>
      </div>

      {/* Work Preferences section */}
      <div className="rounded-lg p-4" style={sectionCard}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1B8EE5]" />
            Work Preferences
          </h3>
          <button onClick={() => goToStep(2)} className="text-[#1B8EE5] text-xs font-medium hover:underline flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Edit
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0">Work Type</span>
            <span className="text-sm text-slate-300">{profile.work_type || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0">Salary Range</span>
            <span className="text-sm text-slate-300">
              {profile.salary_min || profile.salary_max
                ? `${profile.salary_currency} ${profile.salary_min ? Number(profile.salary_min).toLocaleString() : '?'} – ${profile.salary_max ? Number(profile.salary_max).toLocaleString() : '?'}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0">Availability</span>
            <span className="text-sm text-slate-300">{profile.availability || '—'}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0 mt-1">Locations</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.preferred_locations.length > 0 ? profile.preferred_locations.map((loc, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-300"
                  style={{ background: 'rgba(27,142,229,0.12)', border: '1px solid rgba(27,142,229,0.25)' }}
                >
                  {loc}
                </span>
              )) : <span className="text-sm text-slate-500">—</span>}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0 mt-1">Job Types</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.job_types.length > 0 ? profile.job_types.map((jt, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium text-[#1B8EE5]"
                  style={{ background: 'rgba(27,142,229,0.12)', border: '1px solid rgba(27,142,229,0.25)' }}
                >
                  {jt}
                </span>
              )) : <span className="text-sm text-slate-500">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => window.location.href = '/my-applications'}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={gradientBtn}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Complete Profile
            </>
          )}
        </button>
      </div>
    </div>
  );
}
