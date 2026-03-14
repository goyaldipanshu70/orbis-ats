import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatLabel } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Users, FileText, Clock, Edit3, Briefcase, TrendingUp, Star, Calendar, Import, Kanban, CheckCircle, XCircle, Trash2, Plus, Link2, Sparkles, Mail, ShieldCheck, Loader2, Wand2, HelpCircle, Linkedin, Download, ExternalLink, Bot, MapPin, DollarSign, AlertTriangle, Globe, Receipt, ChevronRight, Eye, EyeOff, LayoutTemplate, ShieldAlert } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/components/layout/AppLayout';
import AddCandidateModal from '@/components/AddCandidateModal';
import ImportCandidatesModal from '@/components/ImportCandidatesModal';
import ApprovalBadge from '@/components/ApprovalBadge';
import AIInterviewModal from '@/components/pipeline/AIInterviewModal';
import AIInterviewResultsSheet from '@/components/pipeline/AIInterviewResultsSheet';
import RankCandidatesButton from '@/components/ai/RankCandidatesButton';
import type { Job, UploadedFile, JobStatistics, ScreeningQuestion, AIInterviewSession } from '@/types/api';
import { COUNTRIES, getCitiesForCountry, CURRENCIES, EXPERIENCE_RANGES } from '@/data/locations';
import { apiClient } from '@/utils/api';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};
const sItemCls = "text-slate-200 focus:bg-white/10 focus:text-white";

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

const JobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isHR } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showImportCandidates, setShowImportCandidates] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  const [members, setMembers] = useState<any[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');
  const [isApprovalProcessing, setIsApprovalProcessing] = useState(false);
  const [sharingToLinkedIn, setSharingToLinkedIn] = useState(false);

  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [portals, setPortals] = useState<any[]>([]);
  const [selectedPortalIds, setSelectedPortalIds] = useState<Set<number>>(new Set());
  const [isLoadingPortals, setIsLoadingPortals] = useState(false);
  const [attractivenessScore, setAttractivenessScore] = useState<any>(null);

  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([]);
  const [isScreeningLoading, setIsScreeningLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'yes_no' | 'multiple_choice'>('text');
  const [newRequired, setNewRequired] = useState(true);
  const [newIsKnockout, setNewIsKnockout] = useState(false);
  const [newKnockoutCondition, setNewKnockoutCondition] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [deleteQuestionId, setDeleteQuestionId] = useState<number | null>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [templateQuestions, setTemplateQuestions] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const [showEditJob, setShowEditJob] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (jobId) {
      loadJobDetails();
      loadMembers();
      loadScreeningQuestions();
      loadAttractiveness();
    }
  }, [jobId]);

  const loadAttractiveness = async () => {
    if (!jobId) return;
    try {
      const data = await apiClient.getJobAttractiveness(Number(jobId));
      setAttractivenessScore(data);
    } catch (error) {
      console.error('Error loading attractiveness score:', error);
    }
  };

  const loadJobDetails = async () => {
    setIsLoading(true);
    try {
      if (!jobId) { setJob(null); throw new Error("Job ID is not available."); }
      const jobData = await apiClient.getJobById(jobId);
      setJob(jobData);
    } catch (error) {
      console.error('Error loading job details:', error);
      setJob(null);
      toast({ title: 'Error Loading Job', description: (error as Error).message || 'Could not load job details.', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleImportCandidates = async (candidateIds: string[]) => {
    if (!jobId) return;
    try {
      await apiClient.importCandidates(jobId, candidateIds);
      toast({ title: 'Success', description: `Successfully imported ${candidateIds.length} candidate(s).` });
      loadJobDetails();
    } catch (error) {
      console.error('Error importing candidates:', error);
      toast({ title: 'Error', description: 'Failed to import candidates.', variant: 'destructive' });
      throw error;
    }
  };

  const loadMembers = async () => {
    if (!jobId) return;
    setIsMembersLoading(true);
    try { const data = await apiClient.getJobMembers(jobId); setMembers(data || []); }
    catch { setMembers([]); toast({ title: 'Error', description: 'Failed to load team members.', variant: 'destructive' }); }
    finally { setIsMembersLoading(false); }
  };

  const handleAddMember = async () => {
    if (!jobId || !newMemberUserId.trim()) return;
    const userId = parseInt(newMemberUserId);
    if (isNaN(userId) || userId <= 0) { toast({ title: 'Invalid ID', description: 'Please enter a valid user ID.', variant: 'destructive' }); return; }
    try { await apiClient.addJobMember(jobId, userId, newMemberRole); toast({ title: 'Success', description: 'Team member added.' }); setNewMemberUserId(''); setNewMemberRole('viewer'); loadMembers(); }
    catch { toast({ title: 'Error', description: 'Failed to add team member.', variant: 'destructive' }); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!jobId) return;
    try { await apiClient.removeJobMember(jobId, userId); toast({ title: 'Removed', description: 'Team member removed.' }); loadMembers(); }
    catch { toast({ title: 'Error', description: 'Failed to remove team member.', variant: 'destructive' }); }
  };

  const loadScreeningQuestions = async () => {
    if (!jobId) return;
    setIsScreeningLoading(true);
    try { const data = await apiClient.getScreeningQuestions(jobId); setScreeningQuestions(data || []); }
    catch { setScreeningQuestions([]); toast({ title: 'Error', description: 'Failed to load screening questions.', variant: 'destructive' }); }
    finally { setIsScreeningLoading(false); }
  };

  const handleAddScreeningQuestion = async () => {
    if (!jobId || !newQuestion.trim()) return;
    setIsSavingQuestion(true);
    try {
      await apiClient.createScreeningQuestion(jobId, {
        question: newQuestion.trim(), question_type: newQuestionType, required: newRequired,
        options: newQuestionType === 'multiple_choice' && newOptions.length > 0 ? newOptions : null,
        is_knockout: newIsKnockout, knockout_condition: newIsKnockout && newKnockoutCondition ? newKnockoutCondition : null,
      });
      toast({ title: 'Added', description: 'Screening question added.' });
      setNewQuestion(''); setNewQuestionType('text'); setNewRequired(true); setNewIsKnockout(false); setNewKnockoutCondition(''); setNewOptions([]); setNewOptionInput(''); setShowAddQuestion(false);
      loadScreeningQuestions();
    } catch { toast({ title: 'Error', description: 'Failed to add question.', variant: 'destructive' }); }
    finally { setIsSavingQuestion(false); }
  };

  const handleDeleteScreeningQuestion = async (questionId: number) => {
    if (!jobId) return;
    try { await apiClient.deleteScreeningQuestion(jobId, questionId); toast({ title: 'Deleted', description: 'Question removed.' }); loadScreeningQuestions(); }
    catch { toast({ title: 'Error', description: 'Failed to delete question.', variant: 'destructive' }); }
    finally { setDeleteQuestionId(null); }
  };

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try { const data = await apiClient.getScreeningTemplates(); setTemplateQuestions(data || []); }
    catch { toast({ title: 'Error', description: 'Failed to load templates.', variant: 'destructive' }); }
    finally { setIsLoadingTemplates(false); }
  };

  const handleAddFromTemplate = async (templateId: number) => {
    if (!jobId) return;
    try { await apiClient.addTemplateToJob(jobId, templateId); toast({ title: 'Added', description: 'Template question added.' }); loadScreeningQuestions(); }
    catch { toast({ title: 'Error', description: 'Failed to add template question.', variant: 'destructive' }); }
  };

  const handleGenerateQuestions = async () => {
    if (!jobId) return;
    setIsGenerating(true);
    try { await apiClient.generateScreeningQuestions(jobId); toast({ title: 'Generated', description: 'AI screening questions generated.' }); loadScreeningQuestions(); }
    catch { toast({ title: 'Error', description: 'Failed to generate questions.', variant: 'destructive' }); }
    finally { setIsGenerating(false); }
  };

  const handleApprove = async () => {
    if (!jobId) return; setIsApprovalProcessing(true);
    try { await apiClient.approveJob(jobId); toast({ title: 'Approved', description: 'Job has been approved.' }); loadJobDetails(); }
    catch { toast({ title: 'Error', description: 'Failed to approve job.', variant: 'destructive' }); }
    finally { setIsApprovalProcessing(false); }
  };

  const handleReject = async () => {
    if (!jobId) return; setIsApprovalProcessing(true);
    try { await apiClient.rejectJob(jobId); toast({ title: 'Rejected', description: 'Job has been rejected.' }); loadJobDetails(); }
    catch { toast({ title: 'Error', description: 'Failed to reject job.', variant: 'destructive' }); }
    finally { setIsApprovalProcessing(false); }
  };

  const handleShareLinkedIn = async () => {
    if (!jobId || !job) return; setSharingToLinkedIn(true);
    try { await apiClient.postJobToLinkedIn(Number(jobId), `We're hiring: ${job.job_title}!`); toast({ title: 'Shared!', description: 'Job posted to LinkedIn successfully' }); }
    catch (err: any) { toast({ title: 'LinkedIn Error', description: err.message || 'Failed to post to LinkedIn', variant: 'destructive' }); }
    finally { setSharingToLinkedIn(false); }
  };

  const openEditJob = () => {
    if (!job) return;
    setEditForm({
      job_title: job.job_title || '', summary: job.rubric_summary || '',
      core_skills: (job.key_requirements || []).join(', '), preferred_skills: '',
      country: job.country || '', city: job.city || '',
      number_of_vacancies: job.number_of_vacancies || 1,
      job_type: job.job_type || '', position_type: job.position_type || '',
      experience_range: job.experience_range || '',
      salary_range_min: job.salary_range_min || '', salary_range_max: job.salary_range_max || '',
      salary_currency: job.salary_currency || 'USD', location_type: job.location_type || '',
    });
    setShowEditJob(true);
  };

  const handleSaveEdit = async () => {
    if (!jobId) return; setIsSavingEdit(true);
    try {
      const data: Record<string, any> = { ...editForm };
      if (typeof data.core_skills === 'string') data.core_skills = data.core_skills.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (typeof data.preferred_skills === 'string') data.preferred_skills = data.preferred_skills.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (data.salary_range_min) data.salary_range_min = Number(data.salary_range_min);
      if (data.salary_range_max) data.salary_range_max = Number(data.salary_range_max);
      if (data.number_of_vacancies) data.number_of_vacancies = Number(data.number_of_vacancies);
      await apiClient.editJob(jobId, data);
      toast({ title: 'Job updated successfully' }); setShowEditJob(false); loadJobDetails();
    } catch (err: any) { toast({ title: 'Failed to update job', description: err.message, variant: 'destructive' }); }
    finally { setIsSavingEdit(false); }
  };

  const handleOpenPortalDialog = async () => {
    setShowPortalDialog(true); setSelectedPortalIds(new Set()); setIsLoadingPortals(true);
    try { const data = await apiClient.getJobPortals(); setPortals(data); }
    catch (err: any) { toast({ title: 'Error', description: err.message || 'Failed to load portals', variant: 'destructive' }); setPortals([]); }
    finally { setIsLoadingPortals(false); }
  };

  const togglePortalSelection = (portalId: number) => {
    setSelectedPortalIds((prev) => { const next = new Set(prev); if (next.has(portalId)) next.delete(portalId); else next.add(portalId); return next; });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--orbis-page)' }}>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#1B8EE5] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Loading job details...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--orbis-page)' }}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--orbis-input)' }}>
              <Briefcase className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400">Job not found</p>
            <button onClick={() => navigate('/dashboard')} className="mt-4 px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white transition-all" style={glassCard}>
              Back to Jobs
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const j = job as any;
  const fmt = formatLabel;
  const formatSalary = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
    catch { return `${currency} ${amount.toLocaleString()}`; }
  };

  const daysOpen = Math.ceil((Date.now() - new Date(job.created_date).getTime()) / 86400000);
  const avgScore = job.statistics ? (job.statistics.total_candidates > 0 ? Math.round(((job.statistics.recommended_count * 100) / job.statistics.total_candidates)) : 0) : 0;
  const attractivenessPercent = attractivenessScore
    ? (typeof attractivenessScore.score === 'number' ? Math.round(attractivenessScore.score) : typeof attractivenessScore === 'number' ? Math.round(attractivenessScore) : null)
    : null;

  return (
    <AppLayout>
      <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
        <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(27,142,229,0.04)', filter: 'blur(120px)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm mb-5">
            <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-white transition-colors">Jobs</button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-white font-medium truncate max-w-xs">{job.job_title}</span>
          </nav>

          {/* Header Section */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
            <div className="rounded-2xl p-6" style={glassCard}>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <h1 className="text-2xl font-bold text-white tracking-tight">{job.job_title}</h1>
                    <span className={`px-3 py-0.5 text-xs font-semibold rounded-full border ${
                      job.status === 'Open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : job.status === 'Closed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-white/5 text-slate-400 border-white/10'
                    }`}>{job.status}</span>
                    {(job as any).approval_status && <ApprovalBadge status={(job as any).approval_status} />}
                    {j.salary_visibility === 'hidden' ? (
                      <EyeOff className="w-4 h-4 text-slate-500" title="Hidden from candidates" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" title="Visible to candidates" />
                    )}
                  </div>

                  {/* Inline metadata badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {j.job_type && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300 px-2 py-0.5 rounded-md" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
                        <Briefcase className="w-3 h-3" /> {fmt(j.job_type)}
                      </span>
                    )}
                    {job.location_vacancies && job.location_vacancies.length > 0 && job.location_vacancies.map((lv) => (
                      <span key={lv.id} className="inline-flex items-center gap-1 text-xs text-slate-300 px-2 py-0.5 rounded-md" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
                        <MapPin className="w-3 h-3" /> {lv.city}{lv.country ? `, ${lv.country}` : ''}
                      </span>
                    ))}
                    {j.position_type && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300 px-2 py-0.5 rounded-md" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
                        <Clock className="w-3 h-3" /> {fmt(j.position_type)}
                      </span>
                    )}
                    {j.location_type && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300 px-2 py-0.5 rounded-md" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
                        <Globe className="w-3 h-3" /> {fmt(j.location_type)}
                      </span>
                    )}
                    {j.experience_range && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300 px-2 py-0.5 rounded-md" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
                        <Star className="w-3 h-3" /> {j.experience_range}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Posted {new Date(job.created_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /> Updated {new Date(job.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>

                  {/* Deadline warning */}
                  {(() => {
                    const hcd = (job as any).hiring_close_date;
                    if (!hcd) return null;
                    const daysLeft = Math.ceil((new Date(hcd).getTime() - Date.now()) / 86400000);
                    if (daysLeft < 0) return (
                      <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="text-xs font-medium text-rose-300">Past closing date ({new Date(hcd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})</span>
                      </div>
                    );
                    if (daysLeft <= 7) return (
                      <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-medium text-amber-300">Closing in {daysLeft === 0 ? 'less than a day' : daysLeft === 1 ? '1 day' : `${daysLeft} days`}</span>
                      </div>
                    );
                    return null;
                  })()}

                  {/* Approval actions */}
                  {(isAdmin() || isHR()) && (job as any).approval_status === 'pending' && (
                    <div className="flex items-center gap-3 mt-3 p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <span className="text-xs text-amber-300 font-medium">This job is pending approval.</span>
                      <button disabled={isApprovalProcessing} onClick={handleApprove} className="h-7 px-3 text-xs rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 transition-colors disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button disabled={isApprovalProcessing} onClick={handleReject} className="h-7 px-3 text-xs rounded-lg font-medium text-rose-400 flex items-center gap-1 transition-colors disabled:opacity-50" style={{ border: '1px solid rgba(244,63,94,0.3)' }}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Action buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowAddCandidate(true)} className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-1.5 transition-all hover:scale-[1.02]" style={gradientBtn}>
                      <UserPlus className="w-4 h-4" /> Add Candidate
                    </button>
                    <button onClick={() => navigate(`/jobs/${jobId}/pipeline`)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-all" style={glassCard}>
                      <Kanban className="w-4 h-4" /> View Pipeline
                    </button>
                    <button onClick={() => navigate(`/jobs/${jobId}/candidates`)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-all" style={glassCard}>
                      <Users className="w-4 h-4" /> View Candidates
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(isAdmin() || isHR()) && (
                      <button onClick={openEditJob} className="h-8 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-all" style={glassCard}>
                        <Edit3 className="w-3.5 h-3.5" /> Edit Job
                      </button>
                    )}
                    <RankCandidatesButton jdId={Number(jobId)} />
                    <button onClick={handleShareLinkedIn} disabled={sharingToLinkedIn} className="h-8 px-3 rounded-lg text-xs font-medium text-[#0A66C2] flex items-center gap-1.5 transition-all disabled:opacity-50" style={{ ...glassCard, borderColor: 'rgba(10,102,194,0.3)' }}>
                      <Linkedin className="w-3.5 h-3.5" /> {sharingToLinkedIn ? 'Posting...' : 'Share on LinkedIn'}
                    </button>
                    <button onClick={handleOpenPortalDialog} className="h-8 px-3 rounded-lg text-xs font-medium text-emerald-400 flex items-center gap-1.5 transition-all" style={{ ...glassCard, borderColor: 'rgba(52,211,153,0.2)' }}>
                      <Globe className="w-3.5 h-3.5" /> Post to Portals
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="rounded-xl p-1 mb-6 w-auto inline-flex border-0" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
              <TabsTrigger value="overview" className="rounded-lg text-sm px-4 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 data-[state=active]:shadow-none">Overview</TabsTrigger>
              <TabsTrigger value="screening" className="rounded-lg text-sm px-4 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 data-[state=active]:shadow-none">
                Screening Questions
                {screeningQuestions.length > 0 && <span className="ml-1.5 text-[10px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-full">{screeningQuestions.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="ai-interviews" className="rounded-lg text-sm px-4 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 data-[state=active]:shadow-none">AI Interviews</TabsTrigger>
              <TabsTrigger value="team" className="rounded-lg text-sm px-4 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 data-[state=active]:shadow-none">Team & Costs</TabsTrigger>
            </TabsList>

            {/* ====== OVERVIEW TAB ====== */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Job Description */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                    <div className="rounded-2xl overflow-hidden" style={glassCard}>
                      <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                        <FileText className="w-4 h-4 text-[#1B8EE5]" />
                        <h3 className="text-base font-semibold text-white">Job Description</h3>
                      </div>
                      <div className="px-6 py-5 space-y-6">
                        {job.rubric_summary && <p className="text-sm text-slate-300 leading-relaxed">{job.rubric_summary}</p>}

                        <div>
                          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Star className="w-3.5 h-3.5 text-amber-400" /> Key Requirements
                          </h4>
                          {job.key_requirements && job.key_requirements.length > 0 ? (
                            <ul className="space-y-2">
                              {job.key_requirements.map((req, index) => (
                                <li key={index} className="flex items-start gap-2.5 text-sm text-slate-300">
                                  <div className="w-1.5 h-1.5 bg-[#1B8EE5]/60 rounded-full mt-2 shrink-0" />
                                  <span>{req}</span>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-sm text-slate-500 italic">No key requirements specified.</p>}
                        </div>

                        {j.salary_range_min != null && j.salary_range_max != null && j.salary_visibility !== 'hidden' && (
                          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-medium text-white">{formatSalary(j.salary_range_min, j.salary_currency || 'USD')} &ndash; {formatSalary(j.salary_range_max, j.salary_currency || 'USD')}</span>
                            <span className="text-xs text-slate-500 ml-1">per year</span>
                          </div>
                        )}

                        {j.hiring_close_date && (
                          <div className="flex items-center gap-2 text-sm text-slate-500 pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Hiring deadline: {new Date(j.hiring_close_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            {(() => {
                              const dl = Math.ceil((new Date(j.hiring_close_date).getTime() - Date.now()) / 86400000);
                              if (dl < 0) return <span className="text-[10px] text-rose-400 px-1.5 py-0.5 rounded-full border border-rose-500/20">Closed</span>;
                              if (dl <= 7) return <span className="text-[10px] text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20">Closing soon</span>;
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Uploaded Files */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
                    <div className="rounded-2xl overflow-hidden" style={glassCard}>
                      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                        <h3 className="text-base font-semibold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-[#1B8EE5]" /> Documents</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Job-related files and attachments</p>
                      </div>
                      <div className="px-6 py-5">
                        {job.uploaded_files && job.uploaded_files.length > 0 ? (
                          <div className="space-y-2">
                            {job.uploaded_files.map((file) => (
                              <div key={file.file_id} className="group flex items-center gap-3 p-3 rounded-xl transition-all" style={{ border: '1px solid var(--orbis-border)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--orbis-card)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(27,142,229,0.2)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--orbis-border)'; }}
                              >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${file.file_type === 'rubric' ? 'text-blue-400' : 'text-emerald-400'}`} style={{ background: file.file_type === 'rubric' ? 'rgba(96,165,250,0.1)' : 'rgba(52,211,153,0.1)' }}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{file.display_name}</p>
                                  <p className="text-xs text-slate-500">{file.file_name} &middot; {(file.file_size / 1024).toFixed(1)} KB &middot; {new Date(file.upload_date).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded border border-white/10">{file.file_type}</span>
                                  <button className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-[#1B8EE5] opacity-0 group-hover:opacity-100 transition-all" disabled={!file.file_link} onClick={(e) => { e.stopPropagation(); if (file.file_link) window.open(file.file_link, '_blank'); }}>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                  <button className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-[#1B8EE5] opacity-0 group-hover:opacity-100 transition-all" disabled={!file.file_link} onClick={(e) => { e.stopPropagation(); if (file.file_link) { const a = document.createElement('a'); a.href = file.file_link; a.download = file.file_name; document.body.appendChild(a); a.click(); document.body.removeChild(a); } }}>
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No files uploaded yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
                    <div className="rounded-2xl overflow-hidden" style={glassCard}>
                      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                        <h3 className="text-base font-semibold text-white">Quick Actions</h3>
                      </div>
                      <div className="px-6 py-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { icon: Import, label: 'Import Candidates', onClick: () => setShowImportCandidates(true) },
                            { icon: FileText, label: 'Evaluations', onClick: () => navigate(`/jobs/${jobId}/interview-evaluations`) },
                            { icon: Link2, label: 'Referral Link', onClick: () => navigate(`/referrals?job=${jobId}`) },
                            { icon: Sparkles, label: 'AI Ranking', onClick: () => navigate(`/jobs/${jobId}/pipeline`) },
                            { icon: Mail, label: 'Email Campaign', onClick: () => navigate(`/outreach?job=${jobId}`) },
                            { icon: ShieldCheck, label: 'Compliance', onClick: () => navigate(`/compliance?job=${jobId}`) },
                          ].map((action, i) => (
                            <button key={i} onClick={action.onClick} className="h-9 px-3 text-xs font-medium text-slate-300 hover:text-white rounded-xl flex items-center gap-1.5 transition-all" style={glassCard}>
                              <action.icon className="w-3.5 h-3.5 shrink-0" /> {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Right Column: Stats sidebar */}
                <div className="space-y-6">
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
                    <div className="rounded-2xl overflow-hidden" style={glassCard}>
                      <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                        <TrendingUp className="w-4 h-4 text-[#1B8EE5]" />
                        <h3 className="text-base font-semibold text-white">Statistics</h3>
                      </div>
                      <div className="px-6 py-5">
                        {job.statistics ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--orbis-card)' }}>
                                <div className="text-2xl font-bold text-white">{job.statistics.total_candidates}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">Total Candidates</div>
                              </div>
                              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--orbis-card)' }}>
                                <div className="text-2xl font-bold text-white">{daysOpen}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">Days Open</div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between px-1"><span className="text-xs text-slate-500">Recommended</span><span className="text-sm font-semibold text-emerald-400">{job.statistics.recommended_count}</span></div>
                              <div className="flex items-center justify-between px-1"><span className="text-xs text-slate-500">Under Review</span><span className="text-sm font-semibold text-amber-400">{job.statistics.under_review_count}</span></div>
                              <div className="flex items-center justify-between px-1"><span className="text-xs text-slate-500">Not Recommended</span><span className="text-sm font-semibold text-rose-400">{job.statistics.not_recommended_count}</span></div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6"><TrendingUp className="w-6 h-6 text-slate-400 mx-auto mb-2" /><p className="text-xs text-slate-500">Statistics not available</p></div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* AI Attractiveness Score */}
                  {attractivenessScore && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
                      <div className="rounded-2xl overflow-hidden" style={glassCard}>
                        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <h3 className="text-base font-semibold text-white">AI Score</h3>
                        </div>
                        <div className="px-6 py-5">
                          <div className="flex flex-col items-center">
                            <div className="relative w-24 h-24 mb-3">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--orbis-input)" strokeWidth="8" />
                                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" stroke="#f59e0b" strokeDasharray={`${(attractivenessPercent || 0) * 2.64} 264`} />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-bold text-white">{attractivenessPercent != null ? `${attractivenessPercent}%` : '--'}</span>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500">{attractivenessScore.label || 'Attractiveness Score'}</span>
                            {attractivenessScore.summary && <p className="text-[11px] text-slate-500 text-center mt-2 leading-relaxed">{attractivenessScore.summary}</p>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Locations with progress */}
                  {job.location_vacancies && job.location_vacancies.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.15 }}>
                      <div className="rounded-2xl overflow-hidden" style={glassCard}>
                        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                          <MapPin className="w-4 h-4 text-[#1B8EE5]" />
                          <h3 className="text-base font-semibold text-white">Locations</h3>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                          {(job.location_vacancies || []).map((lv) => {
                            const pct = lv.vacancies > 0 ? Math.round((lv.hired_count / lv.vacancies) * 100) : 0;
                            return (
                              <div key={lv.id}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-white">{lv.city}, {lv.country}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-500">{lv.hired_count}/{lv.vacancies}</span>
                                    {lv.is_full && <span className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Full</span>}
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-input)' }}>
                                  <div className={`h-full rounded-full transition-all ${lv.is_full ? 'bg-emerald-500' : 'bg-[#1B8EE5]'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-white">Total</span>
                              <span className="font-bold text-white">{job.location_vacancies.reduce((s, l) => s + l.hired_count, 0)}/{job.location_vacancies.reduce((s, l) => s + l.vacancies, 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ====== SCREENING QUESTIONS TAB ====== */}
            <TabsContent value="screening">
              <div className="max-w-3xl">
                <div className="rounded-2xl overflow-hidden" style={glassCard}>
                  <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <div>
                      <h3 className="text-base font-semibold text-white flex items-center gap-2"><HelpCircle className="w-4 h-4 text-amber-400" /> Screening Questions</h3>
                      <p className="text-xs text-slate-500 mt-1">Configure questions candidates must answer when applying</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setShowTemplateLibrary(true); loadTemplates(); }} className="h-8 px-3 text-xs rounded-lg font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-all" style={glassCard}>
                        <LayoutTemplate className="w-3.5 h-3.5" /> Templates
                      </button>
                      <button onClick={handleGenerateQuestions} disabled={isGenerating} className="h-8 px-3 text-xs rounded-lg font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-50" style={glassCard}>
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Generate
                      </button>
                      <button onClick={() => setShowAddQuestion(true)} className="h-8 px-3 text-xs rounded-xl font-medium text-white flex items-center gap-1.5 transition-all" style={gradientBtn}>
                        <Plus className="w-3.5 h-3.5" /> Add Question
                      </button>
                    </div>
                  </div>
                  <div className="px-6 py-5">
                    {isScreeningLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-[#1B8EE5] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : screeningQuestions.length === 0 ? (
                      <div className="text-center py-10">
                        <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm text-slate-400 mb-1">No screening questions yet</p>
                        <p className="text-xs text-slate-500">Add questions manually or use AI to generate them from the job description.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {screeningQuestions.map((q, idx) => (
                          <div key={q.id} className="group flex items-start gap-3 p-3 rounded-xl transition-all"
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--orbis-card)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                          >
                            <span className="text-xs font-mono text-slate-400 mt-0.5 w-5 text-right shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-200 leading-relaxed">{q.question}</p>
                              {q.question_type === 'multiple_choice' && q.options && q.options.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {q.options.map((opt: string, oi: number) => (
                                    <span key={oi} className="text-[10px] px-1.5 py-0.5 rounded text-slate-400" style={{ background: 'var(--orbis-input)' }}>{opt}</span>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] px-1.5 py-0 rounded border border-white/10 text-slate-400">
                                  {q.question_type === 'yes_no' ? 'Yes/No' : q.question_type === 'multiple_choice' ? 'Multiple Choice' : q.question_type === 'numeric' ? 'Numeric' : q.question_type === 'date' ? 'Date' : 'Text'}
                                </span>
                                {q.required && <span className="text-[10px] px-1.5 py-0 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Required</span>}
                                {q.is_knockout && <span className="text-[10px] px-1.5 py-0 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-0.5"><ShieldAlert className="w-2.5 h-2.5" />Knockout</span>}
                                {q.ai_generated && <span className="text-[10px] px-1.5 py-0 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-0.5"><Wand2 className="w-2.5 h-2.5" />AI</span>}
                              </div>
                            </div>
                            <button className="h-7 w-7 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all" onClick={() => setDeleteQuestionId(q.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline add question form */}
                    {showAddQuestion && (
                      <div className="mt-4 p-4 rounded-xl space-y-3" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-hover)' }}>
                        <textarea placeholder="Enter your screening question..." value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} rows={2} className="w-full text-sm resize-none rounded-xl p-3 outline-none transition-all" style={glassInput} />
                        <div className="flex items-center gap-3 flex-wrap">
                          <Select value={newQuestionType} onValueChange={(v) => { setNewQuestionType(v as any); if (v !== 'multiple_choice') { setNewOptions([]); setNewOptionInput(''); } }}>
                            <SelectTrigger className="w-40 h-8 text-xs text-white border-0 rounded-lg" style={glassInput}><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl border-0" style={selectDrop}>
                              <SelectItem className={sItemCls} value="text">Text</SelectItem>
                              <SelectItem className={sItemCls} value="yes_no">Yes/No</SelectItem>
                              <SelectItem className={sItemCls} value="multiple_choice">Multiple Choice</SelectItem>
                            </SelectContent>
                          </Select>
                          <label className="flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} className="rounded" /> Required</label>
                          <label className="flex items-center gap-1.5 text-xs text-orange-400"><input type="checkbox" checked={newIsKnockout} onChange={(e) => setNewIsKnockout(e.target.checked)} className="rounded" /> Knockout</label>
                        </div>
                        {newIsKnockout && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 shrink-0">Disqualify when answer</span>
                            <input placeholder="e.g. equals:No" value={newKnockoutCondition} onChange={(e) => setNewKnockoutCondition(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="h-7 text-xs max-w-[200px] rounded-lg px-2 outline-none transition-all" style={glassInput} />
                            <span className="text-[10px] text-slate-400">(equals:No, equals:Yes, less_than:2)</span>
                          </div>
                        )}
                        {newQuestionType === 'multiple_choice' && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {newOptions.map((opt, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-[#1B8EE5]/10 text-[#1B8EE5]">
                                  {opt}
                                  <button type="button" onClick={() => setNewOptions(newOptions.filter((_, j) => j !== i))} className="hover:text-rose-400"><XCircle className="w-3 h-3" /></button>
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <input placeholder="Add option..." value={newOptionInput} onChange={(e) => setNewOptionInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newOptionInput.trim()) { e.preventDefault(); setNewOptions([...newOptions, newOptionInput.trim()]); setNewOptionInput(''); } }} onFocus={handleFocus} onBlur={handleBlur} className="h-7 text-xs max-w-[200px] rounded-lg px-2 outline-none transition-all" style={glassInput} />
                              <button className="h-7 px-2 text-xs rounded-lg text-slate-300" style={glassCard} onClick={() => { if (newOptionInput.trim()) { setNewOptions([...newOptions, newOptionInput.trim()]); setNewOptionInput(''); } }}>Add</button>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setShowAddQuestion(false); setNewQuestion(''); setNewOptions([]); setNewOptionInput(''); setNewIsKnockout(false); setNewKnockoutCondition(''); }} className="h-8 px-3 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                          <button onClick={handleAddScreeningQuestion} disabled={!newQuestion.trim() || isSavingQuestion || (newQuestionType === 'multiple_choice' && newOptions.length < 2)} className="h-8 px-4 text-xs rounded-xl font-medium text-white disabled:opacity-50" style={gradientBtn}>
                            {isSavingQuestion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Template Library */}
                    {showTemplateLibrary && (
                      <div className="mt-4 p-4 rounded-xl space-y-3" style={{ background: 'rgba(27,142,229,0.04)', border: '1px dashed rgba(27,142,229,0.3)' }}>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-1.5"><LayoutTemplate className="w-4 h-4 text-[#1B8EE5]" /> Template Library</h4>
                          <button onClick={() => setShowTemplateLibrary(false)} className="h-7 px-2 text-xs text-slate-400 hover:text-white transition-colors">Close</button>
                        </div>
                        {isLoadingTemplates ? (
                          <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-500" /></div>
                        ) : templateQuestions.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4">No template questions available.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                            {templateQuestions.map((tpl: any) => (
                              <div key={tpl.id} className="flex items-center gap-2 p-2 rounded-lg transition-all" style={{ border: '1px solid transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--orbis-card)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--orbis-hover)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white truncate">{tpl.question}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] px-1 py-0 text-slate-400 border border-white/10 rounded">{tpl.category}</span>
                                    <span className="text-[9px] px-1 py-0 text-slate-400 border border-white/10 rounded">{tpl.question_type === 'yes_no' ? 'Yes/No' : tpl.question_type === 'multiple_choice' ? 'MC' : 'Text'}</span>
                                    {tpl.is_knockout && <span className="text-[9px] px-1 py-0 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded">Knockout</span>}
                                  </div>
                                </div>
                                <button className="h-6 px-2 text-[10px] shrink-0 text-slate-300 rounded-lg flex items-center gap-0.5" style={glassCard} onClick={() => handleAddFromTemplate(tpl.id)}>
                                  <Plus className="w-3 h-3" />Add
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <AlertDialog open={deleteQuestionId !== null} onOpenChange={(open) => { if (!open) setDeleteQuestionId(null); }}>
                <AlertDialogContent className="border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Delete Screening Question</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Are you sure you want to delete this screening question? This action cannot be undone and any existing responses to this question will be orphaned.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="text-slate-300 border-white/10 hover:bg-white/5 hover:text-white">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => deleteQuestionId && handleDeleteScreeningQuestion(deleteQuestionId)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>

            {/* ====== AI INTERVIEWS TAB ====== */}
            <TabsContent value="ai-interviews">
              <div className="max-w-4xl"><AIInterviewsSection jobId={jobId!} /></div>
            </TabsContent>

            {/* ====== TEAM & COSTS TAB ====== */}
            <TabsContent value="team">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
                {/* Team Members */}
                <div className="rounded-2xl overflow-hidden" style={glassCard}>
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#1B8EE5]" /> Team Members</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Manage team members for this job</p>
                  </div>
                  <div className="px-6 py-5">
                    {isMembersLoading ? (
                      <div className="flex items-center justify-center py-6"><div className="w-5 h-5 border-2 border-[#1B8EE5] border-t-transparent rounded-full animate-spin" /></div>
                    ) : members.length === 0 ? (
                      <div className="text-center py-6"><Users className="w-6 h-6 text-slate-400 mx-auto mb-2" /><p className="text-xs text-slate-500">No team members yet</p></div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {members.map((member: any) => (
                          <div key={member.user_id} className="flex items-center justify-between p-3 rounded-xl transition-colors" style={{ border: '1px solid var(--orbis-border)' }}>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{member.first_name} {member.last_name}</p>
                              <p className="text-xs text-slate-500">{member.email}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] capitalize text-slate-400 px-1.5 py-0.5 rounded border border-white/10">{member.role}</span>
                              <button className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" onClick={() => handleRemoveMember(member.user_id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Add Member</p>
                      <div className="flex items-center gap-2">
                        <input placeholder="User ID" value={newMemberUserId} onChange={(e) => setNewMemberUserId(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="h-8 text-sm flex-1 rounded-lg px-3 outline-none transition-all" style={glassInput} />
                        <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} className="h-8 text-xs rounded-lg px-2 outline-none" style={glassInput as any}>
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="interviewer">Interviewer</option>
                        </select>
                        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-white" style={gradientBtn} onClick={handleAddMember} disabled={!newMemberUserId.trim()}>
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <HiringCostsSection jobId={jobId || ''} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <AddCandidateModal jobId={jobId || ''} isOpen={showAddCandidate} onClose={() => setShowAddCandidate(false)} onSuccess={() => { setShowAddCandidate(false); loadJobDetails(); }} />
        <ImportCandidatesModal currentJobId={jobId || ''} isOpen={showImportCandidates} onClose={() => setShowImportCandidates(false)} onImport={handleImportCandidates} />

        {/* Post to Portals Dialog */}
        <Dialog open={showPortalDialog} onOpenChange={setShowPortalDialog}>
          <DialogContent className="sm:max-w-md border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base text-white"><Globe className="w-4 h-4 text-emerald-400" /> Post to Job Portals</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Select the portals where you want to publish this job listing.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {isLoadingPortals ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /><span className="ml-2 text-sm text-slate-500">Loading portals...</span></div>
              ) : portals.length === 0 ? (
                <div className="text-center py-8"><Globe className="w-8 h-8 mx-auto mb-3 text-slate-400" /><p className="text-sm font-medium text-slate-400">No portals configured</p><p className="text-xs mt-1 text-slate-500">Ask an admin to add job portals in Settings.</p></div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {portals.map((portal: any) => (
                    <label key={portal.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors" style={{ border: '1px solid var(--orbis-hover)' }}>
                      <Checkbox checked={selectedPortalIds.has(portal.id)} onCheckedChange={() => togglePortalSelection(portal.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-white truncate">{portal.portal_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{portal.integration_type || 'api'} integration</p>
                      </div>
                      <span className="text-[10px] shrink-0 text-slate-400 px-1.5 py-0.5 rounded border border-white/10">{portal.is_active ? 'Active' : 'Inactive'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <p className="text-[11px] text-slate-400 mr-auto">Portal publishing coming soon</p>
              <button className="px-4 py-2 text-sm rounded-xl text-slate-300" style={glassCard} onClick={() => setShowPortalDialog(false)}>Cancel</button>
              <button className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50" style={gradientBtn} disabled={selectedPortalIds.size === 0} onClick={() => { toast({ title: 'Coming Soon', description: `Publishing to ${selectedPortalIds.size} portal(s) will be available in a future update.` }); setShowPortalDialog(false); }}>
                Post ({selectedPortalIds.size})
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Job Dialog */}
      <Dialog open={showEditJob} onOpenChange={setShowEditJob}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Edit Job</DialogTitle>
            <DialogDescription className="text-slate-500">Update job details and requirements</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Job Title</label>
              <input value={editForm.job_title || ''} onChange={e => setEditForm(f => ({ ...f, job_title: e.target.value }))} onFocus={handleFocus} onBlur={handleBlur} className="h-10 rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Summary</label>
              <textarea value={editForm.summary || ''} onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))} onFocus={handleFocus} onBlur={handleBlur} rows={3} className="rounded-xl p-3 text-sm outline-none transition-all resize-none" style={glassInput} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Core Skills (comma-separated)</label>
                <input value={editForm.core_skills || ''} onChange={e => setEditForm(f => ({ ...f, core_skills: e.target.value }))} onFocus={handleFocus} onBlur={handleBlur} className="h-10 rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Preferred Skills (comma-separated)</label>
                <input value={editForm.preferred_skills || ''} onChange={e => setEditForm(f => ({ ...f, preferred_skills: e.target.value }))} onFocus={handleFocus} onBlur={handleBlur} className="h-10 rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Country</label>
                <Select value={editForm.country || ''} onValueChange={v => setEditForm(f => ({ ...f, country: v, city: '' }))}>
                  <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Select country..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0 max-h-60" style={selectDrop}>{COUNTRIES.map(c => <SelectItem key={c} className={sItemCls} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">City</label>
                <Select value={editForm.city || ''} onValueChange={v => setEditForm(f => ({ ...f, city: v }))} disabled={!editForm.country}>
                  <SelectTrigger className="h-10 rounded-xl text-white border-0 disabled:opacity-40" style={glassInput}><SelectValue placeholder={editForm.country ? 'Select city...' : 'Select country first'} /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0 max-h-60" style={selectDrop}>{getCitiesForCountry(editForm.country || '').map(c => <SelectItem key={c} className={sItemCls} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Job Type</label>
                <Select value={editForm.job_type || ''} onValueChange={v => setEditForm(f => ({ ...f, job_type: v }))}>
                  <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>
                    {['full_time','part_time','contract','internship','freelance'].map(v => <SelectItem key={v} className={sItemCls} value={v}>{fmt(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Location Type</label>
                <Select value={editForm.location_type || ''} onValueChange={v => setEditForm(f => ({ ...f, location_type: v }))}>
                  <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>
                    {['onsite','remote','hybrid'].map(v => <SelectItem key={v} className={sItemCls} value={v}>{fmt(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Vacancies</label>
                <input type="number" min={1} value={editForm.number_of_vacancies || 1} onChange={e => setEditForm(f => ({ ...f, number_of_vacancies: e.target.value }))} onFocus={handleFocus} onBlur={handleBlur} className="h-10 rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Salary Min</label>
                <input type="number" value={editForm.salary_range_min || ''} onChange={e => setEditForm(f => ({ ...f, salary_range_min: e.target.value }))} onFocus={handleFocus} onBlur={handleBlur} className="h-10 rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Salary Max</label>
                <input type="number" value={editForm.salary_range_max || ''} onChange={e => setEditForm(f => ({ ...f, salary_range_max: e.target.value }))} onFocus={handleFocus} onBlur={handleBlur} className="h-10 rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Currency</label>
                <Select value={editForm.salary_currency || 'USD'} onValueChange={v => setEditForm(f => ({ ...f, salary_currency: v }))}>
                  <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>{CURRENCIES.map(c => <SelectItem key={c.value} className={sItemCls} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Experience Range</label>
                <Select value={editForm.experience_range || ''} onValueChange={v => setEditForm(f => ({ ...f, experience_range: v }))}>
                  <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>{EXPERIENCE_RANGES.map(r => <SelectItem key={r} className={sItemCls} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Position Type</label>
                <Select value={editForm.position_type || ''} onValueChange={v => setEditForm(f => ({ ...f, position_type: v }))}>
                  <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-0" style={selectDrop}>
                    {['individual_contributor','team_lead','manager','director','executive'].map(v => <SelectItem key={v} className={sItemCls} value={v}>{fmt(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button className="px-4 py-2 text-sm rounded-xl text-slate-300" style={glassCard} onClick={() => setShowEditJob(false)}>Cancel</button>
            <button className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50 flex items-center gap-1" style={gradientBtn} onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

// ── AI Interviews Section ────────────────────────────────────────
function AIInterviewsSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AIInterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsSessionId, setResultsSessionId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const fetchSessions = async () => { setLoading(true); try { const data = await apiClient.getAIInterviewSessions(Number(jobId)); setSessions(data); } catch { /* empty */ } setLoading(false); };
  useEffect(() => { fetchSessions(); }, [jobId]);

  const handleCancel = async (sessionId: number) => {
    try { await apiClient.cancelAIInterview(sessionId); toast({ title: 'Cancelled', description: 'AI interview cancelled.' }); fetchSessions(); }
    catch { toast({ title: 'Error', description: 'Failed to cancel session.', variant: 'destructive' }); }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    expired: 'bg-white/5 text-slate-400 border-white/10',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={glassCard}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2"><Bot className="w-4 h-4 text-blue-400" /> AI Interviews</h3>
            <p className="text-xs text-slate-500 mt-0.5">{sessions.length} session(s)</p>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="h-8 px-3 text-xs rounded-xl font-medium text-white flex items-center gap-1" style={gradientBtn}>
            <Plus className="w-3.5 h-3.5" /> Send AI Interview
          </button>
        </div>
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10"><Bot className="w-8 h-8 text-slate-400 mx-auto mb-2" /><p className="text-sm text-slate-500">No AI interviews sent yet</p></div>
          ) : (
            <div>
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between px-6 py-3 transition-colors" style={{ borderBottom: '1px solid var(--orbis-grid)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--orbis-subtle)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{s.candidate_name || s.candidate_email || `Candidate #${s.candidate_id}`}</p>
                    <p className="text-xs text-slate-500">{s.interview_type} &middot; {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {s.overall_score != null && <span className="text-sm font-semibold text-white">{s.overall_score}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColors[s.status] || ''}`}>{s.status.replace('_', ' ')}</span>
                    {s.status === 'completed' && (
                      <button className="h-7 px-2 text-xs rounded-lg text-slate-300" style={glassCard} onClick={() => setResultsSessionId(s.id)}>Results</button>
                    )}
                    {s.status === 'pending' && (
                      <button className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 transition-colors" onClick={() => handleCancel(s.id)}>Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AIInterviewResultsSheet sessionId={resultsSessionId} open={resultsSessionId !== null} onOpenChange={(open) => { if (!open) setResultsSessionId(null); }} />
      {showInviteModal && <AIInterviewModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} jdId={Number(jobId)} onSent={() => { setShowInviteModal(false); fetchSessions(); }} />}
    </>
  );
}

// ── Hiring Costs Section ─────────────────────────────────────────
const COST_TYPES = [
  { value: 'job_board', label: 'Job Board' }, { value: 'agency', label: 'Agency' },
  { value: 'referral_bonus', label: 'Referral Bonus' }, { value: 'interview', label: 'Interview' },
  { value: 'recruiter_hours', label: 'Recruiter Hours' }, { value: 'advertising', label: 'Advertising' },
  { value: 'other', label: 'Other' },
];

function HiringCostsSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [costs, setCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [costType, setCostType] = useState('job_board');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const fetchCosts = async () => { setLoading(true); try { const data = await apiClient.getHiringCosts(jobId); setCosts(data || []); } catch { setCosts([]); } setLoading(false); };
  useEffect(() => { fetchCosts(); }, [jobId]);

  const totalCost = costs.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast({ title: 'Invalid amount', description: 'Please enter a valid amount.', variant: 'destructive' }); return; }
    setSaving(true);
    try { await apiClient.addHiringCost(jobId, { cost_type: costType, amount: amt, description: description.trim() || undefined }); toast({ title: 'Cost added', description: 'Hiring cost entry saved.' }); setShowAddDialog(false); setCostType('job_board'); setAmount(''); setDescription(''); fetchCosts(); }
    catch { toast({ title: 'Error', description: 'Failed to save cost entry.', variant: 'destructive' }); }
    setSaving(false);
  };

  const handleDelete = async (costId: number) => {
    try { await apiClient.deleteHiringCost(costId); toast({ title: 'Deleted', description: 'Cost entry removed.' }); fetchCosts(); }
    catch { toast({ title: 'Error', description: 'Failed to delete cost entry.', variant: 'destructive' }); }
  };

  const fmtCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  const fmtType = (t: string) => COST_TYPES.find(ct => ct.value === t)?.label || t.replace(/_/g, ' ');

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={glassCard}>
        <div className="px-6 py-4 cursor-pointer" style={{ borderBottom: '1px solid var(--orbis-border)' }} onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-400" /> Hiring Costs</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white px-2 py-0.5 rounded-full border border-white/10">{fmtCurrency(totalCost)}</span>
              <svg className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{costs.length} cost entry(ies)</p>
        </div>

        {isExpanded && (
          <div className="px-6 py-5">
            {loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
            ) : costs.length === 0 ? (
              <div className="text-center py-6"><Receipt className="w-6 h-6 text-slate-400 mx-auto mb-2" /><p className="text-xs text-slate-500">No costs recorded yet</p></div>
            ) : (
              <div className="space-y-2 mb-4">
                {costs.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl transition-colors" style={{ border: '1px solid var(--orbis-border)' }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] capitalize text-slate-400 px-1.5 py-0.5 rounded border border-white/10">{fmtType(c.cost_type)}</span>
                        <span className="text-sm font-semibold text-white">{fmtCurrency(c.amount)}</span>
                      </div>
                      {c.description && <p className="text-xs text-slate-500 mt-1 truncate">{c.description}</p>}
                      {c.created_at && <p className="text-[10px] text-slate-400 mt-0.5">{new Date(c.created_at).toLocaleDateString()}</p>}
                    </div>
                    <button className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="w-full h-9 rounded-xl text-sm font-medium text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all" style={glassCard} onClick={(e) => { e.stopPropagation(); setShowAddDialog(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add Cost
            </button>
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-base text-white">Add Hiring Cost</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Record a cost entry for this job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Cost Type</label>
              <Select value={costType} onValueChange={setCostType}>
                <SelectTrigger className="h-9 rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>{COST_TYPES.map(ct => <SelectItem key={ct.value} className={sItemCls} value={ct.value}>{ct.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Amount (USD)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="h-9 w-full rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Description (optional)</label>
              <input placeholder="e.g. LinkedIn Premium posting" value={description} onChange={(e) => setDescription(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} className="h-9 w-full rounded-xl px-3 text-sm outline-none transition-all" style={glassInput} />
            </div>
          </div>
          <DialogFooter>
            <button className="px-4 py-2 text-sm rounded-xl text-slate-300" style={glassCard} onClick={() => setShowAddDialog(false)}>Cancel</button>
            <button className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50 flex items-center gap-1" style={gradientBtn} onClick={handleSubmit} disabled={saving || !amount}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Cost
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default JobDetail;
