import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Send, Loader2, PhoneOff, Code, Brain,
  MessageSquare, CheckCircle, Mail, Timer, X,
  Shield, Sparkles, ChevronRight, Mic, MicOff,
  Volume2, VolumeX,
} from 'lucide-react';
import InterviewLobby from '@/components/ai-interview/InterviewLobby';
import CodePanel from '@/components/ai-interview/CodePanel';
import ProctoringMonitor from '@/components/ai-interview/ProctoringMonitor';

import ThreeErrorBoundary from '@/components/ai-interview/three/ThreeErrorBoundary';
const AiAvatarOrb = lazy(() => import('@/components/ai-interview/three/AiAvatarOrb'));
const CelebrationScene = lazy(() => import('@/components/ai-interview/three/CelebrationScene'));

/* ─── Design System ─── */

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

type InterviewState = 'loading' | 'lobby' | 'active' | 'completed' | 'error';

interface Message {
  role: 'ai' | 'candidate';
  content: string;
  messageType?: string;
  codeContent?: string;
  roundNumber?: number;
  roundType?: string;
}

interface RoundInfo {
  round_number: number;
  type: string;
  question_count: number;
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

// Round type display names and colors
const ROUND_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  screening: { label: 'Screening', color: '#34d399', icon: '🎯' },
  technical: { label: 'Technical', color: '#60a5fa', icon: '⚙️' },
  coding: { label: 'Coding', color: '#a78bfa', icon: '💻' },
  system_design: { label: 'System Design', color: '#f59e0b', icon: '🏗️' },
  behavioral: { label: 'Behavioral', color: '#f472b6', icon: '🤝' },
};

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
            active ? 'animate-waveform bg-blue-400' : ''
          }`}
          style={{
            height: active ? '16px' : '4px',
            animationDelay: `${i * 100}ms`,
            opacity: active ? 0.9 : 0.3,
            ...(!active ? { background: 'var(--orbis-border)' } : {}),
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
                : 'w-1.5'
          }`}
          style={i > filled ? { background: 'var(--orbis-border)' } : undefined}
        />
      ))}
    </div>
  );
}

// Round progress indicator
function RoundProgress({ rounds, currentRound }: { rounds: RoundInfo[]; currentRound: number }) {
  if (!rounds.length) return null;
  return (
    <div className="flex items-center gap-1 px-3">
      {rounds.map((r, i) => {
        const info = ROUND_LABELS[r.type] || { label: r.type, color: '#94a3b8', icon: '📋' };
        const isActive = r.round_number === currentRound;
        const isDone = r.round_number < currentRound;
        return (
          <div key={r.round_number} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className="w-4 h-0.5 rounded-full"
                style={{ background: isDone ? info.color : 'var(--orbis-border)' }}
              />
            )}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: isActive ? `${info.color}20` : isDone ? `${info.color}10` : 'transparent',
                color: isActive ? info.color : isDone ? `${info.color}99` : 'var(--orbis-muted)',
                border: isActive ? `1px solid ${info.color}40` : '1px solid transparent',
              }}
            >
              {isDone ? <CheckCircle className="h-3 w-3" /> : null}
              {info.label}
            </div>
          </div>
        );
      })}
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

  // Multi-round state
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentRoundType, setCurrentRoundType] = useState<string>('');
  const [difficultyLevel, setDifficultyLevel] = useState<string>('medium');

  // ── Voice engine state ──
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const recognitionRef = useRef<any>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const lastSpokenMsgRef = useRef<number>(-1);
  const voiceEnabledRef = useRef(true);
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const isMountedRef = useRef(true);
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEndRef = useRef<() => void>(() => {});
  const isProcessingRef = useRef(false);
  const ttsWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with state
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Start webcam
  useEffect(() => {
    if (state !== 'active') return;
    let stopped = false;
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    })
      .then(stream => {
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        activeStream = stream;
        if (webcamRef.current) webcamRef.current.srcObject = stream;
      })
      .catch(() => {});
    return () => {
      stopped = true;
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    };
  }, [state]);

  // ── TTS: Speak AI message ──
  const speakText = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current || !voiceEnabledRef.current) { onEnd?.(); return; }
    synthRef.current.cancel();
    if (ttsWatchdogRef.current) clearTimeout(ttsWatchdogRef.current);

    const utterance = new SpeechSynthesisUtterance(text);
    // Pick a natural English voice
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google') && v.name.includes('Female'))
      || voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
      || voices.find(v => v.lang.startsWith('en') && !v.localService)
      || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    let ended = false;
    const handleEnd = () => {
      if (ended) return;
      ended = true;
      if (ttsWatchdogRef.current) clearTimeout(ttsWatchdogRef.current);
      setIsAiSpeaking(false);
      onEnd?.();
    };

    utterance.onstart = () => {
      setIsAiSpeaking(true);
      // Watchdog: force end if onend never fires (Chrome TTS bug)
      const maxDuration = Math.max(15000, text.length * 80); // ~80ms per char
      ttsWatchdogRef.current = setTimeout(handleEnd, maxDuration);
    };
    utterance.onend = handleEnd;
    utterance.onerror = handleEnd;
    synthRef.current.speak(utterance);
  }, []);

  // ── STT: Start listening ──
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { recognition.stop(); }, 2500); // auto-stop after 2.5s silence
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) { finalTranscript += t + ' '; } else { interim += t; }
      }
      setInterimTranscript(interim || finalTranscript);
      resetSilenceTimer();
    };

    recognition.onerror = () => { if (isMountedRef.current) { setIsListening(false); setInterimTranscript(''); } };
    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (!isMountedRef.current) return;
      setIsListening(false);
      const text = finalTranscript.trim();
      setInterimTranscript('');
      if (text) {
        // If still processing previous message, wait until ready then send
        if (isProcessingRef.current) {
          const waitAndSend = () => {
            if (!isProcessingRef.current) {
              sendMessageRef.current(text);
            } else {
              setTimeout(waitAndSend, 200);
            }
          };
          setTimeout(waitAndSend, 200);
        } else {
          sendMessageRef.current(text);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    resetSilenceTimer();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
  }, []);

  // ── Auto-speak new AI messages and auto-listen after ──
  useEffect(() => {
    if (state !== 'active' || messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg.role !== 'ai' || lastSpokenMsgRef.current >= lastIdx) return;
    lastSpokenMsgRef.current = lastIdx;
    setCurrentCaption(lastMsg.content);

    if (voiceEnabledRef.current) {
      speakText(lastMsg.content, () => {
        // Auto-start listening after AI finishes speaking — use ref for current value
        if (state === 'active' && !isProcessingRef.current) {
          setTimeout(() => startListening(), 400);
        }
      });
    } else {
      // Voice disabled — still auto-listen if not processing
      if (!isProcessingRef.current) {
        setTimeout(() => startListening(), 400);
      }
    }
  }, [messages, state, speakText, startListening]);

  // Cleanup voice + timers on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      synthRef.current?.cancel();
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (ttsWatchdogRef.current) clearTimeout(ttsWatchdogRef.current);
    };
  }, []);

  // Cancel speech/recognition when leaving active state
  useEffect(() => {
    if (state !== 'active') {
      synthRef.current?.cancel();
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
    }
  }, [state]);

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
        if (prev <= 1) { handleEndRef.current(); return 0; }
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
        { role: 'ai', content: data.first_question, messageType: 'question', roundNumber: 1, roundType: data.current_round_type },
      ]);
      setCurrentCaption(data.first_question);
      setTotalQuestions(data.total_questions || 10);
      setCurrentQuestion(1);
      setTimeRemaining((data.time_limit_minutes || 30) * 60);
      startTimeRef.current = Date.now();

      // Multi-round state
      if (data.rounds) setRounds(data.rounds);
      if (data.current_round) setCurrentRound(data.current_round);
      if (data.current_round_type) setCurrentRoundType(data.current_round_type);

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

      // Handle round advancement — insert a transition message before the next question
      if (data.advance_round && data.current_round_type) {
        const roundLabel = ROUND_LABELS[data.current_round_type]?.label || data.current_round_type;
        setMessages(prev => [...prev, {
          role: 'ai',
          content: `Moving on to Round ${data.current_round}: ${roundLabel}`,
          messageType: 'round_transition',
          roundNumber: data.current_round,
          roundType: data.current_round_type,
        }]);
      }

      setMessages(prev => [...prev, {
        role: 'ai',
        content: data.message,
        messageType: data.message_type,
        roundNumber: data.current_round || currentRound,
        roundType: data.current_round_type || currentRoundType,
      }]);
      setCurrentCaption(data.message);

      if (data.current_question) setCurrentQuestion(data.current_question);
      if (data.current_round) setCurrentRound(data.current_round);
      if (data.current_round_type) setCurrentRoundType(data.current_round_type);
      if (data.difficulty_level) setDifficultyLevel(data.difficulty_level);

      if (data.code_prompt) {
        setCodeProblem(data.code_prompt.problem || '');
        setShowCodePanel(true);
      }

      if (data.is_complete) {
        endTimeoutRef.current = setTimeout(() => { if (isMountedRef.current) handleEndInterview(); }, 3000);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process your answer. Please try again.', variant: 'destructive' });
    }
    setIsProcessing(false);
  }, [token, isProcessing, toast, currentRound, currentRoundType]);

  // Keep ref in sync for use in speech recognition callback
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

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
    // Stop voice engine
    synthRef.current?.cancel();
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
    setIsAiSpeaking(false);
    setIsListening(false);

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

  // Keep handleEndRef in sync to avoid stale closures in timer
  useEffect(() => { handleEndRef.current = handleEndInterview; }, [handleEndInterview]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = totalQuestions > 0 ? Math.round((currentQuestion / totalQuestions) * 100) : 0;

  // -- Loading ----

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--orbis-page)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              <Brain className="h-7 w-7 text-white" />
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-blue-400 absolute -bottom-1 -right-1" />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--orbis-text-muted)' }}>Preparing your interview...</p>
        </motion.div>
      </div>
    );
  }

  // -- Error ----

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--orbis-page)', color: 'var(--orbis-text)' }}>
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
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--orbis-heading)' }}>Interview Unavailable</h2>
          <p className="leading-relaxed" style={{ color: 'var(--orbis-text-muted)' }}>{errorMsg || 'This interview link is invalid or has expired.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
            style={{ ...glassCard, color: 'var(--orbis-text)' }}
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  // -- Lobby ----

  if (state === 'lobby' && sessionInfo) {
    return <InterviewLobby sessionInfo={sessionInfo} onStart={handleStart} isStarting={isStarting} />;
  }

  // -- Completed ----

  if (state === 'completed') {
    const completionPct = completionStats.total > 0
      ? Math.round((completionStats.answered / completionStats.total) * 100)
      : 100;

    return (
      <div className="min-h-screen flex flex-col overflow-auto" style={{ background: 'var(--orbis-page)', color: 'var(--orbis-text)' }}>
        {/* Ambient glow */}
        <div className="fixed top-1/4 left-1/3 w-[600px] h-[600px] bg-green-500/[0.04] rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-1/4 right-1/3 w-[500px] h-[500px] bg-blue-500/[0.04] rounded-full blur-[150px] pointer-events-none" />

        {/* Header */}
        <header className="w-full flex items-center justify-between px-8 lg:px-20 py-5" style={{ borderBottom: '1px solid var(--orbis-grid)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--orbis-heading)' }}>Orbis AI</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--orbis-text-muted)' }}>
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

          <motion.h1 variants={fadeIn} transition={{ duration: 0.5 }} className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ color: 'var(--orbis-heading)' }}>
            Interview Complete!
          </motion.h1>
          <motion.p variants={fadeIn} transition={{ duration: 0.5 }} className="text-lg mb-14" style={{ color: 'var(--orbis-text-muted)' }}>
            Thank you for completing your interview with Aria
          </motion.p>

          {/* Summary card */}
          <motion.div variants={fadeIn} transition={{ duration: 0.5 }} className="rounded-2xl p-8 w-full mb-14 shadow-xl shadow-black/20" style={glassCard}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Duration', value: `${completionStats.duration || '\u2014'} min`, colorVar: 'var(--orbis-heading)' },
                { label: 'Questions Answered', value: `${completionStats.answered} of ${completionStats.total}`, colorVar: 'var(--orbis-heading)' },
                { label: 'Completion', value: `${completionPct}%`, colorVar: 'var(--orbis-heading)' },
                { label: 'Status', value: 'Under Review', color: 'text-amber-400', colorVar: undefined, dot: 'bg-amber-500' },
              ].map((stat, i) => (
                <div key={i} className={`flex flex-col items-center md:items-start gap-1.5 p-3 ${i > 0 ? 'md:border-l md:pl-6' : ''}`} style={i > 0 ? { borderLeftColor: 'var(--orbis-border)' } : undefined}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--orbis-text-muted)' }}>{stat.label}</p>
                  {stat.dot ? (
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stat.dot} animate-pulse`} />
                      <p className={`${stat.color || ''} text-xl font-bold`} style={stat.colorVar ? { color: stat.colorVar } : undefined}>{stat.value}</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold tabular-nums" style={stat.colorVar ? { color: stat.colorVar } : undefined}>{stat.value}</p>
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
                { icon: Brain, color: 'purple', text: 'Your responses are being analyzed by our AI' },
                { icon: Timer, color: 'emerald', text: 'The hiring team will review your results within 24-48 hours' },
                { icon: Mail, color: 'violet', text: 'You\'ll receive an email notification with updates' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeIn}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="group flex flex-col items-center p-6 rounded-2xl hover:bg-white/[0.04] transition-all duration-300"
                  style={glassCard}
                >
                  <div className={`h-11 w-11 rounded-xl bg-${item.color}-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className={`h-5 w-5 text-${item.color}-400`} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--orbis-text-muted)' }}>{item.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div variants={fadeIn} transition={{ duration: 0.5 }} className="mt-16 flex flex-col items-center gap-6">
            <button
              onClick={() => {
                // window.close() only works on JS-opened windows; fall back to navigation
                try { window.close(); } catch {}
                // If still open after 200ms, redirect to careers or home
                setTimeout(() => { window.location.href = '/careers'; }, 200);
              }}
              className="px-8 py-3 rounded-xl font-semibold hover:bg-white/[0.04] transition-all text-sm"
              style={{ ...glassCard, color: 'var(--orbis-heading)' }}
            >
              Close Window
            </button>
            <footer className="text-xs flex items-center gap-2" style={{ color: 'var(--orbis-text-muted)' }}>
              <span>Powered by Orbis AI</span>
              <span className="h-1 w-1 rounded-full" style={{ background: 'var(--orbis-border)' }} />
              <span>Secure Interview Session</span>
            </footer>
          </motion.div>
        </motion.main>
      </div>
    );
  }

  // -- Active Interview ----

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--orbis-page)', color: 'var(--orbis-text)' }}>
      {/* Top Navigation Bar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-6 py-3 backdrop-blur-2xl shrink-0 z-50"
        style={{ background: 'color-mix(in srgb, var(--orbis-page) 80%, transparent)', borderBottom: '1px solid var(--orbis-grid)' }}
      >
        {/* Left: Brand + Job info */}
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--orbis-heading)' }}>Orbis AI Interview</span>
            {sessionInfo && (
              <span className="text-xs font-medium" style={{ color: 'var(--orbis-text-muted)' }}>{sessionInfo.job_title}</span>
            )}
          </div>
        </div>

        {/* Center: Rounds + Progress + Timer */}
        <div className="flex items-center gap-5">
          {/* Round progress indicator */}
          {rounds.length > 0 && (
            <div className="hidden lg:block">
              <RoundProgress rounds={rounds} currentRound={currentRound} />
            </div>
          )}

          {/* Progress segment indicator */}
          <div className="hidden md:flex flex-col items-center gap-1.5">
            <ProgressIndicator current={currentQuestion} total={totalQuestions} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--orbis-text-muted)' }}>
              Question {currentQuestion} of {totalQuestions}
            </span>
          </div>

          {/* Mobile question badge */}
          <div className="flex md:hidden items-center gap-1.5 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            <span className="text-xs font-bold text-blue-400">{currentQuestion}/{totalQuestions}</span>
          </div>

          {/* Difficulty badge */}
          {difficultyLevel && (
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: difficultyLevel === 'expert' ? 'rgba(239,68,68,0.1)' : difficultyLevel === 'hard' ? 'rgba(245,158,11,0.1)' : difficultyLevel === 'easy' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                color: difficultyLevel === 'expert' ? '#f87171' : difficultyLevel === 'hard' ? '#fbbf24' : difficultyLevel === 'easy' ? '#34d399' : '#60a5fa',
                border: `1px solid ${difficultyLevel === 'expert' ? 'rgba(239,68,68,0.2)' : difficultyLevel === 'hard' ? 'rgba(245,158,11,0.2)' : difficultyLevel === 'easy' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'}`,
              }}
            >
              {difficultyLevel}
            </div>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-white/[0.06] hidden md:block" />

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-300`} style={
            timeRemaining < 300
              ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }
              : glassCard
          }>
            <Clock className={`h-3.5 w-3.5 ${timeRemaining < 300 ? 'text-red-400 animate-pulse' : ''}`} style={timeRemaining >= 300 ? { color: 'var(--orbis-text-muted)' } : undefined} />
            <span className={`text-sm font-mono font-bold tabular-nums ${timeRemaining < 300 ? 'text-red-400' : ''}`} style={timeRemaining >= 300 ? { color: 'var(--orbis-text)' } : undefined}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Integrity indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs" style={{ color: 'var(--orbis-text-muted)' }}>
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
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center relative flex-1 min-h-0 overflow-hidden" style={{ ...glassCard, background: 'linear-gradient(to bottom, var(--orbis-card), transparent)' }}>
            {/* Subtle radial glow behind avatar */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-80 h-80 bg-blue-600/[0.04] rounded-full blur-[80px]" />
            </div>

            {/* 3D AI Avatar Orb */}
            <div className="relative z-10">
              <ThreeErrorBoundary fallback={
                <div className="relative mb-6">
                  <div className="h-44 w-44 rounded-full bg-gradient-to-br from-blue-600/10 to-blue-600/5 border-2 border-blue-600/20 flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(27,142,229,0.15)]">
                    <Brain className="h-20 w-20 text-blue-500/70" />
                  </div>
                  <div className="absolute -inset-6 rounded-full border border-blue-500/10 border-dashed animate-[spin_12s_linear_infinite]" />
                </div>
              }>
                <Suspense fallback={
                  <div className="relative mb-6">
                    <div className="h-44 w-44 rounded-full bg-gradient-to-br from-blue-600/10 to-blue-600/5 border-2 border-blue-600/20 flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(27,142,229,0.15)]">
                      <Brain className="h-20 w-20 text-blue-500/70" />
                    </div>
                  </div>
                }>
                  <AiAvatarOrb
                    isSpeaking={isAiSpeaking}
                    isThinking={isProcessing}
                    className="h-44 w-44 mb-6"
                  />
                </Suspense>
              </ThreeErrorBoundary>
            </div>

            {/* Name + waveform */}
            <div className="text-center mb-6 relative z-10">
              <h3 className="text-xl font-bold mb-1.5 tracking-tight" style={{ color: 'var(--orbis-heading)' }}>Aria</h3>
              <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--orbis-text-muted)' }}>AI Interviewer</p>
              <AiWaveform active={isAiSpeaking || isProcessing} />
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
                <div className="rounded-xl px-6 py-4" style={glassCard}>
                  <p className="text-lg md:text-xl font-medium leading-relaxed text-center" style={{ color: 'var(--orbis-text)' }}>
                    {isListening && interimTranscript
                      ? interimTranscript
                      : currentCaption
                        ? `"${currentCaption}"`
                        : '"Waiting for your response..."'
                    }
                  </p>
                  {isListening && (
                    <p className="text-xs text-green-400 text-center mt-2 flex items-center justify-center gap-1.5">
                      <Mic className="h-3 w-3" />
                      Listening — speak your answer
                    </p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Chat transcript (collapsible) */}
          <div className={`rounded-2xl flex flex-col transition-all duration-300 overflow-hidden ${showTranscript ? 'h-48 min-h-[192px]' : 'h-0 min-h-0 border-0'}`} style={showTranscript ? { ...glassCard, background: 'var(--orbis-subtle)' } : {}}>
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--orbis-grid)' }}>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--orbis-text-muted)' }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--orbis-text-muted)' }}>Transcript</span>
              </div>
              <span className="text-[10px] font-medium" style={{ color: 'var(--orbis-text-muted)' }}>{messages.length} messages</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  // Round transition messages render as a centered divider
                  if (msg.messageType === 'round_transition') {
                    const roundInfo = ROUND_LABELS[msg.roundType || ''] || { label: msg.roundType, color: '#94a3b8' };
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="flex-1 h-px" style={{ background: `${roundInfo.color}30` }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: `${roundInfo.color}15`, color: roundInfo.color, border: `1px solid ${roundInfo.color}25` }}>
                          {msg.content}
                        </span>
                        <div className="flex-1 h-px" style={{ background: `${roundInfo.color}30` }} />
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex gap-2.5 ${msg.role === 'candidate' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        msg.role === 'ai'
                          ? 'bg-gradient-to-br from-blue-600/20 to-blue-600/20 text-blue-400'
                          : 'bg-slate-500/10'
                      }`} style={msg.role !== 'ai' ? { color: 'var(--orbis-text-muted)' } : undefined}>
                        {msg.role === 'ai' ? <Brain className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">You</span>}
                      </div>
                      <div className={`rounded-xl px-3.5 py-2.5 max-w-[80%] ${
                        msg.role === 'ai'
                          ? 'rounded-tl-sm'
                          : 'rounded-tr-sm'
                      }`} style={
                        msg.role === 'ai'
                          ? { background: 'var(--orbis-grid)', border: '1px solid var(--orbis-grid)' }
                          : { background: 'rgba(27,142,229,0.15)', border: '1px solid rgba(27,142,229,0.1)' }
                      }>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--orbis-text)' }}>{msg.content}</p>
                        {msg.codeContent && (
                          <pre className="mt-2 p-2.5 bg-black/40 rounded-lg text-xs overflow-x-auto" style={{ border: '1px solid var(--orbis-grid)' }}>
                            <code style={{ color: 'var(--orbis-text)' }}>{msg.codeContent}</code>
                          </pre>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2.5"
                >
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Brain className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-xl rounded-tl-sm px-3.5 py-2.5" style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-grid)' }}>
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--orbis-text-muted)' }}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="font-medium">Aria is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>

        {/* Right Panel -- Webcam + Live Analysis / Code */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`flex flex-col gap-4 overflow-hidden transition-all duration-500 ${showCodePanel ? 'w-[60%]' : 'w-[40%]'}`}
        >
          {showCodePanel ? (
            <div className="flex-1 rounded-2xl overflow-hidden" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-semibold" style={{ color: 'var(--orbis-text)' }}>Code Editor</span>
                </div>
                <button
                  onClick={() => setShowCodePanel(false)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                  style={{ color: 'var(--orbis-text-muted)' }}
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
            <>
              {/* Candidate Webcam */}
              <div className="relative rounded-2xl overflow-hidden flex-1 min-h-0" style={{ ...glassCard, background: 'var(--orbis-card)' }}>
                <video
                  ref={webcamRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Recording indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-semibold text-red-400">REC</span>
                </div>
                {/* Name tag */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                  <span className={`h-2 w-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="text-sm font-medium" style={{ color: 'var(--orbis-heading)' }}>You</span>
                </div>
                {/* Live voice transcript overlay */}
                {isListening && interimTranscript && (
                  <div className="absolute bottom-16 left-4 right-4">
                    <div className="px-4 py-2 rounded-xl text-sm text-white/90 font-medium" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
                      {interimTranscript}...
                    </div>
                  </div>
                )}
              </div>

              {/* Voice Status Card */}
              <div className="rounded-2xl p-4" style={glassCard}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--orbis-text-muted)' }}>Voice Status</span>
                  <div className="flex items-center gap-2">
                    {isAiSpeaking && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                        Aria speaking
                      </span>
                    )}
                    {isListening && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        Listening
                      </span>
                    )}
                    {isProcessing && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing
                      </span>
                    )}
                    {!isAiSpeaking && !isListening && !isProcessing && (
                      <span className="text-xs" style={{ color: 'var(--orbis-text-muted)' }}>Ready</span>
                    )}
                  </div>
                </div>
                {/* Speaking waveform visualization */}
                <div className="flex items-center justify-center gap-[3px] h-8">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-[3px] rounded-full ${
                        (isListening || isAiSpeaking) ? 'animate-waveform' : ''
                      } ${isListening ? 'bg-green-400' : isAiSpeaking ? 'bg-blue-400' : ''}`}
                      style={{
                        height: (isListening || isAiSpeaking) ? '20px' : '4px',
                        animationDelay: `${i * 100}ms`,
                        opacity: (isListening || isAiSpeaking) ? 0.8 : 0.2,
                        transition: 'height 0.3s ease, opacity 0.3s ease',
                        ...(!isListening && !isAiSpeaking ? { background: 'var(--orbis-border)' } : {}),
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Hidden proctoring monitor */}
              <div className="hidden">
                <ProctoringMonitor
                  sessionToken={token!}
                  onIntegrityUpdate={setIntegrityScore}
                  apiBase={API_BASE}
                />
              </div>
            </>
          )}
        </motion.section>
      </main>

      {/* Bottom Action Bar — Voice-First */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="px-4 py-3 backdrop-blur-2xl shrink-0"
        style={{ background: 'color-mix(in srgb, var(--orbis-page) 80%, transparent)', borderTop: '1px solid var(--orbis-grid)' }}
      >
        {/* Progress bar */}
        <div className="max-w-5xl mx-auto mb-3">
          <div className="h-0.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(to right, #1B8EE5, #1676c0)' }}
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
              className={`flex flex-col items-center justify-center h-12 w-12 rounded-xl transition-all duration-300 shrink-0 ${
                showCodePanel
                  ? 'bg-blue-600/15 border-blue-600/30 text-blue-400 border'
                  : 'hover:bg-white/[0.04]'
              }`}
              style={!showCodePanel ? { ...glassCard, color: 'var(--orbis-text-muted)' } : undefined}
            >
              <Code className="h-4.5 w-4.5" />
              <span className="text-[9px] font-bold uppercase mt-0.5">Code</span>
            </button>
          )}

          {/* Transcript toggle */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`flex flex-col items-center justify-center h-12 w-12 rounded-xl transition-all duration-300 shrink-0 ${
              showTranscript
                ? 'bg-blue-600/15 border-blue-600/30 text-blue-400 border'
                : 'hover:bg-white/[0.04]'
            }`}
            style={!showTranscript ? { ...glassCard, color: 'var(--orbis-text-muted)' } : undefined}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-[9px] font-bold uppercase mt-0.5">Chat</span>
          </button>

          {/* Text input (secondary) */}
          <div className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-2 focus-within:border-blue-600/30 transition-all duration-300" style={{ ...glassCard, background: 'var(--orbis-card)' }}>
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(textInput);
                }
              }}
              placeholder={isListening ? 'Listening... speak your answer' : 'Type or speak your answer...'}
              disabled={isProcessing || isAiSpeaking}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none font-medium text-sm"
              style={{ color: 'var(--orbis-text)' }}
            />
            <button
              onClick={() => sendMessage(textInput)}
              disabled={!textInput.trim() || isProcessing || isAiSpeaking}
              className="p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:scale-105 transition-all duration-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* TTS toggle */}
          <button
            onClick={() => {
              if (isAiSpeaking) synthRef.current?.cancel();
              setVoiceEnabled(!voiceEnabled);
            }}
            className="h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0"
            style={{
              ...glassCard,
              background: voiceEnabled ? 'rgba(27,142,229,0.15)' : 'var(--orbis-card)',
              color: voiceEnabled ? '#60a5fa' : '#64748b',
            }}
            title={voiceEnabled ? 'Mute Aria' : 'Unmute Aria'}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          {/* Primary Mic Button */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing || isAiSpeaking}
            className="relative h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={
              isListening
                ? { background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 30px rgba(239,68,68,0.4)' }
                : { background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 0 20px rgba(27,142,229,0.4)' }
            }
          >
            {isListening && (
              <div className="absolute inset-0 rounded-full animate-ping" style={{ border: '3px solid rgba(239,68,68,0.4)' }} />
            )}
            {isListening ? (
              <MicOff className="h-6 w-6 text-white" />
            ) : (
              <Mic className="h-6 w-6 text-white" />
            )}
          </button>
        </div>
      </motion.footer>
    </div>
  );
}
