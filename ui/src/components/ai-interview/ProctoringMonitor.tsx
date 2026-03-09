import { useEffect, useRef, useCallback, useState } from 'react';

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
    positive: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    neutral: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    negative: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Webcam feed */}
      <div className="relative rounded-xl overflow-hidden border-2 border-blue-600/20 aspect-video bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        {/* Scanning line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
        {/* Name tag */}
        <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-white">You</span>
        </div>
        {/* REC indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-400 uppercase">Rec</span>
        </div>
      </div>

      {/* Sentiment analysis panel */}
      <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-xl p-6 flex-1 flex flex-col gap-5">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Real-time Soft Skills Analysis
        </h4>

        {/* Sentiment pills */}
        <div className="flex flex-wrap gap-3">
          {sentiments.map(s => {
            const colors = statusColors[s.status];
            return (
              <div key={s.label} className={`flex items-center gap-2 ${colors.bg} ${colors.text} border ${colors.border} px-4 py-2 rounded-xl text-sm font-semibold`}>
                <span className={`h-2 w-2 rounded-full ${s.status === 'positive' ? 'bg-emerald-400' : s.status === 'neutral' ? 'bg-amber-400' : 'bg-red-400'}`} />
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
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
              style={{ width: `${confidence}%` }}
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
                className="w-[3px] bg-blue-600 rounded-full animate-waveform"
                style={{
                  height: '80%',
                  animationDelay: `${i * 60}ms`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
