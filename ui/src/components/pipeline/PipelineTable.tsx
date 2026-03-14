import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PipelineCandidate, PipelineStage, PipelineSummary } from '@/types/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, ArrowRightLeft, TableIcon } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DataPagination } from '@/components/DataPagination';

const TABLE_PAGE_SIZE = 25;

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};
const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};
const sItemCls = 'text-slate-200 focus:bg-white/10 focus:text-white';

const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: 'Applied', screening: 'Screening', ai_interview: 'AI Interview',
  interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected',
};

const STAGE_COLORS: Record<PipelineStage, string> = {
  applied: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  screening: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  ai_interview: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  interview: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  offer: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  hired: 'bg-green-500/10 text-green-400 border border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-blue-500', 'bg-pink-500',
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
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  if (score >= 40) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
  return 'bg-red-500/10 text-red-400 border border-red-500/20';
}

function getRecommendationStyle(rec: string) {
  switch (rec?.toLowerCase()) {
    case 'interview': return 'text-emerald-400';
    case 'consider': return 'text-amber-400';
    case 'reject': return 'text-red-400';
    default: return 'text-slate-500';
  }
}

const fadeInUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

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
  const [page, setPage] = useState(1);

  const allCandidates = useMemo(() => Object.entries(data).flatMap(([stage, candidates]) =>
    candidates.map(c => ({ ...c, pipeline_stage: stage as PipelineStage }))
  ), [data]);

  const totalPages = Math.max(1, Math.ceil(allCandidates.length / TABLE_PAGE_SIZE));
  const paginatedCandidates = useMemo(() =>
    allCandidates.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE)
  , [allCandidates, page]);

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    const pageIds = new Set(paginatedCandidates.map(c => c.id));
    const allPageSelected = paginatedCandidates.every(c => selected.has(c.id));
    if (allPageSelected) {
      const next = new Set(selected);
      pageIds.forEach(id => next.delete(id));
      setSelected(next);
    } else {
      setSelected(new Set([...selected, ...pageIds]));
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
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-white transition-colors"
        style={{ background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-slate-400" />
          <span>Table View</span>
          <span className="text-xs font-medium text-slate-400 px-2 py-0.5 rounded-md tabular-nums" style={{ background: 'var(--orbis-input)' }}>
            {allCandidates.length} candidates
          </span>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div style={{ borderTop: '1px solid var(--orbis-border)' }}>
          {/* Bulk actions */}
          {selected.size > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ background: 'rgba(27,142,229,0.06)', borderBottom: '1px solid rgba(27,142,229,0.15)' }}
            >
              <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(27,142,229,0.12)', color: '#4db5f0' }}>
                {selected.size} selected
              </span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-blue-400" />
              <Select value={bulkStage} onValueChange={(v) => setBulkStage(v as PipelineStage)}>
                <SelectTrigger className="w-36 h-8 text-xs rounded-lg text-white border-0" style={glassInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className={sItemCls}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={handleBulkMove}
                disabled={isBulkMoving}
                className="h-8 px-4 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                {isBulkMoving ? 'Moving...' : 'Move'}
              </button>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent" style={{ borderColor: 'var(--orbis-border)' }}>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={paginatedCandidates.length > 0 && paginatedCandidates.every(c => selected.has(c.id))}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stage</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Score</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCandidates.map((candidate, index) => (
                  <motion.tr
                    key={candidate.id}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: Math.min(index * 0.03, 0.6) }}
                    className={cn(
                      'group transition-colors hover:bg-white/[0.02]',
                      selected.has(candidate.id) && 'bg-blue-500/5'
                    )}
                    style={{ borderColor: 'var(--orbis-grid)' }}
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
                        <span className="font-semibold text-sm text-white">{candidate.full_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">{candidate.email}</TableCell>
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
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center gap-1">
                        <TableIcon className="h-5 w-5 text-slate-400 mb-1" />
                        <span className="text-sm font-medium">No candidates in pipeline</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {allCandidates.length > TABLE_PAGE_SIZE && (
            <div className="px-4 pb-3">
              <DataPagination
                page={page}
                totalPages={totalPages}
                total={allCandidates.length}
                pageSize={TABLE_PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
