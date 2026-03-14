import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield,
  MessageSquare,
  Code,
  AlertTriangle,
  Eye,
  Copy,
  Monitor,
  Clock,
  Mic,
  FileWarning,
  Sparkles,
  Brain,
  Trophy,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AIInterviewResults, CheatingFlag } from '@/types/api';

interface InterviewResultsProps {
  results: AIInterviewResults;
  attemptsUsed?: number;
  maxAttempts?: number;
  onRetake?: () => void;
  onDashboard?: () => void;
}

/* ---------- helper badge configs ---------- */

function getRecBadge(rec: string | null) {
  switch (rec) {
    case 'Hire':
      return { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', label: 'Hire' };
    case 'Manual Review':
      return { bg: 'rgba(234,179,8,0.12)', color: '#facc15', label: 'Manual Review' };
    case 'Do Not Recommend':
      return { bg: 'rgba(239,68,68,0.12)', color: '#f87171', label: 'Do Not Recommend' };
    default:
      return { bg: 'var(--orbis-border)', color: '#94a3b8', label: rec || 'Pending' };
  }
}

function severityStyle(severity: string) {
  const map: Record<string, { bg: string; color: string }> = {
    low: { bg: 'rgba(234,179,8,0.12)', color: '#facc15' },
    medium: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
    high: { bg: 'rgba(249,115,22,0.12)', color: '#fb923c' },
    critical: { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
  };
  return map[severity] || map.medium;
}

function riskStyle(level?: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    low: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', label: 'Low Risk' },
    medium: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Medium Risk' },
    high: { bg: 'rgba(249,115,22,0.12)', color: '#fb923c', label: 'High Risk' },
    critical: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', label: 'Critical Risk' },
  };
  return map[level || 'low'] || map.low;
}

function trustStyle(score: number | null) {
  if (score === null) return { bg: 'var(--orbis-border)', color: '#94a3b8', label: 'N/A' };
  if (score >= 80) return { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', label: `${score}%` };
  if (score >= 60) return { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: `${score}%` };
  return { bg: 'rgba(239,68,68,0.12)', color: '#f87171', label: `${score}%` };
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#4ade80';
  if (score >= 70) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs Improvement';
}

/* ---------- sub-components ---------- */

function GlassBadge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color, border: `1px solid ${color}22` }}
    >
      {children}
    </span>
  );
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-white">{score}/{max}</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #1B8EE5, #a855f7)',
            boxShadow: '0 0 8px rgba(27,142,229,0.4)',
          }}
        />
      </div>
    </div>
  );
}

function GlassCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        background: 'var(--orbis-card)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--orbis-border)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CheatingFlagRow({ flag }: { flag: CheatingFlag }) {
  const labels: Record<string, string> = {
    tab_switching: 'Excessive Tab Switching',
    copy_paste: 'Copy/Paste Detected',
    multiple_faces: 'Multiple Faces Detected',
    long_silence: 'Extended Silence Periods',
    external_device: 'External Device Usage',
    code_plagiarism: 'Code Plagiarism Suspected',
    extended_absence: 'Extended Absence from Window',
  };

  const sev = severityStyle(flag.severity);

  return (
    <div
      className="flex items-center justify-between p-2.5 rounded-lg"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
    >
      <div className="flex items-center gap-2">
        <EventIcon type={flag.type} />
        <span className="text-sm font-medium text-white">{labels[flag.type] || flag.type.replace(/_/g, ' ')}</span>
        {flag.count != null && <span className="text-xs text-slate-500">({flag.count}x)</span>}
        {flag.duration_ms != null && <span className="text-xs text-slate-500">({(flag.duration_ms / 1000).toFixed(0)}s)</span>}
      </div>
      <GlassBadge bg={sev.bg} color={sev.color}>{flag.severity}</GlassBadge>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5 text-slate-500";
  switch (type) {
    case 'tab_away':
    case 'tab_return':
    case 'tab_switching':
    case 'window_blur':
    case 'window_focus':
      return <Eye className={cls} />;
    case 'copy_paste':
      return <Copy className={cls} />;
    case 'multiple_faces':
      return <Monitor className={cls} />;
    case 'long_silence':
      return <Mic className={cls} />;
    case 'external_device':
      return <Monitor className={cls} />;
    case 'code_plagiarism':
      return <FileWarning className={cls} />;
    case 'extended_absence':
      return <Clock className={cls} />;
    default:
      return <AlertTriangle className={cls} />;
  }
}

/* ---------- SVG Score Ring ---------- */

function ScoreRing({
  score,
  size,
  strokeWidth = 8,
  color,
  className = '',
}: {
  score: number;
  size: number;
  strokeWidth?: number;
  color: string;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width={size} height={size} className={className} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(148,163,184,0.15)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          filter: `drop-shadow(0 0 6px ${color}66)`,
        }}
      />
    </svg>
  );
}

/* ---------- Category Score Card ---------- */

function CategoryScoreCard({
  icon: Icon,
  label,
  score,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  score: number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <GlassCard className="p-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative">
            <ScoreRing score={score} size={64} strokeWidth={5} color={color} />
            <div
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="text-sm font-bold text-white">{Math.round(score)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4" style={{ color }} />
            <span className="text-sm font-medium text-slate-300">{label}</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, delay: delay + 0.2 }}
            />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ---------- Mini Stat Card ---------- */

function MiniStatCard({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-lg"
          style={{ background: `${iconColor}15` }}
        >
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 truncate">{label}</p>
          <p className="text-sm font-semibold text-white truncate">{value}</p>
        </div>
      </div>
    </GlassCard>
  );
}

/* ---------- main component ---------- */

export default function InterviewResults({
  results,
  attemptsUsed = 1,
  maxAttempts = 3,
  onRetake,
  onDashboard,
}: InterviewResultsProps) {
  const eval_ = results.evaluation || {};
  const scores = eval_.score_breakdown || {};
  const supplementary = eval_.supplementary_scores || {};
  const rec = getRecBadge(results.ai_recommendation);

  const duration = results.started_at && results.completed_at
    ? Math.round((new Date(results.completed_at).getTime() - new Date(results.started_at).getTime()) / 60000)
    : null;

  const overallScore = results.overall_score ?? 0;
  const scoreColor = getScoreColor(overallScore);
  const scoreLabel = getScoreLabel(overallScore);

  // Derived category scores (scaled to 100)
  const communicationScore = Math.round(((scores.communication_skills || 0) / 20) * 100);
  const technicalScore = Math.round(((scores.technical_competency || 0) / 25) * 100);
  const problemSolvingScore = Math.round(((scores.problem_solving || 0) / 15) * 100);

  // Questions count from transcript
  const aiMessages = results.transcript.filter(m => m.role === 'ai' && m.message_type === 'question');
  const candidateAnswers = results.transcript.filter(m => m.role === 'candidate');
  const questionsAsked = aiMessages.length || 0;
  const questionsAnswered = candidateAnswers.length || 0;

  // Coding challenge detection
  const hasCodingChallenge = results.transcript.some(m => m.code_content);

  // Integrity score
  const integrityScore = results.proctoring_score ?? 100;

  // Remaining retakes
  const remainingRetakes = Math.max(0, maxAttempts - attemptsUsed);
  const canRetake = remainingRetakes > 0;

  // Build strengths
  const strengths: string[] = [];
  if (eval_.strongest_competency) {
    strengths.push(`Strong in ${eval_.strongest_competency}`);
  }
  if (eval_.overall_impression) {
    const impressionLower = eval_.overall_impression.toLowerCase();
    if (
      impressionLower.includes('strong') ||
      impressionLower.includes('excellent') ||
      impressionLower.includes('good') ||
      impressionLower.includes('impressive') ||
      impressionLower.includes('well')
    ) {
      strengths.push(eval_.overall_impression);
    } else if (strengths.length === 0) {
      // If no clear positive keywords but it's the only signal, still show it
      strengths.push(eval_.overall_impression);
    }
  }
  if (communicationScore >= 80) strengths.push('Excellent communication skills');
  if (technicalScore >= 80) strengths.push('Strong technical competency');
  if (problemSolvingScore >= 80) strengths.push('Solid problem-solving ability');

  // Build improvement areas
  const improvements: string[] = [];
  if (eval_.area_for_development) {
    improvements.push(eval_.area_for_development);
  }
  if (eval_.red_flags && eval_.red_flags.length > 0) {
    eval_.red_flags.forEach((flag: string) => {
      improvements.push(flag);
    });
  }
  if (communicationScore < 50) improvements.push('Communication skills need strengthening');
  if (technicalScore < 50) improvements.push('Technical knowledge could be improved');
  if (problemSolvingScore < 50) improvements.push('Problem-solving approach needs work');

  return (
    <div className="space-y-6">
      {/* ========== 1. CELEBRATION HEADER ========== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <GlassCard
          style={{
            background: 'linear-gradient(135deg, rgba(27,142,229,0.1), rgba(168,85,247,0.08))',
            border: '1px solid rgba(27,142,229,0.2)',
          }}
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Left: text content */}
              <div className="flex-1 text-center sm:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                    <Sparkles className="h-5 w-5 text-amber-400" />
                    <h2 className="text-2xl font-bold text-white">Interview Complete!</h2>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    Great job! Here's how you did.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="flex flex-wrap items-center gap-3 justify-center sm:justify-start"
                >
                  <GlassBadge bg={rec.bg} color={rec.color}>{rec.label}</GlassBadge>
                  <GlassBadge bg="rgba(99,102,241,0.12)" color="#818cf8">
                    {results.interview_type} Interview
                  </GlassBadge>
                  <GlassBadge bg="rgba(148,163,184,0.1)" color="#94a3b8">
                    Attempt {attemptsUsed} of {maxAttempts}
                  </GlassBadge>
                  {canRetake && (
                    <button
                      onClick={onRetake}
                      className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                      style={{ color: '#1B8EE5' }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retake Available
                    </button>
                  )}
                </motion.div>

                {duration && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="text-xs text-slate-500 mt-3"
                  >
                    Completed in {duration} minutes
                  </motion.p>
                )}
              </div>

              {/* Right: score ring */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
                className="relative flex-shrink-0"
              >
                <div className="relative" style={{ width: 120, height: 120 }}>
                  <ScoreRing
                    score={overallScore}
                    size={120}
                    strokeWidth={10}
                    color={scoreColor}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white leading-none">
                      {results.overall_score ?? '\u2014'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">/ 100</span>
                  </div>
                </div>
                <p
                  className="text-center text-xs font-semibold mt-2"
                  style={{ color: scoreColor }}
                >
                  {scoreLabel}
                </p>
              </motion.div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ========== 2. SCORE BREAKDOWN - 3 Category Cards ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CategoryScoreCard
          icon={MessageSquare}
          label="Communication"
          score={communicationScore}
          color="#3b82f6"
          delay={0.5}
        />
        <CategoryScoreCard
          icon={Code}
          label="Technical Knowledge"
          score={technicalScore}
          color="#a855f7"
          delay={0.65}
        />
        <CategoryScoreCard
          icon={Brain}
          label="Problem Solving"
          score={problemSolvingScore}
          color="#06b6d4"
          delay={0.8}
        />
      </div>

      {/* ========== 3. STRENGTHS & AREAS FOR IMPROVEMENT ========== */}
      {(strengths.length > 0 || improvements.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {/* Strengths */}
          <GlassCard
            style={{
              border: '1px solid rgba(34,197,94,0.25)',
            }}
          >
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center justify-center h-7 w-7 rounded-lg"
                  style={{ background: 'rgba(34,197,94,0.12)' }}
                >
                  <Trophy className="h-3.5 w-3.5 text-green-400" />
                </div>
                <h3 className="text-sm font-semibold text-green-400">Strengths</h3>
              </div>
              {strengths.length > 0 ? (
                <ul className="space-y-2">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No specific strengths identified.</p>
              )}
            </div>
          </GlassCard>

          {/* Areas for Improvement */}
          <GlassCard
            style={{
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center justify-center h-7 w-7 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.12)' }}
                >
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-amber-400">Areas for Improvement</h3>
              </div>
              {improvements.length > 0 ? (
                <ul className="space-y-2">
                  {improvements.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No specific areas flagged for improvement.</p>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ========== 4. INTERVIEW SUMMARY STATS ========== */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.0 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <MiniStatCard
          icon={Clock}
          label="Duration"
          value={duration ? `${duration} min` : '\u2014'}
          iconColor="#8b5cf6"
        />
        <MiniStatCard
          icon={MessageSquare}
          label="Questions Answered"
          value={`${questionsAnswered} of ${questionsAsked || questionsAnswered}`}
          iconColor="#3b82f6"
        />
        <MiniStatCard
          icon={Code}
          label="Coding Challenge"
          value={hasCodingChallenge ? 'Completed' : 'N/A'}
          iconColor="#06b6d4"
        />
        <MiniStatCard
          icon={Shield}
          label="Integrity Score"
          value={`${integrityScore}%`}
          iconColor="#4ade80"
        />
      </motion.div>

      {/* ========== 5. TABS (Detailed Breakdown, Transcript, Proctoring) ========== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.1 }}
      >
        <Tabs defaultValue="scores">
          <TabsList>
            <TabsTrigger value="scores">Detailed Breakdown</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="proctoring">Proctoring</TabsTrigger>
          </TabsList>

          <TabsContent value="scores" className="space-y-4 mt-4">
            {/* Core scores */}
            <GlassCard>
              <div className="p-5">
                <h3 className="text-base font-semibold text-white mb-4">Score Breakdown</h3>
                <div className="space-y-3">
                  <ScoreBar label="Technical Competency" score={scores.technical_competency || 0} max={25} />
                  <ScoreBar label="Core Qualifications" score={scores.core_qualifications || 0} max={15} />
                  <ScoreBar label="Communication Skills" score={scores.communication_skills || 0} max={20} />
                  <ScoreBar label="Problem Solving" score={scores.problem_solving || 0} max={15} />
                  <ScoreBar label="Domain Knowledge" score={scores.domain_knowledge || 0} max={15} />
                  <ScoreBar label="Teamwork & Culture Fit" score={scores.teamwork_culture_fit || 0} max={10} />
                </div>
              </div>
            </GlassCard>

            {/* Supplementary */}
            {Object.keys(supplementary).length > 0 && (
              <GlassCard>
                <div className="p-5">
                  <h3 className="text-base font-semibold text-white mb-4">Supplementary Metrics</h3>
                  <div className="space-y-3">
                    <ScoreBar label="Answer Depth" score={supplementary.answer_depth || 0} max={10} />
                    <ScoreBar label="Resume Consistency" score={supplementary.consistency_with_resume || 0} max={10} />
                    <ScoreBar label="Verbal Communication" score={supplementary.verbal_communication || 0} max={10} />
                    <ScoreBar label="Adaptability" score={supplementary.adaptability || 0} max={10} />
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Qualitative */}
            <div className="grid grid-cols-2 gap-4">
              <GlassCard>
                <div className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Strongest Area</p>
                  <p className="font-medium text-white">{eval_.strongest_competency || '\u2014'}</p>
                </div>
              </GlassCard>
              <GlassCard>
                <div className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Area for Development</p>
                  <p className="font-medium text-white">{eval_.area_for_development || '\u2014'}</p>
                </div>
              </GlassCard>
            </div>

            {eval_.overall_impression && (
              <GlassCard>
                <div className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Overall Impression</p>
                  <p className="text-sm text-slate-300">{eval_.overall_impression}</p>
                </div>
              </GlassCard>
            )}

            {/* Red flags */}
            {eval_.red_flags?.length > 0 && (
              <GlassCard style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="p-5">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-red-400 mb-3">
                    <AlertTriangle className="h-4 w-4" /> Red Flags
                  </h3>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {eval_.red_flags.map((flag: string, i: number) => (
                      <li key={i} className="text-red-400">{flag}</li>
                    ))}
                  </ul>
                </div>
              </GlassCard>
            )}
          </TabsContent>

          <TabsContent value="transcript" className="mt-4">
            <GlassCard>
              <ScrollArea className="h-[500px]">
                <div className="p-4 space-y-4">
                  {results.transcript.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className="max-w-[80%] rounded-lg px-4 py-2"
                        style={
                          msg.role === 'ai'
                            ? { background: 'var(--orbis-input)', color: 'hsl(var(--foreground))' }
                            : { background: 'rgba(27,142,229,0.25)', color: 'hsl(var(--foreground))' }
                        }
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.role === 'ai' ? (
                            <MessageSquare className="h-3 w-3 text-slate-400" />
                          ) : null}
                          <span className="text-xs font-medium text-slate-300">
                            {msg.role === 'ai' ? 'AI Interviewer' : 'Candidate'}
                          </span>
                          <span
                            className="text-[10px] h-4 inline-flex items-center px-1.5 rounded"
                            style={{ background: 'var(--orbis-border)', color: '#94a3b8', border: '1px solid var(--orbis-hover)' }}
                          >
                            {msg.message_type}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap text-slate-200">{msg.content}</p>
                        {msg.code_content && (
                          <pre className="mt-2 p-2 rounded text-xs overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)' }}>
                            <code className="text-slate-300">{msg.code_content}</code>
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </GlassCard>
          </TabsContent>

          <TabsContent value="proctoring" className="space-y-4 mt-4">
            {/* Trust Score & Risk Level */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-white">
                    <Shield className="h-4 w-4 text-blue-400" /> Proctoring Report
                  </h3>
                  <div className="flex items-center gap-3">
                    {(() => { const t = trustStyle(results.proctoring_score); return <GlassBadge bg={t.bg} color={t.color}>{t.label}</GlassBadge>; })()}
                    {(() => { const r = riskStyle(results.risk_level); return <GlassBadge bg={r.bg} color={r.color}>{r.label}</GlassBadge>; })()}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-400">Trust Score</span>
                      <span className="font-medium text-white">{results.proctoring_score ?? '\u2014'}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${results.proctoring_score ?? 100}%`,
                          background: 'linear-gradient(90deg, #1B8EE5, #a855f7)',
                          boxShadow: '0 0 8px rgba(27,142,229,0.4)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div
                      className="flex items-center gap-2 p-3 rounded-lg"
                      style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                    >
                      <Eye className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-slate-500">Tab Switches</p>
                        <p className="text-sm font-semibold text-white">
                          {results.proctoring_events.filter(e => e.event_type === 'tab_away' || e.event_type === 'window_blur').length}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2 p-3 rounded-lg"
                      style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                    >
                      <Copy className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-xs text-slate-500">Copy/Paste</p>
                        <p className="text-sm font-semibold text-white">
                          {results.proctoring_events.filter(e => e.event_type === 'copy_paste').length}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2 p-3 rounded-lg"
                      style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                    >
                      <Monitor className="h-4 w-4 text-blue-400" />
                      <div>
                        <p className="text-xs text-slate-500">Total Events</p>
                        <p className="text-sm font-semibold text-white">{results.proctoring_events.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Cheating Flags */}
            {results.cheating_flags && results.cheating_flags.length > 0 && (
              <GlassCard style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="p-5">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-red-400 mb-3">
                    <AlertTriangle className="h-4 w-4" /> Flagged Anomalies
                  </h3>
                  <div className="space-y-2">
                    {results.cheating_flags.map((flag, i) => (
                      <CheatingFlagRow key={i} flag={flag} />
                    ))}
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Event Timeline */}
            <GlassCard>
              <div className="p-5">
                <h3 className="text-base font-semibold text-white mb-4">Event Timeline</h3>
                {results.proctoring_events.length === 0 ? (
                  <p className="text-sm text-slate-500">No suspicious activity detected.</p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    {results.proctoring_events.map((evt, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm py-1.5"
                        style={{ borderBottom: i < results.proctoring_events.length - 1 ? '1px solid var(--orbis-border)' : 'none' }}
                      >
                        <div className="flex items-center gap-2">
                          <EventIcon type={evt.event_type} />
                          <span className="text-slate-400 capitalize">{evt.event_type.replace(/_/g, ' ')}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {evt.duration_ms ? `${(evt.duration_ms / 1000).toFixed(1)}s` : ''}
                          {evt.timestamp && ` \u00b7 ${new Date(evt.timestamp).toLocaleTimeString()}`}
                        </span>
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ========== 6. RETAKE OPTION ========== */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
      >
        <GlassCard
          style={{
            background: 'linear-gradient(135deg, rgba(27,142,229,0.06), rgba(168,85,247,0.04))',
            border: '1px solid rgba(27,142,229,0.15)',
          }}
        >
          <div className="p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              {canRetake ? (
                <>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Want to improve your score?
                  </h3>
                  <p className="text-sm text-slate-400">
                    You have {remainingRetakes} retake{remainingRetakes !== 1 ? 's' : ''} available.
                    Your best score will be used.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-white mb-1">
                    All attempts used
                  </h3>
                  <p className="text-sm text-slate-400">
                    You've used all {maxAttempts} attempts. Your best score has been recorded.
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {canRetake && onRetake && (
                <button
                  onClick={onRetake}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: 'transparent',
                    color: '#1B8EE5',
                    border: '1px solid rgba(27,142,229,0.4)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(27,142,229,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake Interview
                </button>
              )}
              {onDashboard && (
                <button
                  onClick={onDashboard}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, #1B8EE5, #2563eb)',
                    boxShadow: '0 2px 8px rgba(27,142,229,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(27,142,229,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(27,142,229,0.3)';
                  }}
                >
                  Back to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
