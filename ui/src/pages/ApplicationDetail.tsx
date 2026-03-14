import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '@/utils/api';
import CandidateLayout from '@/components/layout/CandidateLayout';
import StatusTimeline from '@/components/StatusTimeline';
import { toast } from 'sonner';
import {
  ArrowLeft, Briefcase, FileText, CheckCircle2, XCircle, Clock, Send,
  Eye, Star, AlertCircle, Loader2, ExternalLink, AlertTriangle,
  Download, Phone, Mail, Linkedin, Github, Globe, Upload, History,
  CalendarClock, ChevronRight, Sparkles, TrendingUp, BarChart3,
} from 'lucide-react';
import type { ResumeVersion } from '@/types/api';

const glassCard = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

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
          stroke="var(--orbis-border)"
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
          className="text-lg font-bold text-white"
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm text-slate-400">Loading application...</p>
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

  const statusColor = app.status === 'rejected' ? 'text-red-400' :
    app.status === 'withdrawn' ? 'text-slate-500' :
    app.status === 'hired' ? 'text-green-400' :
    app.status === 'offered' ? 'text-emerald-400' : 'text-blue-400';

  const statusBadge = app.status === 'submitted' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
    app.status === 'screening' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
    app.status === 'shortlisted' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
    app.status === 'interview' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
    app.status === 'offered' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
    app.status === 'hired' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
    app.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
    app.status === 'withdrawn' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' :
    'bg-blue-500/10 text-blue-400 border border-blue-500/20';

  return (
    <CandidateLayout>
      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Breadcrumb */}
        <motion.nav variants={cardVariants} className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <button
            onClick={() => navigate('/my-applications')}
            className="hover:text-white transition-colors"
          >
            My Applications
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-white font-medium truncate max-w-[300px]">{app.job_title}</span>
        </motion.nav>

        {/* Hero Header */}
        <motion.div
          variants={cardVariants}
          className="relative rounded-2xl p-8 mb-8 overflow-hidden"
          style={{
            ...glassCard,
            background: 'linear-gradient(135deg, var(--orbis-card), rgba(27,142,229,0.05))',
          }}
        >
          {/* Subtle background pattern */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-5">
              <motion.div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-blue-500/25"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Briefcase className="h-7 w-7" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{app.job_title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`${statusBadge} font-medium text-xs px-2.5 py-0.5 rounded-md inline-flex`}>
                    {(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}
                  </span>
                  <span className="text-sm text-slate-400">
                    Applied {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            {canWithdraw && (
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 rounded-lg transition-all shrink-0 hover:bg-red-500/10"
                style={{ background: 'var(--orbis-card)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                Withdraw
              </button>
            )}
          </div>
        </motion.div>

        {/* Application Progress */}
        <motion.div
          variants={cardVariants}
          className="rounded-2xl p-6 mb-8"
          style={glassCard}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Application Progress</h2>
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
              className="mt-5 p-4 rounded-xl"
              style={{ background: 'rgba(27,142,229,0.08)', border: '1px solid rgba(27,142,229,0.15)' }}
            >
              <p className="text-sm text-blue-300">{app.status_message}</p>
            </motion.div>
          )}

          {/* Estimated next step date */}
          {app.estimated_next_step_date && (
            <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-400">
              <CalendarClock className="h-4 w-4" />
              <span>
                Estimated next step:{' '}
                <span className="font-medium text-white">
                  {new Date(app.estimated_next_step_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </span>
            </div>
          )}

          {app.status === 'withdrawn' && (
            <div
              className="mt-5 flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              <AlertCircle className="h-5 w-5 text-slate-500 shrink-0" />
              <p className="text-sm font-medium text-slate-400">You withdrew this application.</p>
            </div>
          )}
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left column - Application Details (3/5) */}
          <motion.div className="lg:col-span-3 space-y-6" variants={containerVariants}>
            {/* Resume Card */}
            <motion.div variants={cardVariants} className="rounded-2xl overflow-hidden" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Resume</h2>
                </div>
                {app.resume_url ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--orbis-border)' }}>
                    {isPdf && (
                      <iframe
                        src={app.resume_url}
                        className="w-full h-[280px]"
                        style={{ borderBottom: '1px solid var(--orbis-border)' }}
                        title="Resume preview"
                      />
                    )}
                    <div className="flex items-center gap-3 p-3" style={{ background: 'var(--orbis-input)' }}>
                      <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400 flex-1 truncate font-mono">{app.resume_url.split('/').pop()}</span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={app.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 rounded-lg transition-colors hover:bg-white/5"
                          style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                        >
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                        <a
                          href={app.resume_url}
                          download
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 rounded-lg transition-colors hover:bg-white/5"
                          style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed"
                    style={{ borderColor: 'var(--orbis-border)', background: 'var(--orbis-subtle)' }}
                  >
                    <FileText className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">No resume uploaded</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Resume Versions */}
            <motion.div variants={cardVariants} className="rounded-2xl p-6" style={glassCard}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <History className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Resume Versions</h2>
                </div>
                <div>
                  <input
                    ref={resumeFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleResumeUpload}
                  />
                  <button
                    onClick={() => resumeFileRef.current?.click()}
                    disabled={uploadingResume}
                    className="flex items-center gap-1.5 h-8 px-3 text-xs text-slate-300 rounded-lg transition-colors hover:bg-white/5"
                    style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                  >
                    {uploadingResume ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Upload New
                  </button>
                </div>
              </div>

              {resumeVersions.length > 0 ? (
                <div className="space-y-2">
                  {resumeVersions.map(rv => (
                    <motion.div
                      key={rv.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                        rv.is_primary
                          ? 'hover:bg-blue-500/10'
                          : 'hover:bg-white/5'
                      }`}
                      style={{
                        background: rv.is_primary ? 'rgba(27,142,229,0.06)' : 'var(--orbis-subtle)',
                        border: rv.is_primary ? '1px solid rgba(27,142,229,0.2)' : '1px solid var(--orbis-border)',
                      }}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        rv.is_primary ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-slate-500'
                      }`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">Version {rv.version}</span>
                          {rv.is_primary && (
                            <span className="text-[10px] h-4 px-1.5 inline-flex items-center bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(rv.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <a
                          href={rv.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={rv.resume_url}
                          download
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed"
                  style={{ borderColor: 'var(--orbis-border)', background: 'var(--orbis-subtle)' }}
                >
                  <History className="h-6 w-6 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">No resume versions available</p>
                </div>
              )}
            </motion.div>

            {/* Contact & Links */}
            {links.length > 0 && (
              <motion.div variants={cardVariants} className="rounded-2xl p-6" style={glassCard}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Your Links</h2>
                </div>
                <div className="grid gap-2">
                  {links.map(link => (
                    <motion.div
                      key={link.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 hover:bg-white/5"
                      style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-border)' }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-white/5 text-slate-400">
                        <link.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">{link.label}</p>
                        {link.href ? (
                          <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 hover:underline truncate block transition-colors">
                            {link.label === 'Phone' ? link.value : link.value.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          <p className="text-sm text-white">{link.value}</p>
                        )}
                      </div>
                      {link.href && link.label !== 'Phone' && (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Cover Letter */}
            {app.cover_letter && (
              <motion.div variants={cardVariants} className="rounded-2xl p-6" style={glassCard}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Cover Letter</h2>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{app.cover_letter}</p>
              </motion.div>
            )}

            {/* Details */}
            <motion.div variants={cardVariants} className="rounded-2xl p-6" style={glassCard}>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 text-slate-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Details</h2>
              </div>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-400">Status</span>
                  <span className={`${statusBadge} font-medium text-xs capitalize px-2.5 py-0.5 rounded-md inline-flex`}>{app.status}</span>
                </div>
                <div className="h-px" style={{ background: 'var(--orbis-border)' }} />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-400">Applied</span>
                  <span className="text-sm font-medium text-white">{new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="h-px" style={{ background: 'var(--orbis-border)' }} />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-400">Last Updated</span>
                  <span className="text-sm font-medium text-white">{new Date(app.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right column - AI Assessment (2/5) */}
          <motion.div className="lg:col-span-2" variants={cardVariants}>
            {aiAnalysis ? (
              <div className="rounded-2xl overflow-hidden sticky top-24" style={glassCard}>
                {/* Header gradient strip */}
                <div className="h-1" style={{ background: 'linear-gradient(to right, #1B8EE5, #1676c0, #ec4899)' }} />

                <div className="p-6">
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-400" style={{ background: 'linear-gradient(135deg, rgba(27,142,229,0.1), rgba(22,118,192,0.1))' }}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider">AI Assessment</h2>
                  </div>

                  {/* Score ring + recommendation */}
                  <div
                    className="flex items-center gap-5 mb-6 p-4 rounded-xl"
                    style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                  >
                    <ScoreRing score={totalScore} />
                    <div>
                      <p className="text-sm font-semibold text-white">Match Score</p>
                      <p className="text-xs text-slate-500 mt-0.5 mb-2">Overall fit assessment</p>
                      {recommendation && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          recommendation.includes('Immediately') ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          recommendation === 'Interview' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          recommendation === 'Consider' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-white/5 text-slate-400 border border-white/10'
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
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Score Breakdown</p>
                    <div className="space-y-3.5">
                      {Object.entries(scores).filter(([k]) => k !== 'total_score').map(([key, val]: [string, any]) => {
                        const obtained = typeof val === 'object' ? val.obtained_score : val;
                        const max = typeof val === 'object' ? val.max_score : 10;
                        const pct = max > 0 ? Math.min(100, (obtained / max) * 100) : 0;
                        const barColor = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500';
                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="text-xs font-semibold text-white tabular-nums">{obtained}/{max}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-input)' }}>
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

                  <p className="text-[10px] text-slate-500 mt-6 pt-4" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                    Scores reflect how well your resume matches this role's requirements. Updated automatically when you upload a new resume version.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-6" style={glassCard}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-400" style={{ background: 'linear-gradient(135deg, rgba(27,142,229,0.1), rgba(22,118,192,0.1))' }}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">AI Assessment</h2>
                </div>
                <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                  </div>
                  <p className="text-sm font-medium">Analyzing your resume...</p>
                  <p className="text-xs text-slate-400">This usually takes a few moments</p>
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
