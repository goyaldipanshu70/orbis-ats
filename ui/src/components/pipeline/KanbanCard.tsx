import { useNavigate } from 'react-router-dom';
import { Draggable } from '@hello-pangea/dnd';
import { PipelineCandidate } from '@/types/api';
import { cn } from '@/lib/utils';
import { MessageSquare, Star, MoreHorizontal, ClipboardCheck, CalendarPlus, Gift, Sparkles, Bot, FileText, Clock, Trophy, PuzzleIcon, Mail, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface KanbanCardProps {
  candidate: PipelineCandidate;
  index: number;
  onClick: (candidate: PipelineCandidate) => void;
  onFeedbackClick?: (candidate: PipelineCandidate) => void;
  onScheduleInterview?: (candidate: PipelineCandidate) => void;
  onSendOffer?: (candidate: PipelineCandidate) => void;
  onSendAIInterview?: (candidate: PipelineCandidate) => void;
  onGenerateDocument?: (candidate: PipelineCandidate) => void;
  onViewDocuments?: (candidate: PipelineCandidate) => void;
  onSendEmail?: (candidate: PipelineCandidate) => void;
  onViewAIResults?: (candidate: PipelineCandidate) => void;
  isSelected?: boolean;
  onSelect?: (candidate: PipelineCandidate | null) => void;
  jdId?: number;
}

function getScoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getScoreBadge(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800';
  if (score >= 60) return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800';
  if (score >= 40) return 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-800';
  return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-800';
}

function getSignalColor(signal: string | null | undefined) {
  switch (signal) {
    case 'positive': return 'bg-emerald-500';
    case 'mixed':    return 'bg-amber-400';
    case 'negative': return 'bg-red-500';
    default:         return 'bg-muted-foreground';
  }
}

function getSignalLabel(signal: string | null | undefined) {
  switch (signal) {
    case 'positive': return 'Positive';
    case 'mixed':    return 'Mixed';
    case 'negative': return 'Negative';
    default:         return '';
  }
}

function getRecommendationBadge(rec: string) {
  switch (rec?.toLowerCase()) {
    case 'interview':
      return { label: 'Interview', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700/40' };
    case 'consider':
      return { label: 'Consider', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700/40' };
    case 'reject':
      return { label: 'Reject', className: 'bg-red-50 text-red-700 ring-1 ring-red-200/60 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-700/40' };
    default:
      return { label: rec || 'N/A', className: 'bg-muted text-muted-foreground ring-1 ring-border' };
  }
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || '?';
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const AI_STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  pending:     { bg: 'bg-amber-50 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-300', label: 'Pending', dot: 'bg-amber-400' },
  in_progress: { bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300',   label: 'In Progress', dot: 'bg-blue-400 animate-pulse' },
  completed:   { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Completed', dot: 'bg-emerald-400' },
  expired:     { bg: 'bg-slate-50 dark:bg-slate-800/50',  text: 'text-slate-500 dark:text-slate-400', label: 'Expired', dot: 'bg-slate-400' },
  cancelled:   { bg: 'bg-slate-50 dark:bg-slate-800/50',  text: 'text-slate-500 dark:text-slate-400', label: 'Cancelled', dot: 'bg-slate-400' },
};

export default function KanbanCard({ candidate, index, onClick, onFeedbackClick, onScheduleInterview, onSendOffer, onSendAIInterview, onGenerateDocument, onViewDocuments, onSendEmail, onViewAIResults, isSelected, onSelect, jdId }: KanbanCardProps) {
  const navigate = useNavigate();
  const badge = getRecommendationBadge(candidate.recommendation);
  const score = candidate.score ?? 0;

  // Days in stage
  const daysInStage = (() => {
    const ref = (candidate as any).stage_changed_at || (candidate as any).created_at;
    if (!ref) return null;
    const diff = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  })();

  const daysColor = daysInStage === null ? '' : daysInStage > 14 ? 'text-red-500' : daysInStage > 7 ? 'text-amber-500' : 'text-muted-foreground';
  const source = (candidate as any).source;

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect) {
      onSelect(candidate);
    }
    onClick(candidate);
  };

  return (
    <Draggable draggableId={String(candidate.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={handleClick}
          className={cn(
            'group/card rounded-xl border bg-card cursor-pointer transition-all duration-200',
            'shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5',
            'dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]',
            snapshot.isDragging && 'shadow-[0_8px_24px_rgba(59,130,246,0.2)] ring-2 ring-blue-400/50 rotate-[2deg] scale-[1.02]',
            isSelected && 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-600'
          )}
        >
          <div className="p-3">
            {/* Top row: Avatar + Name + Actions */}
            <div className="flex items-start gap-2.5">
              {/* Avatar */}
              <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm',
                getAvatarColor(candidate.full_name || '')
              )}>
                {getInitials(candidate.full_name || '')}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">
                    {candidate.full_name || 'Unknown'}
                  </p>
                  {/* Context menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/card:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted/80"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/scorecard/${candidate.id}`); }}>
                        <ClipboardCheck className="h-4 w-4 mr-2" /> View Scorecard
                      </DropdownMenuItem>
                      {onScheduleInterview && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onScheduleInterview(candidate); }}>
                          <CalendarPlus className="h-4 w-4 mr-2" /> Schedule Interview
                        </DropdownMenuItem>
                      )}
                      {onSendOffer && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendOffer(candidate); }}>
                          <Gift className="h-4 w-4 mr-2" /> Send Offer
                        </DropdownMenuItem>
                      )}
                      {onViewAIResults && candidate.ai_interview_session_id && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewAIResults(candidate); }}>
                          <Sparkles className="h-4 w-4 mr-2" /> AI Results
                        </DropdownMenuItem>
                      )}
                      {onGenerateDocument && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onGenerateDocument(candidate); }}>
                          <FileText className="h-4 w-4 mr-2" /> Generate Document
                        </DropdownMenuItem>
                      )}
                      {onViewDocuments && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDocuments(candidate); }}>
                          <FileText className="h-4 w-4 mr-2" /> View Documents{(candidate as any).document_count > 0 ? ` (${(candidate as any).document_count})` : ''}
                        </DropdownMenuItem>
                      )}
                      {onSendEmail && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendEmail(candidate); }}>
                          <Mail className="h-4 w-4 mr-2" /> Send Email
                        </DropdownMenuItem>
                      )}
                      {jdId && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/ai-toolkit?tool=ranking&job=${jdId}`); }}>
                            <Trophy className="h-4 w-4 mr-2" /> AI Ranking
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/ai-toolkit?tool=skills-gap&job=${jdId}&candidate=${candidate.id}`); }}>
                            <PuzzleIcon className="h-4 w-4 mr-2" /> Skills Gap
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{candidate.email}</p>
              </div>
            </div>

            {/* Score + Recommendation row */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', getScoreColor(score))}
                    style={{ width: `${Math.min(score, 100)}%` }}
                  />
                </div>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1',
                getScoreBadge(score)
              )}>
                {score}
              </span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', badge.className)}>
                {badge.label}
              </span>
            </div>

            {/* AI Interview status badge */}
            {candidate.ai_interview_status && AI_STATUS_STYLES[candidate.ai_interview_status] && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (candidate.ai_interview_session_id && onViewAIResults) onViewAIResults(candidate);
                }}
                className={cn(
                  'mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all hover:opacity-80',
                  AI_STATUS_STYLES[candidate.ai_interview_status].bg,
                  AI_STATUS_STYLES[candidate.ai_interview_status].text,
                )}
                title={AI_STATUS_STYLES[candidate.ai_interview_status].label}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', AI_STATUS_STYLES[candidate.ai_interview_status].dot)} />
                <Bot className="h-3 w-3" />
                {AI_STATUS_STYLES[candidate.ai_interview_status].label}
                {candidate.ai_interview_score != null && (
                  <span className="ml-0.5 opacity-75">({candidate.ai_interview_score})</span>
                )}
              </button>
            )}

            {/* Meta row: Days + Source + Docs */}
            {(daysInStage !== null || source || (candidate as any).document_count > 0) && (
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                {daysInStage !== null && (
                  <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', daysColor)}>
                    <Clock className="h-2.5 w-2.5" />
                    {daysInStage}d
                  </span>
                )}
                {source && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground capitalize font-medium">
                    {source}
                  </span>
                )}
                {(candidate as any).document_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <FileText className="w-2.5 h-2.5" />
                    {(candidate as any).document_count}
                  </span>
                )}
              </div>
            )}

            {/* Feedback progress indicators for interview stage */}
            {candidate.pipeline_stage === 'interview' && candidate.feedback_progress && (
              <div className="mt-2.5 flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground font-medium">
                  {candidate.feedback_progress} rounds
                </span>
                {(() => {
                  const parts = candidate.feedback_progress.split('/');
                  const completed = parseInt(parts[0], 10);
                  const total = parseInt(parts[1], 10);
                  const pct = total > 0 ? (completed / total) * 100 : 0;
                  return (
                    <div className="h-1.5 flex-1 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  );
                })()}
                {candidate.avg_feedback_score != null && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-700/40">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {candidate.avg_feedback_score}/5
                  </span>
                )}
                {candidate.feedback_signal && (
                  <span
                    role="img"
                    className={cn('inline-block h-2 w-2 shrink-0 rounded-full ring-2 ring-white dark:ring-card', getSignalColor(candidate.feedback_signal))}
                    title={getSignalLabel(candidate.feedback_signal)}
                    aria-label={`Feedback signal: ${getSignalLabel(candidate.feedback_signal)}`}
                  />
                )}
              </div>
            )}

            {/* Feedback button for interview stage */}
            {onFeedbackClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onFeedbackClick(candidate); }}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-purple-200/60 bg-purple-50/50 px-2 py-1.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-all dark:border-purple-800/40 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
              >
                <MessageSquare className="h-3 w-3" /> Feedback
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
