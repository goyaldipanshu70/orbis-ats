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

  const addEvent = useCallback((event_type: string, duration_ms?: number) => {
    eventsBuffer.current.push({
      event_type,
      timestamp: new Date().toISOString(),
      duration_ms,
    });
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

  const updateIntegrity = useCallback(() => {
    const totalTime = Date.now() - startTime.current;
    if (totalTime > 0 && onIntegrityUpdate) {
      const ratio = totalFocusTime.current / totalTime;
      onIntegrityUpdate(Math.round(ratio * 100));
    }
  }, [onIntegrityUpdate]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabAwayStart.current = Date.now();
        addEvent('tab_away');
        // Downgrade sentiments on tab away
        setSentiments(prev => prev.map(s =>
          s.label === 'Engaged' ? { ...s, status: 'negative' as const } : s
        ));
      } else {
        if (tabAwayStart.current) {
          const duration = Date.now() - tabAwayStart.current;
          addEvent('tab_return', duration);
          tabAwayStart.current = null;
        }
        setSentiments(prev => prev.map(s =>
          s.label === 'Engaged' ? { ...s, status: 'positive' as const } : s
        ));
      }
    };

    const handleBlur = () => { if (!document.hidden) addEvent('window_blur'); };
    const handleFocus = () => addEvent('window_focus');

    // Copy/paste detection
    const handleCopy = () => addEvent('copy_paste');
    const handlePaste = () => addEvent('copy_paste');

    // Right-click detection (potential external tool use)
    const handleContextMenu = (e: MouseEvent) => {
      addEvent('external_device');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);

    const focusInterval = setInterval(() => {
      if (!document.hidden) totalFocusTime.current += 1000;
      updateIntegrity();
      // Confidence based on actual focus time and events
      const totalTime = Date.now() - startTime.current;
      const focusPct = totalTime > 0 ? (totalFocusTime.current / totalTime) * 100 : 100;
      const penalty = eventsBuffer.current.length * 3;
      setConfidence(Math.max(0, Math.min(100, Math.round(focusPct - penalty))));
    }, 1000);

    intervalRef.current = setInterval(flushEvents, 30000);

    // Start webcam
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(focusInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
      flushEvents();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [addEvent, flushEvents, updateIntegrity]);

  const statusColors = {
    positive: { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.2)', dot: '#34d399' },
    neutral: { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)', dot: '#fbbf24' },
    negative: { bg: 'rgba(239,68,68,0.1)', text: '#f87171', border: 'rgba(239,68,68,0.2)', dot: '#f87171' },
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Webcam feed */}
      <div
        className="relative rounded-xl overflow-hidden aspect-video"
        style={{ background: '#0d0a1f', border: '2px solid rgba(27,142,229,0.2)' }}
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
          style={{ background: 'rgba(27,142,229,0.4)', boxShadow: '0 0 15px rgba(27,142,229,0.5)' }}
        />
        {/* Name tag */}
        <div
          className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg flex items-center gap-2"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' }}
        >
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-white">You</span>
        </div>
        {/* REC indicator */}
        <div
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
        >
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-400 uppercase">Rec</span>
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

        {/* Speaking confidence bar */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Speaking Confidence</span>
            <span className="text-xs font-bold text-blue-400">{confidence}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${confidence}%`,
                background: 'linear-gradient(90deg, #1B8EE5, #a855f7)',
                boxShadow: '0 0 10px rgba(27,142,229,0.5)',
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
                  background: '#1B8EE5',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
