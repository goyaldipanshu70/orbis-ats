import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2, Mic, Camera, Volume2, Wifi, CheckCircle, XCircle, Info, Play, Clock, HelpCircle, Code, Brain } from 'lucide-react';

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
}

interface CheckItem {
  label: string;
  icon: React.ReactNode;
  status: 'checking' | 'pass' | 'fail';
  detail: string;
}

export default function InterviewLobby({ sessionInfo, onStart, isStarting = false }: InterviewLobbyProps) {
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

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col" style={{ background: 'radial-gradient(circle at top right, #1e293b, #0f172a)' }}>
      {/* 3D Particle background */}
      <ThreeErrorBoundary>
        <Suspense fallback={null}>
          <ParticleField />
        </Suspense>
      </ThreeErrorBoundary>

      {/* Background glow orbs */}
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-[20%] right-[-5%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 backdrop-blur-xl bg-white/[0.03] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ORBIS</h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-600/30">
          <Clock className="h-4 w-4 text-blue-400" />
          <span className="text-blue-400 font-bold text-sm">
            {sessionInfo.time_limit_minutes} min interview
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1440px] mx-auto w-full p-6 lg:p-12 gap-8">
        {/* Left sidebar */}
        <aside className="w-full lg:w-1/3 flex flex-col gap-6">
          {/* Job details card */}
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-xl p-8">
            <span className="inline-block px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-full mb-4 uppercase tracking-wider">
              Interview Lobby
            </span>
            <h2 className="text-3xl font-extrabold mb-2 leading-tight">{sessionInfo.job_title}</h2>
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
            </div>
          </div>

          {/* Instructions card */}
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-xl p-6 border-l-4 border-l-blue-600">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-400" />
              Instructions
            </h3>
            <ul className="text-slate-400 text-sm leading-relaxed space-y-2">
              <li>You'll be interviewed by <strong className="text-slate-300">Aria</strong>, our AI interviewer</li>
              <li>Speak naturally or type your responses</li>
              <li>Find a quiet, well-lit environment</li>
              <li>Your webcam and audio will be recorded</li>
              <li>Tab switching is monitored during the interview</li>
            </ul>
          </div>
        </aside>

        {/* Right main area */}
        <section className="flex-1 flex flex-col gap-8">
          {/* Webcam preview */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-slate-900">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Frosted name tag */}
            <div className="absolute bottom-6 left-6 backdrop-blur-xl bg-white/10 border border-white/20 px-6 py-3 rounded-xl flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-sm">Camera Preview</span>
            </div>
          </div>

          {/* Equipment check grid */}
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-2xl p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-400" />
              Equipment Check
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {checks.map((check) => (
                <div key={check.label} className="flex flex-col items-center p-4 rounded-xl bg-slate-800/50 border border-white/5">
                  <div className={check.status === 'pass' ? 'text-green-500 mb-2' : check.status === 'fail' ? 'text-red-500 mb-2' : 'text-slate-500 mb-2 animate-pulse'}>
                    {check.status === 'checking' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : check.status === 'pass' ? (
                      check.icon
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 mb-1 uppercase">{check.label}</span>
                  <span className={`text-sm font-bold ${check.status === 'pass' ? 'text-green-400' : check.status === 'fail' ? 'text-red-400' : 'text-slate-500'}`}>
                    {check.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Start button */}
          <div className="flex justify-center lg:justify-end mt-4">
            <button
              onClick={onStart}
              disabled={!micOk || isStarting}
              className="w-full lg:w-auto min-w-[280px] py-5 px-10 rounded-xl text-white font-extrabold text-lg shadow-xl shadow-blue-600/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
            >
              {isStarting ? (
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
