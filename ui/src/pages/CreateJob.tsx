
import { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, FileText, Sparkles, ArrowLeft, ArrowRight, Plus, X, Check,
  CloudUpload, Briefcase, GraduationCap, Clock, Loader2, Trash2, FileUp, MapPin, LayoutTemplate,
  DollarSign, CalendarDays, Eye, Building2, Globe, BadgeCheck,
} from 'lucide-react';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { fadeInUp } from '@/lib/animations';
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

/* ── Tag color map ─────────────────────────────────────── */
const TAG_COLORS: Record<string, string> = {
  core_skills:      'bg-blue-50 text-blue-700 border-blue-200',
  preferred_skills: 'bg-teal-50 text-teal-700 border-teal-200',
  soft_skills:      'bg-purple-50 text-purple-700 border-purple-200',
  certifications:   'bg-amber-50 text-amber-700 border-amber-200',
  role_keywords:    'bg-muted text-foreground border-border',
};
const TAG_BTN: Record<string, string> = {
  core_skills:      'border-blue-200 text-blue-600 hover:bg-blue-50',
  preferred_skills: 'border-teal-200 text-teal-600 hover:bg-teal-50',
  soft_skills:      'border-purple-200 text-purple-600 hover:bg-purple-50',
  certifications:   'border-amber-200 text-amber-600 hover:bg-amber-50',
  role_keywords:    'border-border text-muted-foreground hover:bg-muted/50',
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
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {values.map((val, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${colorCls}`}
            >
              {val}
              <button type="button" onClick={() => removeTag(field, i)} className="ml-0.5 rounded-full p-0.5 hover:bg-black/5 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1.5">
            <Input
              value={tagInputs[field] || ''}
              onChange={e => setTagInputs(prev => ({ ...prev, [field]: e.target.value }))}
              onKeyDown={e => handleTagKeyDown(field, e)}
              placeholder={`Add ${label.toLowerCase().replace(/s$/, '')}...`}
              className="h-8 w-40 rounded-full border-dashed text-xs"
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
    // Step 1 allows skipping if manual entry
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
      const totalVacancies = locationVacancies.reduce((s, lv) => s + lv.vacancies, 0);
      const jobMetadata = {
        job_type: jobType || undefined,
        position_type: positionType || undefined,
        experience_range: experienceRange || undefined,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        salary_currency: salaryCurrency || undefined,
        salary_visibility: salaryVisibility || undefined,
        location_type: locationType || undefined,
        hiring_close_date: hiringCloseDate || undefined,
      };
      const result = await apiClient.submitJob(aiResult, rubricFile, modelAnswerFile || undefined, totalVacancies, lockDays, undefined, undefined, locationVacancies, jobMetadata);
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

  /* ── Review helpers ────────────────────────────────── */
  const totalVacancies = locationVacancies.reduce((s, lv) => s + lv.vacancies, 0);

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ────────────────────────────────── */}
          <div className="mb-8 flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Create New Job</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Set up a new job posting with AI-powered extraction</p>
            </div>
          </div>

          {/* ── Step Indicator ─────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center justify-center">
              {STEP_LABELS.map((s, i) => {
                const done = currentStep > s.num;
                const active = currentStep === s.num;
                return (
                  <div key={s.num} className="flex items-center">
                    {i > 0 && (
                      <div className={`h-[2px] w-16 sm:w-24 md:w-32 transition-colors duration-300 ${done ? 'bg-green-500' : 'bg-border'}`} />
                    )}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                        done
                          ? 'bg-green-500 text-white shadow-md shadow-green-500/25'
                          : active
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-4 ring-blue-100'
                          : 'border-2 border-border bg-card text-muted-foreground'
                      }`}>
                        {done ? <Check className="w-5 h-5" /> : s.num}
                      </div>
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        active ? 'text-blue-600' : done ? 'text-green-600' : 'text-muted-foreground'
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
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-blue-600" />
                    Upload Job Description
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Upload a JD file or paste the content to auto-extract job details with AI</p>
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
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-200 ${
                      isDragging
                        ? 'border-blue-400 bg-blue-50/60'
                        : jdFile
                        ? 'border-green-300 bg-green-50/40'
                        : 'border-border bg-muted/30 hover:border-blue-300 hover:bg-blue-50/20'
                    }`}
                  >
                    <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
                      jdFile ? 'bg-green-100' : 'bg-blue-50'
                    }`}>
                      {jdFile ? <Check className="w-7 h-7 text-green-600" /> : <CloudUpload className="w-7 h-7 text-blue-500" />}
                    </div>
                    {jdFile ? (
                      <>
                        <p className="text-sm font-semibold text-green-700">{jdFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{(jdFile.size / 1024).toFixed(1)} KB -- Click or drop to replace</p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-semibold text-foreground">Drop your JD file here or click to browse</p>
                        <p className="text-sm text-muted-foreground mt-1.5">Supported formats: PDF, DOCX, TXT (up to 10 MB)</p>
                      </>
                    )}
                  </motion.div>

                  {/* OR divider */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <span className="relative bg-card px-4 text-sm font-medium text-muted-foreground">OR</span>
                  </div>

                  {/* Paste textarea */}
                  <div>
                    <Label htmlFor="jd-paste" className="text-sm font-medium text-foreground">Paste Job Description</Label>
                    <Textarea
                      id="jd-paste"
                      value={jdText}
                      onChange={e => setJdText(e.target.value)}
                      placeholder="Paste the full job description text here..."
                      className="mt-2 min-h-[140px] rounded-lg border-border bg-muted/30 focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                    />
                  </div>

                  {/* Extract button */}
                  <Button
                    type="button"
                    onClick={handleJdExtraction}
                    disabled={!jdFile || isExtracting}
                    className="w-full h-12 rounded-xl font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl disabled:opacity-50 text-[15px]"
                    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
                  >
                    {isExtracting ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Extracting with AI...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Extract with AI</span>
                    )}
                  </Button>

                  {/* Extraction success banner */}
                  {extractedData && (
                    <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/60 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-800">Extracted: {extractedData.ai_result.job_title}</p>
                        <p className="text-xs text-green-700 mt-0.5">AI has populated the fields. Review and edit in the next step.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="rounded-xl px-6 h-11"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleStep1Next}
                  className="rounded-xl px-6 h-11 font-semibold text-white shadow-md shadow-blue-600/20 hover:shadow-lg gap-2"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
                >
                  Next: Job Details
                  <ArrowRight className="w-4 h-4" />
                </Button>
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
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Briefcase className="w-4.5 h-4.5 text-blue-600" />
                    Basic Information
                  </h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-5">
                      <div>
                        <Label htmlFor="job-title" className="text-sm font-semibold text-foreground">Job Title <span className="text-red-400">*</span></Label>
                        <Input
                          id="job-title"
                          value={formData.job_title}
                          onChange={e => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                          placeholder="e.g., Senior Software Engineer"
                          className="mt-2 h-11 rounded-lg border-border bg-muted/30 focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Job Type</Label>
                        <Select value={jobType} onValueChange={setJobType}>
                          <SelectTrigger className="mt-2 h-11 rounded-lg border-border bg-muted/30 focus:bg-card">
                            <SelectValue placeholder="Select job type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="internship">Internship</SelectItem>
                            <SelectItem value="freelance">Freelance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Location Type</Label>
                        <Select value={locationType} onValueChange={setLocationType}>
                          <SelectTrigger className="mt-2 h-11 rounded-lg border-border bg-muted/30 focus:bg-card">
                            <SelectValue placeholder="Select location type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="onsite">Onsite</SelectItem>
                            <SelectItem value="remote">Remote</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Position Type</Label>
                        <Select value={positionType} onValueChange={setPositionType}>
                          <SelectTrigger className="mt-2 h-11 rounded-lg border-border bg-muted/30 focus:bg-card">
                            <SelectValue placeholder="Select position type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual_contributor">Individual Contributor</SelectItem>
                            <SelectItem value="team_lead">Team Lead</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="executive">Executive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Right column */}
                    <div className="space-y-5">
                      <div>
                        <Label htmlFor="experience-range" className="text-sm font-semibold text-foreground">Experience Range</Label>
                        <Input
                          id="experience-range"
                          value={experienceRange}
                          onChange={e => setExperienceRange(e.target.value)}
                          placeholder="e.g. 3-5 years"
                          className="mt-2 h-11 rounded-lg border-border bg-muted/30 focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Salary Range</Label>
                        <div className="mt-2 grid grid-cols-[1fr_1fr_100px] gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={salaryMin}
                            onChange={e => setSalaryMin(e.target.value)}
                            placeholder="Min"
                            className="h-11 rounded-lg border-border bg-muted/30 focus:bg-card"
                          />
                          <Input
                            type="number"
                            min={0}
                            value={salaryMax}
                            onChange={e => setSalaryMax(e.target.value)}
                            placeholder="Max"
                            className="h-11 rounded-lg border-border bg-muted/30 focus:bg-card"
                          />
                          <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                            <SelectTrigger className="h-11 rounded-lg border-border bg-muted/30 focus:bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                              <SelectItem value="INR">INR</SelectItem>
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
                        <Label className="text-sm font-semibold text-foreground">Salary Visibility</Label>
                        <Select value={salaryVisibility} onValueChange={setSalaryVisibility}>
                          <SelectTrigger className="mt-2 h-11 rounded-lg border-border bg-muted/30 focus:bg-card">
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="hidden">Hidden</SelectItem>
                            <SelectItem value="visible_after_screening">Visible After Screening</SelectItem>
                            <SelectItem value="visible_after_interview">Visible After Interview</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="hiring-close-date" className="text-sm font-semibold text-foreground">Hiring Close Date</Label>
                        <Input
                          id="hiring-close-date"
                          type="date"
                          value={hiringCloseDate}
                          onChange={e => setHiringCloseDate(e.target.value)}
                          className="mt-2 h-11 rounded-lg border-border bg-muted/30 focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Full-width: Description */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="summary" className="text-sm font-semibold text-foreground">Job Description <span className="text-red-400">*</span></Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs rounded-lg gap-1.5"
                          onClick={openTemplatePicker}
                        >
                          <LayoutTemplate className="w-3.5 h-3.5" />
                          Use Template
                        </Button>
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
                    <Textarea
                      id="summary"
                      value={formData.summary}
                      onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                      placeholder="Describe the role, responsibilities, and what makes it a great opportunity..."
                      className="mt-2 min-h-[140px] rounded-lg border-border bg-muted/30 focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <MapPin className="w-4.5 h-4.5 text-emerald-600" />
                      Locations & Vacancies <span className="text-red-400 text-sm">*</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">The job will auto-close once all vacancies across locations are filled.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLocationVacancies(prev => [...prev, { country: '', city: '', vacancies: 1 }])}
                    className="h-8 text-xs rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Location
                  </Button>
                </div>
                <div className="p-6 space-y-3">
                  {locationVacancies.map((lv, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-3 items-end">
                      <div>
                        {idx === 0 && <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Country</Label>}
                        <Select
                          value={lv.country}
                          onValueChange={(val) => setLocationVacancies(prev => prev.map((l, i) => i === idx ? { ...l, country: val, city: '' } : l))}
                        >
                          <SelectTrigger className="h-10 rounded-lg border-border bg-muted/30 focus:bg-card">
                            <SelectValue placeholder="Country" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">City</Label>}
                        <Select
                          value={lv.city}
                          onValueChange={(val) => setLocationVacancies(prev => prev.map((l, i) => i === idx ? { ...l, city: val } : l))}
                          disabled={!lv.country}
                        >
                          <SelectTrigger className="h-10 rounded-lg border-border bg-muted/30 focus:bg-card disabled:opacity-50">
                            <SelectValue placeholder={lv.country ? 'City' : 'Select country'} />
                          </SelectTrigger>
                          <SelectContent>
                            {getCitiesForCountry(lv.country).map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Vacancies</Label>}
                        <Input
                          type="number"
                          min={1}
                          value={lv.vacancies}
                          onChange={e => setLocationVacancies(prev => prev.map((l, i) => i === idx ? { ...l, vacancies: Math.max(1, parseInt(e.target.value) || 1) } : l))}
                          className="h-10 rounded-lg border-border bg-muted/30 text-center"
                        />
                      </div>
                      <div>
                        {idx === 0 && <div className="h-5 mb-1.5" />}
                        {locationVacancies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLocationVacancies(prev => prev.filter((_, i) => i !== idx))}
                            className="flex h-10 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Total vacancies: <span className="font-semibold text-foreground">{totalVacancies}</span>
                  </div>
                </div>
              </div>

              {/* ── Experience & Education ────────────── */}
              <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div variants={fadeInUp} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border bg-muted/30 px-6 py-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      Experience
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <Label htmlFor="min-years" className="text-xs font-medium text-muted-foreground">Minimum Years</Label>
                      <Input
                        id="min-years"
                        type="number"
                        value={formData.experience_requirements.min_years}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          experience_requirements: { ...prev.experience_requirements, min_years: parseInt(e.target.value) || 0 },
                        }))}
                        className="mt-1.5 h-10 rounded-lg border-border bg-muted/30 focus:bg-card"
                      />
                    </div>
                    <div>
                      <Label htmlFor="exp-desc" className="text-xs font-medium text-muted-foreground">Description</Label>
                      <Textarea
                        id="exp-desc"
                        value={formData.experience_requirements.description}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          experience_requirements: { ...prev.experience_requirements, description: e.target.value },
                        }))}
                        className="mt-1.5 rounded-lg border-border bg-muted/30 focus:bg-card"
                        rows={3}
                        placeholder="Describe relevant experience..."
                      />
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={fadeInUp} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border bg-muted/30 px-6 py-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-violet-600" />
                      Education
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <Label htmlFor="degree" className="text-xs font-medium text-muted-foreground">Degree</Label>
                      <Input
                        id="degree"
                        value={formData.educational_requirements.degree}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          educational_requirements: { ...prev.educational_requirements, degree: e.target.value },
                        }))}
                        className="mt-1.5 h-10 rounded-lg border-border bg-muted/30 focus:bg-card"
                        placeholder="e.g., Bachelor's degree"
                      />
                    </div>
                    <div>
                      <Label htmlFor="field" className="text-xs font-medium text-muted-foreground">Field of Study</Label>
                      <Input
                        id="field"
                        value={formData.educational_requirements.field}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          educational_requirements: { ...prev.educational_requirements, field: e.target.value },
                        }))}
                        className="mt-1.5 h-10 rounded-lg border-border bg-muted/30 focus:bg-card"
                        placeholder="e.g., Computer Science"
                      />
                    </div>
                  </div>
                </motion.div>
              </StaggerGrid>

              {/* ── Skills & Keywords ─────────────────── */}
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-base font-semibold text-foreground">Skills & Keywords</h2>
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
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-base font-semibold text-foreground">Additional Settings</h2>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <Label htmlFor="rejectionLockDays" className="text-sm font-semibold text-foreground">Rejection Lock Period (days)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">Override the global default. Leave blank to use the system default (90 days).</p>
                    <Input
                      id="rejectionLockDays"
                      type="number"
                      min={0}
                      max={365}
                      value={rejectionLockDays}
                      onChange={e => setRejectionLockDays(e.target.value)}
                      placeholder="Use default (90 days)"
                      className="h-11 w-48 rounded-lg border-border bg-muted/30 focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>

                  {/* File uploads inline */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Rubric */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <Label className="text-sm font-semibold text-foreground">Evaluation Rubric</Label>
                        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">Optional</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Upload the evaluation criteria and scoring rubric.</p>
                      <input ref={rubricInputRef} type="file" accept=".pdf,.docx,.txt" onChange={e => setRubricFile(e.target.files?.[0] || null)} className="hidden" id="rubric-file" />
                      {rubricFile ? (
                        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50/60 p-3">
                          <FileText className="w-5 h-5 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-800 truncate">{rubricFile.name}</p>
                            <p className="text-[11px] text-green-600">{(rubricFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button type="button" onClick={() => setRubricFile(null)} className="p-1 rounded-lg text-green-600 hover:bg-green-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => rubricInputRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-5 text-sm text-muted-foreground hover:border-amber-300 hover:text-amber-600 transition-all"
                        >
                          <Upload className="w-4 h-4" /> Choose rubric file
                        </button>
                      )}
                    </div>
                    {/* Model Answer */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-violet-600" />
                        <Label className="text-sm font-semibold text-foreground">Model Answer</Label>
                        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">Optional</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Upload sample answers for interview questions.</p>
                      <input ref={modelInputRef} type="file" accept=".pdf,.docx,.txt" onChange={e => setModelAnswerFile(e.target.files?.[0] || null)} className="hidden" id="model-answer-file" />
                      {modelAnswerFile ? (
                        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50/60 p-3">
                          <FileText className="w-5 h-5 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-800 truncate">{modelAnswerFile.name}</p>
                            <p className="text-[11px] text-green-600">{(modelAnswerFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button type="button" onClick={() => setModelAnswerFile(null)} className="p-1 rounded-lg text-green-600 hover:bg-green-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => modelInputRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-5 text-sm text-muted-foreground hover:border-violet-300 hover:text-violet-600 transition-all"
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
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="rounded-xl px-6 h-11 gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={handleStep2Next}
                  className="rounded-xl px-6 h-11 font-semibold text-white shadow-md shadow-blue-600/20 hover:shadow-lg gap-2"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
                >
                  Next: Review
                  <ArrowRight className="w-4 h-4" />
                </Button>
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
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-gradient-to-r from-blue-50/80 to-indigo-50/80 px-6 py-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-foreground">{formData.job_title || 'Untitled Position'}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
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

                <div className="divide-y divide-border">
                  {/* Description */}
                  <div className="px-6 py-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Job Description</h3>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {formData.summary || 'No description provided.'}
                    </p>
                  </div>

                  {/* Details grid */}
                  <div className="px-6 py-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <Building2 className="w-3.5 h-3.5" /> Position Type
                        </div>
                        <p className="text-sm font-medium text-foreground">{positionType ? formatLabel(positionType) : '--'}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3.5 h-3.5" /> Experience
                        </div>
                        <p className="text-sm font-medium text-foreground">{experienceRange || (formData.experience_requirements.min_years ? `${formData.experience_requirements.min_years}+ years` : '--')}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <DollarSign className="w-3.5 h-3.5" /> Salary
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {salaryMin && salaryMax
                            ? `${salaryCurrency} ${Number(salaryMin).toLocaleString()} - ${Number(salaryMax).toLocaleString()}`
                            : salaryMin
                            ? `${salaryCurrency} ${Number(salaryMin).toLocaleString()}+`
                            : '--'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <BadgeCheck className="w-3.5 h-3.5" /> Vacancies
                        </div>
                        <p className="text-sm font-medium text-foreground">{totalVacancies}</p>
                      </div>
                    </div>
                    {hiringCloseDate && (
                      <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Hiring closes: <span className="font-medium text-foreground">{new Date(hiringCloseDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  {(formData.educational_requirements.degree || formData.educational_requirements.field) && (
                    <div className="px-6 py-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Education</h3>
                      <p className="text-sm text-foreground">
                        {[formData.educational_requirements.degree, formData.educational_requirements.field].filter(Boolean).join(' in ')}
                      </p>
                    </div>
                  )}

                  {/* Locations */}
                  {locationVacancies.filter(lv => lv.country && lv.city).length > 0 && (
                    <div className="px-6 py-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Locations</h3>
                      <div className="flex flex-wrap gap-2">
                        {locationVacancies.filter(lv => lv.country && lv.city).map((lv, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            {lv.city}, {lv.country}
                            <span className="ml-1 text-xs text-muted-foreground">({lv.vacancies} {lv.vacancies === 1 ? 'vacancy' : 'vacancies'})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {(formData.core_skills.length > 0 || formData.preferred_skills.length > 0 || formData.soft_skills.length > 0 || formData.certifications.length > 0 || formData.role_keywords.length > 0) && (
                    <div className="px-6 py-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skills & Keywords</h3>
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
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
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
                    <div className="px-6 py-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attached Files</h3>
                      <div className="flex flex-wrap gap-3">
                        {jdFile && (
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                            <FileUp className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">{jdFile.name}</span>
                            <span className="text-xs text-muted-foreground">JD</span>
                          </div>
                        )}
                        {rubricFile && (
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                            <FileText className="w-4 h-4 text-amber-600" />
                            <span className="font-medium">{rubricFile.name}</span>
                            <span className="text-xs text-muted-foreground">Rubric</span>
                          </div>
                        )}
                        {modelAnswerFile && (
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                            <FileText className="w-4 h-4 text-violet-600" />
                            <span className="font-medium">{modelAnswerFile.name}</span>
                            <span className="text-xs text-muted-foreground">Model Answer</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Salary visibility & rejection lock */}
                  {(salaryVisibility || rejectionLockDays) && (
                    <div className="px-6 py-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</h3>
                      <div className="flex flex-wrap gap-4 text-sm">
                        {salaryVisibility && (
                          <span className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            Salary visibility: <span className="font-medium">{formatLabel(salaryVisibility)}</span>
                          </span>
                        )}
                        {rejectionLockDays && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            Rejection lock: <span className="font-medium">{rejectionLockDays} days</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="rounded-xl px-6 h-11 gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleFinalSubmit()}
                    disabled={isLoading}
                    className="rounded-xl px-6 h-11 font-semibold"
                  >
                    Save as Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleFinalSubmit()}
                    disabled={isLoading}
                    className="rounded-xl px-8 h-11 font-semibold text-white shadow-md shadow-blue-600/20 hover:shadow-lg disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Creating Job...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Publish Job</span>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── JD Template Picker Dialog ─────────────────── */}
      <Dialog open={jdTemplateOpen} onOpenChange={setJdTemplateOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" />
              Select a JD Template
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-2">
            {jdTemplatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : jdTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No JD templates found.</p>
            ) : (
              jdTemplates.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/60 transition-colors"
                  onClick={() => applyJdTemplate(tpl)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                    {tpl.category && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {tpl.category}
                      </span>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.description}</p>
                  )}
                  {(tpl.skills && tpl.skills.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.skills.slice(0, 5).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {s}
                        </span>
                      ))}
                      {tpl.skills.length > 5 && (
                        <span className="text-[10px] text-muted-foreground">+{tpl.skills.length - 5} more</span>
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
