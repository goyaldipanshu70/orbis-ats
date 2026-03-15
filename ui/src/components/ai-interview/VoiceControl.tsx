import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

interface VoiceControlProps {
  onTranscript: (text: string) => void;
  autoSpeak?: boolean;
  disabled?: boolean;
}

export default function VoiceControl({ onTranscript, autoSpeak = true, disabled = false }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(autoSpeak);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      synthRef.current.cancel();
    };
  }, []);

  const startListening = useCallback(() => {
    if (disabled || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = () => setIsListening(false);

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) onTranscript(finalTranscript.trim());
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [disabled, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  }, []);

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 rounded-2xl"
      style={glassCard}
    >
      {/* TTS toggle */}
      <button
        onClick={() => {
          if (isSpeaking) stopSpeaking();
          setTtsEnabled(!ttsEnabled);
        }}
        className="p-2.5 rounded-xl transition-colors"
        style={{
          background: ttsEnabled ? 'rgba(27,142,229,0.15)' : 'var(--orbis-input)',
          color: ttsEnabled ? '#1B8EE5' : 'var(--orbis-text-muted)',
        }}
        title={ttsEnabled ? 'Mute AI voice' : 'Enable AI voice'}
      >
        {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </button>

      {/* Large mic button */}
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        className="relative h-16 w-16 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={
          isListening
            ? { background: '#ef4444', boxShadow: '0 0 20px rgba(239,68,68,0.4)' }
            : { background: '#1B8EE5', boxShadow: '0 0 20px rgba(27,142,229,0.4)' }
        }
      >
        {/* Pulsing ring when listening */}
        {isListening && (
          <div className="absolute inset-0 rounded-full animate-ping" style={{ border: '4px solid rgba(239,68,68,0.5)' }} />
        )}
        {isListening ? (
          <MicOff className="h-7 w-7 text-white" />
        ) : (
          <Mic className="h-7 w-7 text-white" />
        )}
      </button>

      {/* Status text */}
      <div className="min-w-0">
        {isListening && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-400 font-medium">Recording...</span>
          </div>
        )}
        {interimText && (
          <p className="text-xs italic truncate max-w-[200px]" style={{ color: 'var(--orbis-text-muted)' }}>{interimText}...</p>
        )}
        {isSpeaking && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#1B8EE5' }} />
            <span className="text-sm font-medium" style={{ color: '#1B8EE5' }}>Aria speaking...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export { VoiceControl };
export type { VoiceControlProps };
