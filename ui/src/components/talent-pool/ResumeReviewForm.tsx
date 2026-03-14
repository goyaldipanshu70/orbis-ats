import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  User, Mail, Phone, Briefcase, Tag, GraduationCap, Building2,
  FolderGit2, Award, Languages, Link2, Plus, X, Linkedin, Github,
  Globe, Code2, FileText,
} from 'lucide-react';
import type {
  DeepResumeMetadata, EducationEntry, WorkExperienceEntry,
  ProjectEntry, CertificationEntry, LanguageEntry, SocialLinks,
} from '@/utils/api';

const CATEGORIES = [
  'Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'IT', 'Product', 'Design', 'Other',
];

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
const selectDrop: React.CSSProperties = {
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

export interface AddFormState {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  current_role: string;
  years_of_experience: string;
  category: string;
  summary: string;
  objective: string;
  notes: string;
  skills: string[];
  education: EducationEntry[];
  work_experience: WorkExperienceEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  languages: LanguageEntry[];
  links: SocialLinks;
}

export function emptyAddForm(): AddFormState {
  return {
    full_name: '', email: '', phone: '', location: '', current_role: '',
    years_of_experience: '', category: '', summary: '', objective: '', notes: '',
    skills: [],
    education: [],
    work_experience: [],
    projects: [],
    certifications: [],
    languages: [],
    links: {
      linkedin_url: '', github_url: '', leetcode_url: '', hackerrank_url: '',
      stackoverflow_url: '', twitter_url: '', personal_website: '', portfolio_url: '',
      other_urls: [],
    },
  };
}

export function metadataToForm(meta: DeepResumeMetadata): AddFormState {
  const links = meta.links || {};
  return {
    full_name: meta.full_name || '',
    email: meta.email || '',
    phone: meta.phone || '',
    location: meta.location || '',
    current_role: meta.current_role || '',
    years_of_experience: meta.years_of_experience != null ? String(meta.years_of_experience) : '',
    category: '',
    summary: meta.summary || '',
    objective: meta.objective || '',
    notes: '',
    skills: meta.skills || [],
    education: meta.education || [],
    work_experience: meta.work_experience || [],
    projects: meta.projects || [],
    certifications: meta.certifications || [],
    languages: meta.languages || [],
    links: {
      linkedin_url: links.linkedin_url || meta.linkedin_url || '',
      github_url: links.github_url || meta.github_url || '',
      leetcode_url: links.leetcode_url || '',
      hackerrank_url: links.hackerrank_url || '',
      stackoverflow_url: links.stackoverflow_url || '',
      twitter_url: links.twitter_url || '',
      personal_website: links.personal_website || '',
      portfolio_url: links.portfolio_url || meta.portfolio_url || '',
      other_urls: links.other_urls || [],
    },
  };
}

export function formToMetadata(form: AddFormState): DeepResumeMetadata {
  return {
    full_name: form.full_name,
    email: form.email || null,
    phone: form.phone || null,
    location: form.location || null,
    current_role: form.current_role || null,
    years_of_experience: form.years_of_experience ? parseFloat(form.years_of_experience) : null,
    summary: form.summary || null,
    objective: form.objective || null,
    linkedin_url: form.links.linkedin_url || null,
    github_url: form.links.github_url || null,
    portfolio_url: form.links.portfolio_url || null,
    skills: form.skills,
    education: form.education,
    work_experience: form.work_experience,
    projects: form.projects,
    certifications: form.certifications,
    languages: form.languages,
    links: form.links,
  };
}

interface ResumeReviewFormProps {
  form: AddFormState;
  onChange: (form: AddFormState) => void;
  showSuccess?: boolean;
}

export default function ResumeReviewForm({ form, onChange, showSuccess }: ResumeReviewFormProps) {
  const set = (key: keyof AddFormState, value: any) =>
    onChange({ ...form, [key]: value });
  const setLink = (key: keyof SocialLinks, value: string) =>
    onChange({ ...form, links: { ...form.links, [key]: value } });

  // Skill management
  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !form.skills.includes(trimmed)) {
      set('skills', [...form.skills, trimmed]);
    }
  };
  const removeSkill = (skill: string) =>
    set('skills', form.skills.filter(s => s !== skill));

  // Default open sections
  const defaultOpen = ['personal'];
  if (form.summary || form.objective) defaultOpen.push('summary');
  if (form.education.length) defaultOpen.push('education');
  if (form.work_experience.length) defaultOpen.push('experience');
  if (form.skills.length) defaultOpen.push('skills');
  if (form.links.linkedin_url || form.links.github_url || form.links.portfolio_url || form.links.personal_website) defaultOpen.push('links');

  return (
    <div className="space-y-4">
      {showSuccess && (
        <div
          className="rounded-xl p-3 flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Resume parsed successfully</p>
            <p className="text-xs text-emerald-400/70">Review and edit the extracted fields below, then confirm.</p>
          </div>
        </div>
      )}

      <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
        {/* 1. Personal Information */}
        <AccordionItem value="personal" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-blue-400" /> Personal Information</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            <div>
              <label className="text-xs font-medium text-slate-300">Full Name *</label>
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="John Doe" onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 h-8 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500" style={glassInput} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium flex items-center gap-1 text-slate-300"><Mail className="w-3 h-3" /> Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 h-8 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500" style={glassInput} />
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1 text-slate-300"><Phone className="w-3 h-3" /> Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 234 567 890" onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 h-8 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500" style={glassInput} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium flex items-center gap-1 text-slate-300"><Briefcase className="w-3 h-3" /> Current Role</label>
                <input value={form.current_role} onChange={e => set('current_role', e.target.value)} placeholder="Software Engineer" onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 h-8 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500" style={glassInput} />
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1 text-slate-300"><Tag className="w-3 h-3" /> Category</label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-slate-200 focus:bg-white/10 focus:text-white">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="San Francisco, CA" onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 h-8 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500" style={glassInput} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Years of Experience</label>
                <input value={form.years_of_experience} onChange={e => set('years_of_experience', e.target.value)} placeholder="5" onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 h-8 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500" style={glassInput} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Summary */}
        <AccordionItem value="summary" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" /> Summary & Objective</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            <div>
              <label className="text-xs font-medium text-slate-300">Professional Summary</label>
              <textarea value={form.summary} onChange={e => set('summary', e.target.value)} rows={3} placeholder="Brief professional summary..." onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none transition-all resize-y placeholder:text-slate-500" style={glassInput} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300">Career Objective</label>
              <textarea value={form.objective} onChange={e => set('objective', e.target.value)} rows={2} placeholder="Career objective..." onFocus={handleFocus} onBlur={handleBlur} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none transition-all resize-y placeholder:text-slate-500" style={glassInput} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Education */}
        <AccordionItem value="education" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-amber-400" /> Education
              {form.education.length > 0 && (
                <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {form.education.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.education.map((edu, i) => (
              <div key={i} className="relative rounded-2xl p-3 space-y-2" style={glassCard}>
                <button
                  onClick={() => set('education', form.education.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Degree</label>
                    <input value={edu.degree || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, degree: e.target.value };
                      set('education', updated);
                    }} placeholder="B.Tech" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Field of Study</label>
                    <input value={edu.field_of_study || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, field_of_study: e.target.value };
                      set('education', updated);
                    }} placeholder="Computer Science" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Institution</label>
                    <input value={edu.institution || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, institution: e.target.value };
                      set('education', updated);
                    }} placeholder="MIT" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Year</label>
                    <input value={edu.graduation_year ?? ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, graduation_year: e.target.value ? parseInt(e.target.value) : null };
                      set('education', updated);
                    }} placeholder="2020" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">GPA</label>
                    <input value={edu.gpa || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, gpa: e.target.value };
                      set('education', updated);
                    }} placeholder="3.8/4.0" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                </div>
              </div>
            ))}
            <button
              className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-lg text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={() => set('education', [...form.education, { degree: '', field_of_study: '', institution: '', graduation_year: null, gpa: '', honors: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Education
            </button>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Work Experience */}
        <AccordionItem value="experience" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-400" /> Work Experience
              {form.work_experience.length > 0 && (
                <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {form.work_experience.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.work_experience.map((exp, i) => (
              <div key={i} className="relative rounded-2xl p-3 space-y-2" style={glassCard}>
                <button
                  onClick={() => set('work_experience', form.work_experience.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Role</label>
                    <input value={exp.role || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, role: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Software Engineer" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Company</label>
                    <input value={exp.company || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, company: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Google" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Start Date</label>
                    <input value={exp.start_date || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, start_date: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Jan 2020" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">End Date</label>
                    <input value={exp.end_date || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, end_date: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Present" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Location</label>
                    <input value={exp.location || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, location: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Mountain View, CA" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                </div>
                {/* Responsibilities */}
                <div>
                  <label className="text-[10px] text-slate-400">Responsibilities</label>
                  <div className="space-y-1 mt-1">
                    {(exp.responsibilities || []).map((resp, ri) => (
                      <div key={ri} className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">-</span>
                        <input
                          value={resp}
                          onChange={e => {
                            const updated = [...form.work_experience];
                            const resps = [...(updated[i].responsibilities || [])];
                            resps[ri] = e.target.value;
                            updated[i] = { ...exp, responsibilities: resps };
                            set('work_experience', updated);
                          }}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          className="flex-1 h-6 px-2 rounded-lg text-[11px] outline-none transition-all placeholder:text-slate-500"
                          style={glassInput}
                        />
                        <button
                          onClick={() => {
                            const updated = [...form.work_experience];
                            updated[i] = { ...exp, responsibilities: (exp.responsibilities || []).filter((_, j) => j !== ri) };
                            set('work_experience', updated);
                          }}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      className="inline-flex items-center h-6 px-2 text-[10px] text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
                      onClick={() => {
                        const updated = [...form.work_experience];
                        updated[i] = { ...exp, responsibilities: [...(exp.responsibilities || []), ''] };
                        set('work_experience', updated);
                      }}
                    >
                      <Plus className="h-2.5 w-2.5 mr-0.5" /> Add point
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-lg text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={() => set('work_experience', [...form.work_experience, { company: '', role: '', start_date: '', end_date: '', location: '', responsibilities: [] }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Experience
            </button>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Projects */}
        <AccordionItem value="projects" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-orange-400" /> Projects
              {form.projects.length > 0 && (
                <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {form.projects.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.projects.map((proj, i) => (
              <div key={i} className="relative rounded-2xl p-3 space-y-2" style={glassCard}>
                <button
                  onClick={() => set('projects', form.projects.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Title</label>
                    <input value={proj.title || ''} onChange={e => {
                      const updated = [...form.projects];
                      updated[i] = { ...proj, title: e.target.value };
                      set('projects', updated);
                    }} placeholder="Project name" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">URL</label>
                    <input value={proj.url || ''} onChange={e => {
                      const updated = [...form.projects];
                      updated[i] = { ...proj, url: e.target.value };
                      set('projects', updated);
                    }} placeholder="https://..." onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Description</label>
                  <textarea value={proj.description || ''} onChange={e => {
                    const updated = [...form.projects];
                    updated[i] = { ...proj, description: e.target.value };
                    set('projects', updated);
                  }} rows={2} placeholder="Brief description..." onFocus={handleFocus} onBlur={handleBlur} className="w-full px-2 py-1.5 rounded-lg text-xs outline-none transition-all resize-y placeholder:text-slate-500" style={glassInput} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Tech Stack</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(proj.tech_stack || []).map((t, ti) => (
                      <span key={ti} className="inline-flex items-center text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {t}
                        <button onClick={() => {
                          const updated = [...form.projects];
                          updated[i] = { ...proj, tech_stack: (proj.tech_stack || []).filter((_, j) => j !== ti) };
                          set('projects', updated);
                        }} className="hover:text-red-400">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <input
                      placeholder="Add tech..."
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      className="h-6 w-24 px-2 rounded-lg text-[10px] outline-none transition-all placeholder:text-slate-500"
                      style={glassInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            const updated = [...form.projects];
                            updated[i] = { ...proj, tech_stack: [...(proj.tech_stack || []), val] };
                            set('projects', updated);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-lg text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={() => set('projects', [...form.projects, { title: '', description: '', tech_stack: [], url: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Project
            </button>
          </AccordionContent>
        </AccordionItem>

        {/* 6. Skills */}
        <AccordionItem value="skills" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-cyan-400" /> Skills
              {form.skills.length > 0 && (
                <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {form.skills.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.skills.map(s => (
                <span key={s} className="inline-flex items-center text-xs gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {s}
                  <button onClick={() => removeSkill(s)} className="hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              placeholder="Type a skill and press Enter..."
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="w-full h-8 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
              style={glassInput}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </AccordionContent>
        </AccordionItem>

        {/* 7. Certifications */}
        <AccordionItem value="certifications" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2">
              <Award className="h-4 w-4 text-rose-400" /> Certifications
              {form.certifications.length > 0 && (
                <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {form.certifications.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.certifications.map((cert, i) => (
              <div key={i} className="relative rounded-2xl p-3 space-y-2" style={glassCard}>
                <button
                  onClick={() => set('certifications', form.certifications.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Name</label>
                    <input value={cert.name || ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, name: e.target.value };
                      set('certifications', updated);
                    }} placeholder="AWS Solutions Architect" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Issuer</label>
                    <input value={cert.issuer || ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, issuer: e.target.value };
                      set('certifications', updated);
                    }} placeholder="Amazon" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Year</label>
                    <input value={cert.year ?? ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, year: e.target.value ? parseInt(e.target.value) : null };
                      set('certifications', updated);
                    }} placeholder="2023" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Credential ID</label>
                    <input value={cert.credential_id || ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, credential_id: e.target.value };
                      set('certifications', updated);
                    }} placeholder="ABC123" onFocus={handleFocus} onBlur={handleBlur} className="w-full h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500" style={glassInput} />
                  </div>
                </div>
              </div>
            ))}
            <button
              className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-lg text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={() => set('certifications', [...form.certifications, { name: '', issuer: '', year: null, expiry_year: null, credential_id: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Certification
            </button>
          </AccordionContent>
        </AccordionItem>

        {/* 8. Languages */}
        <AccordionItem value="languages" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-teal-400" /> Languages
              {form.languages.length > 0 && (
                <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {form.languages.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 px-1">
            {form.languages.map((lang, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={lang.language}
                  onChange={e => {
                    const updated = [...form.languages];
                    updated[i] = { ...lang, language: e.target.value };
                    set('languages', updated);
                  }}
                  placeholder="Language"
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="flex-1 h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                />
                <input
                  value={lang.proficiency || ''}
                  onChange={e => {
                    const updated = [...form.languages];
                    updated[i] = { ...lang, proficiency: e.target.value };
                    set('languages', updated);
                  }}
                  placeholder="Proficiency"
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="flex-1 h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                />
                <button
                  onClick={() => set('languages', form.languages.filter((_, j) => j !== i))}
                  className="text-slate-500 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-lg text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={() => set('languages', [...form.languages, { language: '', proficiency: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Language
            </button>
          </AccordionContent>
        </AccordionItem>

        {/* 9. Links & Social Profiles */}
        <AccordionItem value="links" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-blue-400" /> Links & Social Profiles</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 px-1">
            {([
              { key: 'linkedin_url' as const, label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/in/...' },
              { key: 'github_url' as const, label: 'GitHub', icon: Github, placeholder: 'github.com/...' },
              { key: 'leetcode_url' as const, label: 'LeetCode', icon: Code2, placeholder: 'leetcode.com/u/...' },
              { key: 'hackerrank_url' as const, label: 'HackerRank', icon: Code2, placeholder: 'hackerrank.com/...' },
              { key: 'stackoverflow_url' as const, label: 'Stack Overflow', icon: Code2, placeholder: 'stackoverflow.com/users/...' },
              { key: 'twitter_url' as const, label: 'Twitter/X', icon: Globe, placeholder: 'x.com/...' },
              { key: 'personal_website' as const, label: 'Personal Website', icon: Globe, placeholder: 'https://...' },
              { key: 'portfolio_url' as const, label: 'Portfolio', icon: Globe, placeholder: 'portfolio.dev/...' },
            ]).map(link => (
              <div key={link.key} className="flex items-center gap-2">
                <link.icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <label className="text-[10px] w-24 shrink-0 text-slate-400">{link.label}</label>
                <input
                  value={(form.links[link.key] as string) || ''}
                  onChange={e => setLink(link.key, e.target.value)}
                  placeholder={link.placeholder}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="flex-1 h-7 px-2 rounded-lg text-xs outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* 10. Notes */}
        <AccordionItem value="notes" className="border-white/10">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline text-white">
            <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /> Notes</span>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Additional notes about this candidate..."
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all resize-y placeholder:text-slate-500"
              style={glassInput}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
