
import { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Sparkles, ArrowLeft, ArrowRight, Plus, X, Check,
  CloudUpload, Briefcase, GraduationCap, Clock, Loader2, Trash2, FileUp, MapPin, LayoutTemplate,
  DollarSign, CalendarDays, Eye, Building2, Globe, BadgeCheck, Bot,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { JobFormData, JDExtractionResult, JDTemplate } from '@/types/api';
import { COUNTRIES, getCitiesForCountry } from '@/data/locations';
import AppLayout from '@/components/layout/AppLayout';
import JDGeneratorButton from '@/components/ai/JDGeneratorButton';
import JDBiasChecker from '@/components/ai/JDBiasChecker';
import SalaryInsightsCard from '@/components/ai/SalaryInsightsCard';

/* ── Design system constants ────────────────────────── */
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
const selectDropdown: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
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

/* ── Tag color map (dark theme) ─────────────────────── */
const TAG_COLORS: Record<string, string> = {
  core_skills:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  preferred_skills: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  soft_skills:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  certifications:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  role_keywords:    'bg-white/5 text-slate-300 border-white/10',
};
const TAG_BTN: Record<string, string> = {
  core_skills:      'border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
  preferred_skills: 'border-teal-500/30 text-teal-400 hover:bg-teal-500/10',
  soft_skills:      'border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
  certifications:   'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
  role_keywords:    'border-white/10 text-slate-400 hover:bg-white/5',
};

const STEP_LABELS = [
  { num: 1, label: 'Upload JD' },
  { num: 2, label: 'Job Details' },
  { num: 3, label: 'Review' },
];

const CreateJob = () => {
  const location = useLocation();
  const prefill = location.state as Record<string, any> | null;

  const [currentStep, setCurrentStep] = useState(prefill ? 2 : 1);
  const [activeTab, setActiveTab] = useState<'extract' | 'manual'>(prefill ? 'manual' : 'extract');
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState('');
  const [extractedData, setExtractedData] = useState<JDExtractionResult | null>(null);
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [modelAnswerFile, setModelAnswerFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [jdTemplateOpen, setJdTemplateOpen] = useState(false);
  const [jdTemplates, setJdTemplates] = useState<JDTemplate[]>([]);
  const [jdTemplatesLoading, setJdTemplatesLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rubricInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<JobFormData>({
    job_title: prefill?.job_title || '',
    summary: prefill?.summary || '',
    number_of_vacancies: prefill?.number_of_vacancies || 1,
    country: '',
    city: '',
    core_skills: prefill?.core_skills || [],
    preferred_skills: [],
    experience_requirements: { min_years: 0, description: '' },
    educational_requirements: { degree: '', field: '' },
    soft_skills: [],
    certifications: [],
    role_keywords: [],
  });
  const [locationVacancies, setLocationVacancies] = useState<Array<{country: string; city: string; vacancies: number}>>([
    { country: '', city: '', vacancies: prefill?.number_of_vacancies || 1 },
  ]);
  const [rejectionLockDays, setRejectionLockDays] = useState<string>('');
  const [jobType, setJobType] = useState<string>(prefill?.job_type || '');
  const [positionType, setPositionType] = useState<string>('');
  const [experienceRange, setExperienceRange] = useState<string>('');
  const [salaryMin, setSalaryMin] = useState<string>(prefill?.salary_min || '');
  const [salaryMax, setSalaryMax] = useState<string>(prefill?.salary_max || '');
  const [salaryCurrency, setSalaryCurrency] = useState<string>(prefill?.salary_currency || 'USD');
  const [salaryVisibility, setSalaryVisibility] = useState<string>('');
  const [locationType, setLocationType] = useState<string>(prefill?.location_type || '');
  const [hiringCloseDate, setHiringCloseDate] = useState<string>('');
  const [autoAIInterview, setAutoAIInterview] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  /* ── Drag & drop ───────────────────────────────────── */
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && /\.(pdf|docx|txt)$/i.test(file.name)) setJdFile(file);
  }, []);

  /* ── AI Extraction ─────────────────────────────────── */
  const handleJdExtraction = async () => {
    if (!jdFile) {
      toast({ title: 'Error', description: 'Please select a JD file to extract.', variant: 'destructive' });
      return;
    }
    setIsExtracting(true);
    try {
      const result = await apiClient.extractJD(jdFile);
      setExtractedData(result);
      const ai = result.ai_result;
      setFormData(prev => ({
        ...prev,
        job_title: ai.job_title,
        summary: ai.summary,
        core_skills: ai.extracted_rubric.core_skills,
        preferred_skills: ai.extracted_rubric.preferred_skills,
        experience_requirements: ai.extracted_rubric.experience_requirements,
        educational_requirements: ai.extracted_rubric.educational_requirements,
        soft_skills: ai.extracted_rubric.soft_skills,
        certifications: ai.extracted_rubric.certifications,
        role_keywords: ai.extracted_rubric.role_keywords,
      }));
      toast({ title: 'Success', description: 'Job description extracted successfully!' });
      setCurrentStep(2);
    } catch (err: any) {
      const msg = err?.message || 'Failed to extract job description.';
      toast({ title: 'Extraction Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsExtracting(false);
    }
  };

  /* ── JD Template picker ───────────────────────────── */
  const openTemplatePicker = async () => {
    setJdTemplateOpen(true);
    if (jdTemplates.length > 0) return;
    setJdTemplatesLoading(true);
    try {
      const templates = await apiClient.getJDTemplates();
      setJdTemplates(templates);
    } catch {
      toast({ title: 'Error', description: 'Failed to load JD templates.', variant: 'destructive' });
    } finally {
      setJdTemplatesLoading(false);
    }
  };

  const applyJdTemplate = (tpl: JDTemplate) => {
    const content = typeof tpl.jd_content === 'string'
      ? tpl.jd_content
      : JSON.stringify(tpl.jd_content ?? '', null, 2);
    setFormData(prev => ({
      ...prev,
      summary: content,
      core_skills: tpl.skills ?? prev.core_skills,
    }));
    if (tpl.experience_range) setExperienceRange(tpl.experience_range);
    if (tpl.salary_range?.min) setSalaryMin(String(tpl.salary_range.min));
    if (tpl.salary_range?.max) setSalaryMax(String(tpl.salary_range.max));
    if (tpl.salary_range?.currency) setSalaryCurrency(tpl.salary_range.currency);
    setJdTemplateOpen(false);
    toast({ title: 'Template Applied', description: `"${tpl.name}" has been applied to the form.` });
  };

  /* ── Tag helpers ────────────────────────────────────── */
  const addTag = (field: keyof JobFormData, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const arr = formData[field] as string[];
    if (arr.includes(trimmed)) return;
    setFormData(prev => ({ ...prev, [field]: [...arr, trimmed] }));
    setTagInputs(prev => ({ ...prev, [field]: '' }));
  };

  const removeTag = (field: keyof JobFormData, index: number) => {
    const arr = formData[field] as string[];
    setFormData(prev => ({ ...prev, [field]: arr.filter((_, i) => i !== index) }));
  };

  const handleTagKeyDown = (field: keyof JobFormData, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(field, tagInputs[field] || '');
    }
  };

  /* ── Tag section renderer ──────────────────────────── */
  const renderTagSection = (field: keyof JobFormData, label: string) => {
    const values = formData[field] as string[];
    const colorCls = TAG_COLORS[field] || TAG_COLORS.role_keywords;
    const btnCls = TAG_BTN[field] || TAG_BTN.role_keywords;

    return (
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {values.map((val, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${colorCls}`}
            >
              {val}
              <button type="button" onClick={() => removeTag(field, i)} className="ml-0.5 rounded-full p-0.5 hover:bg-white/10 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              value={tagInputs[field] || ''}
              onChange={e => setTagInputs(prev => ({ ...prev, [field]: e.target.value }))}
              onKeyDown={e => handleTagKeyDown(field, e)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={`Add ${label.toLowerCase().replace(/s$/, '')}...`}
              className="h-8 w-40 rounded-full border-dashed text-xs px-3 outline-none transition-all"
              style={glassInput}
            />
            <button
              type="button"
              onClick={() => addTag(field, tagInputs[field] || '')}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed transition-colors ${btnCls}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ── Step navigation ───────────────────────────────── */
  const handleStep1Next = () => {
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (!formData.job_title.trim()) {
      toast({ title: 'Error', description: 'Please provide a job title.', variant: 'destructive' });
      return;
    }
    const hasInvalidLoc = locationVacancies.some(lv => !lv.country || !lv.city);
    if (hasInvalidLoc) {
      toast({ title: 'Error', description: 'Please select a country and city for all locations.', variant: 'destructive' });
      return;
    }
    setCurrentStep(3);
  };

  /* ── Final submit ──────────────────────────────────── */
  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      const aiResult = {
        ai_result: {
          job_title: formData.job_title,
          extracted_rubric: {
            core_skills: formData.core_skills,
            preferred_skills: formData.preferred_skills,
            experience_requirements: formData.experience_requirements,
            educational_requirements: formData.educational_requirements,
            soft_skills: formData.soft_skills,
            certifications: formData.certifications,
            role_keywords: formData.role_keywords,
          },
          summary: formData.summary,
          raw_text_classification: extractedData?.ai_result.raw_text_classification || {
            matches_known_roles: true,
            role_category: 'Custom Role',
            matched_role: formData.job_title,
          },
        },
      };
      const lockDays = rejectionLockDays ? parseInt(rejectionLockDays) : undefined;
      const totalVac = locationVacancies.reduce((s, lv) => s + lv.vacancies, 0);
      const jobMetadata: Record<string, any> = {
        job_type: jobType || undefined,
        position_type: positionType || undefined,
        experience_range: experienceRange || undefined,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        salary_currency: salaryCurrency || undefined,
        salary_visibility: salaryVisibility || undefined,
        location_type: locationType || undefined,
        hiring_close_date: hiringCloseDate || undefined,
        auto_ai_interview: autoAIInterview,
      };
      const result = await apiClient.submitJob(aiResult, rubricFile, modelAnswerFile || undefined, totalVac, lockDays, undefined, undefined, locationVacancies, jobMetadata);
      toast({ title: 'Success', description: 'Job created successfully!' });
      navigate(`/jobs/${result.jd_id}`);
    } catch (err: any) {
      if (err?.status === 409) {
        toast({ title: 'Duplicate Job Detected', description: err.message || 'A job with the same title already exists in this city.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: err?.message || 'Failed to create job.', variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Helper: format label ──────────────────────────── */
  const formatLabel = (val: string) =>
    val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const totalVacancies = locationVacancies.reduce((s, lv) => s + lv.vacancies, 0);

  /* ── Reusable: glass select trigger props ──────────── */
  const selectTriggerCls = "mt-2 h-11 rounded-xl text-white border-0 outline-none";
  const selectContentStyle = selectDropdown;
  const selectItemCls = "text-slate-200 focus:bg-white/10 focus:text-white";

  return (
    <AppLayout>
      <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
        {/* Ambient glow */}
        <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(27,142,229,0.04)', filter: 'blur(120px)' }} />
        <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(59,130,246,0.03)', filter: 'blur(120px)' }} />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ──────────────────────────────────── */}
          <div className="mb-8 flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:text-white transition-all"
              style={glassCard}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Create New Job</h1>
              <p className="text-slate-400 text-sm mt-0.5">Set up a new job posting with AI-powered extraction</p>
            </div>
          </div>

          {/* ── Step Indicator ───────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center justify-center">
              {STEP_LABELS.map((s, i) => {
                const done = currentStep > s.num;
                const active = currentStep === s.num;
                return (
                  <div key={s.num} className="flex items-center">
                    {i > 0 && (
                      <div
                        className="h-[2px] w-16 sm:w-24 md:w-32 transition-colors duration-300"
                        style={{ background: done ? '#34d399' : 'var(--orbis-border)' }}
                      />
                    )}
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-all duration-300"
                        style={
                          done
                            ? { background: '#34d399', color: 'hsl(var(--foreground))', boxShadow: '0 4px 16px rgba(52,211,153,0.3)' }
                            : active
                            ? { background: '#1B8EE5', color: 'hsl(var(--foreground))', boxShadow: '0 0 20px rgba(27,142,229,0.5)', border: '2px solid #1B8EE5' }
                            : { ...glassCard, color: 'rgb(100,116,139)' }
                        }
                      >
                        {done ? <Check className="w-5 h-5" /> : s.num}
                      </div>
                      <span className={`text-xs font-semibold whitespace-nowrap ${
                        active ? 'text-[#1B8EE5]' : done ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═════════ STEP CONTENT ═════════ */}
          <AnimatePresence mode="wait">

          {/* ═══ STEP 1: Upload JD ═══ */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="rounded-2xl overflow-hidden" style={glassCard}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                      <Sparkles className="w-5 h-5 text-[#1B8EE5]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Upload Job Description</h2>
                      <p className="text-sm text-slate-400 mt-0.5">Upload a JD file or paste the content to auto-extract job details with AI</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Drop zone */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={e => setJdFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="jd-file"
                  />
                  <motion.div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.005 }}
                    transition={{ duration: 0.2 }}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl p-12 transition-all duration-200"
                    style={{
                      border: isDragging
                        ? '2px dashed #1B8EE5'
                        : jdFile
                        ? '2px dashed rgba(52,211,153,0.4)'
                        : '2px dashed var(--orbis-border)',
                      background: isDragging
                        ? 'rgba(27,142,229,0.08)'
                        : jdFile
                        ? 'rgba(52,211,153,0.05)'
                        : 'var(--orbis-subtle)',
                    }}
                  >
                    <div
                      className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                      style={{ background: jdFile ? 'rgba(52,211,153,0.15)' : 'rgba(27,142,229,0.1)' }}
                    >
                      {jdFile ? <Check className="w-7 h-7 text-emerald-400" /> : <CloudUpload className="w-7 h-7 text-[#1B8EE5]" />}
                    </div>
                    {jdFile ? (
                      <>
                        <p className="text-sm font-semibold text-emerald-400">{jdFile.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{(jdFile.size / 1024).toFixed(1)} KB — Click or drop to replace</p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-semibold text-white">Drop your JD file here or click to browse</p>
                        <p className="text-sm text-slate-400 mt-1.5">Supported formats: PDF, DOCX, TXT (up to 10 MB)</p>
                      </>
                    )}
                  </motion.div>

                  {/* OR divider */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full" style={{ borderTop: '1px solid var(--orbis-hover)' }} />
                    </div>
                    <span className="relative px-4 text-xs font-bold uppercase tracking-widest text-slate-500" style={{ background: 'var(--orbis-page)' }}>OR</span>
                  </div>

                  {/* Paste textarea */}
                  <div>
                    <label className="text-sm font-medium text-slate-300">Paste Job Description</label>
                    <textarea
                      value={jdText}
                      onChange={e => setJdText(e.target.value)}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="Paste the full job description text here..."
                      rows={5}
                      className="mt-2 w-full rounded-xl p-4 text-sm text-white placeholder:text-slate-500 outline-none transition-all resize-none"
                      style={glassInput}
                    />
                  </div>

                  {/* Extract button */}
                  <button
                    type="button"
                    onClick={handleJdExtraction}
                    disabled={!jdFile || isExtracting}
                    className="w-full h-12 rounded-xl font-bold text-white text-[15px] transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                    style={gradientBtn}
                  >
                    {isExtracting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Extracting with AI...</>
                    ) : (
                      <><Sparkles className="w-5 h-5" /> Extract with AI</>
                    )}
                  </button>

                  {/* Extraction success banner */}
                  {extractedData && (
                    <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-400">Extracted: {extractedData.ai_result.job_title}</p>
                        <p className="text-xs text-emerald-500/70 mt-0.5">AI has populated the fields. Review and edit in the next step.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-6 h-11 rounded-xl font-semibold text-slate-300 hover:text-white transition-all"
                  style={glassCard}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="px-6 h-11 rounded-xl font-semibold text-white flex items-center gap-2 transition-all hover:scale-[1.02]"
                  style={gradientBtn}
                >
                  Next: Job Details
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: Job Details Form ═══ */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* ── Basic Information ─────────────────── */}
              <div className="rounded-2xl overflow-hidden" style={glassCard}>
                <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                  <div className="p-2 rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
                    <Briefcase className="w-4 h-4 text-[#1B8EE5]" />
                  </div>
                  <h2 className="text-base font-bold text-white">Basic Information</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Job Title <span className="text-rose-400">*</span></label>
                        <input
                          value={formData.job_title}
                          onChange={e => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          placeholder="e.g., Senior Software Engineer"
                          className="mt-2 w-full h-11 rounded-xl px-4 text-sm outline-none transition-all"
                          style={glassInput}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Job Type</label>
                        <Select value={jobType} onValueChange={setJobType}>
                          <SelectTrigger className={selectTriggerCls} style={glassInput}>
                            <SelectValue placeholder="Select job type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-0" style={selectContentStyle}>
                            {['full_time','part_time','contract','internship','freelance'].map(v => (
                              <SelectItem key={v} className={selectItemCls} value={v}>{formatLabel(v)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Location Type</label>
                        <Select value={locationType} onValueChange={setLocationType}>
                          <SelectTrigger className={selectTriggerCls} style={glassInput}>
                            <SelectValue placeholder="Select location type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-0" style={selectContentStyle}>
                            {['onsite','remote','hybrid'].map(v => (
                              <SelectItem key={v} className={selectItemCls} value={v}>{formatLabel(v)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Position Type</label>
                        <Select value={positionType} onValueChange={setPositionType}>
                          <SelectTrigger className={selectTriggerCls} style={glassInput}>
                            <SelectValue placeholder="Select position type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-0" style={selectContentStyle}>
                            {['individual_contributor','team_lead','manager','director','executive'].map(v => (
                              <SelectItem key={v} className={selectItemCls} value={v}>{formatLabel(v)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Right column */}
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Experience Range</label>
                        <input
                          value={experienceRange}
                          onChange={e => setExperienceRange(e.target.value)}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          placeholder="e.g. 3-5 years"
                          className="mt-2 w-full h-11 rounded-xl px-4 text-sm outline-none transition-all"
                          style={glassInput}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Salary Range</label>
                        <div className="mt-2 grid grid-cols-[1fr_1fr_100px] gap-2">
                          <input
                            type="number"
                            min={0}
                            value={salaryMin}
                            onChange={e => setSalaryMin(e.target.value)}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder="Min"
                            className="h-11 rounded-xl px-4 text-sm outline-none transition-all"
                            style={glassInput}
                          />
                          <input
                            type="number"
                            min={0}
                            value={salaryMax}
                            onChange={e => setSalaryMax(e.target.value)}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder="Max"
                            className="h-11 rounded-xl px-4 text-sm outline-none transition-all"
                            style={glassInput}
                          />
                          <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                            <SelectTrigger className={selectTriggerCls} style={glassInput}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-0" style={selectContentStyle}>
                              {['USD','EUR','GBP','INR'].map(v => (
                                <SelectItem key={v} className={selectItemCls} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <SalaryInsightsCard
                          jobTitle={formData.job_title}
                          location={locationVacancies[0]?.city || undefined}
                          country={locationVacancies[0]?.country || undefined}
                          seniority={positionType || undefined}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Salary Visibility</label>
                        <Select value={salaryVisibility} onValueChange={setSalaryVisibility}>
                          <SelectTrigger className={selectTriggerCls} style={glassInput}>
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-0" style={selectContentStyle}>
                            {['public','hidden','visible_after_screening','visible_after_interview'].map(v => (
                              <SelectItem key={v} className={selectItemCls} value={v}>{formatLabel(v)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Hiring Close Date</label>
                        <input
                          type="date"
                          value={hiringCloseDate}
                          onChange={e => setHiringCloseDate(e.target.value)}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          className="mt-2 w-full h-11 rounded-xl px-4 text-sm outline-none transition-all"
                          style={glassInput}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Full-width: Description */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Job Description <span className="text-rose-400">*</span></label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="h-7 px-3 text-xs rounded-lg font-medium flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
                          style={glassCard}
                          onClick={openTemplatePicker}
                        >
                          <LayoutTemplate className="w-3.5 h-3.5" />
                          Use Template
                        </button>
                        <JDGeneratorButton
                          jobTitle={formData.job_title}
                          seniority={positionType}
                          location={locationVacancies[0]?.city || undefined}
                          onGenerated={(jd) => {
                            const parts: string[] = [];
                            if (jd.summary) parts.push(jd.summary);
                            if (jd.responsibilities?.length) parts.push('\n\nResponsibilities:\n' + jd.responsibilities.map(r => `- ${r}`).join('\n'));
                            if (jd.requirements?.length) parts.push('\n\nRequirements:\n' + jd.requirements.map(r => `- ${r}`).join('\n'));
                            if (jd.qualifications?.length) parts.push('\n\nQualifications:\n' + jd.qualifications.map(q => `- ${q}`).join('\n'));
                            if (jd.benefits?.length) parts.push('\n\nBenefits:\n' + jd.benefits.map(b => `- ${b}`).join('\n'));
                            setFormData(prev => ({ ...prev, summary: parts.join('') }));
                          }}
                        />
                      </div>
                    </div>
                    <textarea
                      value={formData.summary}
                      onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="Describe the role, responsibilities, and what makes it a great opportunity..."
                      className="mt-2 w-full min-h-[140px] rounded-xl p-4 text-sm text-white placeholder:text-slate-500 outline-none transition-all resize-none"
                      style={glassInput}
                      required
                    />
                    <div className="mt-2">
                      <JDBiasChecker
                        text={formData.summary}
                        onFixApplied={(oldPhrase, newPhrase) => {
                          setFormData(prev => ({
                            ...prev,
                            summary: prev.summary.replace(oldPhrase, newPhrase),
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Locations & Vacancies ─────────────── */}
              <div className="rounded-2xl overflow-hidden" style={glassCard}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: 'rgba(52,211,153,0.12)' }}>
                      <MapPin className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Locations & Vacancies <span className="text-rose-400 text-sm">*</span></h2>
                      <p className="text-xs text-slate-500 mt-0.5">The job will auto-close once all vacancies across locations are filled.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocationVacancies(prev => [...prev, { country: '', city: '', vacancies: 1 }])}
                    className="h-8 px-3 text-xs rounded-lg font-medium flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
                    style={glassCard}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Location
                  </button>
                </div>
                <div className="p-6 space-y-3">
                  {locationVacancies.map((lv, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-3 items-end">
                      <div>
                        {idx === 0 && <label className="text-xs font-medium text-slate-500 mb-1.5 block">Country</label>}
                        <Select
                          value={lv.country}
                          onValueChange={(val) => setLocationVacancies(prev => prev.map((l, i) => i === idx ? { ...l, country: val, city: '' } : l))}
                        >
                          <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}>
                            <SelectValue placeholder="Country" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-0 max-h-60" style={selectContentStyle}>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c} className={selectItemCls} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        {idx === 0 && <label className="text-xs font-medium text-slate-500 mb-1.5 block">City</label>}
                        <Select
                          value={lv.city}
                          onValueChange={(val) => setLocationVacancies(prev => prev.map((l, i) => i === idx ? { ...l, city: val } : l))}
                          disabled={!lv.country}
                        >
                          <SelectTrigger className="h-10 rounded-xl text-white border-0 disabled:opacity-40" style={glassInput}>
                            <SelectValue placeholder={lv.country ? 'City' : 'Select country'} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-0 max-h-60" style={selectContentStyle}>
                            {getCitiesForCountry(lv.country).map((c) => (
                              <SelectItem key={c} className={selectItemCls} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        {idx === 0 && <label className="text-xs font-medium text-slate-500 mb-1.5 block">Vacancies</label>}
                        <input
                          type="number"
                          min={1}
                          value={lv.vacancies}
                          onChange={e => setLocationVacancies(prev => prev.map((l, i) => i === idx ? { ...l, vacancies: Math.max(1, parseInt(e.target.value) || 1) } : l))}
                          className="h-10 w-full rounded-xl px-3 text-sm text-center outline-none transition-all"
                          style={glassInput}
                        />
                      </div>
                      <div>
                        {idx === 0 && <div className="h-5 mb-1.5" />}
                        {locationVacancies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLocationVacancies(prev => prev.filter((_, i) => i !== idx))}
                            className="flex h-10 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 text-xs text-slate-500">
                    Total vacancies: <span className="font-semibold text-white">{totalVacancies}</span>
                  </div>
                </div>
              </div>

              {/* ── Experience & Education ────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl overflow-hidden"
                  style={glassCard}
                >
                  <div className="px-6 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <Clock className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">Experience</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500">Minimum Years</label>
                      <input
                        type="number"
                        value={formData.experience_requirements.min_years}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          experience_requirements: { ...prev.experience_requirements, min_years: parseInt(e.target.value) || 0 },
                        }))}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className="mt-1.5 w-full h-10 rounded-xl px-4 text-sm outline-none transition-all"
                        style={glassInput}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Description</label>
                      <textarea
                        value={formData.experience_requirements.description}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          experience_requirements: { ...prev.experience_requirements, description: e.target.value },
                        }))}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className="mt-1.5 w-full rounded-xl p-4 text-sm outline-none transition-all resize-none"
                        style={glassInput}
                        rows={3}
                        placeholder="Describe relevant experience..."
                      />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl overflow-hidden"
                  style={glassCard}
                >
                  <div className="px-6 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <GraduationCap className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">Education</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500">Degree</label>
                      <input
                        value={formData.educational_requirements.degree}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          educational_requirements: { ...prev.educational_requirements, degree: e.target.value },
                        }))}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className="mt-1.5 w-full h-10 rounded-xl px-4 text-sm outline-none transition-all"
                        style={glassInput}
                        placeholder="e.g., Bachelor's degree"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Field of Study</label>
                      <input
                        value={formData.educational_requirements.field}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          educational_requirements: { ...prev.educational_requirements, field: e.target.value },
                        }))}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className="mt-1.5 w-full h-10 rounded-xl px-4 text-sm outline-none transition-all"
                        style={glassInput}
                        placeholder="e.g., Computer Science"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* ── Skills & Keywords ─────────────────── */}
              <div className="rounded-2xl overflow-hidden" style={glassCard}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                  <h2 className="text-base font-bold text-white">Skills & Keywords</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderTagSection('core_skills', 'Core Skills')}
                    {renderTagSection('preferred_skills', 'Preferred Skills')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderTagSection('soft_skills', 'Soft Skills')}
                    {renderTagSection('certifications', 'Certifications')}
                  </div>
                  {renderTagSection('role_keywords', 'Role Keywords')}
                </div>
              </div>

              {/* ── Additional Settings ───────────────── */}
              <div className="rounded-2xl overflow-hidden" style={glassCard}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                  <h2 className="text-base font-bold text-white">Additional Settings</h2>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Rejection Lock Period (days)</label>
                    <p className="text-xs text-slate-500 mt-0.5 mb-2">Override the global default. Leave blank to use the system default (90 days).</p>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={rejectionLockDays}
                      onChange={e => setRejectionLockDays(e.target.value)}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="Use default (90 days)"
                      className="h-11 w-48 rounded-xl px-4 text-sm outline-none transition-all"
                      style={glassInput}
                    />
                  </div>

                  {/* File uploads */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Rubric */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <label className="text-sm font-semibold text-white">Evaluation Rubric</label>
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500" style={{ background: 'var(--orbis-input)' }}>Optional</span>
                      </div>
                      <p className="text-xs text-slate-500">Upload the evaluation criteria and scoring rubric.</p>
                      <input ref={rubricInputRef} type="file" accept=".pdf,.docx,.txt" onChange={e => setRubricFile(e.target.files?.[0] || null)} className="hidden" id="rubric-file" />
                      {rubricFile ? (
                        <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                          <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-emerald-300 truncate">{rubricFile.name}</p>
                            <p className="text-[11px] text-emerald-500/60">{(rubricFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button type="button" onClick={() => setRubricFile(null)} className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => rubricInputRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl py-5 text-sm text-slate-500 hover:text-amber-400 transition-all"
                          style={{ border: '2px dashed var(--orbis-hover)', background: 'var(--orbis-subtle)' }}
                        >
                          <Upload className="w-4 h-4" /> Choose rubric file
                        </button>
                      )}
                    </div>
                    {/* Model Answer */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <label className="text-sm font-semibold text-white">Model Answer</label>
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500" style={{ background: 'var(--orbis-input)' }}>Optional</span>
                      </div>
                      <p className="text-xs text-slate-500">Upload sample answers for interview questions.</p>
                      <input ref={modelInputRef} type="file" accept=".pdf,.docx,.txt" onChange={e => setModelAnswerFile(e.target.files?.[0] || null)} className="hidden" id="model-answer-file" />
                      {modelAnswerFile ? (
                        <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                          <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-emerald-300 truncate">{modelAnswerFile.name}</p>
                            <p className="text-[11px] text-emerald-500/60">{(modelAnswerFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button type="button" onClick={() => setModelAnswerFile(null)} className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => modelInputRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl py-5 text-sm text-slate-500 hover:text-blue-400 transition-all"
                          style={{ border: '2px dashed var(--orbis-hover)', background: 'var(--orbis-subtle)' }}
                        >
                          <Upload className="w-4 h-4" /> Choose model answer file
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-6 h-11 rounded-xl font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                  style={glassCard}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2Next}
                  className="px-6 h-11 rounded-xl font-semibold text-white flex items-center gap-2 transition-all hover:scale-[1.02]"
                  style={gradientBtn}
                >
                  Next: Review
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 3: Review ═══ */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Review summary card */}
              <div className="rounded-2xl overflow-hidden" style={glassCard}>
                <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, rgba(27,142,229,0.12) 0%, rgba(22,118,192,0.08) 100%)', borderBottom: '1px solid var(--orbis-border)' }}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={gradientBtn}>
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-white">{formData.job_title || 'Untitled Position'}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-400">
                        {locationVacancies.filter(lv => lv.city && lv.country).length > 0 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {locationVacancies.filter(lv => lv.city && lv.country).map(lv => `${lv.city}, ${lv.country}`).join(' / ')}
                          </span>
                        )}
                        {jobType && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {formatLabel(jobType)}
                          </span>
                        )}
                        {locationType && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />
                            {formatLabel(locationType)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  {/* Description */}
                  <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Job Description</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {formData.summary || 'No description provided.'}
                    </p>
                  </div>

                  {/* Details grid */}
                  <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { icon: Building2, label: 'Position Type', value: positionType ? formatLabel(positionType) : '--' },
                        { icon: Clock, label: 'Experience', value: experienceRange || (formData.experience_requirements.min_years ? `${formData.experience_requirements.min_years}+ years` : '--') },
                        { icon: DollarSign, label: 'Salary', value: salaryMin && salaryMax ? `${salaryCurrency} ${Number(salaryMin).toLocaleString()} - ${Number(salaryMax).toLocaleString()}` : salaryMin ? `${salaryCurrency} ${Number(salaryMin).toLocaleString()}+` : '--' },
                        { icon: BadgeCheck, label: 'Vacancies', value: String(totalVacancies) },
                      ].map((item, idx) => (
                        <div key={idx} className="rounded-xl p-3" style={{ background: 'var(--orbis-card)' }}>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                            <item.icon className="w-3.5 h-3.5" /> {item.label}
                          </div>
                          <p className="text-sm font-medium text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {hiringCloseDate && (
                      <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-400">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Hiring closes: <span className="font-medium text-white">{new Date(hiringCloseDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  {(formData.educational_requirements.degree || formData.educational_requirements.field) && (
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Education</h3>
                      <p className="text-sm text-slate-300">
                        {[formData.educational_requirements.degree, formData.educational_requirements.field].filter(Boolean).join(' in ')}
                      </p>
                    </div>
                  )}

                  {/* Locations */}
                  {locationVacancies.filter(lv => lv.country && lv.city).length > 0 && (
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Locations</h3>
                      <div className="flex flex-wrap gap-2">
                        {locationVacancies.filter(lv => lv.country && lv.city).map((lv, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-slate-300" style={glassCard}>
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            {lv.city}, {lv.country}
                            <span className="ml-1 text-xs text-slate-500">({lv.vacancies} {lv.vacancies === 1 ? 'vacancy' : 'vacancies'})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {(formData.core_skills.length > 0 || formData.preferred_skills.length > 0 || formData.soft_skills.length > 0 || formData.certifications.length > 0 || formData.role_keywords.length > 0) && (
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Skills & Keywords</h3>
                      <div className="space-y-3">
                        {[
                          { field: 'core_skills', label: 'Core Skills' },
                          { field: 'preferred_skills', label: 'Preferred Skills' },
                          { field: 'soft_skills', label: 'Soft Skills' },
                          { field: 'certifications', label: 'Certifications' },
                          { field: 'role_keywords', label: 'Role Keywords' },
                        ].map(({ field, label }) => {
                          const values = formData[field as keyof JobFormData] as string[];
                          if (!values || values.length === 0) return null;
                          const colorCls = TAG_COLORS[field] || TAG_COLORS.role_keywords;
                          return (
                            <div key={field}>
                              <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {values.map((v, i) => (
                                  <span key={i} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorCls}`}>
                                    {v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Attached files */}
                  {(rubricFile || modelAnswerFile || jdFile) && (
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Attached Files</h3>
                      <div className="flex flex-wrap gap-3">
                        {jdFile && (
                          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300" style={glassCard}>
                            <FileUp className="w-4 h-4 text-[#1B8EE5]" />
                            <span className="font-medium">{jdFile.name}</span>
                            <span className="text-xs text-slate-500">JD</span>
                          </div>
                        )}
                        {rubricFile && (
                          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300" style={glassCard}>
                            <FileText className="w-4 h-4 text-amber-400" />
                            <span className="font-medium">{rubricFile.name}</span>
                            <span className="text-xs text-slate-500">Rubric</span>
                          </div>
                        )}
                        {modelAnswerFile && (
                          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300" style={glassCard}>
                            <FileText className="w-4 h-4 text-blue-400" />
                            <span className="font-medium">{modelAnswerFile.name}</span>
                            <span className="text-xs text-slate-500">Model Answer</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Salary visibility & rejection lock */}
                  {(salaryVisibility || rejectionLockDays) && (
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Settings</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                        {salaryVisibility && (
                          <span className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            Salary visibility: <span className="font-medium text-white">{formatLabel(salaryVisibility)}</span>
                          </span>
                        )}
                        {rejectionLockDays && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Rejection lock: <span className="font-medium text-white">{rejectionLockDays} days</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Interview Toggle */}
              <div className="rounded-xl p-4 flex items-center justify-between" style={glassCard}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(27,142,229,0.12)' }}>
                    <Bot className="w-5 h-5 text-[#1B8EE5]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Auto AI Interview</p>
                    <p className="text-xs text-slate-500">Automatically send AI interview invites to candidates when they apply</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={autoAIInterview} onChange={(e) => setAutoAIInterview(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" style={{ background: autoAIInterview ? '#1B8EE5' : 'var(--orbis-border)' }}></div>
                </label>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 h-11 rounded-xl font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                  style={glassCard}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit()}
                    disabled={isLoading}
                    className="px-6 h-11 rounded-xl font-semibold text-slate-300 hover:text-white disabled:opacity-50 transition-all"
                    style={glassCard}
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit()}
                    disabled={isLoading}
                    className="px-8 h-11 rounded-xl font-semibold text-white flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                    style={gradientBtn}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating Job...</>
                    ) : (
                      <><Check className="w-4 h-4" /> Publish Job</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── JD Template Picker Dialog ─────────────────── */}
      <Dialog open={jdTemplateOpen} onOpenChange={setJdTemplateOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <LayoutTemplate className="w-4 h-4" />
              Select a JD Template
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-2">
            {jdTemplatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : jdTemplates.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-12">No JD templates found.</p>
            ) : (
              jdTemplates.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  className="w-full text-left rounded-xl p-3 transition-colors hover:bg-white/5"
                  style={{ border: '1px solid var(--orbis-hover)' }}
                  onClick={() => applyJdTemplate(tpl)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{tpl.name}</p>
                    {tpl.category && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full text-slate-400" style={{ background: 'var(--orbis-input)' }}>
                        {tpl.category}
                      </span>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tpl.description}</p>
                  )}
                  {(tpl.skills && tpl.skills.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.skills.slice(0, 5).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {s}
                        </span>
                      ))}
                      {tpl.skills.length > 5 && (
                        <span className="text-[10px] text-slate-500">+{tpl.skills.length - 5} more</span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CreateJob;
