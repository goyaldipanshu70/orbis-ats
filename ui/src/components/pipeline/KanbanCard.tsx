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
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  if (score >= 40) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
  return 'bg-red-500/10 text-red-400 border border-red-500/20';
}

function getSignalColor(signal: string | null | undefined) {
  switch (signal) {
    case 'positive': return 'bg-emerald-500';
    case 'mixed':    return 'bg-amber-400';
    case 'negative': return 'bg-red-500';
    default:         return 'bg-slate-500';
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
      return { label: 'Interview', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    case 'consider':
      return { label: 'Consider', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    case 'reject':
      return { label: 'Reject', cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
    default:
      return { label: rec || 'N/A', cls: 'bg-white/5 text-slate-400 border border-white/10' };
  }
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || '?';
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-blue-500', 'bg-pink-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const AI_STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  pending:     { bg: 'bg-amber-500/10',  text: 'text-amber-400', label: 'Pending', dot: 'bg-amber-400' },
  in_progress: { bg: 'bg-blue-500/10',   text: 'text-blue-400',  label: 'In Progress', dot: 'bg-blue-400 animate-pulse' },
  completed:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Completed', dot: 'bg-emerald-400' },
  expired:     { bg: 'bg-slate-500/10',   text: 'text-slate-400', label: 'Expired', dot: 'bg-slate-400' },
  cancelled:   { bg: 'bg-slate-500/10',   text: 'text-slate-400', label: 'Cancelled', dot: 'bg-slate-400' },
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

  const daysColor = daysInStage === null ? '' : daysInStage > 14 ? 'text-red-400' : daysInStage > 7 ? 'text-amber-400' : 'text-slate-500';
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
            'group/card rounded-xl cursor-pointer transition-all duration-200',
            'hover:-translate-y-0.5',
            snapshot.isDragging && 'rotate-[2deg] scale-[1.02]',
            isSelected && 'ring-2 ring-blue-500'
          )}
          style={{
            ...provided.draggableProps.style,
            background: 'var(--orbis-card)',
            border: isSelected ? '1px solid rgba(27,142,229,0.4)' : '1px solid var(--orbis-border)',
            boxShadow: snapshot.isDragging
              ? '0 8px 24px rgba(27,142,229,0.2)'
              : '0 1px 3px rgba(0,0,0,0.2)',
          }}
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
                  <p className="text-sm font-semibold text-white truncate leading-tight">
                    {candidate.full_name || 'Unknown'}
                  </p>
                  {/* Context menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/card:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-white/10"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-0" style={{ background: 'var(--orbis-dropdown)', border: '1px solid var(--orbis-border)' }}>
                      <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); navigate(`/scorecard/${candidate.id}${jdId ? `?jd_id=${jdId}` : ''}`); }}>
                        <ClipboardCheck className="h-4 w-4 mr-2" /> View Scorecard
                      </DropdownMenuItem>
                      {onScheduleInterview && (
                        <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); onScheduleInterview(candidate); }}>
                          <CalendarPlus className="h-4 w-4 mr-2" /> Schedule Interview
                        </DropdownMenuItem>
                      )}
                      {onSendOffer && (
                        <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); onSendOffer(candidate); }}>
                          <Gift className="h-4 w-4 mr-2" /> Send Offer
                        </DropdownMenuItem>
                      )}
                      {onViewAIResults && candidate.ai_interview_session_id && (
                        <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); onViewAIResults(candidate); }}>
                          <Sparkles className="h-4 w-4 mr-2" /> AI Results
                        </DropdownMenuItem>
                      )}
                      {onGenerateDocument && (
                        <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); onGenerateDocument(candidate); }}>
                          <FileText className="h-4 w-4 mr-2" /> Generate Document
                        </DropdownMenuItem>
                      )}
                      {onViewDocuments && (
                        <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); onViewDocuments(candidate); }}>
                          <FileText className="h-4 w-4 mr-2" /> View Documents{(candidate as any).document_count > 0 ? ` (${(candidate as any).document_count})` : ''}
                        </DropdownMenuItem>
                      )}
                      {onSendEmail && (
                        <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); onSendEmail(candidate); }}>
                          <Mail className="h-4 w-4 mr-2" /> Send Email
                        </DropdownMenuItem>
                      )}
                      {jdId && (
                        <>
                          <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${jdId}/pipeline`); }}>
                            <Trophy className="h-4 w-4 mr-2" /> AI Ranking
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-slate-200 focus:bg-white/5 focus:text-white" onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${jdId}/candidates/${candidate.id}`); }}>
                            <PuzzleIcon className="h-4 w-4 mr-2" /> Skills Gap
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{candidate.email}</p>
              </div>
            </div>

            {/* Score + Recommendation row */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', getScoreColor(score))}
                    style={{ width: `${Math.min(score, 100)}%` }}
                  />
                </div>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                getScoreBadge(score)
              )}>
                {score}
              </span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', badge.cls)}>
                {badge.label}
              </span>
            </div>

            {/* AI Interview status badge */}
            {candidate.ai_interview_status && AI_STATUS_STYLES[candidate.ai_interview_status] && (
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (candidate.ai_interview_session_id && onViewAIResults) onViewAIResults(candidate);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all hover:opacity-80',
                    AI_STATUS_STYLES[candidate.ai_interview_status].bg,
                    AI_STATUS_STYLES[candidate.ai_interview_status].text,
                  )}
                  title={AI_STATUS_STYLES[candidate.ai_interview_status].label}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', AI_STATUS_STYLES[candidate.ai_interview_status].dot)} />
                  <Bot className="h-3 w-3" />
                  {AI_STATUS_STYLES[candidate.ai_interview_status].label}
                  {candidate.ai_interview_score != null && (
                    <span className="ml-0.5 opacity-75">({Math.round(candidate.ai_interview_score)})</span>
                  )}
                </button>
                {/* Show AI recommendation for completed interviews */}
                {candidate.ai_interview_status === 'completed' && (candidate as any).ai_interview_recommendation && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-md capitalize',
                    (candidate as any).ai_interview_recommendation === 'strong_hire' || (candidate as any).ai_interview_recommendation === 'hire'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : (candidate as any).ai_interview_recommendation === 'maybe'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  )}>
                    {((candidate as any).ai_interview_recommendation || '').replace('_', ' ')}
                  </span>
                )}
              </div>
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md text-slate-500 capitalize font-medium" style={{ background: 'var(--orbis-grid)' }}>
                    {source}
                  </span>
                )}
                {(candidate as any).document_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                    <FileText className="w-2.5 h-2.5" />
                    {(candidate as any).document_count}
                  </span>
                )}
              </div>
            )}

            {/* Feedback progress indicators for interview stage */}
            {candidate.pipeline_stage === 'interview' && candidate.feedback_progress && (
              <div className="mt-2.5 flex items-center gap-2 text-[10px]">
                <span className="text-slate-500 font-medium">
                  {candidate.feedback_progress} rounds
                </span>
                {(() => {
                  const parts = candidate.feedback_progress.split('/');
                  const completed = parseInt(parts[0], 10);
                  const total = parseInt(parts[1], 10);
                  const pct = total > 0 ? (completed / total) * 100 : 0;
                  return (
                    <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ background: '#1B8EE5', width: `${pct}%` }}
                      />
                    </div>
                  );
                })()}
                {candidate.avg_feedback_score != null && (
                  <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {candidate.avg_feedback_score}/5
                  </span>
                )}
                {candidate.feedback_signal && (
                  <span
                    role="img"
                    className={cn('inline-block h-2 w-2 shrink-0 rounded-full ring-2 ring-[var(--orbis-page)]', getSignalColor(candidate.feedback_signal))}
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
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-blue-400 transition-all"
                style={{ background: 'rgba(27,142,229,0.08)', border: '1px solid rgba(27,142,229,0.2)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(27,142,229,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(27,142,229,0.08)'; }}
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
