import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp, scaleIn } from '@/lib/animations';
import { apiClient } from '@/utils/api';
import CandidateLayout from '@/components/layout/CandidateLayout';
import StatusTimeline from '@/components/StatusTimeline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, Briefcase, FileText, CheckCircle2, XCircle, Clock, Send,
  Eye, Star, AlertCircle, Loader2, ExternalLink, AlertTriangle,
  Download, Phone, Mail, Linkedin, Github, Globe, Upload, History,
  CalendarClock, ChevronRight, Sparkles, TrendingUp, BarChart3,
} from 'lucide-react';
import type { ResumeVersion } from '@/types/api';

const STATUS_STEPS = [
  { key: 'submitted', label: 'Submitted', icon: Send },
  { key: 'screening', label: 'AI Screening', icon: Eye },
  { key: 'shortlisted', label: 'Shortlisted', icon: Star },
  { key: 'interview', label: 'Interview', icon: Clock },
  { key: 'offered', label: 'Offered', icon: CheckCircle2 },
  { key: 'hired', label: 'Hired', icon: CheckCircle2 },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const offset = circumference - (progress / 100) * circumference;
  const color = progress >= 75 ? '#22c55e' : progress >= 50 ? '#3b82f6' : progress >= 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/40"
          strokeWidth={5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="text-lg font-bold text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          {Math.round(score)}
        </motion.span>
      </div>
    </div>
  );
}

const ApplicationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeFileRef = useRef<HTMLInputElement>(null);

  const fetchResumeVersions = async (appId: number) => {
    try {
      const versions = await apiClient.getResumeVersions(appId);
      setResumeVersions(versions || []);
    } catch {
      setResumeVersions([]);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.getApplicationDetail(Number(id))
      .then(data => {
        setApp(data);
        fetchResumeVersions(Number(id));
      })
      .catch(() => navigate('/my-applications'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingResume(true);
    try {
      await apiClient.uploadResumeVersion(Number(id), file);
      toast.success('Resume uploaded successfully');
      fetchResumeVersions(Number(id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload resume');
    } finally {
      setUploadingResume(false);
      if (resumeFileRef.current) resumeFileRef.current.value = '';
    }
  };

  const handleWithdraw = async () => {
    if (!id) return;
    setWithdrawing(true);
    try {
      await apiClient.withdrawApplication(Number(id));
      toast.success('Application withdrawn');
      navigate('/my-applications');
    } catch (err: any) {
      toast.error(err.message || 'Failed to withdraw');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <CandidateLayout>
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Loading application...</p>
        </div>
      </CandidateLayout>
    );
  }

  if (!app) return null;

  const canWithdraw = ['submitted', 'screening'].includes(app.status);
  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === app.status);

  // AI analysis summary
  const aiAnalysis = app.ai_analysis;
  const scores = aiAnalysis?.category_scores || {};
  const totalScore = (() => {
    const raw = scores.total_score;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'object' && raw) return raw.obtained_score || 0;
    return 0;
  })();
  const recommendation = aiAnalysis?.ai_recommendation || '';

  const isPdf = app.resume_url && app.resume_url.toLowerCase().includes('.pdf');

  // Social links
  const links = [
    { icon: Phone, label: 'Phone', value: app.phone, href: app.phone ? `tel:${app.phone.replace(/\s/g, '')}` : null },
    { icon: Linkedin, label: 'LinkedIn', value: app.linkedin_url, href: app.linkedin_url },
    { icon: Github, label: 'GitHub', value: app.github_url, href: app.github_url },
    { icon: Globe, label: 'Portfolio', value: app.portfolio_url, href: app.portfolio_url },
  ].filter(l => l.value);

  const statusColor = app.status === 'rejected' ? 'text-red-600' :
    app.status === 'withdrawn' ? 'text-muted-foreground' :
    app.status === 'hired' ? 'text-green-600' :
    app.status === 'offered' ? 'text-emerald-600' : 'text-blue-600';

  const statusBg = app.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-700' :
    app.status === 'withdrawn' ? 'bg-muted border-border text-muted-foreground' :
    app.status === 'hired' ? 'bg-green-50 border-green-200 text-green-700' :
    app.status === 'offered' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    'bg-blue-50 border-blue-200 text-blue-700';

  return (
    <CandidateLayout>
      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Breadcrumb */}
        <motion.nav variants={cardVariants} className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <button
            onClick={() => navigate('/my-applications')}
            className="hover:text-foreground transition-colors"
          >
            My Applications
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[300px]">{app.job_title}</span>
        </motion.nav>

        {/* Hero Header */}
        <motion.div
          variants={cardVariants}
          className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card to-blue-50/30 dark:to-blue-950/10 p-8 mb-8 overflow-hidden"
        >
          {/* Subtle background pattern */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-5">
              <motion.div
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Briefcase className="h-7 w-7" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{app.job_title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={`${statusBg} border font-medium text-xs px-2.5 py-0.5`}>
                    {(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Applied {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            {canWithdraw && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 transition-all shrink-0"
              >
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <AlertTriangle className="h-4 w-4 mr-1.5" />}
                Withdraw
              </Button>
            )}
          </div>
        </motion.div>

        {/* Application Progress */}
        <motion.div
          variants={cardVariants}
          className="rounded-2xl border border-border bg-card p-6 mb-8"
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Application Progress</h2>
          </div>

          <StatusTimeline
            currentStatus={app.status}
            lastUpdated={app.updated_at}
            rejectionReason={app.status === 'rejected' ? 'Unfortunately, your application was not selected for this role.' : undefined}
          />

          {/* Status message */}
          {app.status_message && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-5 p-4 rounded-xl bg-blue-50/80 border border-blue-100"
            >
              <p className="text-sm text-blue-700">{app.status_message}</p>
            </motion.div>
          )}

          {/* Estimated next step date */}
          {app.estimated_next_step_date && (
            <div className="mt-4 flex items-center gap-2.5 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              <span>
                Estimated next step:{' '}
                <span className="font-medium text-foreground">
                  {new Date(app.estimated_next_step_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </span>
            </div>
          )}

          {app.status === 'withdrawn' && (
            <div className="mt-5 flex items-center gap-3 p-4 rounded-xl bg-muted/60 border border-border">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm font-medium text-muted-foreground">You withdrew this application.</p>
            </div>
          )}
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left column - Application Details (3/5) */}
          <motion.div className="lg:col-span-3 space-y-6" variants={containerVariants}>
            {/* Resume Card */}
            <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Resume</h2>
                </div>
                {app.resume_url ? (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {isPdf && (
                      <iframe
                        src={app.resume_url}
                        className="w-full h-[280px] border-b border-border"
                        title="Resume preview"
                      />
                    )}
                    <div className="flex items-center gap-3 p-3 bg-muted/50">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1 truncate font-mono">{app.resume_url.split('/').pop()}</span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs rounded-lg">
                          <a href={app.resume_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" /> View
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs rounded-lg">
                          <a href={app.resume_url} download>
                            <Download className="h-3 w-3 mr-1" /> Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border bg-muted/30">
                    <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No resume uploaded</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Resume Versions */}
            <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <History className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Resume Versions</h2>
                </div>
                <div>
                  <input
                    ref={resumeFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleResumeUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resumeFileRef.current?.click()}
                    disabled={uploadingResume}
                    className="h-8 text-xs rounded-lg"
                  >
                    {uploadingResume ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Upload New
                  </Button>
                </div>
              </div>

              {resumeVersions.length > 0 ? (
                <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="visible">
                  {resumeVersions.map(rv => (
                    <motion.div
                      key={rv.id}
                      variants={fadeInUp}
                      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 hover:shadow-sm ${
                        rv.is_primary
                          ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50/80'
                          : 'bg-muted/30 hover:bg-muted/60'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        rv.is_primary ? 'bg-blue-100 text-blue-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">Version {rv.version}</span>
                          {rv.is_primary && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-blue-300 text-blue-600 bg-blue-50">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(rv.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 rounded-lg">
                          <a href={rv.resume_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 rounded-lg">
                          <a href={rv.resume_url} download>
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-border bg-muted/20">
                  <History className="h-6 w-6 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No resume versions available</p>
                </div>
              )}
            </motion.div>

            {/* Contact & Links */}
            {links.length > 0 && (
              <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                    <Globe className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Your Links</h2>
                </div>
                <motion.div className="grid gap-2" variants={staggerContainer} initial="hidden" animate="visible">
                  {links.map(link => (
                    <motion.div
                      key={link.label}
                      variants={fadeInUp}
                      className="group flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 bg-muted/20 hover:bg-muted/50 hover:border-border transition-all duration-200"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                        <link.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">{link.label}</p>
                        {link.href ? (
                          <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate block transition-colors">
                            {link.label === 'Phone' ? link.value : link.value.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          <p className="text-sm text-foreground">{link.value}</p>
                        )}
                      </div>
                      {link.href && link.label !== 'Phone' && (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-foreground transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* Cover Letter */}
            {app.cover_letter && (
              <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Cover Letter</h2>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{app.cover_letter}</p>
              </motion.div>
            )}

            {/* Details */}
            <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Details</h2>
              </div>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={`${statusBg} border font-medium text-xs capitalize`}>{app.status}</Badge>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">Applied</span>
                  <span className="text-sm font-medium text-foreground">{new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-sm font-medium text-foreground">{new Date(app.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right column - AI Assessment (2/5) */}
          <motion.div className="lg:col-span-2" variants={cardVariants}>
            {aiAnalysis ? (
              <div className="rounded-2xl border border-border bg-card overflow-hidden sticky top-24">
                {/* Header gradient strip */}
                <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

                <div className="p-6">
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 text-blue-600">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">AI Assessment</h2>
                  </div>

                  {/* Score ring + recommendation */}
                  <div className="flex items-center gap-5 mb-6 p-4 rounded-xl bg-muted/30 border border-border/50">
                    <ScoreRing score={totalScore} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Match Score</p>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-2">Overall fit assessment</p>
                      {recommendation && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          recommendation.includes('Immediately') ? 'bg-green-100 text-green-700 border border-green-200' :
                          recommendation === 'Interview' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          recommendation === 'Consider' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {recommendation.includes('Immediately') && <CheckCircle2 className="h-3 w-3" />}
                          {recommendation === 'Interview' && <Eye className="h-3 w-3" />}
                          {recommendation === 'Consider' && <Clock className="h-3 w-3" />}
                          {recommendation}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score breakdown */}
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Score Breakdown</p>
                    <div className="space-y-3.5">
                      {Object.entries(scores).filter(([k]) => k !== 'total_score').map(([key, val]: [string, any]) => {
                        const obtained = typeof val === 'object' ? val.obtained_score : val;
                        const max = typeof val === 'object' ? val.max_score : 10;
                        const pct = max > 0 ? Math.min(100, (obtained / max) * 100) : 0;
                        const barColor = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500';
                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="text-xs font-semibold text-foreground tabular-nums">{obtained}/{max}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${barColor}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-6 pt-4 border-t border-border/50">
                    Scores reflect how well your resume matches this role's requirements. Updated automatically when you upload a new resume version.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 text-blue-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">AI Assessment</h2>
                </div>
                <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin" />
                  </div>
                  <p className="text-sm font-medium">Analyzing your resume...</p>
                  <p className="text-xs text-muted-foreground/70">This usually takes a few moments</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </CandidateLayout>
  );
};

export default ApplicationDetail;
