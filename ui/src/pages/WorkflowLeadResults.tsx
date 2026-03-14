import { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip';
import { DataPagination } from '@/components/DataPagination';
import { apiClient } from '@/utils/api';
import { PaginatedResponse } from '@/types/pagination';
import { ScrapedLead } from '@/types/workflow';
import {
  Search, ExternalLink, Github, Linkedin, Mail, Star,
  MapPin, User, Download, ArrowLeft, Users, BarChart3, AtSign
} from 'lucide-react';

// ── Design-system constants ───────────────────────────────────────────
const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

/** Validate URL is safe (http/https only) to prevent javascript: XSS */
function isSafeUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function scoreColor(score: number) {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export default function WorkflowLeadResults() {
  const { runId: run_id } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') || '1');
  const pageSize = 50;

  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailLead, setDetailLead] = useState<ScrapedLead | null>(null);
  const [talentPoolConfirmOpen, setTalentPoolConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workflow-leads', run_id, page],
    queryFn: () =>
      apiClient.request<PaginatedResponse<ScrapedLead>>(
        `/api/workflows/runs/${run_id}/leads?page=${page}&page_size=${pageSize}`
      ),
    enabled: !!run_id,
  });

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Client-side filtering on current page
  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.name || '').toLowerCase().includes(q) ||
          (l.skills || []).some((s) => s.toLowerCase().includes(q))
      );
    }
    const min = minScore ? Number(minScore) : null;
    const max = maxScore ? Number(maxScore) : null;
    if (min !== null && max !== null && min > max) return result;
    if (min !== null) result = result.filter((l) => (l.score ?? 0) >= min);
    if (max !== null) result = result.filter((l) => (l.score ?? 0) <= max);
    return result;
  }, [leads, search, minScore, maxScore]);

  // KPI calculations
  const avgScore = useMemo(() => {
    const scored = leads.filter((l) => l.score !== null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((s, l) => s + (l.score ?? 0), 0) / scored.length);
  }, [leads]);

  const withEmail = useMemo(() => leads.filter((l) => l.email).length, [leads]);
  const withLinkedIn = useMemo(() => leads.filter((l) => l.linkedin_url).length, [leads]);

  const addToTalentPool = useMutation({
    mutationFn: (leadIds: number[]) =>
      apiClient.request('/api/workflows/leads/add-to-talent-pool', {
        method: 'POST',
        body: JSON.stringify({ lead_ids: leadIds }),
      }),
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Selected leads added to Talent Pool');
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error(err?.detail || err?.message || 'Failed to add leads to Talent Pool');
    },
  });

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  function onPageChange(p: number) {
    setSearchParams({ page: String(p) });
  }

  return (
    <AppLayout>
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              style={glassCard}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Lead Results</h1>
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full mt-1 font-mono bg-slate-500/10 text-slate-400 border border-slate-500/20">
                Run #{run_id}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setTalentPoolConfirmOpen(true)}
                disabled={addToTalentPool.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                <Users className="h-4 w-4" />
                Add to Talent Pool ({selectedIds.size})
              </button>
            )}
            <button
              disabled={filtered.length === 0}
              onClick={() => {
                const headers = ['Name', 'Email', 'Headline', 'Location', 'Skills', 'Score', 'Source', 'LinkedIn', 'GitHub', 'Portfolio'];
                const esc = (v: unknown) => String(v ?? '').replace(/"/g, '""');
                const rows = filtered.map((l) => [
                  esc(l.name),
                  esc(l.email),
                  esc(l.headline),
                  esc(l.location),
                  esc((l.skills || []).join('; ')),
                  l.score ?? '',
                  esc(l.source),
                  esc(l.linkedin_url),
                  esc(l.github_url),
                  esc(l.portfolio_url),
                ]);
                const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `leads-run-${run_id}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${filtered.length} leads`);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white disabled:opacity-50 transition-colors"
              style={glassCard}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Leads', value: total, icon: Users, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400' },
            { label: 'Avg Score', value: avgScore, icon: BarChart3, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
            { label: 'With Email', value: withEmail, icon: AtSign, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400' },
            { label: 'With LinkedIn', value: withLinkedIn, icon: Linkedin, iconBg: 'bg-sky-500/10', iconColor: 'text-sky-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl" style={glassCard}>
              <div className="flex items-center gap-4 p-5">
                <div className={`rounded-lg p-2.5 ${kpi.iconBg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-400">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white">{kpi.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search / Filter Bar */}
        <div className="rounded-xl" style={glassCard}>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                placeholder="Search by name or skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={glassInput}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 whitespace-nowrap">Score:</span>
              <input
                type="number"
                placeholder="Min"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className={`w-20 px-2 py-2 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${minScore && maxScore && Number(minScore) > Number(maxScore) ? 'ring-1 ring-red-400' : ''}`}
                style={glassInput}
              />
              <span className="text-slate-500">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className={`w-20 px-2 py-2 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${minScore && maxScore && Number(minScore) > Number(maxScore) ? 'ring-1 ring-red-400' : ''}`}
                style={glassInput}
              />
              {minScore && maxScore && Number(minScore) > Number(maxScore) && (
                <span className="text-xs text-red-400 whitespace-nowrap">Min &gt; Max</span>
              )}
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="rounded-xl overflow-hidden" style={glassCard}>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent" style={{ background: 'var(--orbis-card)' }}>
                  <TableHead className="w-10 text-slate-400">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Headline</TableHead>
                  <TableHead className="text-slate-400">Location</TableHead>
                  <TableHead className="text-slate-400">Skills</TableHead>
                  <TableHead className="w-32 text-slate-400">Score</TableHead>
                  <TableHead className="text-slate-400">Source</TableHead>
                  <TableHead className="text-slate-400">Links</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                      Loading leads...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer border-white/5 hover:bg-white/[0.02]"
                      onClick={() => setDetailLead(lead)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap text-white">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-400">
                            {(lead.name || '?').charAt(0).toUpperCase()}
                          </div>
                          {lead.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-400">
                        {lead.headline || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-300">
                        {lead.location ? (
                          <span className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {lead.location}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <SkillBadges skills={lead.skills} />
                      </TableCell>
                      <TableCell>
                        <ScoreBar score={lead.score} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          {lead.source}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {isSafeUrl(lead.github_url) && (
                            <a href={lead.github_url} target="_blank" rel="noopener noreferrer">
                              <span className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                                <Github className="h-3.5 w-3.5" />
                              </span>
                            </a>
                          )}
                          {isSafeUrl(lead.linkedin_url) && (
                            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                              <span className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                                <Linkedin className="h-3.5 w-3.5" />
                              </span>
                            </a>
                          )}
                          {isSafeUrl(lead.portfolio_url) && (
                            <a href={lead.portfolio_url} target="_blank" rel="noopener noreferrer">
                              <span className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </span>
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">
                        {lead.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-500" />
                            {lead.email}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        <DataPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />

        {/* Talent Pool Confirmation */}
        <AlertDialog open={talentPoolConfirmOpen} onOpenChange={setTalentPoolConfirmOpen}>
          <AlertDialogContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Add to Talent Pool?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                This will add {selectedIds.size} selected lead{selectedIds.size !== 1 ? 's' : ''} to the Talent Pool. Duplicates will be automatically skipped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 text-slate-300 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  addToTalentPool.mutate(Array.from(selectedIds));
                  setTalentPoolConfirmOpen(false);
                }}
                className="text-white"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                Add to Talent Pool
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lead Detail Dialog */}
        <Dialog open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            {detailLead && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-lg font-bold text-blue-400">
                      {detailLead.name.charAt(0).toUpperCase()}
                    </div>
                    {detailLead.name || 'Unknown'}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    {detailLead.headline || 'No headline'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Location</p>
                      <p className="font-medium text-white flex items-center gap-1">
                        {detailLead.location ? (
                          <>
                            <MapPin className="h-3 w-3" />
                            {detailLead.location}
                          </>
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Experience</p>
                      <p className="font-medium text-white">
                        {detailLead.experience_years != null
                          ? `${detailLead.experience_years} years`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Email</p>
                      <p className="font-medium">
                        {detailLead.email ? (
                          <a
                            href={`mailto:${encodeURIComponent(detailLead.email)}`}
                            className="text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {detailLead.email}
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Source</p>
                      <p className="font-medium text-white">{detailLead.source}</p>
                    </div>
                  </div>

                  {/* Score */}
                  {detailLead.score !== null && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Score</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--orbis-input)' }}>
                            <div
                              className={`h-full rounded-full transition-all ${scoreColor(detailLead.score)}`}
                              style={{ width: `${detailLead.score}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-lg font-bold ${scoreTextColor(detailLead.score)}`}>
                          {detailLead.score}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Score Breakdown */}
                  {detailLead.score_breakdown &&
                    Object.keys(detailLead.score_breakdown).length > 0 && (
                      <div>
                        <p className="text-sm text-slate-500 mb-2">Score Breakdown</p>
                        <div className="space-y-2">
                          {Object.entries(detailLead.score_breakdown).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3 text-sm">
                              <span className="w-28 capitalize text-slate-500">
                                {key.replace(/_/g, ' ')}
                              </span>
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-input)' }}>
                                <div
                                  className={`h-full rounded-full ${scoreColor(value)}`}
                                  style={{ width: `${value}%` }}
                                />
                              </div>
                              <span className="w-8 text-right font-medium text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Skills */}
                  {(detailLead.skills || []).length > 0 && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(detailLead.skills || []).map((skill) => (
                          <span key={skill} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Links */}
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Links</p>
                    <div className="flex flex-wrap gap-2">
                      {isSafeUrl(detailLead.linkedin_url) && (
                        <a href={detailLead.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                            style={glassCard}
                          >
                            <Linkedin className="h-3.5 w-3.5" />
                            LinkedIn
                          </span>
                        </a>
                      )}
                      {isSafeUrl(detailLead.github_url) && (
                        <a href={detailLead.github_url} target="_blank" rel="noopener noreferrer">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                            style={glassCard}
                          >
                            <Github className="h-3.5 w-3.5" />
                            GitHub
                          </span>
                        </a>
                      )}
                      {isSafeUrl(detailLead.portfolio_url) && (
                        <a href={detailLead.portfolio_url} target="_blank" rel="noopener noreferrer">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                            style={glassCard}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Portfolio
                          </span>
                        </a>
                      )}
                      {isSafeUrl(detailLead.source_url) && (
                        <a href={detailLead.source_url} target="_blank" rel="noopener noreferrer">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                            style={glassCard}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Source URL
                          </span>
                        </a>
                      )}
                      {!isSafeUrl(detailLead.linkedin_url) &&
                        !isSafeUrl(detailLead.github_url) &&
                        !isSafeUrl(detailLead.portfolio_url) &&
                        !isSafeUrl(detailLead.source_url) && (
                          <span className="text-sm text-slate-500">No links available</span>
                        )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

/* -- Sub-components -------------------------------------------------------- */

function SkillBadges({ skills }: { skills: string[] | null }) {
  if (!skills?.length) return <span className="text-slate-500">-</span>;

  const visible = skills.slice(0, 3);
  const remaining = skills.length - 3;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 flex-wrap">
        {visible.map((s) => (
          <span key={s} className="inline-flex items-center text-[10px] px-1.5 py-0 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {s}
          </span>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center text-[10px] px-1.5 py-0 rounded-full cursor-default bg-slate-500/10 text-slate-400 border border-slate-500/20">
                +{remaining} more
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[250px]" style={selectDrop}>
              <div className="flex flex-wrap gap-1">
                {skills.slice(3).map((s) => (
                  <span key={s} className="inline-flex items-center text-[10px] px-1.5 py-0 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {s}
                  </span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-500 text-sm">-</span>;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--orbis-input)' }}>
        <div
          className={`h-full rounded-full transition-all ${scoreColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-7 text-right ${scoreTextColor(score)}`}>
        {score}
      </span>
    </div>
  );
}
