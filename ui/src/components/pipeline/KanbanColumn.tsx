import { motion } from 'framer-motion';
import { Droppable } from '@hello-pangea/dnd';
import { PipelineCandidate, PipelineStage } from '@/types/api';
import KanbanCard from './KanbanCard';
import { cn } from '@/lib/utils';
import { Users, UserCheck, Bot, Phone, FileText, CheckCircle, XCircle, Inbox } from 'lucide-react';

const STAGE_ICONS: Record<PipelineStage, React.ElementType> = {
  applied: Users,
  screening: UserCheck,
  ai_interview: Bot,
  interview: Phone,
  offer: FileText,
  hired: CheckCircle,
  rejected: XCircle,
};

const STAGE_STYLES: Record<PipelineStage, { bg: string; headerBg: string; headerBorder: string; dot: string; countBg: string; countText: string; dropHighlight: string; iconColor: string }> = {
  applied:      { bg: 'bg-blue-50/30 dark:bg-blue-950/20',    headerBg: 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20',    headerBorder: 'border-blue-200/50 dark:border-blue-800/40',    dot: 'bg-blue-500',    countBg: 'bg-blue-100 dark:bg-blue-900/50',    countText: 'text-blue-700 dark:text-blue-300',    dropHighlight: 'bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-300/40 ring-inset',    iconColor: 'text-blue-500' },
  screening:    { bg: 'bg-amber-50/30 dark:bg-amber-950/20',   headerBg: 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20',   headerBorder: 'border-amber-200/50 dark:border-amber-800/40',   dot: 'bg-amber-500',   countBg: 'bg-amber-100 dark:bg-amber-900/50',   countText: 'text-amber-700 dark:text-amber-300',   dropHighlight: 'bg-amber-50/60 dark:bg-amber-950/40 ring-2 ring-amber-300/40 ring-inset',   iconColor: 'text-amber-500' },
  ai_interview: { bg: 'bg-violet-50/30 dark:bg-violet-950/20', headerBg: 'bg-gradient-to-r from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20', headerBorder: 'border-violet-200/50 dark:border-violet-800/40', dot: 'bg-violet-500', countBg: 'bg-violet-100 dark:bg-violet-900/50', countText: 'text-violet-700 dark:text-violet-300', dropHighlight: 'bg-violet-50/60 dark:bg-violet-950/40 ring-2 ring-violet-300/40 ring-inset', iconColor: 'text-violet-500' },
  interview:    { bg: 'bg-purple-50/30 dark:bg-purple-950/20', headerBg: 'bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20', headerBorder: 'border-purple-200/50 dark:border-purple-800/40', dot: 'bg-purple-500', countBg: 'bg-purple-100 dark:bg-purple-900/50', countText: 'text-purple-700 dark:text-purple-300', dropHighlight: 'bg-purple-50/60 dark:bg-purple-950/40 ring-2 ring-purple-300/40 ring-inset', iconColor: 'text-purple-500' },
  offer:        { bg: 'bg-emerald-50/30 dark:bg-emerald-950/20', headerBg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20', headerBorder: 'border-emerald-200/50 dark:border-emerald-800/40', dot: 'bg-emerald-500', countBg: 'bg-emerald-100 dark:bg-emerald-900/50', countText: 'text-emerald-700 dark:text-emerald-300', dropHighlight: 'bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-300/40 ring-inset', iconColor: 'text-emerald-500' },
  hired:        { bg: 'bg-green-50/30 dark:bg-green-950/20',   headerBg: 'bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20',   headerBorder: 'border-green-200/50 dark:border-green-800/40',   dot: 'bg-green-500',   countBg: 'bg-green-100 dark:bg-green-900/50',   countText: 'text-green-700 dark:text-green-300',   dropHighlight: 'bg-green-50/60 dark:bg-green-950/40 ring-2 ring-green-300/40 ring-inset',   iconColor: 'text-green-500' },
  rejected:     { bg: 'bg-red-50/30 dark:bg-red-950/20',     headerBg: 'bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20',     headerBorder: 'border-red-200/50 dark:border-red-800/40',     dot: 'bg-red-500',     countBg: 'bg-red-100 dark:bg-red-900/50',     countText: 'text-red-700 dark:text-red-300',     dropHighlight: 'bg-red-50/60 dark:bg-red-950/40 ring-2 ring-red-300/40 ring-inset',     iconColor: 'text-red-500' },
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('flex flex-col rounded-xl min-w-[272px] w-[272px] border border-border/40', styles.bg)}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2.5 px-3.5 py-3 rounded-t-xl border-b', styles.headerBg, styles.headerBorder)}>
        <div className={cn('flex items-center justify-center w-6 h-6 rounded-lg', styles.countBg)}>
          <Icon className={cn('h-3.5 w-3.5', styles.iconColor)} />
        </div>
        <span className="text-[13px] font-semibold text-foreground tracking-tight">{STAGE_LABELS[stage]}</span>
        <span className={cn(
          'ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-bold tabular-nums',
          styles.countBg, styles.countText
        )}>
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
              snapshot.isDraggingOver && styles.dropHighlight
            )}
          >
            {candidates.map((candidate, index) => (
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
            {candidates.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground/60">
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
