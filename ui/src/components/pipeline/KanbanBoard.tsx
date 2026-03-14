import { useState, useCallback } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { PipelineCandidate, PipelineStage, PipelineSummary } from '@/types/api';
import KanbanColumn from './KanbanColumn';
import StageTransitionModal from './StageTransitionModal';
import HireLocationModal from './HireLocationModal';
import OfferStageModal from './OfferStageModal';
import PanelBuilderModal from '@/components/PanelBuilderModal';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

const STAGES: PipelineStage[] = ['applied', 'screening', 'ai_interview', 'interview', 'offer', 'hired', 'rejected'];

interface KanbanBoardProps {
  data: PipelineSummary;
  onDataChange: (data: PipelineSummary) => void;
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
  jobTitle?: string;
  onRefresh?: () => void;
}

export default function KanbanBoard({ data, onDataChange, onCardClick, onFeedbackClick, onScheduleInterview, onSendOffer, onSendAIInterview, onGenerateDocument, onViewDocuments, onSendEmail, onViewAIResults, selectedCandidateId, onSelectCandidate, jdId, jobTitle, onRefresh }: KanbanBoardProps) {
  const { toast } = useToast();
  const [transitionModal, setTransitionModal] = useState<{
    candidate: PipelineCandidate;
    fromStage: PipelineStage;
    toStage: PipelineStage;
  } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [hireLocationModal, setHireLocationModal] = useState<{
    candidate: PipelineCandidate;
    fromStage: PipelineStage;
  } | null>(null);
  const [panelBuilderOpen, setPanelBuilderOpen] = useState(false);
  const [panelBuilderCandidate, setPanelBuilderCandidate] = useState<PipelineCandidate | null>(null);
  const [offerMoveCandidate, setOfferMoveCandidate] = useState<{ candidate: PipelineCandidate; fromStage: PipelineStage } | null>(null);

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const fromStage = source.droppableId as PipelineStage;
    const toStage = destination.droppableId as PipelineStage;
    const candidateId = parseInt(draggableId);
    const candidate = data[fromStage].find(c => c.id === candidateId);
    if (!candidate) return;

    if (fromStage === toStage) {
      // Reorder within same column -- no API call needed
      const items = [...data[fromStage]];
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      onDataChange({ ...data, [fromStage]: items });
      return;
    }

    // Different stage -- show confirmation modal for rejection, instant move for others
    if (toStage === 'rejected') {
      setTransitionModal({ candidate, fromStage, toStage });
      return;
    }

    // AI Interview stage -- open config modal; backend auto-moves on invite send
    if (toStage === 'ai_interview' && fromStage !== 'ai_interview' && onSendAIInterview) {
      onSendAIInterview(candidate);
      return;
    }

    // Open panel builder when moving to interview stage (if jdId is available)
    if (toStage === 'interview' && fromStage !== 'interview' && jdId) {
      setPanelBuilderCandidate(candidate);
      setPanelBuilderOpen(true);
      return;
    }

    // Hired stage -- check available locations
    if (toStage === 'hired' && jdId) {
      apiClient.getAvailableHireLocations(String(jdId))
        .then((locations) => {
          if (locations.length === 0) {
            toast({ title: 'All positions filled', description: 'There are no open vacancies remaining for this job.', variant: 'destructive' });
            return;
          }
          if (locations.length === 1) {
            performMove(candidate, fromStage, toStage, '', locations[0].id);
            return;
          }
          setHireLocationModal({ candidate, fromStage });
        })
        .catch(() => {
          // Fallback: move without location
          performMove(candidate, fromStage, toStage, '');
        });
      return;
    }

    // Offer stage -- redirect to offer modal
    if (toStage === 'offer') {
      setOfferMoveCandidate({ candidate, fromStage });
      return;
    }

    // Optimistic update
    performMove(candidate, fromStage, toStage, '');
  }, [data, onDataChange, jdId]);

  const performMove = async (candidate: PipelineCandidate, fromStage: PipelineStage, toStage: PipelineStage, notes: string, hiredLocationId?: number) => {
    // Optimistic update
    const newData = { ...data };
    newData[fromStage] = data[fromStage].filter(c => c.id !== candidate.id);
    newData[toStage] = [...data[toStage], { ...candidate, pipeline_stage: toStage }];
    onDataChange(newData);

    try {
      const result = await apiClient.moveCandidateStage(candidate.id, toStage, notes || undefined, hiredLocationId);
      const pendingEmailId = result.pending_email_id;

      if (pendingEmailId) {
        toast({
          title: `${candidate.full_name} moved to ${toStage}`,
          description: 'Email notification will be sent in 10 seconds.',
          action: {
            label: 'Cancel Email',
            onClick: async () => {
              try {
                await apiClient.cancelStageEmail(pendingEmailId);
                toast({ title: 'Email cancelled', description: 'Stage notification email was cancelled.' });
              } catch {
                toast({ title: 'Could not cancel', description: 'Email may have already been sent.', variant: 'destructive' });
              }
            },
          },
          duration: 12000,
        });
      } else {
        toast({ title: 'Moved', description: `${candidate.full_name} moved to ${toStage}` });
      }

      if (onRefresh) onRefresh();
    } catch (error: any) {
      // Rollback
      onDataChange(data);
      toast({ title: 'Error', description: error.message || 'Failed to move candidate', variant: 'destructive' });
    }
  };

  const handleTransitionConfirm = async (notes: string) => {
    if (!transitionModal) return;
    setIsMoving(true);
    await performMove(transitionModal.candidate, transitionModal.fromStage, transitionModal.toStage, notes);
    setIsMoving(false);
    setTransitionModal(null);
  };

  const handlePanelBuilderSuccess = () => {
    setPanelBuilderOpen(false);
    setPanelBuilderCandidate(null);
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin rounded-2xl p-3"
          style={{ background: 'var(--orbis-subtle)', border: '1px solid var(--orbis-grid)' }}
        >
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              candidates={data[stage] || []}
              onCardClick={onCardClick}
              onFeedbackClick={stage === 'interview' ? onFeedbackClick : undefined}
              onScheduleInterview={onScheduleInterview}
              onSendOffer={onSendOffer}
              onSendAIInterview={onSendAIInterview}
              onGenerateDocument={onGenerateDocument}
              onViewDocuments={onViewDocuments}
              onSendEmail={onSendEmail}
              onViewAIResults={onViewAIResults}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={onSelectCandidate}
              jdId={jdId}
            />
          ))}
        </div>
      </DragDropContext>

      {transitionModal && (
        <StageTransitionModal
          isOpen={true}
          onClose={() => setTransitionModal(null)}
          onConfirm={handleTransitionConfirm}
          candidateName={transitionModal.candidate.full_name}
          fromStage={transitionModal.fromStage}
          toStage={transitionModal.toStage}
          isLoading={isMoving}
        />
      )}

      {hireLocationModal && jdId && (
        <HireLocationModal
          isOpen={true}
          onClose={() => setHireLocationModal(null)}
          onConfirm={(locationId) => {
            performMove(hireLocationModal.candidate, hireLocationModal.fromStage, 'hired', '', locationId);
            setHireLocationModal(null);
          }}
          candidateName={hireLocationModal.candidate.full_name}
          jobId={String(jdId)}
          isLoading={isMoving}
        />
      )}

      {panelBuilderCandidate && jdId && (
        <PanelBuilderModal
          isOpen={panelBuilderOpen}
          onClose={() => { setPanelBuilderOpen(false); setPanelBuilderCandidate(null); }}
          candidateId={panelBuilderCandidate.id}
          jdId={jdId}
          candidateName={panelBuilderCandidate.full_name}
          jobTitle={jobTitle || ''}
          onSuccess={handlePanelBuilderSuccess}
        />
      )}

      {offerMoveCandidate && (
        <OfferStageModal
          isOpen={!!offerMoveCandidate}
          onClose={() => setOfferMoveCandidate(null)}
          candidateId={offerMoveCandidate.candidate.id}
          candidateName={offerMoveCandidate.candidate.full_name}
          candidateEmail={offerMoveCandidate.candidate.email}
          jdId={jdId || 0}
          jobTitle={jobTitle || ''}
          fromStage={offerMoveCandidate.fromStage}
          onComplete={(pendingEmailId) => {
            setOfferMoveCandidate(null);
            if (pendingEmailId) {
              toast({
                title: `Offer sent to ${offerMoveCandidate.candidate.full_name}`,
                description: 'Email with documents will be sent in 10 seconds.',
                action: {
                  label: 'Cancel Email',
                  onClick: async () => {
                    try {
                      await apiClient.cancelStageEmail(pendingEmailId);
                      toast({ title: 'Email cancelled' });
                    } catch {
                      toast({ title: 'Could not cancel', variant: 'destructive' });
                    }
                  },
                },
                duration: 12000,
              });
            }
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </>
  );
}
