import { useEffect, useRef, useCallback, useState } from 'react';

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

interface ProctoringEvent {
  event_type: string;
  timestamp: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

interface ProctoringMonitorProps {
  sessionToken: string;
  onIntegrityUpdate?: (score: number) => void;
  apiBase?: string;
}

export default function ProctoringMonitor({ sessionToken, onIntegrityUpdate, apiBase = '' }: ProctoringMonitorProps) {
  const eventsBuffer = useRef<ProctoringEvent[]>([]);
  const tabAwayStart = useRef<number | null>(null);
  const totalFocusTime = useRef(0);
  const startTime = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [confidence, setConfidence] = useState(92);
  const [sentiments, setSentiments] = useState([
    { label: 'Confident', status: 'positive' as const },
    { label: 'Engaged', status: 'positive' as const },
    { label: 'Clear Communication', status: 'neutral' as const },
  ]);

  // Enhanced tracking refs
  const keystrokeTimings = useRef<number[]>([]);
  const lastKeystroke = useRef<number>(0);
  const silenceStart = useRef<number>(Date.now());
  const lastSpeechActivity = useRef<number>(Date.now());
  const screenSwitchCount = useRef(0);
  const pasteContentLengths = useRef<number[]>([]);
  const totalEvents = useRef(0);
  const integrityDeductions = useRef(0);

  const addEvent = useCallback((event_type: string, duration_ms?: number, metadata?: Record<string, any>) => {
    eventsBuffer.current.push({
      event_type,
      timestamp: new Date().toISOString(),
      duration_ms,
      metadata,
    });
    totalEvents.current += 1;
  }, []);

  const flushEvents = useCallback(async () => {
    if (eventsBuffer.current.length === 0) return;
    const batch = [...eventsBuffer.current];
    eventsBuffer.current = [];
    try {
      await fetch(`${apiBase}/api/ai-interview/room/${sessionToken}/proctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
    } catch {
      eventsBuffer.current.unshift(...batch);
    }
  }, [sessionToken, apiBase]);

  const computeIntegrityScore = useCallback(() => {
    const totalTime = Date.now() - startTime.current;
    if (totalTime <= 0) return 100;

    let score = 100;

    // Focus time ratio penalty
    const focusRatio = totalFocusTime.current / totalTime;
    if (focusRatio < 0.9) score -= Math.round((1 - focusRatio) * 30);

    // Screen switch penalty
    if (screenSwitchCount.current > 2) {
      score -= Math.min(screenSwitchCount.current * 3, 25);
    }

    // Typing pattern anomaly penalty
    if (keystrokeTimings.current.length >= 5) {
      const timings = keystrokeTimings.current.slice(-20);
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);
      // Very uniform typing (< 15ms std dev) with fast speed suggests pasting or bot
      if (stdDev < 15 && avg < 80) {
        score -= 10;
      }
    }

    // Paste content length anomaly
    for (const len of pasteContentLengths.current) {
      if (len > 200) score -= 5; // Pasting large blocks is suspicious
    }

    score -= integrityDeductions.current;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, []);

  const updateIntegrity = useCallback(() => {
    const score = computeIntegrityScore();
    if (onIntegrityUpdate) onIntegrityUpdate(score);
    return score;
  }, [onIntegrityUpdate, computeIntegrityScore]);

  // Notify parent that candidate is speaking (called from AIInterviewRoom)
  // Expose via ref-based callback
  useEffect(() => {
    // @ts-ignore — attach to window for parent access
    window.__proctoringNotifySpeech = () => {
      lastSpeechActivity.current = Date.now();
      silenceStart.current = Date.now();
    };
    return () => {
      // @ts-ignore
      delete window.__proctoringNotifySpeech;
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabAwayStart.current = Date.now();
        screenSwitchCount.current += 1;
        addEvent('tab_away', undefined, { switch_count: screenSwitchCount.current });
        setSentiments(prev => prev.map(s =>
          s.label === 'Engaged' ? { ...s, status: 'negative' as const } : s
        ));
      } else {
        if (tabAwayStart.current) {
          const duration = Date.now() - tabAwayStart.current;
          addEvent('tab_return', duration, { switch_count: screenSwitchCount.current });
          tabAwayStart.current = null;
          // Long absence is more suspicious
          if (duration > 10000) {
            integrityDeductions.current += 5;
          }
        }
        setSentiments(prev => prev.map(s =>
          s.label === 'Engaged' ? { ...s, status: 'positive' as const } : s
        ));
      }
    };

    const handleBlur = () => { if (!document.hidden) addEvent('window_blur'); };
    const handleFocus = () => addEvent('window_focus');

    // Copy/paste detection with content analysis
    const handleCopy = () => {
      addEvent('copy_paste', undefined, { action: 'copy' });
      integrityDeductions.current += 2;
    };
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') || '';
      pasteContentLengths.current.push(text.length);
      addEvent('copy_paste', undefined, {
        action: 'paste',
        content_length: text.length,
        is_code: /[{};()=>]/.test(text) && text.length > 50,
      });
      if (text.length > 200) {
        integrityDeductions.current += 5;
      } else {
        integrityDeductions.current += 2;
      }
    };

    // Right-click detection
    const handleContextMenu = () => {
      addEvent('external_device');
      integrityDeductions.current += 1;
    };

    // Keystroke timing analysis for abnormal typing patterns
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (lastKeystroke.current > 0) {
        const delta = now - lastKeystroke.current;
        if (delta < 2000) { // Only track rapid sequences
          keystrokeTimings.current.push(delta);
          // Keep last 50 timings
          if (keystrokeTimings.current.length > 50) {
            keystrokeTimings.current = keystrokeTimings.current.slice(-50);
          }
        }
      }
      lastKeystroke.current = now;
    };

    // Screen resize detection (possible screen switching / dev tools)
    const handleResize = () => {
      addEvent('window_resize', undefined, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste as EventListener);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    // Periodic integrity check + silence detection
    const focusInterval = setInterval(() => {
      if (!document.hidden) totalFocusTime.current += 1000;

      // Suspicious silence detection (30+ seconds with no speech activity)
      const silenceDuration = Date.now() - lastSpeechActivity.current;
      if (silenceDuration > 30000 && silenceDuration < 31000) {
        addEvent('long_silence', silenceDuration);
      }

      const score = updateIntegrity();
      setConfidence(score);
    }, 1000);

    intervalRef.current = setInterval(flushEvents, 30000);

    // Start webcam
    let camStream: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    }).then(stream => {
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      camStream = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => {});

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste as EventListener);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      clearInterval(focusInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Use sendBeacon for reliable event delivery on unmount
      if (eventsBuffer.current.length > 0) {
        try {
          navigator.sendBeacon(
            `${apiBase}/api/ai-interview/room/${sessionToken}/proctor`,
            new Blob([JSON.stringify({ events: eventsBuffer.current })], { type: 'application/json' }),
          );
        } catch { /* best effort */ }
      }
      if (camStream) camStream.getTracks().forEach(t => t.stop());
    };
  }, [addEvent, flushEvents, updateIntegrity]);

  const statusColors = {
    positive: { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.2)', dot: '#34d399' },
    neutral: { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)', dot: '#fbbf24' },
    negative: { bg: 'rgba(239,68,68,0.1)', text: '#f87171', border: 'rgba(239,68,68,0.2)', dot: '#f87171' },
  };

  const integrityColor = confidence >= 80 ? '#34d399' : confidence >= 60 ? '#fbbf24' : '#f87171';

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Webcam feed */}
      <div
        className="relative rounded-xl overflow-hidden aspect-video"
        style={{ background: '#0d0a1f', border: `2px solid ${integrityColor}30` }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        {/* Scanning line */}
        <div
          className="absolute top-0 left-0 w-full h-1"
          style={{ background: `${integrityColor}60`, boxShadow: `0 0 15px ${integrityColor}80` }}
        />
        {/* Name tag */}
        <div
          className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg flex items-center gap-2"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' }}
        >
          <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: integrityColor }} />
          <span className="text-xs font-medium text-white">You</span>
        </div>
        {/* REC + Integrity badge */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
          >
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 uppercase">Rec</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
          >
            <span className="text-[10px] font-bold uppercase" style={{ color: integrityColor }}>
              {confidence}%
            </span>
          </div>
        </div>
      </div>

      {/* Sentiment analysis panel */}
      <div
        className="rounded-2xl p-6 flex-1 flex flex-col gap-5"
        style={glassCard}
      >
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Real-time Soft Skills Analysis
        </h4>

        {/* Sentiment pills */}
        <div className="flex flex-wrap gap-3">
          {sentiments.map(s => {
            const colors = statusColors[s.status];
            return (
              <div
                key={s.label}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: colors.dot }} />
                {s.label}
              </div>
            );
          })}
        </div>

        {/* Integrity score bar */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Integrity Score</span>
            <span className="text-xs font-bold" style={{ color: integrityColor }}>{confidence}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${confidence}%`,
                background: `linear-gradient(90deg, ${integrityColor}, ${integrityColor}cc)`,
                boxShadow: `0 0 10px ${integrityColor}80`,
              }}
            />
          </div>
        </div>

        {/* Waveform visualization */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Speaking Waveform</h4>
          <div className="h-12 flex items-center justify-center gap-[3px]">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full animate-waveform"
                style={{
                  height: '80%',
                  animationDelay: `${i * 60}ms`,
                  opacity: 0.6,
                  background: 'var(--orbis-accent, #1B8EE5)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
