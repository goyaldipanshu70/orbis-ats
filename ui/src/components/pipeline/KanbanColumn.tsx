import { useState } from 'react';
import { motion } from 'framer-motion';
import { Droppable } from '@hello-pangea/dnd';
import { PipelineCandidate, PipelineStage } from '@/types/api';
import KanbanCard from './KanbanCard';
import { cn } from '@/lib/utils';
import { Users, UserCheck, Bot, Phone, FileText, CheckCircle, XCircle, Inbox, ChevronDown } from 'lucide-react';

const KANBAN_PAGE_SIZE = 50;

const STAGE_ICONS: Record<PipelineStage, React.ElementType> = {
  applied: Users,
  screening: UserCheck,
  ai_interview: Bot,
  interview: Phone,
  offer: FileText,
  hired: CheckCircle,
  rejected: XCircle,
};

const STAGE_STYLES: Record<PipelineStage, { bg: string; headerBg: string; dot: string; countBg: string; countText: string; dropRing: string; iconColor: string }> = {
  applied:      { bg: 'rgba(59,130,246,0.04)',  headerBg: 'rgba(59,130,246,0.08)',  dot: 'bg-blue-500',    countBg: 'rgba(59,130,246,0.12)',  countText: 'text-blue-400',    dropRing: 'ring-blue-500/30',    iconColor: 'text-blue-400' },
  screening:    { bg: 'rgba(245,158,11,0.04)',   headerBg: 'rgba(245,158,11,0.08)',   dot: 'bg-amber-500',   countBg: 'rgba(245,158,11,0.12)',   countText: 'text-amber-400',   dropRing: 'ring-amber-500/30',   iconColor: 'text-amber-400' },
  ai_interview: { bg: 'rgba(27,142,229,0.04)',   headerBg: 'rgba(27,142,229,0.08)',   dot: 'bg-blue-500',  countBg: 'rgba(27,142,229,0.12)',   countText: 'text-blue-400',  dropRing: 'ring-blue-500/30',  iconColor: 'text-blue-400' },
  interview:    { bg: 'rgba(168,85,247,0.04)',   headerBg: 'rgba(168,85,247,0.08)',   dot: 'bg-blue-500',  countBg: 'rgba(168,85,247,0.12)',   countText: 'text-blue-400',  dropRing: 'ring-blue-500/30',  iconColor: 'text-blue-400' },
  offer:        { bg: 'rgba(16,185,129,0.04)',   headerBg: 'rgba(16,185,129,0.08)',   dot: 'bg-emerald-500', countBg: 'rgba(16,185,129,0.12)',   countText: 'text-emerald-400', dropRing: 'ring-emerald-500/30', iconColor: 'text-emerald-400' },
  hired:        { bg: 'rgba(34,197,94,0.04)',    headerBg: 'rgba(34,197,94,0.08)',    dot: 'bg-green-500',   countBg: 'rgba(34,197,94,0.12)',    countText: 'text-green-400',   dropRing: 'ring-green-500/30',   iconColor: 'text-green-400' },
  rejected:     { bg: 'rgba(239,68,68,0.04)',    headerBg: 'rgba(239,68,68,0.08)',    dot: 'bg-red-500',     countBg: 'rgba(239,68,68,0.12)',    countText: 'text-red-400',     dropRing: 'ring-red-500/30',     iconColor: 'text-red-400' },
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  ai_interview: 'AI Interview',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

interface KanbanColumnProps {
  stage: PipelineStage;
  candidates: PipelineCandidate[];
  onCardClick: (candidate: PipelineCandidate) => void;
  onFeedbackClick?: (candidate: PipelineCandidate) => void;
  onScheduleInterview?: (candidate: PipelineCandidate) => void;
  onSendOffer?: (candidate: PipelineCandidate) => void;
  onSendAIInterview?: (candidate: PipelineCandidate) => void;
  onGenerateDocument?: (candidate: PipelineCandidate) => void;
  onViewDocuments?: (candidate: PipelineCandidate) => void;
  onSendEmail?: (candidate: PipelineCandidate) => void;
  onViewAIResults?: (candidate: PipelineCandidate) => void;
  selectedCandidateId?: number | null;
  onSelectCandidate?: (candidate: PipelineCandidate | null) => void;
  jdId?: number;
}

export default function KanbanColumn({ stage, candidates, onCardClick, onFeedbackClick, onScheduleInterview, onSendOffer, onSendAIInterview, onGenerateDocument, onViewDocuments, onSendEmail, onViewAIResults, selectedCandidateId, onSelectCandidate, jdId }: KanbanColumnProps) {
  const styles = STAGE_STYLES[stage];
  const Icon = STAGE_ICONS[stage];
  const [visibleCount, setVisibleCount] = useState(KANBAN_PAGE_SIZE);
  const visibleCandidates = candidates.slice(0, visibleCount);
  const hasMore = candidates.length > visibleCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col rounded-xl min-w-[272px] w-[272px]"
      style={{ background: styles.bg, border: '1px solid var(--orbis-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 rounded-t-xl"
        style={{ background: styles.headerBg, borderBottom: '1px solid var(--orbis-border)' }}
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ background: styles.countBg }}>
          <Icon className={cn('h-3.5 w-3.5', styles.iconColor)} />
        </div>
        <span className="text-[13px] font-semibold text-white tracking-tight">{STAGE_LABELS[stage]}</span>
        <span
          className={cn('ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-bold tabular-nums', styles.countText)}
          style={{ background: styles.countBg }}
        >
          {candidates.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px] max-h-[calc(100vh-340px)] transition-all duration-200 rounded-b-xl',
              snapshot.isDraggingOver && `ring-2 ring-inset ${styles.dropRing}`
            )}
            style={snapshot.isDraggingOver ? { background: styles.headerBg } : undefined}
          >
            {visibleCandidates.map((candidate, index) => (
              <KanbanCard
                key={candidate.id}
                candidate={candidate}
                index={index}
                onClick={onCardClick}
                onFeedbackClick={onFeedbackClick}
                onScheduleInterview={onScheduleInterview}
                onSendOffer={onSendOffer}
                onSendAIInterview={onSendAIInterview}
                onGenerateDocument={onGenerateDocument}
                onViewDocuments={onViewDocuments}
                onSendEmail={onSendEmail}
                onViewAIResults={onViewAIResults}
                isSelected={selectedCandidateId === candidate.id}
                onSelect={onSelectCandidate}
                jdId={jdId}
              />
            ))}
            {provided.placeholder}
            {hasMore && (
              <button
                onClick={() => setVisibleCount(prev => prev + KANBAN_PAGE_SIZE)}
                className="w-full py-2 text-xs font-medium text-slate-500 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                style={{ background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Show more ({candidates.length - visibleCount} remaining)
              </button>
            )}
            {candidates.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center h-24 text-slate-400">
                <Inbox className="h-5 w-5 mb-1" />
                <span className="text-[11px] font-medium">No candidates</span>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </motion.div>
  );
}
