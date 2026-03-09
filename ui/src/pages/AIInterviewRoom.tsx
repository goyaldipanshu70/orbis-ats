import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Send, Loader2, PhoneOff, Code, Brain,
  MessageSquare, CheckCircle, Mail, Timer, X,
  Shield, Sparkles, ChevronRight, Mic,
} from 'lucide-react';
import InterviewLobby from '@/components/ai-interview/InterviewLobby';
import VoiceControl from '@/components/ai-interview/VoiceControl';
import CodePanel from '@/components/ai-interview/CodePanel';
import ProctoringMonitor from '@/components/ai-interview/ProctoringMonitor';

import ThreeErrorBoundary from '@/components/ai-interview/three/ThreeErrorBoundary';
const AiAvatarOrb = lazy(() => import('@/components/ai-interview/three/AiAvatarOrb'));
const CelebrationScene = lazy(() => import('@/components/ai-interview/three/CelebrationScene'));

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

type InterviewState = 'loading' | 'lobby' | 'active' | 'completed' | 'error';

interface Message {
  role: 'ai' | 'candidate';
  content: string;
  messageType?: string;
  codeContent?: string;
}

interface SessionInfo {
  job_title: string;
  company?: string;
  interview_type: string;
  time_limit_minutes: number;
  max_questions: number;
  include_coding: boolean;
  coding_language?: string;
  status: string;
}

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

// Animated waveform bars for the AI avatar
function AiWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-6">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-300 ${
            active ? 'animate-waveform bg-blue-400' : 'bg-slate-600'
          }`}
          style={{
            height: active ? '16px' : '4px',
            animationDelay: `${i * 100}ms`,
            opacity: active ? 0.9 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// Progress dots for interview stages
function ProgressIndicator({ current, total }: { current: number; total: number }) {
  const segments = Math.min(total, 12);
  const filled = Math.min(current, segments);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i < filled
              ? 'w-4 bg-blue-500'
              : i === filled
                ? 'w-3 bg-blue-500/50'
                : 'w-1.5 bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

export default function AIInterviewRoom() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [state, setState] = useState<InterviewState>('loading');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [codeProblem, setCodeProblem] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentCaption, setCurrentCaption] = useState('');
  const [completionStats, setCompletionStats] = useState({ duration: 0, answered: 0, total: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Timer countdown
  useEffect(() => {
    if (state !== 'active' || timeRemaining <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { handleEndInterview(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state, timeRemaining > 0]);

  // Load session info
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/ai-interview/room/${token}`)
      .then(r => { if (!r.ok) throw new Error('Invalid interview link'); return r.json(); })
      .then(data => {
        setSessionInfo(data);
        setState(data.status === 'completed' ? 'completed' : 'lobby');
      })
      .catch(err => { setErrorMsg(err.message); setState('error'); });
  }, [token]);

  const handleStart = useCallback(async () => {
    if (!token) return;
    setIsStarting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/ai-interview/room/${token}/start`, { method: 'POST' });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.detail || 'Failed to start'); }
      const data = await resp.json();

      setMessages([
        { role: 'ai', content: data.opening_message, messageType: 'system' },
        { role: 'ai', content: data.first_question, messageType: 'question' },
      ]);
      setCurrentCaption(data.first_question);
      setTotalQuestions(data.total_questions || 10);
      setCurrentQuestion(1);
      setTimeRemaining((data.time_limit_minutes || 30) * 60);
      startTimeRef.current = Date.now();
      setState('active');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setIsStarting(false);
  }, [token, toast]);

  const sendMessage = useCallback(async (text: string) => {
    if (!token || !text.trim() || isProcessing) return;

    setMessages(prev => [...prev, { role: 'candidate', content: text }]);
    setTextInput('');
    setIsProcessing(true);

    try {
      const resp = await fetch(`${API_BASE}/api/ai-interview/room/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!resp.ok) throw new Error('Failed to get response');

      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.message, messageType: data.message_type }]);
      setCurrentCaption(data.message);

      if (data.current_question) setCurrentQuestion(data.current_question);

      if (data.code_prompt) {
        setCodeProblem(data.code_prompt.problem || '');
        setShowCodePanel(true);
      }

      if (data.is_complete) {
        setTimeout(() => handleEndInterview(), 3000);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process your answer. Please try again.', variant: 'destructive' });
    }
    setIsProcessing(false);
  }, [token, isProcessing, toast]);

  const handleCodeSubmit = useCallback(async (code: string, language: string) => {
    if (!token) return;
    setIsSubmittingCode(true);
    try {
      const resp = await fetch(`${API_BASE}/api/ai-interview/room/${token}/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      if (!resp.ok) throw new Error('Code evaluation failed');
      const result = await resp.json();

      setMessages(prev => [
        ...prev,
        { role: 'candidate', content: `[Submitted ${language} code]`, codeContent: code },
        { role: 'ai', content: result.feedback || 'Code evaluated.', messageType: 'follow_up' },
      ]);
      setShowCodePanel(false);
    } catch {
      toast({ title: 'Error', description: 'Code submission failed', variant: 'destructive' });
    }
    setIsSubmittingCode(false);
  }, [token, toast]);

  const handleEndInterview = useCallback(async () => {
    if (!token) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = Math.round((Date.now() - startTimeRef.current) / 60000);
    setCompletionStats({
      duration,
      answered: currentQuestion,
      total: totalQuestions,
    });

    try {
      await fetch(`${API_BASE}/api/ai-interview/room/${token}/end`, { method: 'POST' });
    } catch { /* best effort */ }
    setState('completed');
  }, [token, currentQuestion, totalQuestions]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = totalQuestions > 0 ? Math.round((currentQuestion / totalQuestions) * 100) : 0;

  // ── Loading ────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Brain className="h-7 w-7 text-white" />
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-blue-400 absolute -bottom-1 -right-1" />
          </div>
          <p className="text-slate-500 text-sm font-medium">Preparing your interview...</p>
        </motion.div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-slate-100">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          transition={{ duration: 0.5 }}
          className="text-center space-y-5 max-w-md mx-auto px-6"
        >
          <div className="mx-auto w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <X className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Interview Unavailable</h2>
          <p className="text-slate-400 leading-relaxed">{errorMsg || 'This interview link is invalid or has expired.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Lobby ──────────────────────────────────────────────────────

  if (state === 'lobby' && sessionInfo) {
    return <InterviewLobby sessionInfo={sessionInfo} onStart={handleStart} isStarting={isStarting} />;
  }

  // ── Completed ──────────────────────────────────────────────────

  if (state === 'completed') {
    const completionPct = completionStats.total > 0
      ? Math.round((completionStats.answered / completionStats.total) * 100)
      : 100;

    return (
      <div className="min-h-screen bg-[#0a0e1a] text-slate-100 flex flex-col overflow-auto" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0a0e1a 100%)' }}>
        {/* Ambient glow */}
        <div className="fixed top-1/4 left-1/3 w-[600px] h-[600px] bg-green-500/[0.04] rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-1/4 right-1/3 w-[500px] h-[500px] bg-blue-500/[0.04] rounded-full blur-[150px] pointer-events-none" />

        {/* Header */}
        <header className="w-full flex items-center justify-between px-8 lg:px-20 py-5 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Orbis AI</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="h-3.5 w-3.5" />
            <span>Secure Session</span>
          </div>
        </header>

        {/* Main content */}
        <motion.main
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="flex-1 flex flex-col items-center justify-center max-w-[880px] w-full mx-auto px-6 py-16 text-center"
        >
          {/* 3D Celebration Scene */}
          <motion.div variants={fadeIn} transition={{ duration: 0.6 }}>
            <ThreeErrorBoundary fallback={
              <div className="mb-10 relative">
                <div className="h-28 w-28 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-2 border-green-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.15)]">
                  <CheckCircle className="h-14 w-14 text-green-400" />
                </div>
                <div className="absolute -top-3 -right-3 h-3 w-3 bg-green-400 rounded-full opacity-50" />
                <div className="absolute top-14 -left-6 h-2 w-2 bg-blue-400 rounded-full opacity-40" />
              </div>
            }>
              <Suspense fallback={
                <div className="mb-10">
                  <div className="h-28 w-28 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-2 border-green-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.15)]">
                    <CheckCircle className="h-14 w-14 text-green-400" />
                  </div>
                </div>
              }>
                <CelebrationScene className="h-48 w-48 mb-6" />
              </Suspense>
            </ThreeErrorBoundary>
          </motion.div>

          <motion.h1 variants={fadeIn} transition={{ duration: 0.5 }} className="text-4xl md:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
            Interview Complete!
          </motion.h1>
          <motion.p variants={fadeIn} transition={{ duration: 0.5 }} className="text-slate-500 text-lg mb-14">
            Thank you for completing your interview with Aria
          </motion.p>

          {/* Summary card */}
          <motion.div variants={fadeIn} transition={{ duration: 0.5 }} className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 w-full mb-14 shadow-xl shadow-black/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Duration', value: `${completionStats.duration || '\u2014'} min`, color: 'text-white' },
                { label: 'Questions Answered', value: `${completionStats.answered} of ${completionStats.total}`, color: 'text-white' },
                { label: 'Completion', value: `${completionPct}%`, color: 'text-white' },
                { label: 'Status', value: 'Under Review', color: 'text-amber-400', dot: 'bg-amber-500' },
              ].map((stat, i) => (
                <div key={i} className={`flex flex-col items-center md:items-start gap-1.5 p-3 ${i > 0 ? 'md:border-l md:border-white/[0.06] md:pl-6' : ''}`}>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                  {stat.dot ? (
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stat.dot} animate-pulse`} />
                      <p className={`${stat.color} text-xl font-bold`}>{stat.value}</p>
                    </div>
                  ) : (
                    <p className={`${stat.color} text-2xl font-bold tabular-nums`}>{stat.value}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* What happens next */}
          <motion.div variants={fadeIn} transition={{ duration: 0.5 }} className="w-full">
            <div className="flex items-center justify-center gap-2 mb-8">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <h3 className="text-blue-400 text-xs font-bold tracking-[0.15em] uppercase">What happens next</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {[
                { icon: Brain, color: 'blue', text: 'Your responses are being analyzed by our AI' },
                { icon: Timer, color: 'emerald', text: 'The hiring team will review your results within 24-48 hours' },
                { icon: Mail, color: 'violet', text: 'You\'ll receive an email notification with updates' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeIn}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="group flex flex-col items-center p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300"
                >
                  <div className={`h-11 w-11 rounded-xl bg-${item.color}-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className={`h-5 w-5 text-${item.color}-400`} />
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div variants={fadeIn} transition={{ duration: 0.5 }} className="mt-16 flex flex-col items-center gap-6">
            <button
              onClick={() => window.close()}
              className="px-8 py-3 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/[0.04] transition-all text-sm"
            >
              Close Window
            </button>
            <footer className="text-slate-600 text-xs flex items-center gap-2">
              <span>Powered by Orbis AI</span>
              <span className="h-1 w-1 bg-slate-700 rounded-full" />
              <span>Secure Interview Session</span>
            </footer>
          </motion.div>
        </motion.main>
      </div>
    );
  }

  // ── Active Interview ────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[#0a0e1a] text-slate-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-6 py-3 border-b border-white/[0.04] backdrop-blur-2xl bg-[#0a0e1a]/80 shrink-0 z-50"
      >
        {/* Left: Brand + Job info */}
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-bold tracking-tight">Orbis AI Interview</span>
            {sessionInfo && (
              <span className="text-xs text-slate-500 font-medium">{sessionInfo.job_title}</span>
            )}
          </div>
        </div>

        {/* Center: Progress + Timer */}
        <div className="flex items-center gap-5">
          {/* Progress segment indicator */}
          <div className="hidden md:flex flex-col items-center gap-1.5">
            <ProgressIndicator current={currentQuestion} total={totalQuestions} />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              Question {currentQuestion} of {totalQuestions}
            </span>
          </div>

          {/* Mobile question badge */}
          <div className="flex md:hidden items-center gap-1.5 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            <span className="text-xs font-bold text-blue-400">{currentQuestion}/{totalQuestions}</span>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-white/[0.06] hidden md:block" />

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-300 ${
            timeRemaining < 300
              ? 'bg-red-500/10 border border-red-500/20'
              : 'bg-white/[0.03] border border-white/[0.06]'
          }`}>
            <Clock className={`h-3.5 w-3.5 ${timeRemaining < 300 ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
            <span className={`text-sm font-mono font-bold tabular-nums ${timeRemaining < 300 ? 'text-red-400' : 'text-slate-300'}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Integrity indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <Shield className="h-3.5 w-3.5 text-green-500" />
            <span className="font-medium">{integrityScore}%</span>
          </div>

          {/* End Interview button */}
          <button
            onClick={handleEndInterview}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-300 font-semibold text-sm"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="hidden sm:inline">End</span>
          </button>
        </div>
      </motion.header>

      {/* Main split content */}
      <main className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
        {/* Left Panel -- AI Interviewer */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`flex flex-col gap-4 overflow-hidden transition-all duration-500 ${showCodePanel ? 'w-[40%]' : 'w-[60%]'}`}
        >
          {/* AI Avatar + Caption area */}
          <div className="backdrop-blur-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] rounded-2xl p-8 flex flex-col items-center justify-center relative flex-1 min-h-0 overflow-hidden">
            {/* Subtle radial glow behind avatar */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-80 h-80 bg-blue-600/[0.04] rounded-full blur-[80px]" />
            </div>

            {/* 3D AI Avatar Orb */}
            <div className="relative z-10">
              <ThreeErrorBoundary fallback={
                <div className="relative mb-6">
                  <div className="h-44 w-44 rounded-full bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border-2 border-blue-600/20 flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(37,99,235,0.15)]">
                    <Brain className="h-20 w-20 text-blue-500/70" />
                  </div>
                  <div className="absolute -inset-6 rounded-full border border-blue-500/10 border-dashed animate-[spin_12s_linear_infinite]" />
                </div>
              }>
                <Suspense fallback={
                  <div className="relative mb-6">
                    <div className="h-44 w-44 rounded-full bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border-2 border-blue-600/20 flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(37,99,235,0.15)]">
                      <Brain className="h-20 w-20 text-blue-500/70" />
                    </div>
                  </div>
                }>
                  <AiAvatarOrb
                    isSpeaking={!isProcessing && messages.length > 0 && messages[messages.length - 1].role === 'ai'}
                    isThinking={isProcessing}
                    className="h-44 w-44 mb-6"
                  />
                </Suspense>
              </ThreeErrorBoundary>
            </div>

            {/* Name + waveform */}
            <div className="text-center mb-6 relative z-10">
              <h3 className="text-xl font-bold mb-1.5 tracking-tight">Aria</h3>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mb-2">AI Interviewer</p>
              <AiWaveform active={isProcessing} />
            </div>

            {/* Live caption - question card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCaption}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-xl relative z-10"
              >
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-6 py-4">
                  <p className="text-lg md:text-xl font-medium leading-relaxed text-slate-200 text-center">
                    {currentCaption ? `"${currentCaption}"` : '"Waiting for your response..."'}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Chat transcript */}
          <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/[0.06] rounded-2xl flex flex-col h-48 min-h-[192px]">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Transcript</span>
              </div>
              <span className="text-[10px] text-slate-600 font-medium">{messages.length} messages</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex gap-2.5 ${msg.role === 'candidate' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                      msg.role === 'ai'
                        ? 'bg-gradient-to-br from-blue-600/20 to-indigo-600/20 text-blue-400'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {msg.role === 'ai' ? <Brain className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">You</span>}
                    </div>
                    <div className={`rounded-xl px-3.5 py-2.5 max-w-[80%] ${
                      msg.role === 'ai'
                        ? 'bg-white/[0.04] border border-white/[0.04] rounded-tl-sm'
                        : 'bg-blue-600/15 border border-blue-600/10 rounded-tr-sm'
                    }`}>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.codeContent && (
                        <pre className="mt-2 p-2.5 bg-black/40 rounded-lg text-xs overflow-x-auto border border-white/[0.04]">
                          <code className="text-slate-300">{msg.codeContent}</code>
                        </pre>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2.5"
                >
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600/20 to-indigo-600/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Brain className="h-3.5 w-3.5" />
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.04] rounded-xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="font-medium">Aria is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>

        {/* Right Panel -- Candidate / Code */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`flex flex-col gap-4 overflow-hidden transition-all duration-500 ${showCodePanel ? 'w-[60%]' : 'w-[40%]'}`}
        >
          {showCodePanel ? (
            <div className="flex-1 rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0d1117]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-semibold text-slate-300">Code Editor</span>
                </div>
                <button
                  onClick={() => setShowCodePanel(false)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CodePanel
                language={sessionInfo?.coding_language || 'python'}
                problemDescription={codeProblem}
                onSubmit={handleCodeSubmit}
                isSubmitting={isSubmittingCode}
              />
            </div>
          ) : (
            <ProctoringMonitor
              sessionToken={token!}
              onIntegrityUpdate={setIntegrityScore}
              apiBase={API_BASE}
            />
          )}
        </motion.section>
      </main>

      {/* Bottom Action Bar */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="px-4 py-3 border-t border-white/[0.04] backdrop-blur-2xl bg-[#0a0e1a]/80 shrink-0"
      >
        {/* Progress bar */}
        <div className="max-w-5xl mx-auto mb-3">
          <div className="h-0.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {/* Code editor toggle */}
          {sessionInfo?.include_coding && (
            <button
              onClick={() => setShowCodePanel(!showCodePanel)}
              className={`flex flex-col items-center justify-center h-12 w-12 rounded-xl border transition-all duration-300 shrink-0 ${
                showCodePanel
                  ? 'bg-blue-600/15 border-blue-600/30 text-blue-400'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
              }`}
            >
              <Code className="h-4.5 w-4.5" />
              <span className="text-[9px] font-bold uppercase mt-0.5">Code</span>
            </button>
          )}

          {/* Text input */}
          <div className="flex-1 flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-2 focus-within:border-blue-600/30 focus-within:bg-white/[0.04] transition-all duration-300">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(textInput);
                }
              }}
              placeholder="Type your answer..."
              disabled={isProcessing}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-slate-200 placeholder:text-slate-600 font-medium text-sm"
            />
            <button
              onClick={() => sendMessage(textInput)}
              disabled={!textInput.trim() || isProcessing}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:scale-105 transition-all duration-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Voice control with large mic */}
          <VoiceControl
            onTranscript={sendMessage}
            disabled={isProcessing}
          />
        </div>
      </motion.footer>
    </div>
  );
}
