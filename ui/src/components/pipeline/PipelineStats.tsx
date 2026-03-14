import { motion } from 'framer-motion';
import { staggerContainer, scaleIn } from '@/lib/animations';
import { PipelineSummary, PipelineStage, LocationVacancy } from '@/types/api';
import { Users, UserCheck, Phone, FileText, CheckCircle, XCircle, ArrowRight, Bot, MapPin, TrendingUp, BarChart3 } from 'lucide-react';
import { CountingNumber } from '@/components/ui/counting-number';
import { cn } from '@/lib/utils';

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

const STAGE_CONFIG = [
  { key: 'applied',      label: 'Applied',      icon: Users,      accent: '#3b82f6', accentRgb: '59,130,246' },
  { key: 'screening',    label: 'Screening',    icon: UserCheck,  accent: '#f59e0b', accentRgb: '245,158,11' },
  { key: 'ai_interview', label: 'AI Interview', icon: Bot,        accent: '#1B8EE5', accentRgb: '139,92,246' },
  { key: 'interview',    label: 'Interview',    icon: Phone,      accent: '#a855f7', accentRgb: '168,85,247' },
  { key: 'offer',        label: 'Offer',        icon: FileText,   accent: '#10b981', accentRgb: '16,185,129' },
  { key: 'hired',        label: 'Hired',        icon: CheckCircle, accent: '#22c55e', accentRgb: '34,197,94' },
  { key: 'rejected',     label: 'Rejected',     icon: XCircle,    accent: '#ef4444', accentRgb: '239,68,68' },
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
  if (rate === null) return 'text-slate-500';
  if (rate >= 50) return 'text-emerald-400';
  if (rate >= 25) return 'text-amber-400';
  return 'text-red-400';
}

function getRateBg(rate: number | null): string {
  if (rate === null) return 'bg-slate-700';
  if (rate >= 50) return 'bg-emerald-500';
  if (rate >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

function getRateBadgeBg(rate: number | null): string {
  if (rate === null) return 'var(--orbis-grid)';
  if (rate >= 50) return 'rgba(16,185,129,0.12)';
  if (rate >= 25) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
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
        <motion.div
          variants={scaleIn}
          className="rounded-2xl px-4 py-3 relative overflow-hidden"
          style={glassCard}
        >
          <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: 'linear-gradient(90deg, #1B8EE5, #1676c0)' }} />
          <div className="flex items-center gap-1.5 mb-1">
            <div className="flex items-center justify-center w-5 h-5 rounded-md" style={{ background: 'var(--orbis-border)' }}>
              <BarChart3 className="h-3 w-3 text-slate-400" />
            </div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total</p>
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">
            <CountingNumber value={total} />
          </p>
        </motion.div>

        {/* Stage cards */}
        {STAGE_CONFIG.map(({ key, label, icon: Icon, accent, accentRgb }) => (
          <motion.div
            key={key}
            variants={scaleIn}
            className="rounded-2xl px-4 py-3 relative overflow-hidden"
            style={{ background: `rgba(${accentRgb},0.04)`, border: `1px solid rgba(${accentRgb},0.1)` }}
          >
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: accent }} />
            <div className="flex items-center gap-1.5 mb-1">
              <div className="flex items-center justify-center w-5 h-5 rounded-md" style={{ background: `rgba(${accentRgb},0.15)` }}>
                <Icon className="h-3 w-3" style={{ color: accent }} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
            </div>
            <p className="text-2xl font-bold tracking-tight" style={{ color: accent }}>
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
          className="flex items-center gap-4 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(27,142,229,0.06)', border: '1px solid rgba(27,142,229,0.1)' }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(27,142,229,0.15)' }}>
              <Bot className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-white">AI Interviews</span>
          </div>
          <div className="h-4 w-px" style={{ background: 'var(--orbis-hover)' }} />
          <span className="text-sm font-bold text-white tabular-nums">{aiTotal}</span>
          {aiPending > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-semibold px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {aiPending} pending
            </span>
          )}
          {aiCompleted > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-md" style={{ background: 'rgba(16,185,129,0.12)' }}>
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
          className="rounded-2xl px-4 py-3"
          style={glassCard}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 mr-1">
              <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Conversion</span>
            </div>
            {FUNNEL_STEPS.map(({ from, to, label }, i) => {
              const rate = getConversionRate(cumulativeCounts[from], cumulativeCounts[to]);
              return (
                <div key={label} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-slate-700" />}
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-1.5 w-6 rounded-full', getRateBg(rate))} />
                    <span
                      className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums', getRateColor(rate))}
                      style={{ background: getRateBadgeBg(rate) }}
                    >
                      {rate !== null ? `${rate}%` : '--'}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">{label}</span>
                  </div>
                </div>
              );
            })}
            <div className="ml-auto flex items-center gap-2 pl-3" style={{ borderLeft: '1px solid var(--orbis-border)' }}>
              <span className="text-[10px] text-slate-500 font-medium">Overall</span>
              <span
                className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums', getRateColor(overallRate))}
                style={{ background: getRateBadgeBg(overallRate) }}
              >
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
          className="rounded-2xl px-4 py-3"
          style={glassCard}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <MapPin className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-white">Vacancy Progress</span>
            <span className="ml-auto text-xs font-bold text-white tabular-nums px-2 py-0.5 rounded-md" style={{ background: 'var(--orbis-border)' }}>
              {locationVacancies.reduce((s, l) => s + l.hired_count, 0)}/{locationVacancies.reduce((s, l) => s + l.vacancies, 0)} total
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {locationVacancies.map((loc) => {
              const pct = loc.vacancies > 0 ? Math.round((loc.hired_count / loc.vacancies) * 100) : 0;
              return (
                <div
                  key={loc.id}
                  className="flex items-center gap-2.5 p-2 rounded-lg transition-colors hover:bg-white/[0.03]"
                  style={{ background: 'var(--orbis-subtle)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white truncate">{loc.city}</span>
                      <span className="text-[10px] text-slate-500 ml-1 shrink-0 font-medium tabular-nums">
                        {loc.hired_count}/{loc.vacancies}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: loc.is_full ? '#22c55e' : '#3b82f6',
                        }}
                      />
                    </div>
                  </div>
                  {loc.is_full && (
                    <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-wider" style={{ background: 'rgba(16,185,129,0.12)' }}>
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
