import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { apiClient } from '@/utils/api';
import {
  X, Briefcase, AlertTriangle, FileText, MapPin, Mail, Clock,
  ExternalLink, Loader2, Tag, Phone, Linkedin, Github, Globe, Download,
  Copy, Check, GraduationCap, Building2, FolderGit2, Award, Languages,
  Link2, Code2,
} from 'lucide-react';
import type { DeepResumeMetadata } from '@/utils/api';

interface CandidateDrawerProps {
  candidateId: string | null;
  open: boolean;
  onClose: () => void;
}

const recColors: Record<string, string> = {
  'Interview Immediately': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  'Interview': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  'Consider': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  'Do Not Recommend': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  inactive: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  blacklisted: 'bg-muted text-foreground border-border',
};

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  HR: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  Finance: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Marketing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Sales: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  IT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Product: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Design: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  Other: 'bg-muted text-foreground',
};

function extractScore(raw: any): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'object' && raw !== null) return raw.obtained_score ?? 0;
  return 0;
}

function hasValue(v: any): boolean {
  return v && v !== 'N/A' && v !== '';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function CandidateDrawer({ candidateId, open, onClose }: CandidateDrawerProps) {
  const [candidate, setCandidate] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!candidateId || !open) return;
    setLoading(true);
    setCandidate(null);
    setHistory([]);
    Promise.all([
      apiClient.getTalentPoolCandidate(candidateId),
      apiClient.getTalentPoolHistory(candidateId),
    ])
      .then(([c, h]) => {
        setCandidate(c);
        setHistory(Array.isArray(h) ? h : []);
      })
      .catch(() => {
        setCandidate(null);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [candidateId, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const ai = candidate?.ai_resume_analysis || {};
  const meta = ai.metadata || {};
  // Profile-level fields take priority, fall back to AI metadata
  const displayName = candidate?.full_name || meta.full_name || '?';
  const displayEmail = candidate?.email || meta.email;
  const displayPhone = candidate?.phone || meta.phone;
  const candidateStatus = candidate?.status || 'active';
  const candidateCategory = candidate?.category || '';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const parsedLinks = candidate?.parsed_metadata?.links || {};
  const linkedinUrl = meta.linkedin_url || parsedLinks.linkedin_url || candidate?.linkedin_url;
  const githubUrl = meta.github_url || parsedLinks.github_url || candidate?.github_url;
  const portfolioUrl = meta.portfolio_url || parsedLinks.portfolio_url || candidate?.portfolio_url;
  const personalSite = parsedLinks.personal_website;

  const contactItems = [
    { icon: Mail, value: displayEmail, href: displayEmail ? `mailto:${displayEmail}` : undefined, label: 'Email' },
    { icon: Phone, value: displayPhone, href: displayPhone ? `tel:${displayPhone.replace(/\s/g, '')}` : undefined, label: 'Phone' },
    { icon: Linkedin, value: linkedinUrl, href: linkedinUrl, label: 'LinkedIn' },
    { icon: Github, value: githubUrl, href: githubUrl, label: 'GitHub' },
    { icon: Globe, value: portfolioUrl || personalSite, href: portfolioUrl || personalSite, label: portfolioUrl ? 'Portfolio' : 'Website' },
  ].filter(item => hasValue(item.value));

  const resumeUrl = candidate?.resume_url;
  const isPdf = resumeUrl && resumeUrl.toLowerCase().includes('.pdf');

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-background shadow-2xl border-l flex flex-col"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-bold shadow-md">
                  {loading ? '...' : initials}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {loading ? 'Loading...' : displayName !== '?' ? displayName : 'Candidate'}
                  </h2>
                  {!loading && candidate && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {hasValue(meta.current_role) && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" /> {meta.current_role}
                        </span>
                      )}
                      {hasValue(meta.location) && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {meta.location}
                        </span>
                      )}
                      {(meta.years_of_experience || 0) > 0 && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> {meta.years_of_experience} yrs exp
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="View Scorecard"
                  onClick={() => { onClose(); window.location.href = `/scorecard/${candidateId}`; }}
                >
                  <Award className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Skills Gap Analysis"
                  onClick={() => { onClose(); window.location.href = `/scorecard/${candidateId}`; }}
                >
                  <Code2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Status + Category badges */}
            {!loading && candidate && (
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className={`capitalize text-xs ${statusColors[candidateStatus] || ''}`}>
                  {candidateStatus}
                </Badge>
                {candidateCategory && (
                  <Badge className={`text-xs ${CATEGORY_COLORS[candidateCategory] || CATEGORY_COLORS.Other}`}>
                    <Tag className="h-3 w-3 mr-1" />{candidateCategory}
                  </Badge>
                )}
                {candidate.source && candidate.source !== 'manual' && (
                  <Badge variant="secondary" className="text-[10px]">
                    Source: {candidate.source}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Body */}
          {!loading && candidate && (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="px-6 py-5 space-y-6">

              {/* Contact & Links */}
              {contactItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact & Links</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {contactItems.map(item => (
                      <div key={item.label} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
                        <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                          {item.href ? (
                            <a
                              href={item.href}
                              target={item.label !== 'Email' && item.label !== 'Phone' ? '_blank' : undefined}
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 hover:underline truncate block"
                            >
                              {item.label === 'LinkedIn' || item.label === 'GitHub' || item.label === 'Portfolio'
                                ? item.value.replace(/^https?:\/\/(www\.)?/, '')
                                : item.value}
                            </a>
                          ) : (
                            <p className="text-sm font-medium truncate">{item.value}</p>
                          )}
                        </div>
                        <CopyButton text={item.value} />
                        {item.href && (item.label === 'LinkedIn' || item.label === 'GitHub' || item.label === 'Portfolio') && (
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume */}
              {resumeUrl && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resume</h3>
                  <div className="rounded-lg border overflow-hidden">
                    {isPdf && (
                      <div className="bg-muted/30 border-b">
                        <iframe
                          src={resumeUrl}
                          className="w-full h-[400px]"
                          title="Resume preview"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-3 bg-muted/20">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground flex-1 truncate">
                        {resumeUrl.split('/').pop() || 'Resume'}
                      </span>
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> View
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <a href={resumeUrl} download>
                          <Download className="h-3 w-3 mr-1" /> Download
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Skills */}
              {(ai.highlighted_skills?.length > 0 || ai.key_skills?.length > 0) && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {(ai.highlighted_skills || []).map((s: string) => (
                      <Badge key={`hl-${s}`} className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800">
                        {s}
                      </Badge>
                    ))}
                    {(ai.key_skills || [])
                      .filter((s: string) => !(ai.highlighted_skills || []).includes(s))
                      .slice(0, 15)
                      .map((s: string) => (
                        <Badge key={`sk-${s}`} variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full">
                          {s}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {/* Deep Metadata Sections */}
              {(() => {
                const pm: DeepResumeMetadata | undefined = candidate?.parsed_metadata;
                if (!pm) return null;
                const hasSummary = pm.summary || pm.objective;
                const hasEducation = pm.education && pm.education.length > 0;
                const hasExperience = pm.work_experience && pm.work_experience.length > 0;
                const hasProjects = pm.projects && pm.projects.length > 0;
                const hasCerts = pm.certifications && pm.certifications.length > 0;
                const hasLangs = pm.languages && pm.languages.length > 0;
                const deepLinks = pm.links || {};
                const hasDeepLinks = deepLinks.leetcode_url || deepLinks.hackerrank_url || deepLinks.stackoverflow_url || deepLinks.twitter_url || deepLinks.personal_website || (deepLinks.other_urls && deepLinks.other_urls.length > 0);
                if (!hasSummary && !hasEducation && !hasExperience && !hasProjects && !hasCerts && !hasLangs && !hasDeepLinks) return null;

                const defaultOpen: string[] = [];
                if (hasSummary) defaultOpen.push('dm-summary');
                if (hasExperience) defaultOpen.push('dm-experience');
                if (hasEducation) defaultOpen.push('dm-education');

                return (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detailed Profile</h3>
                    <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
                      {hasSummary && (
                        <AccordionItem value="dm-summary">
                          <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2">
                            <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-purple-600" /> Summary</span>
                          </AccordionTrigger>
                          <AccordionContent>
                            {pm.summary && <p className="text-sm text-foreground mb-2">{pm.summary}</p>}
                            {pm.objective && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Objective</p>
                                <p className="text-sm text-foreground">{pm.objective}</p>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {hasEducation && (
                        <AccordionItem value="dm-education">
                          <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2">
                            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-amber-600" /> Education ({pm.education!.length})</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2">
                            {pm.education!.map((edu, i) => (
                              <div key={i} className="border rounded-lg p-2.5 bg-muted/20">
                                <p className="text-sm font-medium">
                                  {[edu.degree, edu.field_of_study].filter(Boolean).join(' in ') || 'Degree'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {[edu.institution, edu.graduation_year].filter(Boolean).join(' - ')}
                                </p>
                                {edu.gpa && <p className="text-xs text-muted-foreground">GPA: {edu.gpa}</p>}
                                {edu.honors && <p className="text-xs text-muted-foreground">{edu.honors}</p>}
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {hasExperience && (
                        <AccordionItem value="dm-experience">
                          <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2">
                            <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-green-600" /> Work Experience ({pm.work_experience!.length})</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2">
                            {pm.work_experience!.map((exp, i) => (
                              <div key={i} className="border rounded-lg p-2.5 bg-muted/20">
                                <p className="text-sm font-medium">{exp.role || 'Role'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[exp.company, [exp.start_date, exp.end_date].filter(Boolean).join(' - ')].filter(Boolean).join(' | ')}
                                </p>
                                {exp.location && <p className="text-[10px] text-muted-foreground">{exp.location}</p>}
                                {exp.responsibilities && exp.responsibilities.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {exp.responsibilities.map((r, ri) => (
                                      <li key={ri} className="text-xs text-muted-foreground flex gap-1.5">
                                        <span className="text-muted-foreground/50 shrink-0">-</span>
                                        <span>{r}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {hasProjects && (
                        <AccordionItem value="dm-projects">
                          <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2">
                            <span className="flex items-center gap-1.5"><FolderGit2 className="h-3.5 w-3.5 text-orange-600" /> Projects ({pm.projects!.length})</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2">
                            {pm.projects!.map((proj, i) => (
                              <div key={i} className="border rounded-lg p-2.5 bg-muted/20">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{proj.title || 'Project'}</p>
                                  {proj.url && (
                                    <a href={proj.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                                {proj.description && <p className="text-xs text-muted-foreground mt-0.5">{proj.description}</p>}
                                {proj.tech_stack && proj.tech_stack.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {proj.tech_stack.map((t, ti) => (
                                      <Badge key={ti} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {hasCerts && (
                        <AccordionItem value="dm-certs">
                          <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2">
                            <span className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-rose-600" /> Certifications ({pm.certifications!.length})</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-1.5">
                            {pm.certifications!.map((cert, i) => (
                              <div key={i} className="flex items-center gap-2 border rounded-lg p-2 bg-muted/20">
                                <Award className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{cert.name || 'Certification'}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {[cert.issuer, cert.year].filter(Boolean).join(' - ')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {hasLangs && (
                        <AccordionItem value="dm-langs">
                          <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2">
                            <span className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 text-teal-600" /> Languages ({pm.languages!.length})</span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2">
                              {pm.languages!.map((lang, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {lang.language}{lang.proficiency ? ` (${lang.proficiency})` : ''}
                                </Badge>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {hasDeepLinks && (
                        <AccordionItem value="dm-links">
                          <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2">
                            <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-indigo-600" /> Additional Links</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-1.5">
                            {([
                              { label: 'LeetCode', url: deepLinks.leetcode_url, icon: Code2 },
                              { label: 'HackerRank', url: deepLinks.hackerrank_url, icon: Code2 },
                              { label: 'Stack Overflow', url: deepLinks.stackoverflow_url, icon: Code2 },
                              { label: 'Twitter/X', url: deepLinks.twitter_url, icon: Globe },
                              { label: 'Personal Website', url: deepLinks.personal_website, icon: Globe },
                            ] as const).filter(l => l.url).map(l => (
                              <div key={l.label} className="flex items-center gap-2 border rounded-lg px-2.5 py-1.5 bg-muted/20">
                                <l.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground w-24 shrink-0">{l.label}</span>
                                <a href={l.url!} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate flex-1">
                                  {l.url!.replace(/^https?:\/\/(www\.)?/, '')}
                                </a>
                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              </div>
                            ))}
                            {deepLinks.other_urls && deepLinks.other_urls.length > 0 && deepLinks.other_urls.map((u, i) => (
                              <div key={i} className="flex items-center gap-2 border rounded-lg px-2.5 py-1.5 bg-muted/20">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                <a href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate flex-1">
                                  {u.replace(/^https?:\/\/(www\.)?/, '')}
                                </a>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  </div>
                );
              })()}

              {/* Job History — per-job scores for context */}
              {history.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" /> Evaluation History ({history.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-2">Scores are specific to each job evaluation</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Job</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Stage</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Score</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Recommendation</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h, i) => {
                          const hScore = extractScore(h.total_score);
                          return (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-3 text-xs">
                                <span className="font-medium">{h.job_title || `#${h.jd_id}`}</span>
                              </td>
                              <td className="p-3">
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {h.pipeline_stage || 'applied'}
                                </Badge>
                              </td>
                              <td className="p-3 font-medium tabular-nums">{Math.round(hScore)}</td>
                              <td className="p-3">
                                {h.recommendation ? (
                                  <Badge variant="outline" className={`text-[10px] ${recColors[h.recommendation] || ''}`}>
                                    {h.recommendation}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Pending</span>
                                )}
                              </td>
                              <td className="p-3 text-muted-foreground text-xs">
                                {h.created_at ? new Date(h.created_at).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Added date */}
              {candidate.created_at && (
                <p className="text-[11px] text-muted-foreground text-center pt-2">
                  Added to talent pool on {new Date(candidate.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}

              <div className="h-4" />
            </motion.div>
          )}

          {/* Empty/error state */}
          {!loading && !candidate && candidateId && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-3" />
              <p className="text-sm">Could not load candidate details</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
