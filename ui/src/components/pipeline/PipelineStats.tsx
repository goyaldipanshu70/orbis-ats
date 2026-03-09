import { motion } from 'framer-motion';
import { staggerContainer, scaleIn } from '@/lib/animations';
import { PipelineSummary, PipelineStage, LocationVacancy } from '@/types/api';
import { Users, UserCheck, Phone, FileText, CheckCircle, XCircle, ArrowRight, Bot, MapPin, TrendingUp, BarChart3 } from 'lucide-react';
import { CountingNumber } from '@/components/ui/counting-number';
import { cn } from '@/lib/utils';

const STAGE_CONFIG = [
  { key: 'applied', label: 'Applied', icon: Users, iconColor: 'text-blue-500', bgGradient: 'from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20', borderColor: 'border-blue-200/50 dark:border-blue-800/40', valueColor: 'text-blue-700 dark:text-blue-300' },
  { key: 'screening', label: 'Screening', icon: UserCheck, iconColor: 'text-amber-500', bgGradient: 'from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20', borderColor: 'border-amber-200/50 dark:border-amber-800/40', valueColor: 'text-amber-700 dark:text-amber-300' },
  { key: 'ai_interview', label: 'AI Interview', icon: Bot, iconColor: 'text-violet-500', bgGradient: 'from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20', borderColor: 'border-violet-200/50 dark:border-violet-800/40', valueColor: 'text-violet-700 dark:text-violet-300' },
  { key: 'interview', label: 'Interview', icon: Phone, iconColor: 'text-purple-500', bgGradient: 'from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20', borderColor: 'border-purple-200/50 dark:border-purple-800/40', valueColor: 'text-purple-700 dark:text-purple-300' },
  { key: 'offer', label: 'Offer', icon: FileText, iconColor: 'text-emerald-500', bgGradient: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20', borderColor: 'border-emerald-200/50 dark:border-emerald-800/40', valueColor: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'hired', label: 'Hired', icon: CheckCircle, iconColor: 'text-green-500', bgGradient: 'from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20', borderColor: 'border-green-200/50 dark:border-green-800/40', valueColor: 'text-green-700 dark:text-green-300' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, iconColor: 'text-red-500', bgGradient: 'from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20', borderColor: 'border-red-200/50 dark:border-red-800/40', valueColor: 'text-red-700 dark:text-red-300' },
] as const;

const FUNNEL_STEPS: { from: PipelineStage; to: PipelineStage; label: string }[] = [
  { from: 'applied', to: 'screening', label: 'Applied -> Screening' },
  { from: 'screening', to: 'ai_interview', label: 'Screening -> AI Interview' },
  { from: 'ai_interview', to: 'interview', label: 'AI Interview -> Interview' },
  { from: 'interview', to: 'offer', label: 'Interview -> Offer' },
  { from: 'offer', to: 'hired', label: 'Offer -> Hired' },
];

function getConversionRate(fromCount: number, toCount: number): number | null {
  if (fromCount === 0) return null;
  return Math.round((toCount / fromCount) * 100);
}

function getRateColor(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 50) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 25) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getRateBg(rate: number | null): string {
  if (rate === null) return 'bg-muted';
  if (rate >= 50) return 'bg-emerald-500';
  if (rate >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

function getRateBadgeBg(rate: number | null): string {
  if (rate === null) return 'bg-muted/60';
  if (rate >= 50) return 'bg-emerald-50 dark:bg-emerald-950/40';
  if (rate >= 25) return 'bg-amber-50 dark:bg-amber-950/40';
  return 'bg-red-50 dark:bg-red-950/40';
}

interface PipelineStatsProps {
  data: PipelineSummary;
  locationVacancies?: LocationVacancy[];
}

export default function PipelineStats({ data, locationVacancies }: PipelineStatsProps) {
  const total = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);

  // AI interview counts
  const allCandidates = Object.values(data).flat();
  const aiPending = allCandidates.filter(c => c.ai_interview_status === 'pending' || c.ai_interview_status === 'in_progress').length;
  const aiCompleted = allCandidates.filter(c => c.ai_interview_status === 'completed').length;
  const aiTotal = aiPending + aiCompleted;

  // Cumulative counts: each stage includes candidates that passed through it
  const cumulativeCounts: Record<string, number> = {
    applied: data.applied.length + data.screening.length + data.ai_interview.length + data.interview.length + data.offer.length + data.hired.length,
    screening: data.screening.length + data.ai_interview.length + data.interview.length + data.offer.length + data.hired.length,
    ai_interview: data.ai_interview.length + data.interview.length + data.offer.length + data.hired.length,
    interview: data.interview.length + data.offer.length + data.hired.length,
    offer: data.offer.length + data.hired.length,
    hired: data.hired.length,
  };

  const overallRate = getConversionRate(cumulativeCounts.applied, cumulativeCounts.hired);

  return (
    <div className="space-y-3">
      {/* KPI Cards */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total card */}
        <motion.div variants={scaleIn} className="rounded-xl border border-border/50 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-800/20 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-200/60 dark:bg-slate-700/40">
              <BarChart3 className="h-3 w-3 text-slate-500" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total</p>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">
            <CountingNumber value={total} />
          </p>
        </motion.div>

        {/* Stage cards */}
        {STAGE_CONFIG.map(({ key, label, icon: Icon, iconColor, bgGradient, borderColor, valueColor }) => (
          <motion.div
            key={key}
            variants={scaleIn}
            className={cn('rounded-xl border px-4 py-3 bg-gradient-to-br shadow-[0_1px_3px_rgba(0,0,0,0.04)]', bgGradient, borderColor)}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className={cn('flex items-center justify-center w-5 h-5 rounded-md bg-white/60 dark:bg-white/10')}>
                <Icon className={cn('h-3 w-3', iconColor)} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</p>
            </div>
            <p className={cn('text-2xl font-bold tracking-tight', valueColor)}>
              <CountingNumber value={data[key as keyof PipelineSummary]?.length ?? 0} />
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* AI Interview Stats */}
      {aiTotal > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4 rounded-xl border border-border/50 bg-gradient-to-r from-violet-50/50 to-card dark:from-violet-950/20 dark:to-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-semibold text-foreground">AI Interviews</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-bold text-foreground tabular-nums">{aiTotal}</span>
          {aiPending > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {aiPending} pending
            </span>
          )}
          {aiCompleted > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {aiCompleted} completed
            </span>
          )}
        </motion.div>
      )}

      {/* Conversion Funnel */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 mr-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Conversion</span>
            </div>
            {FUNNEL_STEPS.map(({ from, to, label }, i) => {
              const rate = getConversionRate(cumulativeCounts[from], cumulativeCounts[to]);
              return (
                <div key={label} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/30" />}
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-1.5 w-6 rounded-full', getRateBg(rate))} />
                    <span className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums',
                      getRateColor(rate), getRateBadgeBg(rate)
                    )}>
                      {rate !== null ? `${rate}%` : '--'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">{label}</span>
                  </div>
                </div>
              );
            })}
            <div className="ml-auto flex items-center gap-2 pl-3 border-l border-border">
              <span className="text-[10px] text-muted-foreground font-medium">Overall</span>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums',
                getRateColor(overallRate), getRateBadgeBg(overallRate)
              )}>
                {overallRate !== null ? `${overallRate}%` : '--'}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Vacancy Progress */}
      {locationVacancies && locationVacancies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-foreground">Vacancy Progress</span>
            <span className="ml-auto text-xs font-bold text-foreground tabular-nums bg-muted/60 px-2 py-0.5 rounded-md">
              {locationVacancies.reduce((s, l) => s + l.hired_count, 0)}/{locationVacancies.reduce((s, l) => s + l.vacancies, 0)} total
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {locationVacancies.map((loc) => {
              const pct = loc.vacancies > 0 ? Math.round((loc.hired_count / loc.vacancies) * 100) : 0;
              return (
                <div key={loc.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-foreground truncate">{loc.city}</span>
                      <span className="text-[10px] text-muted-foreground ml-1 shrink-0 font-medium tabular-nums">
                        {loc.hired_count}/{loc.vacancies}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          loc.is_full ? 'bg-emerald-500' : 'bg-blue-500'
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                  {loc.is_full && (
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-wider">
                      Full
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
