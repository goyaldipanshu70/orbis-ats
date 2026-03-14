import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, Brain, BarChart3, Target, Clock, MessageSquare,
  Mic, RefreshCw, CheckCircle, ArrowRight, Shield, Lightbulb,
  Trophy, Eye,
} from 'lucide-react';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Design tokens ─── */
const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ─── Score helpers ─── */
function getScoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#1B8EE5';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs Improvement';
}

/* ─── Circular Score Ring ─── */
function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-bold text-white"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {score}
        </motion.span>
        <span className="text-sm text-slate-400">/100</span>
      </div>
    </div>
  );
}

/* ─── Mini Progress Bar ─── */
function MiniProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 }}
      />
    </div>
  );
}

/* ─── Main Page Component ─── */
const AIAssessment = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // Toggle this to see both states
  const [hasAssessment] = useState(true);
  const mockScore = {
    overall: 85,
    communication: 88,
    technical: 82,
    problemSolving: 85,
    attempts: 1,
    maxAttempts: 3,
    lastTaken: '2026-03-12',
    label: 'Excellent',
  };

  const handleStartAssessment = () => {
    navigate('/ai-interview/demo-token');
  };

  const scoreBreakdown = [
    { label: 'Communication', value: mockScore.communication, color: '#1B8EE5' },
    { label: 'Technical Knowledge', value: mockScore.technical, color: '#a855f7' },
    { label: 'Problem Solving', value: mockScore.problemSolving, color: '#06b6d4' },
  ];

  const steps = [
    {
      num: 1,
      icon: Brain,
      title: 'Start Assessment',
      description: 'Begin a 20-minute AI-powered interview covering behavioral, technical, and coding questions.',
    },
    {
      num: 2,
      icon: BarChart3,
      title: 'Get Your Score',
      description: 'Receive detailed scores on communication, technical knowledge, and problem-solving ability.',
    },
    {
      num: 3,
      icon: Target,
      title: 'Get Matched',
      description: 'Your score helps hiring managers find you. Higher scores mean better job matches.',
    },
  ];

  const expectItems = [
    { icon: Clock, label: 'Duration', value: '~20 minutes' },
    { icon: MessageSquare, label: 'Questions', value: '8-10 questions' },
    { icon: Mic, label: 'Format', value: 'Voice + Text + Code' },
    { icon: RefreshCw, label: 'Attempts', value: 'Up to 3 retakes' },
  ];

  const tips = [
    'Find a quiet environment with good lighting',
    'Ensure your camera and microphone are working',
    'You can respond via voice or text',
    'For coding questions, explain your thought process',
    'Your best score from all attempts will be used',
  ];

  return (
    <CandidateLayout>
      <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden">
        {/* ─── Background decorative orbs ─── */}
        <motion.div
          className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(27,142,229,0.12), transparent)' }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 -right-40 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent)' }}
          animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(27,142,229,0.05), transparent)' }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* ─── Content ─── */}
        <motion.div
          className="relative z-10 max-w-4xl mx-auto"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* ── 1. Hero Section ── */}
          <motion.div variants={staggerItem} className="text-center mb-10">
            <motion.div
              className="inline-flex mb-6"
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.1 }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
                  boxShadow: '0 8px 32px rgba(27,142,229,0.35)',
                }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              AI Assessment
            </h1>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              Complete a 20-minute AI-powered assessment to unlock job matches and showcase your skills to hiring managers.
            </p>
          </motion.div>

          {/* ── 2. Score Card (if assessment taken) ── */}
          {hasAssessment && (
            <motion.div variants={staggerItem} className="mb-10">
              <div
                className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
                style={{
                  ...glassCard,
                  background: 'linear-gradient(135deg, rgba(27,142,229,0.06), var(--orbis-card))',
                }}
              >
                {/* Subtle gradient border glow */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(27,142,229,0.15), rgba(168,85,247,0.08), rgba(6,182,212,0.08))',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    WebkitMaskComposite: 'xor',
                    padding: '1px',
                    borderRadius: '1rem',
                  }}
                />

                <div className="relative z-10">
                  {/* Top row: badge + attempts */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(250,204,21,0.1)', color: '#fbbf24', border: '1px solid rgba(250,204,21,0.2)' }}
                      >
                        Best Score
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">
                      Attempt {mockScore.attempts} of {mockScore.maxAttempts}
                    </span>
                  </div>

                  {/* Center: Score Ring + Label */}
                  <div className="flex flex-col items-center mb-8">
                    <ScoreRing score={mockScore.overall} />
                    <motion.span
                      className="mt-3 text-lg font-semibold"
                      style={{ color: getScoreColor(mockScore.overall) }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                    >
                      {getScoreLabel(mockScore.overall)}
                    </motion.span>
                  </div>

                  {/* Score breakdown row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {scoreBreakdown.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl p-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-300">{item.label}</span>
                          <span className="text-sm font-semibold text-white">{item.value}/100</span>
                        </div>
                        <MiniProgressBar value={item.value} color={item.color} />
                      </div>
                    ))}
                  </div>

                  {/* Last taken + actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                    <span className="text-sm text-slate-500">
                      Last taken: {new Date(mockScore.lastTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-2 rounded-xl px-5 h-10 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/5 active:scale-[0.97]"
                        style={{ border: '1px solid var(--orbis-border)' }}
                        onClick={() => navigate('/ai-interview/demo-token')}
                      >
                        <Eye className="w-4 h-4" />
                        View Detailed Results
                      </button>
                      {mockScore.attempts < mockScore.maxAttempts && (
                        <button
                          className="flex items-center gap-2 rounded-xl px-5 h-10 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
                          style={{
                            background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
                            boxShadow: '0 4px 20px rgba(27,142,229,0.3)',
                          }}
                          onClick={handleStartAssessment}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retake Assessment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 3. How It Works (if no assessment) ── */}
          {!hasAssessment && (
            <motion.div variants={staggerItem} className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-6 text-center">How It Works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {steps.map((step) => (
                  <motion.div
                    key={step.num}
                    variants={fadeUp}
                    className="rounded-2xl p-6 text-center group transition-all duration-300 hover:scale-[1.02]"
                    style={glassCard}
                    whileHover={{ y: -4 }}
                  >
                    {/* Step number */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white mx-auto mb-4"
                      style={{
                        background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
                        boxShadow: '0 4px 16px rgba(27,142,229,0.25)',
                      }}
                    >
                      {step.num}
                    </div>
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(27,142,229,0.1)', border: '1px solid rgba(27,142,229,0.15)' }}
                    >
                      <step.icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── 4. Assessment Details Card ── */}
          <motion.div variants={staggerItem} className="mb-10">
            <div className="rounded-2xl p-6 sm:p-8" style={glassCard}>
              <div className="flex items-center gap-2.5 mb-6">
                <Lightbulb className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">What to Expect</h2>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {expectItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl p-4 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                      style={{ background: 'rgba(27,142,229,0.1)' }}
                    >
                      <item.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Tips list */}
              <div
                className="rounded-xl p-5"
                style={{ background: 'rgba(27,142,229,0.04)', border: '1px solid rgba(27,142,229,0.1)' }}
              >
                <p className="text-sm font-medium text-slate-300 mb-3">Tips for success:</p>
                <ul className="space-y-2.5">
                  {tips.map((tip) => (
                    <li key={tip} className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-400 leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>

          {/* ── 5. CTA Button ── */}
          <motion.div variants={staggerItem} className="text-center pb-12">
            {!hasAssessment && (
              <motion.button
                className="inline-flex items-center gap-2.5 rounded-2xl px-10 h-14 text-base font-semibold text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
                  boxShadow: '0 8px 32px rgba(27,142,229,0.35)',
                }}
                onClick={handleStartAssessment}
                whileHover={{ boxShadow: '0 12px 40px rgba(27,142,229,0.45)' }}
                whileTap={{ scale: 0.97 }}
              >
                <Sparkles className="w-5 h-5" />
                Start Assessment
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            )}

            {hasAssessment && mockScore.attempts < mockScore.maxAttempts && (
              <motion.button
                className="inline-flex items-center gap-2.5 rounded-2xl px-8 h-12 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/5 active:scale-[0.97]"
                style={{ border: '1px solid var(--orbis-border)' }}
                onClick={handleStartAssessment}
                whileHover={{ borderColor: 'rgba(27,142,229,0.4)' }}
              >
                <RefreshCw className="w-4 h-4" />
                Retake Assessment
              </motion.button>
            )}

            {hasAssessment && mockScore.attempts >= mockScore.maxAttempts && (
              <button
                className="inline-flex items-center gap-2.5 rounded-2xl px-8 h-12 text-sm font-medium text-slate-500 cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                disabled
              >
                <Shield className="w-4 h-4" />
                Maximum attempts reached
              </button>
            )}

            <p className="text-xs text-slate-500 mt-4">
              By starting, you agree to camera and microphone monitoring
            </p>
          </motion.div>
        </motion.div>
      </div>
    </CandidateLayout>
  );
};

export default AIAssessment;
