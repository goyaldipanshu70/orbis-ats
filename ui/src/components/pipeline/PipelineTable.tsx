import { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { PipelineCandidate, PipelineStage, PipelineSummary } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ArrowRightLeft, TableIcon } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: 'Applied', screening: 'Screening', ai_interview: 'AI Interview',
  interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected',
};

const STAGE_COLORS: Record<PipelineStage, string> = {
  applied: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800/40',
  screening: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/40',
  ai_interview: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/60 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/40',
  interview: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-800/40',
  offer: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/40',
  hired: 'bg-green-50 text-green-700 ring-1 ring-green-200/60 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-800/40',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/40',
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || '?';
}

function getScoreBadge(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (score >= 60) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300';
  if (score >= 40) return 'bg-orange-50 text-orange-700 ring-1 ring-orange-200/60 dark:bg-orange-950/40 dark:text-orange-300';
  return 'bg-red-50 text-red-700 ring-1 ring-red-200/60 dark:bg-red-950/40 dark:text-red-300';
}

function getRecommendationStyle(rec: string) {
  switch (rec?.toLowerCase()) {
    case 'interview': return 'text-emerald-700 dark:text-emerald-400';
    case 'consider': return 'text-amber-700 dark:text-amber-400';
    case 'reject': return 'text-red-700 dark:text-red-400';
    default: return 'text-muted-foreground';
  }
}

interface PipelineTableProps {
  data: PipelineSummary;
  onRefresh: () => void;
}

export default function PipelineTable({ data, onRefresh }: PipelineTableProps) {
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStage, setBulkStage] = useState<PipelineStage>('screening');
  const [isBulkMoving, setIsBulkMoving] = useState(false);

  const allCandidates = Object.entries(data).flatMap(([stage, candidates]) =>
    candidates.map(c => ({ ...c, pipeline_stage: stage as PipelineStage }))
  );

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === allCandidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allCandidates.map(c => c.id)));
    }
  };

  const handleBulkMove = async () => {
    if (selected.size === 0) return;
    setIsBulkMoving(true);
    try {
      await apiClient.bulkMoveCandidates(Array.from(selected), bulkStage);
      toast({ title: 'Bulk move complete', description: `${selected.size} candidates moved to ${STAGE_LABELS[bulkStage]}` });
      setSelected(new Set());
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Bulk move failed', variant: 'destructive' });
    }
    setIsBulkMoving(false);
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          <span>Table View</span>
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md tabular-nums">
            {allCandidates.length} candidates
          </span>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t border-border/50">
          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-200/50 dark:border-blue-800/40 px-4 py-2.5">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                {selected.size} selected
              </span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-blue-400" />
              <Select value={bulkStage} onValueChange={(v) => setBulkStage(v as PipelineStage)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleBulkMove} disabled={isBulkMoving} className="h-8 text-xs font-semibold">
                {isBulkMoving ? 'Moving...' : 'Move'}
              </Button>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === allCandidates.length && allCandidates.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allCandidates.map((candidate, index) => (
                  <motion.tr
                    key={candidate.id}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      'group border-border/30 transition-colors hover:bg-muted/30',
                      selected.has(candidate.id) && 'bg-blue-50/40 dark:bg-blue-950/20'
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(candidate.id)}
                        onCheckedChange={() => toggleSelect(candidate.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                          getAvatarColor(candidate.full_name || '')
                        )}>
                          {getInitials(candidate.full_name || '')}
                        </div>
                        <span className="font-semibold text-sm text-foreground">{candidate.full_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{candidate.email}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold', STAGE_COLORS[candidate.pipeline_stage])}>
                        {STAGE_LABELS[candidate.pipeline_stage]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums', getScoreBadge(candidate.score ?? 0))}>
                        {candidate.score ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-sm font-medium', getRecommendationStyle(candidate.recommendation))}>
                        {candidate.recommendation || 'N/A'}
                      </span>
                    </TableCell>
                  </motion.tr>
                ))}
                {allCandidates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <TableIcon className="h-5 w-5 text-muted-foreground/40 mb-1" />
                        <span className="text-sm font-medium">No candidates in pipeline</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
