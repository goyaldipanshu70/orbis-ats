import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">Resume parsed successfully</p>
            <p className="text-xs text-green-600">Review and edit the extracted fields below, then confirm.</p>
          </div>
        </div>
      )}

      <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
        {/* 1. Personal Information */}
        <AccordionItem value="personal">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-blue-600" /> Personal Information</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            <div>
              <Label className="text-xs font-medium">Full Name *</Label>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="John Doe" className="mt-1 h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 234 567 890" className="mt-1 h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium flex items-center gap-1"><Briefcase className="w-3 h-3" /> Current Role</Label>
                <Input value={form.current_role} onChange={e => set('current_role', e.target.value)} placeholder="Software Engineer" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium flex items-center gap-1"><Tag className="w-3 h-3" /> Category</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Location</Label>
                <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="San Francisco, CA" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium">Years of Experience</Label>
                <Input value={form.years_of_experience} onChange={e => set('years_of_experience', e.target.value)} placeholder="5" className="mt-1 h-8 text-sm" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Summary */}
        <AccordionItem value="summary">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-purple-600" /> Summary & Objective</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            <div>
              <Label className="text-xs font-medium">Professional Summary</Label>
              <Textarea value={form.summary} onChange={e => set('summary', e.target.value)} rows={3} placeholder="Brief professional summary..." className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium">Career Objective</Label>
              <Textarea value={form.objective} onChange={e => set('objective', e.target.value)} rows={2} placeholder="Career objective..." className="mt-1 text-sm" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Education */}
        <AccordionItem value="education">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-amber-600" /> Education
              {form.education.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{form.education.length}</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.education.map((edu, i) => (
              <div key={i} className="relative border rounded-lg p-3 bg-muted/20 space-y-2">
                <button
                  onClick={() => set('education', form.education.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Degree</Label>
                    <Input value={edu.degree || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, degree: e.target.value };
                      set('education', updated);
                    }} placeholder="B.Tech" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Field of Study</Label>
                    <Input value={edu.field_of_study || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, field_of_study: e.target.value };
                      set('education', updated);
                    }} placeholder="Computer Science" className="h-7 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Institution</Label>
                    <Input value={edu.institution || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, institution: e.target.value };
                      set('education', updated);
                    }} placeholder="MIT" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Year</Label>
                    <Input value={edu.graduation_year ?? ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, graduation_year: e.target.value ? parseInt(e.target.value) : null };
                      set('education', updated);
                    }} placeholder="2020" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">GPA</Label>
                    <Input value={edu.gpa || ''} onChange={e => {
                      const updated = [...form.education];
                      updated[i] = { ...edu, gpa: e.target.value };
                      set('education', updated);
                    }} placeholder="3.8/4.0" className="h-7 text-xs" />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => set('education', [...form.education, { degree: '', field_of_study: '', institution: '', graduation_year: null, gpa: '', honors: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Education
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Work Experience */}
        <AccordionItem value="experience">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-600" /> Work Experience
              {form.work_experience.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{form.work_experience.length}</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.work_experience.map((exp, i) => (
              <div key={i} className="relative border rounded-lg p-3 bg-muted/20 space-y-2">
                <button
                  onClick={() => set('work_experience', form.work_experience.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Role</Label>
                    <Input value={exp.role || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, role: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Software Engineer" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Company</Label>
                    <Input value={exp.company || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, company: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Google" className="h-7 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Start Date</Label>
                    <Input value={exp.start_date || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, start_date: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Jan 2020" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">End Date</Label>
                    <Input value={exp.end_date || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, end_date: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Present" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Location</Label>
                    <Input value={exp.location || ''} onChange={e => {
                      const updated = [...form.work_experience];
                      updated[i] = { ...exp, location: e.target.value };
                      set('work_experience', updated);
                    }} placeholder="Mountain View, CA" className="h-7 text-xs" />
                  </div>
                </div>
                {/* Responsibilities */}
                <div>
                  <Label className="text-[10px]">Responsibilities</Label>
                  <div className="space-y-1 mt-1">
                    {(exp.responsibilities || []).map((resp, ri) => (
                      <div key={ri} className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">-</span>
                        <Input
                          value={resp}
                          onChange={e => {
                            const updated = [...form.work_experience];
                            const resps = [...(updated[i].responsibilities || [])];
                            resps[ri] = e.target.value;
                            updated[i] = { ...exp, responsibilities: resps };
                            set('work_experience', updated);
                          }}
                          className="h-6 text-[11px] flex-1"
                        />
                        <button
                          onClick={() => {
                            const updated = [...form.work_experience];
                            updated[i] = { ...exp, responsibilities: (exp.responsibilities || []).filter((_, j) => j !== ri) };
                            set('work_experience', updated);
                          }}
                          className="text-muted-foreground hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        const updated = [...form.work_experience];
                        updated[i] = { ...exp, responsibilities: [...(exp.responsibilities || []), ''] };
                        set('work_experience', updated);
                      }}
                    >
                      <Plus className="h-2.5 w-2.5 mr-0.5" /> Add point
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => set('work_experience', [...form.work_experience, { company: '', role: '', start_date: '', end_date: '', location: '', responsibilities: [] }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Experience
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Projects */}
        <AccordionItem value="projects">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-orange-600" /> Projects
              {form.projects.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{form.projects.length}</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.projects.map((proj, i) => (
              <div key={i} className="relative border rounded-lg p-3 bg-muted/20 space-y-2">
                <button
                  onClick={() => set('projects', form.projects.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Title</Label>
                    <Input value={proj.title || ''} onChange={e => {
                      const updated = [...form.projects];
                      updated[i] = { ...proj, title: e.target.value };
                      set('projects', updated);
                    }} placeholder="Project name" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">URL</Label>
                    <Input value={proj.url || ''} onChange={e => {
                      const updated = [...form.projects];
                      updated[i] = { ...proj, url: e.target.value };
                      set('projects', updated);
                    }} placeholder="https://..." className="h-7 text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Description</Label>
                  <Textarea value={proj.description || ''} onChange={e => {
                    const updated = [...form.projects];
                    updated[i] = { ...proj, description: e.target.value };
                    set('projects', updated);
                  }} rows={2} placeholder="Brief description..." className="text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Tech Stack</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(proj.tech_stack || []).map((t, ti) => (
                      <Badge key={ti} variant="secondary" className="text-[10px] gap-1">
                        {t}
                        <button onClick={() => {
                          const updated = [...form.projects];
                          updated[i] = { ...proj, tech_stack: (proj.tech_stack || []).filter((_, j) => j !== ti) };
                          set('projects', updated);
                        }}>
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      placeholder="Add tech..."
                      className="h-6 w-24 text-[10px]"
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
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => set('projects', [...form.projects, { title: '', description: '', tech_stack: [], url: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Project
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 6. Skills */}
        <AccordionItem value="skills">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-cyan-600" /> Skills
              {form.skills.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{form.skills.length}</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.skills.map(s => (
                <Badge key={s} variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                  {s}
                  <button onClick={() => removeSkill(s)} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Type a skill and press Enter..."
              className="h-8 text-sm"
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
        <AccordionItem value="certifications">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Award className="h-4 w-4 text-rose-600" /> Certifications
              {form.certifications.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{form.certifications.length}</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-1">
            {form.certifications.map((cert, i) => (
              <div key={i} className="relative border rounded-lg p-3 bg-muted/20 space-y-2">
                <button
                  onClick={() => set('certifications', form.certifications.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Name</Label>
                    <Input value={cert.name || ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, name: e.target.value };
                      set('certifications', updated);
                    }} placeholder="AWS Solutions Architect" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Issuer</Label>
                    <Input value={cert.issuer || ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, issuer: e.target.value };
                      set('certifications', updated);
                    }} placeholder="Amazon" className="h-7 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Year</Label>
                    <Input value={cert.year ?? ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, year: e.target.value ? parseInt(e.target.value) : null };
                      set('certifications', updated);
                    }} placeholder="2023" className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Credential ID</Label>
                    <Input value={cert.credential_id || ''} onChange={e => {
                      const updated = [...form.certifications];
                      updated[i] = { ...cert, credential_id: e.target.value };
                      set('certifications', updated);
                    }} placeholder="ABC123" className="h-7 text-xs" />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => set('certifications', [...form.certifications, { name: '', issuer: '', year: null, expiry_year: null, credential_id: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Certification
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 8. Languages */}
        <AccordionItem value="languages">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-teal-600" /> Languages
              {form.languages.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{form.languages.length}</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 px-1">
            {form.languages.map((lang, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={lang.language}
                  onChange={e => {
                    const updated = [...form.languages];
                    updated[i] = { ...lang, language: e.target.value };
                    set('languages', updated);
                  }}
                  placeholder="Language"
                  className="h-7 text-xs flex-1"
                />
                <Input
                  value={lang.proficiency || ''}
                  onChange={e => {
                    const updated = [...form.languages];
                    updated[i] = { ...lang, proficiency: e.target.value };
                    set('languages', updated);
                  }}
                  placeholder="Proficiency"
                  className="h-7 text-xs flex-1"
                />
                <button
                  onClick={() => set('languages', form.languages.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => set('languages', [...form.languages, { language: '', proficiency: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Language
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 9. Links & Social Profiles */}
        <AccordionItem value="links">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-indigo-600" /> Links & Social Profiles</span>
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
                <link.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Label className="text-[10px] w-24 shrink-0">{link.label}</Label>
                <Input
                  value={(form.links[link.key] as string) || ''}
                  onChange={e => setLink(link.key, e.target.value)}
                  placeholder={link.placeholder}
                  className="h-7 text-xs flex-1"
                />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* 10. Notes */}
        <AccordionItem value="notes">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Notes</span>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Additional notes about this candidate..."
              className="text-sm"
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
