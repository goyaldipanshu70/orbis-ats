import { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
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

function scoreColor(score: number) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number) {
  if (score >= 70) return 'text-green-700 dark:text-green-400';
  if (score >= 40) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
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
          l.name.toLowerCase().includes(q) ||
          l.skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    const min = minScore ? Number(minScore) : null;
    const max = maxScore ? Number(maxScore) : null;
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
    onSuccess: () => {
      toast.success('Selected leads added to Talent Pool');
      setSelectedIds(new Set());
    },
    onError: () => {
      toast.error('Failed to add leads to Talent Pool');
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
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Lead Results</h1>
              <Badge variant="secondary" className="mt-1 font-mono text-xs">
                Run #{run_id}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                onClick={() => addToTalentPool.mutate(Array.from(selectedIds))}
                disabled={addToTalentPool.isPending}
              >
                <Users className="mr-2 h-4 w-4" />
                Add to Talent Pool ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => toast.info('Export coming soon')}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/40">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/40">
                <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{avgScore}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/40">
                <AtSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">With Email</p>
                <p className="text-2xl font-bold">{withEmail}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-sky-100 p-2.5 dark:bg-sky-900/40">
                <Linkedin className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">With LinkedIn</p>
                <p className="text-2xl font-bold">{withLinkedIn}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search / Filter Bar */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Score:</span>
              <Input
                type="number"
                placeholder="Min"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="w-20"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="w-20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="w-32">Score</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      Loading leads...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailLead(lead)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          {lead.name}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {lead.headline || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
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
                        <Badge variant="outline" className="text-xs">
                          {lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {lead.github_url && (
                            <a href={lead.github_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Github className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          {lead.linkedin_url && (
                            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Linkedin className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          {lead.portfolio_url && (
                            <a href={lead.portfolio_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {lead.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {lead.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <DataPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />

        {/* Lead Detail Dialog */}
        <Dialog open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {detailLead && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {detailLead.name.charAt(0).toUpperCase()}
                    </div>
                    {detailLead.name}
                  </DialogTitle>
                  <DialogDescription>
                    {detailLead.headline || 'No headline'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium flex items-center gap-1">
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
                      <p className="text-muted-foreground">Experience</p>
                      <p className="font-medium">
                        {detailLead.experience_years != null
                          ? `${detailLead.experience_years} years`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">
                        {detailLead.email ? (
                          <a
                            href={`mailto:${detailLead.email}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {detailLead.email}
                          </a>
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Source</p>
                      <p className="font-medium">{detailLead.source}</p>
                    </div>
                  </div>

                  {/* Score */}
                  {detailLead.score !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Score</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
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
                        <p className="text-sm text-muted-foreground mb-2">Score Breakdown</p>
                        <div className="space-y-2">
                          {Object.entries(detailLead.score_breakdown).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3 text-sm">
                              <span className="w-28 capitalize text-muted-foreground">
                                {key.replace(/_/g, ' ')}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${scoreColor(value)}`}
                                  style={{ width: `${value}%` }}
                                />
                              </div>
                              <span className="w-8 text-right font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Skills */}
                  {detailLead.skills.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailLead.skills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Links */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Links</p>
                    <div className="flex flex-wrap gap-2">
                      {detailLead.linkedin_url && (
                        <a href={detailLead.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Linkedin className="mr-1.5 h-3.5 w-3.5" />
                            LinkedIn
                          </Button>
                        </a>
                      )}
                      {detailLead.github_url && (
                        <a href={detailLead.github_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Github className="mr-1.5 h-3.5 w-3.5" />
                            GitHub
                          </Button>
                        </a>
                      )}
                      {detailLead.portfolio_url && (
                        <a href={detailLead.portfolio_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Portfolio
                          </Button>
                        </a>
                      )}
                      {detailLead.source_url && (
                        <a href={detailLead.source_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Source URL
                          </Button>
                        </a>
                      )}
                      {!detailLead.linkedin_url &&
                        !detailLead.github_url &&
                        !detailLead.portfolio_url &&
                        !detailLead.source_url && (
                          <span className="text-sm text-muted-foreground">No links available</span>
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

/* ── Sub-components ─────────────────────────────────────────────────────── */

function SkillBadges({ skills }: { skills: string[] }) {
  if (!skills.length) return <span className="text-muted-foreground">-</span>;

  const visible = skills.slice(0, 3);
  const remaining = skills.length - 3;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 flex-wrap">
        {visible.map((s) => (
          <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
            {s}
          </Badge>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-default">
                +{remaining} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[250px]">
              <div className="flex flex-wrap gap-1">
                {skills.slice(3).map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {s}
                  </Badge>
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
  if (score === null) return <span className="text-muted-foreground text-sm">-</span>;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
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
