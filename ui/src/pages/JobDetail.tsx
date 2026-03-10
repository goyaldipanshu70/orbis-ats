import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatLabel } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Users, FileText, Clock, Edit3, Briefcase, TrendingUp, Star, Calendar, Import, Kanban, CheckCircle, XCircle, Trash2, Plus, Link2, Sparkles, Mail, ShieldCheck, Loader2, Wand2, HelpCircle, Linkedin, Download, ExternalLink, Bot, MapPin, DollarSign, AlertTriangle, Globe, Receipt, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/components/layout/AppLayout';
import AddCandidateModal from '@/components/AddCandidateModal';
import ImportCandidatesModal from '@/components/ImportCandidatesModal';
import ApprovalBadge from '@/components/ApprovalBadge';
import AIInterviewModal from '@/components/pipeline/AIInterviewModal';
import AIInterviewResultsSheet from '@/components/pipeline/AIInterviewResultsSheet';
import type { Job, UploadedFile, JobStatistics, ScreeningQuestion, AIInterviewSession } from '@/types/api';
import { COUNTRIES, getCitiesForCountry, CURRENCIES, EXPERIENCE_RANGES } from '@/data/locations';
import { apiClient } from '@/utils/api';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fadeInUp, scaleIn, hoverScale, tapScale } from '@/lib/animations';

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

  // ---- Team members state ----
  const [members, setMembers] = useState<any[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');
  const [isApprovalProcessing, setIsApprovalProcessing] = useState(false);
  const [sharingToLinkedIn, setSharingToLinkedIn] = useState(false);

  // Portal posting state
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [portals, setPortals] = useState<any[]>([]);
  const [selectedPortalIds, setSelectedPortalIds] = useState<Set<number>>(new Set());
  const [isLoadingPortals, setIsLoadingPortals] = useState(false);
  const [attractivenessScore, setAttractivenessScore] = useState<any>(null);

  // Screening questions state
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([]);
  const [isScreeningLoading, setIsScreeningLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'yes_no' | 'multiple_choice'>('text');
  const [newRequired, setNewRequired] = useState(true);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  // Edit job state
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
      if (!jobId) {
        setJob(null);
        throw new Error("Job ID is not available.");
      }
      const jobData = await apiClient.getJobById(jobId);
      setJob(jobData);
    } catch (error) {
      console.error('Error loading job details:', error);
      setJob(null);
      toast({
        title: 'Error Loading Job',
        description: (error as Error).message || 'Could not load job details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportCandidates = async (candidateIds: string[]) => {
    if (!jobId) return;

    try {
      await apiClient.importCandidates(jobId, candidateIds);
      toast({
        title: 'Success',
        description: `Successfully imported ${candidateIds.length} candidate(s).`,
      });
      loadJobDetails();
    } catch (error) {
      console.error('Error importing candidates:', error);
      toast({
        title: 'Error',
        description: 'Failed to import candidates. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const loadMembers = async () => {
    if (!jobId) return;
    setIsMembersLoading(true);
    try {
      const data = await apiClient.getJobMembers(jobId);
      setMembers(data || []);
    } catch {
      setMembers([]);
      toast({ title: 'Error', description: 'Failed to load team members.', variant: 'destructive' });
    } finally {
      setIsMembersLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!jobId || !newMemberUserId.trim()) return;
    const userId = parseInt(newMemberUserId);
    if (isNaN(userId) || userId <= 0) {
      toast({ title: 'Invalid ID', description: 'Please enter a valid user ID.', variant: 'destructive' });
      return;
    }
    try {
      await apiClient.addJobMember(jobId, userId, newMemberRole);
      toast({ title: 'Success', description: 'Team member added.' });
      setNewMemberUserId('');
      setNewMemberRole('viewer');
      loadMembers();
    } catch {
      toast({ title: 'Error', description: 'Failed to add team member.', variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!jobId) return;
    try {
      await apiClient.removeJobMember(jobId, userId);
      toast({ title: 'Removed', description: 'Team member removed.' });
      loadMembers();
    } catch {
      toast({ title: 'Error', description: 'Failed to remove team member.', variant: 'destructive' });
    }
  };

  // Screening question functions
  const loadScreeningQuestions = async () => {
    if (!jobId) return;
    setIsScreeningLoading(true);
    try {
      const data = await apiClient.getScreeningQuestions(jobId);
      setScreeningQuestions(data || []);
    } catch {
      setScreeningQuestions([]);
      toast({ title: 'Error', description: 'Failed to load screening questions.', variant: 'destructive' });
    }
    finally { setIsScreeningLoading(false); }
  };

  const handleAddScreeningQuestion = async () => {
    if (!jobId || !newQuestion.trim()) return;
    setIsSavingQuestion(true);
    try {
      await apiClient.createScreeningQuestion(jobId, {
        question: newQuestion.trim(),
        question_type: newQuestionType,
        required: newRequired,
      });
      toast({ title: 'Added', description: 'Screening question added.' });
      setNewQuestion('');
      setNewQuestionType('text');
      setNewRequired(true);
      setShowAddQuestion(false);
      loadScreeningQuestions();
    } catch {
      toast({ title: 'Error', description: 'Failed to add question.', variant: 'destructive' });
    } finally { setIsSavingQuestion(false); }
  };

  const handleDeleteScreeningQuestion = async (questionId: number) => {
    if (!jobId) return;
    if (!confirm('Are you sure you want to delete this screening question?')) return;
    try {
      await apiClient.deleteScreeningQuestion(jobId, questionId);
      toast({ title: 'Deleted', description: 'Question removed.' });
      loadScreeningQuestions();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete question.', variant: 'destructive' });
    }
  };

  const handleGenerateQuestions = async () => {
    if (!jobId) return;
    setIsGenerating(true);
    try {
      await apiClient.generateScreeningQuestions(jobId);
      toast({ title: 'Generated', description: 'AI screening questions generated.' });
      loadScreeningQuestions();
    } catch {
      toast({ title: 'Error', description: 'Failed to generate questions.', variant: 'destructive' });
    } finally { setIsGenerating(false); }
  };

  const handleApprove = async () => {
    if (!jobId) return;
    setIsApprovalProcessing(true);
    try {
      await apiClient.approveJob(jobId);
      toast({ title: 'Approved', description: 'Job has been approved.' });
      loadJobDetails();
    } catch {
      toast({ title: 'Error', description: 'Failed to approve job.', variant: 'destructive' });
    } finally {
      setIsApprovalProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!jobId) return;
    setIsApprovalProcessing(true);
    try {
      await apiClient.rejectJob(jobId);
      toast({ title: 'Rejected', description: 'Job has been rejected.' });
      loadJobDetails();
    } catch {
      toast({ title: 'Error', description: 'Failed to reject job.', variant: 'destructive' });
    } finally {
      setIsApprovalProcessing(false);
    }
  };

  const handleShareLinkedIn = async () => {
    if (!jobId || !job) return;
    setSharingToLinkedIn(true);
    try {
      await apiClient.postJobToLinkedIn(Number(jobId), `We're hiring: ${job.job_title}!`);
      toast({ title: 'Shared!', description: 'Job posted to LinkedIn successfully' });
    } catch (err: any) {
      toast({ title: 'LinkedIn Error', description: err.message || 'Failed to post to LinkedIn', variant: 'destructive' });
    } finally {
      setSharingToLinkedIn(false);
    }
  };

  const openEditJob = () => {
    if (!job) return;
    setEditForm({
      job_title: job.job_title || '',
      summary: job.rubric_summary || '',
      core_skills: (job.key_requirements || []).join(', '),
      preferred_skills: '',
      country: job.country || '',
      city: job.city || '',
      number_of_vacancies: job.number_of_vacancies || 1,
      job_type: job.job_type || '',
      position_type: job.position_type || '',
      experience_range: job.experience_range || '',
      salary_range_min: job.salary_range_min || '',
      salary_range_max: job.salary_range_max || '',
      salary_currency: job.salary_currency || 'USD',
      location_type: job.location_type || '',
    });
    setShowEditJob(true);
  };

  const handleSaveEdit = async () => {
    if (!jobId) return;
    setIsSavingEdit(true);
    try {
      const data: Record<string, any> = { ...editForm };
      // Convert comma-separated skills to arrays
      if (typeof data.core_skills === 'string') {
        data.core_skills = data.core_skills.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (typeof data.preferred_skills === 'string') {
        data.preferred_skills = data.preferred_skills.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      // Convert numeric fields
      if (data.salary_range_min) data.salary_range_min = Number(data.salary_range_min);
      if (data.salary_range_max) data.salary_range_max = Number(data.salary_range_max);
      if (data.number_of_vacancies) data.number_of_vacancies = Number(data.number_of_vacancies);

      await apiClient.editJob(jobId, data);
      toast({ title: 'Job updated successfully' });
      setShowEditJob(false);
      loadJobDetails();
    } catch (err: any) {
      toast({ title: 'Failed to update job', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenPortalDialog = async () => {
    setShowPortalDialog(true);
    setSelectedPortalIds(new Set());
    setIsLoadingPortals(true);
    try {
      const data = await apiClient.getJobPortals();
      setPortals(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to load portals', variant: 'destructive' });
      setPortals([]);
    } finally {
      setIsLoadingPortals(false);
    }
  };

  const togglePortalSelection = (portalId: number) => {
    setSelectedPortalIds((prev) => {
      const next = new Set(prev);
      if (next.has(portalId)) {
        next.delete(portalId);
      } else {
        next.add(portalId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm text-muted-foreground">Loading job details...</div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground">Job not found</div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/dashboard')}>
                Back to Jobs
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const j = job as any;
  const fmt = formatLabel;
  const formatSalary = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(amount);
    } catch { return `${currency} ${amount.toLocaleString()}`; }
  };

  const daysOpen = Math.ceil((Date.now() - new Date(job.created_date).getTime()) / 86400000);
  const avgScore = job.statistics
    ? (job.statistics.total_candidates > 0
      ? Math.round(((job.statistics.recommended_count * 100) / job.statistics.total_candidates))
      : 0)
    : 0;

  const attractivenessPercent = attractivenessScore
    ? (typeof attractivenessScore.score === 'number'
      ? Math.round(attractivenessScore.score)
      : typeof attractivenessScore === 'number'
      ? Math.round(attractivenessScore)
      : null)
    : null;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm mb-5">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Jobs
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-foreground font-medium truncate max-w-xs">
              {job.job_title}
            </span>
          </nav>

          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                {/* Left: Title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                      {job.job_title}
                    </h1>
                    <Badge
                      className={`${
                        job.status === 'Open'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : job.status === 'Closed'
                          ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                          : 'bg-muted text-muted-foreground border-border'
                      } px-3 py-0.5 text-xs font-semibold rounded-full border`}
                    >
                      {job.status}
                    </Badge>
                    {(job as any).approval_status && (
                      <ApprovalBadge status={(job as any).approval_status} />
                    )}
                    {j.salary_visibility === 'hidden' ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" title="Hidden from candidates" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground/40" title="Visible to candidates" />
                    )}
                  </div>

                  {/* Inline metadata badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {j.job_type && (
                      <Badge variant="outline" className="text-xs font-normal gap-1 rounded-md">
                        <Briefcase className="w-3 h-3" />
                        {fmt(j.job_type)}
                      </Badge>
                    )}
                    {job.location_vacancies && job.location_vacancies.length > 0 && (
                      job.location_vacancies.map((lv) => (
                        <Badge key={lv.id} variant="outline" className="text-xs font-normal gap-1 rounded-md">
                          <MapPin className="w-3 h-3" />
                          {lv.city}{lv.country ? `, ${lv.country}` : ''}
                        </Badge>
                      ))
                    )}
                    {j.position_type && (
                      <Badge variant="outline" className="text-xs font-normal gap-1 rounded-md">
                        <Clock className="w-3 h-3" />
                        {fmt(j.position_type)}
                      </Badge>
                    )}
                    {j.location_type && (
                      <Badge variant="outline" className="text-xs font-normal gap-1 rounded-md">
                        <Globe className="w-3 h-3" />
                        {fmt(j.location_type)}
                      </Badge>
                    )}
                    {j.experience_range && (
                      <Badge variant="outline" className="text-xs font-normal gap-1 rounded-md">
                        <Star className="w-3 h-3" />
                        {j.experience_range}
                      </Badge>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Posted {new Date(job.created_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" />
                      Updated {new Date(job.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Deadline warning banner */}
                  {(() => {
                    const hcd = (job as any).hiring_close_date;
                    if (!hcd) return null;
                    const daysLeft = Math.ceil((new Date(hcd).getTime() - Date.now()) / 86400000);
                    if (daysLeft < 0) {
                      return (
                        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">
                            Past closing date ({new Date(hcd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})
                          </span>
                        </div>
                      );
                    }
                    if (daysLeft <= 7) {
                      return (
                        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Closing in {daysLeft === 0 ? 'less than a day' : daysLeft === 1 ? '1 day' : `${daysLeft} days`}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Approval actions for admin/HR when pending */}
                  {(isAdmin() || isHR()) && (job as any).approval_status === 'pending' && (
                    <div className="flex items-center gap-3 mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">This job is pending approval.</span>
                      <Button
                        size="sm"
                        disabled={isApprovalProcessing}
                        onClick={handleApprove}
                        className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isApprovalProcessing}
                        onClick={handleReject}
                        className="h-7 px-3 text-xs border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right: Action buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  {/* Row 1: Primary actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setShowAddCandidate(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm"
                    >
                      <UserPlus className="w-4 h-4 mr-1.5" />
                      Add Candidate
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/jobs/${jobId}/pipeline`)}
                      className="px-4 py-2 rounded-lg text-sm"
                    >
                      <Kanban className="w-4 h-4 mr-1.5" />
                      View Pipeline
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/jobs/${jobId}/candidates`)}
                      className="px-4 py-2 rounded-lg text-sm"
                    >
                      <Users className="w-4 h-4 mr-1.5" />
                      View Candidates
                    </Button>
                  </div>
                  {/* Row 2: Secondary actions */}
                  <div className="flex flex-wrap gap-2">
                    {(isAdmin() || isHR()) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openEditJob}
                        className="rounded-lg text-xs h-8"
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                        Edit Job
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareLinkedIn}
                      disabled={sharingToLinkedIn}
                      className="border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/5 hover:text-[#004182] rounded-lg text-xs h-8"
                    >
                      <Linkedin className="w-3.5 h-3.5 mr-1.5" />
                      {sharingToLinkedIn ? 'Posting...' : 'Share on LinkedIn'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPortalDialog}
                      className="border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 rounded-lg text-xs h-8"
                    >
                      <Globe className="w-3.5 h-3.5 mr-1.5" />
                      Post to Portals
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/50 border border-border rounded-lg p-1 mb-6 w-auto inline-flex">
              <TabsTrigger value="overview" className="rounded-md text-sm px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="screening" className="rounded-md text-sm px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Screening Questions
                {screeningQuestions.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted-foreground/10 text-muted-foreground px-1.5 py-0.5 rounded-full">{screeningQuestions.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="ai-interviews" className="rounded-md text-sm px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                AI Interviews
              </TabsTrigger>
              <TabsTrigger value="team" className="rounded-md text-sm px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Team & Costs
              </TabsTrigger>
            </TabsList>

            {/* ====== OVERVIEW TAB ====== */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: 2/3 */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Job Description */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                    <Card className="border border-border rounded-xl overflow-hidden">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          Job Description
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-6">
                        <div className="space-y-6">
                          {job.rubric_summary && (
                            <p className="text-sm text-foreground/90 leading-relaxed">
                              {job.rubric_summary}
                            </p>
                          )}

                          {/* Key Requirements */}
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              Key Requirements
                            </h4>
                            {job.key_requirements && job.key_requirements.length > 0 ? (
                              <ul className="space-y-2">
                                {job.key_requirements.map((req, index) => (
                                  <li key={index} className="flex items-start gap-2.5 text-sm text-foreground/80">
                                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full mt-2 shrink-0"></div>
                                    <span>{req}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No key requirements specified.</p>
                            )}
                          </div>

                          {/* Salary Range */}
                          {j.salary_range_min != null && j.salary_range_max != null && j.salary_visibility !== 'hidden' && (
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                              <DollarSign className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm font-medium text-foreground">
                                {formatSalary(j.salary_range_min, j.salary_currency || 'USD')} &ndash; {formatSalary(j.salary_range_max, j.salary_currency || 'USD')}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">per year</span>
                            </div>
                          )}

                          {/* Hiring Close Date */}
                          {j.hiring_close_date && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-3 border-t border-border">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Hiring deadline: {new Date(j.hiring_close_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                              {(() => {
                                const dl = Math.ceil((new Date(j.hiring_close_date).getTime() - Date.now()) / 86400000);
                                if (dl < 0) return <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">Closed</Badge>;
                                if (dl <= 7) return <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">Closing soon</Badge>;
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Uploaded Files */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
                    <Card className="border border-border rounded-xl overflow-hidden">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          Documents
                        </CardTitle>
                        <CardDescription className="text-xs">Job-related files and attachments</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 pb-6">
                        {job.uploaded_files && job.uploaded_files.length > 0 ? (
                          <div className="space-y-2">
                            {job.uploaded_files.map((file) => (
                              <div key={file.file_id} className="group flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/20 hover:bg-muted/50 transition-all">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${file.file_type === 'rubric' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{file.display_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {file.file_name} &middot; {(file.file_size / 1024).toFixed(1)} KB &middot; {new Date(file.upload_date).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Badge variant="outline" className="text-[10px] font-normal">{file.file_type}</Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                    disabled={!file.file_link}
                                    onClick={(e) => { e.stopPropagation(); if (file.file_link) window.open(file.file_link, '_blank'); }}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                    disabled={!file.file_link}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (file.file_link) {
                                        const a = document.createElement('a');
                                        a.href = file.file_link;
                                        a.download = file.file_name;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                      }
                                    }}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No files uploaded yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
                    <Card className="border border-border rounded-xl overflow-hidden">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold text-foreground">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowImportCandidates(true)}
                            className="h-9 text-xs justify-start"
                          >
                            <Import className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            Import Candidates
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/jobs/${jobId}/interview-evaluations`)}
                            className="h-9 text-xs justify-start"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            Evaluations
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/referrals?job=${jobId}`)}
                            className="h-9 text-xs justify-start"
                          >
                            <Link2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            Referral Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/ai-toolkit?tool=ranking&job=${jobId}`)}
                            className="h-9 text-xs justify-start"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            AI Ranking
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/outreach?job=${jobId}`)}
                            className="h-9 text-xs justify-start"
                          >
                            <Mail className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            Email Campaign
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/compliance?job=${jobId}`)}
                            className="h-9 text-xs justify-start"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            Compliance
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Right Column: 1/3 - Stats sidebar */}
                <div className="space-y-6">
                  {/* Stats Card */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
                    <Card className="border border-border rounded-xl overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          Statistics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-5">
                        {job.statistics ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <div className="text-2xl font-bold text-foreground">{job.statistics.total_candidates}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">Total Candidates</div>
                              </div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <div className="text-2xl font-bold text-foreground">{daysOpen}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">Days Open</div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs text-muted-foreground">Recommended</span>
                                <span className="text-sm font-semibold text-emerald-600">{job.statistics.recommended_count}</span>
                              </div>
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs text-muted-foreground">Under Review</span>
                                <span className="text-sm font-semibold text-amber-600">{job.statistics.under_review_count}</span>
                              </div>
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs text-muted-foreground">Not Recommended</span>
                                <span className="text-sm font-semibold text-red-500">{job.statistics.not_recommended_count}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <TrendingUp className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Statistics not available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* AI Attractiveness Score */}
                  {attractivenessScore && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
                      <Card className="border border-border rounded-xl overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            AI Score
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 pb-5">
                          <div className="flex flex-col items-center">
                            {/* Circular progress */}
                            <div className="relative w-24 h-24 mb-3">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/50" />
                                <circle
                                  cx="50" cy="50" r="42" fill="none"
                                  strokeWidth="8"
                                  strokeLinecap="round"
                                  className="text-amber-500"
                                  strokeDasharray={`${(attractivenessPercent || 0) * 2.64} 264`}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-bold text-foreground">
                                  {attractivenessPercent != null ? `${attractivenessPercent}%` : '--'}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {attractivenessScore.label || 'Attractiveness Score'}
                            </span>
                            {attractivenessScore.summary && (
                              <p className="text-[11px] text-muted-foreground text-center mt-2 leading-relaxed">{attractivenessScore.summary}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Locations with progress */}
                  {job.location_vacancies && job.location_vacancies.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.15 }}>
                      <Card className="border border-border rounded-xl overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary" />
                            Locations
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 pb-5">
                          <div className="space-y-3">
                            {(job.location_vacancies || []).map((lv) => {
                              const pct = lv.vacancies > 0 ? Math.round((lv.hired_count / lv.vacancies) * 100) : 0;
                              return (
                                <div key={lv.id}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-foreground">{lv.city}, {lv.country}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-muted-foreground">{lv.hired_count}/{lv.vacancies}</span>
                                      {lv.is_full && (
                                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 text-[10px] px-1.5 py-0">Full</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${lv.is_full ? 'bg-emerald-500' : 'bg-primary'}`}
                                      style={{ width: `${Math.min(100, pct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            <div className="pt-2 border-t border-border mt-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-foreground">Total</span>
                                <span className="font-bold text-foreground">
                                  {job.location_vacancies.reduce((s, l) => s + l.hired_count, 0)}/{job.location_vacancies.reduce((s, l) => s + l.vacancies, 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ====== SCREENING QUESTIONS TAB ====== */}
            <TabsContent value="screening">
              <div className="max-w-3xl">
                <Card className="border border-border rounded-xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-500" />
                          Screening Questions
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">Configure questions candidates must answer when applying</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateQuestions}
                          disabled={isGenerating}
                          className="h-8 text-xs gap-1.5"
                        >
                          {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          AI Generate
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowAddQuestion(true)}
                          className="h-8 text-xs gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Question
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-6">
                    {isScreeningLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : screeningQuestions.length === 0 ? (
                      <div className="text-center py-10">
                        <HelpCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-1">No screening questions yet</p>
                        <p className="text-xs text-muted-foreground">Add questions manually or use AI to generate them from the job description.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {screeningQuestions.map((q, idx) => (
                          <div key={q.id} className="group flex items-start gap-3 p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-all">
                            <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5 text-right shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground leading-relaxed">{q.question}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                  {q.question_type === 'yes_no' ? 'Yes/No' : q.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Text'}
                                </Badge>
                                {q.required && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">Required</Badge>
                                )}
                                {q.ai_generated && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                                    <Wand2 className="w-2.5 h-2.5 mr-0.5" />AI
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all"
                              onClick={() => handleDeleteScreeningQuestion(q.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline add question form */}
                    {showAddQuestion && (
                      <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30 space-y-3">
                        <Textarea
                          placeholder="Enter your screening question..."
                          value={newQuestion}
                          onChange={(e) => setNewQuestion(e.target.value)}
                          rows={2}
                          className="text-sm resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <Select value={newQuestionType} onValueChange={(v) => setNewQuestionType(v as any)}>
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="yes_no">Yes/No</SelectItem>
                              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                            </SelectContent>
                          </Select>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={newRequired}
                              onChange={(e) => setNewRequired(e.target.checked)}
                              className="rounded border-border"
                            />
                            Required
                          </label>
                          <div className="flex-1" />
                          <Button variant="ghost" size="sm" onClick={() => { setShowAddQuestion(false); setNewQuestion(''); }} className="h-8 text-xs">
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleAddScreeningQuestion}
                            disabled={!newQuestion.trim() || isSavingQuestion}
                            className="h-8 text-xs"
                          >
                            {isSavingQuestion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ====== AI INTERVIEWS TAB ====== */}
            <TabsContent value="ai-interviews">
              <div className="max-w-4xl">
                <AIInterviewsSection jobId={jobId!} />
              </div>
            </TabsContent>

            {/* ====== TEAM & COSTS TAB ====== */}
            <TabsContent value="team">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
                {/* Team Members */}
                <Card className="border border-border rounded-xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Team Members
                    </CardTitle>
                    <CardDescription className="text-xs">Manage team members for this job</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pb-5">
                    {isMembersLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : members.length === 0 ? (
                      <div className="text-center py-6">
                        <Users className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No team members yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {members.map((member: any) => (
                          <div
                            key={member.user_id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-[10px] capitalize font-normal">
                                {member.role}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => handleRemoveMember(member.user_id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add member form */}
                    <div className="pt-3 border-t border-border space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Add Member</p>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="User ID"
                          value={newMemberUserId}
                          onChange={(e) => setNewMemberUserId(e.target.value)}
                          className="h-8 text-sm flex-1"
                        />
                        <select
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value)}
                          className="h-8 text-xs border border-border rounded-md px-2 bg-background"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="interviewer">Interviewer</option>
                        </select>
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={handleAddMember}
                          disabled={!newMemberUserId.trim()}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Hiring Costs */}
                <HiringCostsSection jobId={jobId || ''} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <AddCandidateModal
          jobId={jobId || ''}
          isOpen={showAddCandidate}
          onClose={() => setShowAddCandidate(false)}
          onSuccess={() => {
            setShowAddCandidate(false);
            loadJobDetails();
          }}
        />

        <ImportCandidatesModal
          currentJobId={jobId || ''}
          isOpen={showImportCandidates}
          onClose={() => setShowImportCandidates(false)}
          onImport={handleImportCandidates}
        />

        {/* Post to Portals Dialog */}
        <Dialog open={showPortalDialog} onOpenChange={setShowPortalDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-emerald-600" />
                Post to Job Portals
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select the portals where you want to publish this job listing.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {isLoadingPortals ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading portals...</span>
                </div>
              ) : portals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No portals configured</p>
                  <p className="text-xs mt-1">Ask an admin to add job portals in Settings.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {portals.map((portal: any) => (
                    <label
                      key={portal.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        checked={selectedPortalIds.has(portal.id)}
                        onCheckedChange={() => togglePortalSelection(portal.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{portal.portal_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {portal.integration_type || 'api'} integration
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                        {portal.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <p className="text-[11px] text-muted-foreground mr-auto">
                Portal publishing coming soon
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowPortalDialog(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedPortalIds.size === 0}
                onClick={() => {
                  toast({
                    title: 'Coming Soon',
                    description: `Publishing to ${selectedPortalIds.size} portal(s) will be available in a future update.`,
                  });
                  setShowPortalDialog(false);
                }}
              >
                Post ({selectedPortalIds.size})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

        {/* Edit Job Dialog */}
        <Dialog open={showEditJob} onOpenChange={setShowEditJob}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Job</DialogTitle>
              <DialogDescription>Update job details and requirements</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Job Title</Label>
                <Input value={editForm.job_title || ''} onChange={e => setEditForm(f => ({ ...f, job_title: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Summary</Label>
                <Textarea value={editForm.summary || ''} onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Core Skills (comma-separated)</Label>
                  <Input value={editForm.core_skills || ''} onChange={e => setEditForm(f => ({ ...f, core_skills: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Preferred Skills (comma-separated)</Label>
                  <Input value={editForm.preferred_skills || ''} onChange={e => setEditForm(f => ({ ...f, preferred_skills: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Country</Label>
                  <Select value={editForm.country || ''} onValueChange={v => setEditForm(f => ({ ...f, country: v, city: '' }))}>
                    <SelectTrigger><SelectValue placeholder="Select country..." /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>City</Label>
                  <Select value={editForm.city || ''} onValueChange={v => setEditForm(f => ({ ...f, city: v }))} disabled={!editForm.country}>
                    <SelectTrigger><SelectValue placeholder={editForm.country ? 'Select city...' : 'Select country first'} /></SelectTrigger>
                    <SelectContent>
                      {getCitiesForCountry(editForm.country || '').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Job Type</Label>
                  <Select value={editForm.job_type || ''} onValueChange={v => setEditForm(f => ({ ...f, job_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Location Type</Label>
                  <Select value={editForm.location_type || ''} onValueChange={v => setEditForm(f => ({ ...f, location_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Vacancies</Label>
                  <Input type="number" min={1} value={editForm.number_of_vacancies || 1} onChange={e => setEditForm(f => ({ ...f, number_of_vacancies: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Salary Min</Label>
                  <Input type="number" value={editForm.salary_range_min || ''} onChange={e => setEditForm(f => ({ ...f, salary_range_min: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Salary Max</Label>
                  <Input type="number" value={editForm.salary_range_max || ''} onChange={e => setEditForm(f => ({ ...f, salary_range_max: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Select value={editForm.salary_currency || 'USD'} onValueChange={v => setEditForm(f => ({ ...f, salary_currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Experience Range</Label>
                  <Select value={editForm.experience_range || ''} onValueChange={v => setEditForm(f => ({ ...f, experience_range: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Position Type</Label>
                  <Select value={editForm.position_type || ''} onValueChange={v => setEditForm(f => ({ ...f, position_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditJob(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : 'Save Changes'}
              </Button>
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

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAIInterviewSessions(Number(jobId));
      setSessions(data);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, [jobId]);

  const handleCancel = async (sessionId: number) => {
    try {
      await apiClient.cancelAIInterview(sessionId);
      toast({ title: 'Cancelled', description: 'AI interview cancelled.' });
      fetchSessions();
    } catch {
      toast({ title: 'Error', description: 'Failed to cancel session.', variant: 'destructive' });
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      expired: 'bg-muted text-muted-foreground border-border',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    };
    return <Badge variant="outline" className={`text-[10px] font-normal ${styles[status] || ''}`}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <>
      <Card className="border border-border rounded-xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-500" />
                AI Interviews
              </CardTitle>
              <CardDescription className="text-xs mt-1">{sessions.length} session(s)</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowInviteModal(true)} className="h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Send AI Interview
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10">
              <Bot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No AI interviews sent yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{s.candidate_name || s.candidate_email || `Candidate #${s.candidate_id}`}</p>
                    <p className="text-xs text-muted-foreground">{s.interview_type} &middot; {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {s.overall_score != null && (
                      <span className="text-sm font-semibold text-foreground">{s.overall_score}</span>
                    )}
                    {statusBadge(s.status)}
                    {s.status === 'completed' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResultsSessionId(s.id)}>
                        Results
                      </Button>
                    )}
                    {s.status === 'pending' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => handleCancel(s.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AIInterviewResultsSheet
        sessionId={resultsSessionId}
        open={resultsSessionId !== null}
        onOpenChange={(open) => { if (!open) setResultsSessionId(null); }}
      />

      {showInviteModal && (
        <AIInterviewModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          jdId={Number(jobId)}
          onSent={() => { setShowInviteModal(false); fetchSessions(); }}
        />
      )}
    </>
  );
}

// ── Hiring Costs Section ─────────────────────────────────────────
const COST_TYPES = [
  { value: 'job_board', label: 'Job Board' },
  { value: 'agency', label: 'Agency' },
  { value: 'referral_bonus', label: 'Referral Bonus' },
  { value: 'interview', label: 'Interview' },
  { value: 'recruiter_hours', label: 'Recruiter Hours' },
  { value: 'advertising', label: 'Advertising' },
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

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getHiringCosts(jobId);
      setCosts(data || []);
    } catch {
      setCosts([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCosts(); }, [jobId]);

  const totalCost = costs.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.addHiringCost(jobId, {
        cost_type: costType,
        amount: amt,
        description: description.trim() || undefined,
      });
      toast({ title: 'Cost added', description: 'Hiring cost entry saved.' });
      setShowAddDialog(false);
      setCostType('job_board');
      setAmount('');
      setDescription('');
      fetchCosts();
    } catch {
      toast({ title: 'Error', description: 'Failed to save cost entry.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (costId: number) => {
    try {
      await apiClient.deleteHiringCost(costId);
      toast({ title: 'Deleted', description: 'Cost entry removed.' });
      fetchCosts();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete cost entry.', variant: 'destructive' });
    }
  };

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  const fmtType = (t: string) => COST_TYPES.find(ct => ct.value === t)?.label || t.replace(/_/g, ' ');

  return (
    <>
      <Card className="border border-border rounded-xl overflow-hidden">
        <CardHeader
          className="pb-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              Hiring Costs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                {fmtCurrency(totalCost)}
              </Badge>
              <svg
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <CardDescription className="text-xs">{costs.length} cost entry(ies)</CardDescription>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0 pb-5">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : costs.length === 0 ? (
              <div className="text-center py-6">
                <Receipt className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No costs recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {costs.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0 font-normal">
                          {fmtType(c.cost_type)}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {fmtCurrency(c.amount)}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{c.description}</p>
                      )}
                      {c.created_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={(e) => { e.stopPropagation(); setShowAddDialog(true); }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Cost
            </Button>
          </CardContent>
        )}
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Hiring Cost</DialogTitle>
            <DialogDescription className="text-xs">Record a cost entry for this job.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Cost Type</Label>
              <Select value={costType} onValueChange={setCostType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_TYPES.map(ct => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Amount (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Description (optional)</Label>
              <Input
                placeholder="e.g. LinkedIn Premium posting"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={saving || !amount}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Save Cost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

export default JobDetail;
