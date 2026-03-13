import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Briefcase, Search, GitBranch, FileText,
  Users, CalendarCheck, BarChart3, ArrowUp,
  Copy, ChevronRight, MapPin, Mail, Phone, Star,
  Clock, Loader2, TrendingUp, UserCheck,
  Mic, MicOff, Volume2, VolumeX, Globe, Paperclip, X,
  CheckCircle2, Zap, PanelRightOpen, PanelRightClose,
  ChevronDown, Wrench, Activity, Plus, MessageSquare, Trash2,
  ShieldCheck, ExternalLink, Send,
} from 'lucide-react';
import { Fade } from '@/components/ui/fade';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import AppLayout from '@/components/layout/AppLayout';

// Inline DataChart stub
function DataChart({ headers, rows, title, compact }: { headers: string[]; rows: string[][]; title?: string; compact?: boolean }) {
  return (
    <div className={`overflow-x-auto my-3 rounded-xl border border-border ${compact ? 'text-xs' : 'text-sm'}`}>
      {title && <div className="px-4 py-2 bg-muted border-b border-border font-semibold text-foreground">{title}</div>}
      <table className="min-w-full">
        <thead className="bg-muted border-b border-border">
          <tr>{headers.map((h, i) => <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-foreground border-t border-border">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function parseJsonChartData(json: string): { headers: string[]; rows: string[][] } | null {
  try {
    const data = JSON.parse(json);
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.map((item: any) => headers.map(h => String(item[h] ?? '')));
      return { headers, rows };
    }
  } catch {}
  return null;
}

import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Job } from '@/types/api';

/* ─── Types ─── */

interface FileAttachment {
  url: string;
  filename: string;
  extracted_text?: string;
  type: 'pdf' | 'docx' | 'txt' | 'image';
  truncated?: boolean;
  char_count?: number;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  type?: 'text' | 'candidates';
  data?: any;
  actions?: Array<{ tool: string; args: any; result: any }>;
  files?: FileAttachment[];
  isStreaming?: boolean;
}

interface QuickStats {
  active_jobs: number;
  total_candidates: number;
  pending_interviews: number;
}

interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

/* ─── Suggestion Tiles ─── */

const SUGGESTIONS = [
  {
    icon: Search,
    color: 'from-blue-500/20 to-blue-600/10 text-blue-500 border-blue-500/20',
    title: 'Show top candidates for a role',
    desc: 'Search and rank candidates by job fit score',
  },
  {
    icon: Users,
    color: 'from-violet-500/20 to-violet-600/10 text-violet-500 border-violet-500/20',
    title: 'Compare top candidates',
    desc: 'Side-by-side analysis of shortlisted profiles',
  },
  {
    icon: GitBranch,
    color: 'from-emerald-500/20 to-emerald-600/10 text-emerald-500 border-emerald-500/20',
    title: 'Pipeline status for open roles',
    desc: 'Visualize where candidates stand in the funnel',
  },
  {
    icon: CalendarCheck,
    color: 'from-amber-500/20 to-amber-600/10 text-amber-500 border-amber-500/20',
    title: 'Interview schedule this week',
    desc: 'Plan and coordinate upcoming interviews',
  },
  {
    icon: Briefcase,
    color: 'from-rose-500/20 to-rose-600/10 text-rose-500 border-rose-500/20',
    title: 'Create a new job posting',
    desc: 'AI creates the job directly via natural language',
  },
  {
    icon: BarChart3,
    color: 'from-cyan-500/20 to-cyan-600/10 text-cyan-500 border-cyan-500/20',
    title: 'Generate hiring report',
    desc: 'Get a summary of recruitment metrics',
  },
  {
    icon: CheckCircle2,
    color: 'from-teal-500/20 to-teal-600/10 text-teal-500 border-teal-500/20',
    title: 'Show compliance report',
    desc: 'Check SLA status and diversity metrics',
    href: '/compliance',
  },
  {
    icon: Zap,
    color: 'from-orange-500/20 to-orange-600/10 text-orange-500 border-orange-500/20',
    title: 'View candidate scorecards',
    desc: 'Detailed evaluation breakdowns',
    href: '/jobs',
  },
];

/* ─── Quick Action Cards ─── */

const QUICK_ACTIONS = [
  { icon: Briefcase, label: 'Create a new job posting' },
  { icon: Search, label: 'Show me all candidates' },
  { icon: GitBranch, label: 'Show hiring pipeline status' },
  { icon: FileText, label: 'Generate a hiring report' },
];

/* ─── Tool label map ─── */

const TOOL_LABELS: Record<string, { label: string; color: string }> = {
  create_job_posting: { label: 'Job Created', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  move_candidate_stage: { label: 'Candidate Moved', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  add_candidates_to_job: { label: 'Candidates Added', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  schedule_interview: { label: 'Interview Scheduled', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  create_offer: { label: 'Offer Created', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  update_job_status: { label: 'Job Updated', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
  search_candidates: { label: 'Talent Search', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  web_search: { label: 'Web Search', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  view_scorecard: { label: 'Scorecard', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  check_compliance: { label: 'Compliance Check', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  create_referral: { label: 'Referral Created', color: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300' },
  start_campaign: { label: 'Campaign Started', color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
};

/* ─── Speech support detection ─── */

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const speechSynthesis = window.speechSynthesis;
const HAS_SPEECH_RECOGNITION = !!SpeechRecognition;
const HAS_SPEECH_SYNTHESIS = !!speechSynthesis;

/* ─── Component ─── */

export default function HiringAssistant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Data state
  const [stats, setStats] = useState<QuickStats>({ active_jobs: 0, total_candidates: 0, pending_interviews: 0 });
  const [jobs, setJobs] = useState<Job[]>([]);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  // File state
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Web search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Tool execution panel
  const [toolPanelOpen, setToolPanelOpen] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
  const [agentPhase, setAgentPhase] = useState<string>('idle');

  // Conversation persistence
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [conversationSidebarOpen, setConversationSidebarOpen] = useState(true);

  // Confirmation state
  const [pendingConfirmations, setPendingConfirmations] = useState<Map<string, { tool: string; description: string; messageId: number }>>(new Map());

  // Recording timer ref
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.first_name || 'there';

  /* ─── Effects ─── */

  useEffect(() => {
    loadInitialData();
    loadConversations();
    return () => {
      abortControllerRef.current?.abort();
      stopRecording();
      stopSpeaking();
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  /* ─── Data Loading ─── */

  const loadInitialData = async () => {
    try {
      const [dashStats, jobRes] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getJobs(1, 50),
      ]);
      setStats({
        active_jobs: dashStats.active_jobs,
        total_candidates: dashStats.total_candidates,
        pending_interviews: dashStats.pending_interviews,
      });
      setJobs(jobRes.items);
    } catch {
      // Silently fail on initial load
    }
  };

  const loadConversations = async () => {
    try {
      const res = await apiClient.getAgentConversations(1, 50);
      setConversations(res.items || []);
    } catch {
      // Silently fail
    }
  };

  const loadConversation = async (convo: Conversation) => {
    setActiveConversationId(convo.id);
    try {
      const res = await apiClient.getAgentConversationMessages(convo.id);
      setMessages((res.messages || []).map((m: any, i: number) => ({
        id: m.id || Date.now() + i,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        type: m.data ? 'candidates' : 'text',
        data: m.data,
        actions: m.actions,
      })));
    } catch {
      toast({ title: 'Failed to load conversation', variant: 'destructive' });
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setPendingConfirmations(new Map());
  };

  const deleteConversation = async (id: number) => {
    try {
      await apiClient.deleteAgentConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        startNewConversation();
      }
    } catch {
      toast({ title: 'Failed to delete conversation', variant: 'destructive' });
    }
  };

  /* ─── Voice Input ─── */

  const startRecording = () => {
    if (!HAS_SPEECH_RECOGNITION) {
      toast({ title: 'Voice not supported', description: 'Your browser does not support speech recognition', variant: 'destructive' });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; }
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow microphone in browser settings.',
        'no-speech': 'No speech detected. Please try again.',
        'network': 'Network error. Check your connection.',
        'aborted': 'Recording stopped.',
      };
      const msg = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
      if (event.error !== 'aborted') {
        toast({ title: 'Voice input error', description: msg, variant: 'destructive' });
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);

    // Auto-stop after 30 seconds
    recordingTimerRef.current = setTimeout(() => {
      stopRecording();
      toast({ title: 'Recording stopped', description: 'Maximum recording time (30s) reached' });
    }, 30000);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  /* ─── Voice Output ─── */

  const speakText = (text: string) => {
    if (!HAS_SPEECH_SYNTHESIS) return;
    stopSpeaking();
    // Strip markdown for cleaner speech
    const clean = text
      .replace(/[#*`_~\[\]()>|]/g, '')
      .replace(/<!--.*?-->/gs, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (HAS_SPEECH_SYNTHESIS) {
      speechSynthesis.cancel();
    }
  };

  /* ─── File Upload ─── */

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    setUploadingFile(true);
    try {
      const result = await apiClient.uploadHiringAgentFile(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let fileType: FileAttachment['type'] = 'txt';
      if (ext === 'pdf') fileType = 'pdf';
      else if (ext === 'docx' || ext === 'doc') fileType = 'docx';
      else if (['png', 'jpg', 'jpeg'].includes(ext)) fileType = 'image';

      setAttachedFiles(prev => [...prev, {
        url: result.url,
        filename: result.filename,
        extracted_text: result.extracted_text,
        type: fileType,
        truncated: result.truncated,
        char_count: result.char_count,
      }]);
      const truncMsg = result.truncated ? ' (text truncated for AI processing)' : '';
      toast({ title: `${file.name} attached${truncMsg}` });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  /* ─── Message Helpers ─── */

  const addUserMessage = (content: string, files?: FileAttachment[]): number => {
    const id = Date.now();
    setMessages(prev => [
      ...prev,
      { id, role: 'user', content, created_at: new Date().toISOString(), type: 'text', files },
    ]);
    return id;
  };

  const addBotMessage = (content: string, type: ChatMessage['type'] = 'text', data?: any, actions?: ChatMessage['actions']) => {
    const id = Date.now() + Math.random();
    setMessages(prev => [
      ...prev,
      { id, role: 'assistant', content, created_at: new Date().toISOString(), type, data, actions },
    ]);

    // Track any pending confirmations from actions
    if (actions) {
      for (const action of actions) {
        if (action.result?.pending_confirmation && action.result?.confirmation_token) {
          setPendingConfirmations(prev => {
            const next = new Map(prev);
            next.set(action.result.confirmation_token, {
              tool: action.tool,
              description: action.result.description,
              messageId: id,
            });
            return next;
          });
        }
      }
    }
  };

  /* ─── Confirmation Handlers ─── */

  const handleConfirm = async (token: string) => {
    try {
      const result = await apiClient.confirmHiringAgentAction(token);
      setPendingConfirmations(prev => { const next = new Map(prev); next.delete(token); return next; });
      addBotMessage(
        `Action confirmed and executed successfully.${result.result?.link ? ` [View →](${result.result.link})` : ''}`,
        'text',
        undefined,
        [{ tool: result.tool, args: result.args, result: result.result }],
      );
      loadInitialData();
    } catch {
      toast({ title: 'Failed to confirm action', variant: 'destructive' });
    }
  };

  const handleCancelConfirmation = async (token: string) => {
    try {
      await apiClient.cancelHiringAgentAction(token);
      setPendingConfirmations(prev => { const next = new Map(prev); next.delete(token); return next; });
      addBotMessage('Action cancelled by user.');
    } catch {
      toast({ title: 'Failed to cancel action', variant: 'destructive' });
    }
  };

  /* ─── Send Message (SSE Streaming) ─── */

  const sendMessage = async (content?: string) => {
    const text = (content ?? input).trim();
    if (!text || isLoading) return;
    setInput('');

    // Capture and clear files
    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);

    // Stop recording if active
    if (isRecording) stopRecording();

    addUserMessage(text, currentFiles.length > 0 ? currentFiles : undefined);
    setIsLoading(true);
    setAgentPhase('gathering');

    // Build conversation history
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    // Build file context from attached files
    let fileContext: string | undefined;
    if (currentFiles.length > 0) {
      const textParts = currentFiles
        .filter(f => f.extracted_text)
        .map(f => `[File: ${f.filename}]\n${f.extracted_text}`);
      if (textParts.length > 0) {
        fileContext = textParts.join('\n\n---\n\n');
      }
    }

    // Try SSE streaming first, fall back to regular query
    const streamHelper = apiClient.queryHiringAgentStream(
      text, history, undefined, webSearchEnabled, fileContext, activeConversationId ?? undefined,
    );
    abortControllerRef.current = { abort: streamHelper.abort } as AbortController;

    try {
      const response = await streamHelper.response;

      if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
        // Fall back to regular non-streaming query
        const result = await apiClient.queryHiringAgent(text, history, undefined, webSearchEnabled, fileContext);
        handleNonStreamingResult(result);
        return;
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        const result = await apiClient.queryHiringAgent(text, history, undefined, webSearchEnabled, fileContext);
        handleNonStreamingResult(result);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let streamingContent = '';
      const streamingId = Date.now() + Math.random();
      let actionsCollected: ChatMessage['actions'] = [];

      // Add empty streaming message
      setMessages(prev => [...prev, {
        id: streamingId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        type: 'text',
        isStreaming: true,
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            // Next line should be data:
            continue;
          }
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6);
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.phase) {
              setAgentPhase(data.phase);
            } else if (data.tool && !data.result) {
              // Tool call happening
              setAgentPhase('executing');
              setToolPanelOpen(true);
            } else if (data.tool && data.result) {
              // Tool result
              actionsCollected.push({ tool: data.tool, args: data.args || {}, result: data.result });
            } else if (data.text !== undefined) {
              // Token streaming
              streamingContent += data.text;
              setMessages(prev => prev.map(m =>
                m.id === streamingId ? { ...m, content: streamingContent } : m
              ));
            } else if (data.answer !== undefined) {
              // Final response
              streamingContent = data.answer;
              const finalActions = actionsCollected.length > 0 ? actionsCollected : (data.actions || undefined);
              setMessages(prev => prev.map(m =>
                m.id === streamingId ? {
                  ...m,
                  content: data.answer,
                  data: data.data,
                  type: data.data_type === 'candidates' ? 'candidates' : 'text',
                  actions: finalActions,
                  isStreaming: false,
                } : m
              ));

              // Track pending confirmations
              if (finalActions) {
                for (const action of finalActions) {
                  if (action.result?.pending_confirmation && action.result?.confirmation_token) {
                    setPendingConfirmations(prev => {
                      const next = new Map(prev);
                      next.set(action.result.confirmation_token, {
                        tool: action.tool,
                        description: action.result.description,
                        messageId: streamingId,
                      });
                      return next;
                    });
                  }
                }
              }

              // Set conversation ID if returned
              if (data.conversation_id && !activeConversationId) {
                setActiveConversationId(data.conversation_id);
                loadConversations();
              }
            }
          } catch {
            // Ignore malformed SSE data
          }
        }
      }

      // Finalize streaming message if not already done
      setMessages(prev => prev.map(m =>
        m.id === streamingId && m.isStreaming ? { ...m, isStreaming: false } : m
      ));

      if (autoSpeak && streamingContent) {
        speakText(streamingContent);
      }

      if (actionsCollected.length > 0) {
        loadInitialData();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Fall back to regular query on stream failure
      try {
        const result = await apiClient.queryHiringAgent(text, history, undefined, webSearchEnabled, fileContext);
        handleNonStreamingResult(result);
      } catch {
        addBotMessage('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setAgentPhase('idle');
      abortControllerRef.current = null;
    }
  };

  const handleNonStreamingResult = (result: { answer: string; data?: any; data_type?: string; actions?: Array<{tool: string; args: any; result: any}> }) => {
    if (result.actions && result.actions.length > 0) {
      setAgentPhase('executing');
      setToolPanelOpen(true);
    }
    setAgentPhase('finalizing');

    if (result.data_type === 'candidates' && Array.isArray(result.data) && result.data.length > 0) {
      addBotMessage(result.answer, 'candidates', result.data, result.actions ?? undefined);
    } else {
      addBotMessage(result.answer, 'text', undefined, result.actions ?? undefined);
    }

    if (autoSpeak && result.answer) speakText(result.answer);
    if (result.actions && result.actions.length > 0) loadInitialData();
    setIsLoading(false);
    setAgentPhase('idle');
  };

  const handleQuickAction = (label: string) => {
    sendMessage(label);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t);
    toast({ title: 'Copied to clipboard' });
  };

  /* ─── Render Helpers ─── */

  const renderActionResults = (actions: ChatMessage['actions']) => {
    if (!actions || actions.length === 0) return null;

    // Collect web search sources
    const webSources = actions
      .filter(a => a.tool === 'web_search' && a.result?.success && a.result?.results)
      .flatMap(a => a.result.results || []);

    return (
      <>
        <div className="flex flex-wrap gap-2 mt-3">
          {actions.map((action, i) => {
            const info = TOOL_LABELS[action.tool] || { label: action.tool, color: 'bg-muted text-muted-foreground' };
            const success = action.result?.success !== false;
            const isPending = action.result?.pending_confirmation;
            const link = action.result?.link;

            if (isPending) return null; // Rendered separately as confirmation card

            return (
              <span
                key={i}
                onClick={link ? () => navigate(link) : undefined}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  success ? info.color : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                } ${link ? 'cursor-pointer hover:opacity-80' : ''}`}
              >
                {success ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {success ? info.label : `${info.label} Failed`}
                {link && <ExternalLink className="w-3 h-3" />}
              </span>
            );
          })}
        </div>

        {/* Pending confirmation cards */}
        {actions.filter(a => a.result?.pending_confirmation).map((action, i) => {
          const token = action.result?.confirmation_token;
          if (!token || !pendingConfirmations.has(token)) return null;
          return (
            <div key={`confirm-${i}`} className="mt-3 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Confirmation Required</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{action.result.description}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleConfirm(token)}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-500 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleCancelConfirmation(token)}
                      className="px-3 py-1.5 bg-muted text-muted-foreground text-xs font-semibold rounded-lg hover:bg-muted/80 transition-colors border border-border"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Web search sources */}
        {webSources.length > 0 && (
          <details className="mt-3 group">
            <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {webSources.length} source{webSources.length !== 1 ? 's' : ''}
              <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-border">
              {webSources.map((src: any, si: number) => (
                <div key={si} className="text-xs">
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    {src.title || src.url}
                  </a>
                  {src.content && <p className="text-muted-foreground mt-0.5 line-clamp-2">{src.content}</p>}
                </div>
              ))}
            </div>
          </details>
        )}
      </>
    );
  };

  const renderCandidateCards = (candidates: any[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      {candidates.map((c: any, i: number) => {
        const name = c.metadata?.full_name || c.candidate_name || `Candidate ${i + 1}`;
        const role = c.metadata?.current_role || 'Not specified';
        const email = c.metadata?.email || '';
        const phone = c.metadata?.phone || '';
        const location = c.metadata?.location || '';
        const score = c.category_scores?.total_score;
        const recommendation = c.ai_recommendation || 'Pending';

        let recColor = 'bg-muted text-muted-foreground';
        if (recommendation === 'Interview' || recommendation === 'Interview Immediately')
          recColor = 'bg-emerald-100 text-emerald-700';
        else if (recommendation === 'Consider') recColor = 'bg-amber-100 text-amber-700';
        else if (recommendation === 'Reject' || recommendation === 'Do Not Recommend')
          recColor = 'bg-red-100 text-red-700';

        return (
          <div
            key={c.candidate_id || i}
            className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-foreground text-sm">{name}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
              {score != null && (
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold">
                  <Star className="w-3 h-3" />
                  {score}
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {email}
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> {phone}
                </div>
              )}
              {location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> {location}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${recColor}`}>
                {recommendation}
              </span>
              {c.highlighted_skills && c.highlighted_skills.length > 0 && (
                <div className="flex gap-1">
                  {c.highlighted_skills.slice(0, 2).map((s: string, si: number) => (
                    <span key={si} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderMessage = (msg: ChatMessage) => {
    if (msg.role === 'user') {
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex justify-end">
          <div className="max-w-[75%]">
            {/* Show file chips on user messages */}
            {msg.files && msg.files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                {msg.files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-blue-500/80 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                    <Paperclip className="w-2.5 h-2.5" />
                    {f.filename}
                  </span>
                ))}
              </div>
            )}
            <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
              {msg.content}
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-sm px-4 py-3">
            {/* Action results badges */}
            {renderActionResults(msg.actions)}

            <div className="prose prose-sm max-w-none prose-slate dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold prose-headings:text-foreground prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeStr = String(children).replace(/\n$/, '');
                    if (!match) {
                      if (!codeStr.includes('\n')) {
                        return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground" {...props}>{children}</code>;
                      }
                    }
                    const lang = match ? match[1] : 'text';
                    if (lang === 'json') {
                      const chartData = parseJsonChartData(codeStr);
                      if (chartData) return <DataChart headers={chartData.headers} rows={chartData.rows} title="Data Visualization" compact />;
                    }
                    return (
                      <SyntaxHighlighter style={oneLight} language={lang} PreTag="div"
                        customStyle={{ margin: 0, padding: '12px', background: '#fafafa', fontSize: '12px', lineHeight: '1.6', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        wrapLongLines>{codeStr}</SyntaxHighlighter>
                    );
                  },
                  table({ node, children, ...props }: any) {
                    try {
                      const tableEl = node;
                      if (tableEl) {
                        const headerCells = tableEl.children?.[0]?.children?.[0]?.children || [];
                        const headers = headerCells.map((c: any) => (c.children || []).map((ch: any) => ch.value || ch.children?.map((x: any) => x.value).join('') || '').join(''));
                        const bodyRows = tableEl.children?.[1]?.children || [];
                        const rows = bodyRows.map((row: any) => (row.children || []).map((cell: any) => (cell.children || []).map((ch: any) => ch.value || ch.children?.map((x: any) => x.value).join('') || '').join('')));
                        if (headers.length > 0 && rows.length > 0) return <DataChart headers={headers} rows={rows} />;
                      }
                    } catch {}
                    return <div className="overflow-x-auto my-3 rounded-xl border border-border"><table className="min-w-full text-sm" {...props}>{children}</table></div>;
                  },
                  thead({ children, ...props }: any) { return <thead className="bg-muted border-b border-border" {...props}>{children}</thead>; },
                  th({ children, ...props }: any) { return <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider" {...props}>{children}</th>; },
                  td({ children, ...props }: any) { return <td className="px-4 py-2.5 text-sm text-foreground border-t border-border" {...props}>{children}</td>; },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>

            {/* Rich rendered sections */}
            {msg.type === 'candidates' && msg.data && renderCandidateCards(msg.data)}
          </div>

          {/* Actions below the bubble */}
          <div className="flex items-center gap-0.5 mt-1.5 ml-2">
            <button
              onClick={() => copyText(msg.content)}
              title="Copy"
              className="p-1.5 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded-lg transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {HAS_SPEECH_SYNTHESIS && (
              <button
                onClick={() => speakText(msg.content)}
                title="Read aloud"
                className="p-1.5 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded-lg transition-all"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  /* ─── Main Render ─── */

  return (
    <AppLayout noPadding>
      <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden">
        {/* ── LEFT PANEL: Quick Context + Conversations ── */}
        <aside className="w-80 shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-foreground">Hiring Assistant</h2>
                <p className="text-[11px] text-muted-foreground">AI-powered recruitment</p>
              </div>
              <button
                onClick={startNewConversation}
                title="New conversation"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="px-4 py-4 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Quick Stats
            </p>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-3 gap-2">
              {[
                { label: 'Active Jobs', value: stats.active_jobs, icon: Briefcase, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/50' },
                { label: 'Candidates', value: stats.total_candidates, icon: Users, color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/50' },
                { label: 'Interviews', value: stats.pending_interviews, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50' },
              ].map(({ label, value, icon: Icon, color }) => (
                <motion.div key={label} variants={fadeInUp} className="text-center p-2 rounded-xl bg-muted border border-border">
                  <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center mx-auto mb-1.5`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{value}</p>
                  <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-4 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => handleQuickAction(label)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-muted/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800 transition-all group text-center"
                >
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300 leading-tight">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation History */}
          <div className="border-b border-border">
            <button
              onClick={() => setConversationSidebarOpen(!conversationSidebarOpen)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors"
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                Conversations
                {conversations.length > 0 && (
                  <span className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0.5 rounded-full">{conversations.length}</span>
                )}
              </p>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${conversationSidebarOpen ? 'rotate-180' : ''}`} />
            </button>
            {conversationSidebarOpen && (
              <div className="px-3 pb-3 max-h-40 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin' }}>
                {conversations.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-2">No saved conversations</p>
                ) : (
                  conversations.map(convo => (
                    <div
                      key={convo.id}
                      className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                        activeConversationId === convo.id
                          ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => loadConversation(convo)}
                    >
                      <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-foreground truncate flex-1">{convo.title || 'Untitled'}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Active Jobs List */}
          <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'thin' }}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Active Jobs
            </p>
            {jobs.filter(j => j.status === 'Open').length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No active jobs</p>
                <p className="text-[10px] text-muted-foreground mt-1">Create one to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs
                  .filter(j => j.status === 'Open')
                  .map(job => (
                    <button
                      key={job.job_id}
                      onClick={() =>
                        sendMessage(`Show me candidates for ${job.job_title}`)
                      }
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800 transition-all group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
                        <Briefcase className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate group-hover:text-blue-700 dark:group-hover:text-blue-300">
                          {job.job_title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            <UserCheck className="w-3 h-3 inline mr-0.5" />
                            {job.statistics?.total_candidates || 0}
                          </span>
                          {(job.statistics?.recommended_count || 0) > 0 && (
                            <span className="text-[10px] text-emerald-500 font-medium">
                              <TrendingUp className="w-3 h-3 inline mr-0.5" />
                              {job.statistics.recommended_count} rec.
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-blue-500 shrink-0" />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── CENTER PANEL: Chat Interface ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Bot className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">Hiring Assistant</h1>
                <p className="text-xs text-muted-foreground">AI-powered assistant for recruitment queries</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Agent Phase Indicator */}
              <AnimatePresence>
                {agentPhase !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-full px-3 py-1.5"
                  >
                    <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    <div className="flex items-center gap-1">
                      {['gathering', 'planning', 'executing', 'finalizing'].map((phase, i) => (
                        <div key={phase} className="flex items-center gap-1">
                          {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-all ${
                              agentPhase === phase
                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                : ['gathering', 'planning', 'executing', 'finalizing'].indexOf(agentPhase) > i
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground/50'
                            }`}
                          >
                            {phase.charAt(0).toUpperCase() + phase.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tool panel toggle */}
              {messages.some(m => m.actions && m.actions.length > 0) && (
                <button
                  onClick={() => setToolPanelOpen(!toolPanelOpen)}
                  className={`p-2 rounded-lg transition-colors ${
                    toolPanelOpen
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={toolPanelOpen ? 'Hide tool panel' : 'Show tool panel'}
                >
                  {toolPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Empty state OR Messages */}
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-y-auto">
              {/* Hero */}
              <div className="relative mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-blue-300/30 dark:shadow-blue-900/40">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400 to-violet-600 blur-3xl opacity-15 -z-10 scale-150" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight text-center">
                Hi {firstName}! I'm your Hiring Assistant
              </h1>
              <p className="text-sm text-muted-foreground mb-10 text-center max-w-md leading-relaxed">
                I can create jobs, move candidates, schedule interviews, search the web, and analyze files -- all through natural conversation.
              </p>

              {/* Suggestion tiles - 2x4 grid */}
              <StaggerGrid className="grid grid-cols-2 gap-3 max-w-2xl w-full">
                {SUGGESTIONS.map(({ icon: Icon, color, title, desc }) => (
                  <motion.div key={title} variants={fadeInUp}>
                  <button
                    key={title}
                    onClick={() => sendMessage(title)}
                    className="w-full flex items-start gap-3.5 p-4 bg-card border border-border rounded-2xl hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left group"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} border flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-blue-400 shrink-0 mt-0.5 transition-colors" />
                  </button>
                  </motion.div>
                ))}
              </StaggerGrid>
            </div>
          ) : (
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}
            >
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
                {messages.map(msg => (
                  <Fade key={msg.id} duration={0.3} inView={false}>
                    <div>{renderMessage(msg)}</div>
                  </Fade>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0s', animationDuration: '0.6s' }}
                        />
                        <span
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.15s', animationDuration: '0.6s' }}
                        />
                        <span
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.3s', animationDuration: '0.6s' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* ── INPUT BAR (sticky bottom) ── */}
          <div className="px-6 pb-5 pt-3 bg-gradient-to-t from-background via-background to-background/80 border-t border-border/50">
            <div className="max-w-3xl mx-auto">
              {/* Attached file chips */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachedFiles.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-800"
                    >
                      <Paperclip className="w-3 h-3" />
                      {f.filename}
                      <button
                        onClick={() => removeFile(i)}
                        className="ml-0.5 p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Voice recording indicator */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 mb-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl"
                  >
                    <div className="relative flex items-center justify-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <div className="absolute w-5 h-5 bg-red-500/30 rounded-full animate-ping" />
                    </div>
                    <span className="text-xs font-medium text-red-700 dark:text-red-300">Listening... speak now</span>
                    <button
                      onClick={stopRecording}
                      className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                    >
                      Stop
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                className={`flex items-end gap-2 bg-card border rounded-2xl px-3 py-2.5 shadow-sm transition-all duration-200 ${
                  inputFocused
                    ? 'border-blue-300 dark:border-blue-700 ring-4 ring-blue-500/8 shadow-md'
                    : 'border-border hover:border-border'
                }`}
              >
                {/* Left action buttons */}
                <div className="flex items-center gap-0.5 pb-1.5">
                  {/* File upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Attach file"
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all disabled:opacity-50"
                  >
                    {uploadingFile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>

                  {/* Web search toggle */}
                  <button
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    title={webSearchEnabled ? 'Web search ON' : 'Web search OFF'}
                    className={`p-1.5 rounded-lg transition-all ${
                      webSearchEnabled
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder-muted-foreground outline-none border-none focus:ring-0 py-1.5 leading-relaxed"
                />

                <div className="flex items-center gap-1 pb-1">
                  {/* Voice input */}
                  <button
                    onClick={HAS_SPEECH_RECOGNITION ? toggleRecording : undefined}
                    disabled={!HAS_SPEECH_RECOGNITION}
                    title={!HAS_SPEECH_RECOGNITION ? 'Voice not supported in this browser' : isRecording ? 'Stop recording' : 'Voice input'}
                    className={`p-2 rounded-xl transition-all ${
                      !HAS_SPEECH_RECOGNITION
                        ? 'text-muted-foreground/40 cursor-not-allowed'
                        : isRecording
                        ? 'text-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Send button */}
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    className={`p-2 rounded-full transition-all duration-200 shrink-0 ${
                      input.trim() && !isLoading
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-200/50 dark:shadow-blue-900/30'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Footer row */}
              <div className="flex items-center justify-between mt-2 px-1">
                <div className="flex items-center gap-3">
                  {HAS_SPEECH_SYNTHESIS && (
                    <button
                      onClick={() => { setAutoSpeak(!autoSpeak); stopSpeaking(); }}
                      className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${
                        autoSpeak ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {autoSpeak ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                      Auto-speak {autoSpeak ? 'ON' : 'OFF'}
                    </button>
                  )}
                  {webSearchEnabled && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600">
                      <Zap className="w-3 h-3" />
                      Web search enabled
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Orbis AI Hiring Assistant
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL: Tool Execution Panel ── */}
        <AnimatePresence>
          {toolPanelOpen && (
            <motion.aside initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 320 }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.25 }} className="shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Tool Actions</h3>
                  {(() => {
                    const totalActions = messages.reduce((acc, m) => acc + (m.actions?.length || 0), 0);
                    return totalActions > 0 ? (
                      <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {totalActions}
                      </span>
                    ) : null;
                  })()}
                </div>
                <button
                  onClick={() => setToolPanelOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                {messages
                  .filter(m => m.actions && m.actions.length > 0)
                  .flatMap((m, mi) =>
                    (m.actions || []).map((action, ai) => {
                      const key = `${mi}-${ai}`;
                      const numKey = mi * 100 + ai;
                      const info = TOOL_LABELS[action.tool] || { label: action.tool, color: 'bg-muted text-muted-foreground' };
                      const success = action.result?.success !== false;
                      const isExpanded = expandedTools.has(numKey);
                      return (
                        <div
                          key={key}
                          className={`border rounded-xl overflow-hidden transition-all ${
                            success ? 'border-border' : 'border-red-200'
                          }`}
                        >
                          <button
                            onClick={() => {
                              const next = new Set(expandedTools);
                              if (isExpanded) next.delete(numKey);
                              else next.add(numKey);
                              setExpandedTools(next);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                          >
                            {success ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-foreground flex-1">
                              {info.label}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-border">
                              <div className="mt-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Arguments</p>
                                <pre className="text-[10px] text-muted-foreground bg-muted rounded-lg p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                                  {JSON.stringify(action.args, null, 2)}
                                </pre>
                              </div>
                              <div className="mt-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Result</p>
                                <pre className="text-[10px] text-muted-foreground bg-muted rounded-lg p-2 overflow-x-auto whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                  {JSON.stringify(action.result, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                {messages.every(m => !m.actions || m.actions.length === 0) && (
                  <div className="text-center py-12">
                    <Wrench className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No tool actions yet</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Tool calls will appear here when the agent takes actions
                    </p>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
