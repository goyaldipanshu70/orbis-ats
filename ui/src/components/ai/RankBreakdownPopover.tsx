import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Breakdown {
  resume: number;
  interview: number;
  feedback: number;
  screening: number;
}

interface Props {
  breakdown: Breakdown;
  weights: Breakdown;
  trigger: React.ReactNode;
}

const categories = [
  { key: 'resume' as const, label: 'Resume', color: 'bg-blue-500', trackBg: 'rgba(59,130,246,0.15)' },
  { key: 'interview' as const, label: 'Interview', color: 'bg-blue-500', trackBg: 'rgba(168,85,247,0.15)' },
  { key: 'feedback' as const, label: 'Feedback', color: 'bg-emerald-500', trackBg: 'rgba(16,185,129,0.15)' },
  { key: 'screening' as const, label: 'Screening', color: 'bg-amber-500', trackBg: 'rgba(245,158,11,0.15)' },
];

export default function RankBreakdownPopover({ breakdown, weights, trigger }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-4 rounded-xl border-0"
        style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
        align="start"
      >
        <h4 className="text-sm font-semibold text-white mb-3">Score Breakdown</h4>
        <div className="space-y-3">
          {categories.map(({ key, label, color, trackBg }) => {
            const score = breakdown[key] ?? 0;
            const weight = weights[key] ?? 0;
            const weightPct = Math.round(weight * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-400">
                    {label} <span className="text-[10px] opacity-60">({weightPct}%)</span>
                  </span>
                  <span className="text-xs font-semibold text-white">{Math.round(score)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: trackBg }}>
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${Math.min(100, score)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
