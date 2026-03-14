import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Loader2, Mic, Camera, Volume2, Wifi, CheckCircle, XCircle, Info, Play,
  Clock, HelpCircle, Code, Brain, RefreshCw, Lightbulb, CheckCircle2,
  MessageSquare, Terminal,
} from 'lucide-react';

import ThreeErrorBoundary from './three/ThreeErrorBoundary';
const ParticleField = lazy(() => import('./three/ParticleField'));

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

interface InterviewLobbyProps {
  sessionInfo: SessionInfo;
  onStart: () => void;
  isStarting?: boolean;
  attemptsUsed?: number;
  maxAttempts?: number;
}

interface CheckItem {
  label: string;
  icon: React.ReactNode;
  status: 'checking' | 'pass' | 'fail';
  detail: string;
}

export default function InterviewLobby({ sessionInfo, onStart, isStarting = false, attemptsUsed = 0, maxAttempts = 3 }: InterviewLobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [checks, setChecks] = useState<CheckItem[]>([
    { label: 'Camera', icon: <Camera className="h-5 w-5" />, status: 'checking', detail: 'Checking...' },
    { label: 'Microphone', icon: <Mic className="h-5 w-5" />, status: 'checking', detail: 'Checking...' },
    { label: 'Speaker', icon: <Volume2 className="h-5 w-5" />, status: 'checking', detail: 'Checking...' },
    { label: 'Internet', icon: <Wifi className="h-5 w-5" />, status: 'checking', detail: 'Checking...' },
  ]);

  const updateCheck = (label: string, status: 'pass' | 'fail', detail: string) => {
    setChecks(prev => prev.map(c => c.label === label ? { ...c, status, detail } : c));
  };

  useEffect(() => {
    // Check camera + start preview
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        updateCheck('Camera', 'pass', 'Ready');
      })
      .catch(() => updateCheck('Camera', 'fail', 'Blocked'));

    // Check mic
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        updateCheck('Microphone', 'pass', 'Active');
      })
      .catch(() => updateCheck('Microphone', 'fail', 'Blocked'));

    // Check speakers (assume pass if audio context works)
    try {
      const ctx = new AudioContext();
      ctx.close();
      updateCheck('Speaker', 'pass', 'Tested');
    } catch {
      updateCheck('Speaker', 'fail', 'Unavailable');
    }

    // Check internet (simple connectivity test)
    updateCheck('Internet', navigator.onLine ? 'pass' : 'fail', navigator.onLine ? 'Stable' : 'Offline');

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const micOk = checks.find(c => c.label === 'Microphone')?.status === 'pass';
  const noAttemptsLeft = attemptsUsed >= maxAttempts;

  const tips = [
    'Speak clearly and take your time with answers',
    'You can respond via voice or text input',
    'For coding questions, explain your thought process',
    `The interview takes approximately ${sessionInfo.time_limit_minutes} minutes`,
    `You can retake this interview up to ${maxAttempts} times`,
  ];

  const expectSections = [
    {
      key: 'behavioral',
      title: 'Behavioral',
      icon: <MessageSquare className="h-5 w-5 text-blue-400" />,
      description: 'Questions about your experience and soft skills',
      show: true,
    },
    {
      key: 'technical',
      title: 'Technical',
      icon: <Code className="h-5 w-5 text-blue-400" />,
      description: 'Domain-specific knowledge assessment',
      show: true,
    },
    {
      key: 'coding',
      title: 'Coding',
      icon: <Terminal className="h-5 w-5 text-blue-400" />,
      description: 'Live coding challenge',
      show: sessionInfo.include_coding,
    },
  ].filter(s => s.show);

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: 'radial-gradient(circle at top right, #1a1145, var(--orbis-page))' }}>
      {/* 3D Particle background */}
      <ThreeErrorBoundary>
        <Suspense fallback={null}>
          <ParticleField />
        </Suspense>
      </ThreeErrorBoundary>

      {/* Background glow orbs */}
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(27,142,229,0.08)' }} />
      <div className="fixed top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(27,142,229,0.06)' }} />

      {/* Green pulse keyframes for equipment check pass animation */}
      <style>{`
        @keyframes greenPulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .green-pulse-animate {
          animation: greenPulse 1.5s ease-out 1;
        }
        @keyframes webcamGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-4 sticky top-0 z-50"
        style={{
          background: 'var(--orbis-card)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--orbis-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: '#1B8EE5' }}>
            <Brain className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">ORBIS</h1>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: 'rgba(27,142,229,0.15)',
            border: '1px solid rgba(27,142,229,0.3)',
          }}
        >
          <Clock className="h-4 w-4 text-blue-300" />
          <span className="text-blue-300 font-bold text-sm">
            {sessionInfo.time_limit_minutes} min interview
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1440px] mx-auto w-full p-6 lg:p-12 gap-8">
        {/* Left sidebar */}
        <aside className="w-full lg:w-1/3 flex flex-col gap-6">
          {/* Job details card */}
          <div
            className="rounded-xl p-8"
            style={{
              background: 'var(--orbis-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--orbis-border)',
            }}
          >
            <span
              className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-4 uppercase tracking-wider"
              style={{ background: 'rgba(27,142,229,0.2)', color: '#b68aff' }}
            >
              Interview Lobby
            </span>
            <h2 className="text-3xl font-extrabold mb-2 leading-tight text-white">{sessionInfo.job_title}</h2>
            {sessionInfo.company && (
              <p className="text-slate-400 text-lg mb-6">{sessionInfo.company}</p>
            )}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <Clock className="h-5 w-5 text-blue-400" />
                <span>{sessionInfo.time_limit_minutes} Minute Duration</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <HelpCircle className="h-5 w-5 text-blue-400" />
                <span>{sessionInfo.max_questions} Questions</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Brain className="h-5 w-5 text-blue-400" />
                <span className="capitalize">{sessionInfo.interview_type} Interview</span>
              </div>
              {sessionInfo.include_coding && (
                <div className="flex items-center gap-3 text-slate-300">
                  <Code className="h-5 w-5 text-blue-400" />
                  <span>Coding: {sessionInfo.coding_language || 'Any Language'}</span>
                </div>
              )}

              {/* Attempts Remaining */}
              <div className="flex items-center gap-3 text-slate-300">
                <RefreshCw className="h-5 w-5 text-blue-400" />
                {noAttemptsLeft ? (
                  <span className="text-red-400 font-semibold">No attempts remaining</span>
                ) : (
                  <span>Attempt {attemptsUsed + 1} of {maxAttempts}</span>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Your best score from all attempts will be used
            </p>
          </div>

          {/* Prepare for Success — enhanced instructions card */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--orbis-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--orbis-border)',
              borderLeft: '4px solid #1B8EE5',
            }}
          >
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              Prepare for Success
            </h3>
            <ul className="space-y-3">
              {tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>

            {/* Original instructions kept as a secondary note */}
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--orbis-border)' }}>
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-blue-400" />
                Important Notes
              </h4>
              <ul className="text-slate-400 text-xs leading-relaxed space-y-1.5">
                <li>You'll be interviewed by <strong className="text-slate-300">Aria</strong>, our AI interviewer</li>
                <li>Speak naturally or type your responses</li>
                <li>Find a quiet, well-lit environment</li>
                <li>Your webcam and audio will be recorded</li>
                <li>Tab switching is monitored during the interview</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Right main area */}
        <section className="flex-1 flex flex-col gap-8">
          {/* Webcam preview with gradient border glow */}
          <div
            className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: '#0d0a1f',
              border: '1px solid var(--orbis-border)',
              boxShadow: '0 0 30px rgba(27,142,229,0.15), 0 0 60px rgba(91,45,186,0.1)',
            }}
          >
            {/* Gradient border glow overlay */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none z-10"
              style={{
                background: 'transparent',
                boxShadow: 'inset 0 0 0 2px transparent',
                border: '2px solid transparent',
                borderImage: 'linear-gradient(135deg, rgba(27,142,229,0.6), rgba(91,45,186,0.6), rgba(27,142,229,0.3)) 1',
                animation: 'webcamGlow 3s ease-in-out infinite',
              }}
            />
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Frosted name tag */}
            <div
              className="absolute bottom-6 left-6 px-6 py-3 rounded-xl flex items-center gap-3 z-20"
              style={{
                background: 'var(--orbis-hover)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--orbis-border-strong)',
              }}
            >
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-sm text-white">Camera Preview</span>
            </div>
          </div>

          {/* Equipment check grid */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'var(--orbis-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--orbis-border)',
            }}
          >
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
              <CheckCircle className="h-5 w-5 text-blue-400" />
              Equipment Check
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {checks.map((check) => (
                <div
                  key={check.label}
                  className={`flex flex-col items-center p-4 rounded-xl transition-all duration-300 ${check.status === 'pass' ? 'green-pulse-animate' : ''}`}
                  style={{
                    background: check.status === 'pass'
                      ? 'rgba(34, 197, 94, 0.05)'
                      : 'var(--orbis-card)',
                    border: check.status === 'pass'
                      ? '1px solid rgba(34, 197, 94, 0.2)'
                      : check.status === 'fail'
                        ? '1px solid rgba(239, 68, 68, 0.2)'
                        : '1px solid var(--orbis-border)',
                  }}
                >
                  <div className={
                    check.status === 'pass'
                      ? 'text-green-500 mb-2'
                      : check.status === 'fail'
                        ? 'text-red-500 mb-2'
                        : 'text-slate-500 mb-2 animate-pulse'
                  }>
                    {check.status === 'checking' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : check.status === 'pass' ? (
                      check.icon
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 mb-1 uppercase">{check.label}</span>
                  <span className={`text-sm font-bold ${check.status === 'pass' ? 'text-green-400' : check.status === 'fail' ? 'text-red-400' : 'text-slate-500'}`}>
                    {check.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* What to Expect section */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">What to Expect</h3>
            <div className={`grid gap-4 ${expectSections.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
              {expectSections.map((section) => (
                <div
                  key={section.key}
                  className="rounded-xl p-5 flex flex-col items-center text-center gap-3"
                  style={{
                    background: 'var(--orbis-card)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--orbis-border)',
                  }}
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(27,142,229,0.15)' }}
                  >
                    {section.icon}
                  </div>
                  <span className="text-white font-bold text-sm">{section.title}</span>
                  <span className="text-slate-400 text-xs leading-relaxed">{section.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Start button area */}
          <div className="flex flex-col items-center lg:items-end gap-3 mt-4">
            <button
              onClick={onStart}
              disabled={!micOk || isStarting || noAttemptsLeft}
              className="w-full lg:w-auto min-w-[280px] py-5 px-10 rounded-xl text-white font-extrabold text-lg shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg, #1B8EE5 0%, #5b2dba 100%)', boxShadow: '0 8px 30px rgba(27,142,229,0.25)' }}
            >
              {noAttemptsLeft ? (
                <>
                  <XCircle className="h-5 w-5" />
                  No Attempts Remaining
                </>
              ) : isStarting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Starting Interview...
                </>
              ) : (
                <>
                  START INTERVIEW
                  <Play className="h-5 w-5" />
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center lg:text-right max-w-md">
              By starting, you agree to camera and microphone monitoring during the interview
            </p>
            <p className="text-xs text-slate-500 text-center lg:text-right">
              Your best score from {maxAttempts} attempts will be used
            </p>
          </div>

          {!micOk && checks.find(c => c.label === 'Microphone')?.status === 'fail' && (
            <p className="text-sm text-red-400 text-center">
              Microphone access is required. Please enable it in your browser settings and refresh.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
