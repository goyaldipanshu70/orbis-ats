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
  { key: 'resume' as const, label: 'Resume', color: 'bg-blue-500', trackColor: 'bg-blue-100 dark:bg-blue-950/40' },
  { key: 'interview' as const, label: 'Interview', color: 'bg-purple-500', trackColor: 'bg-purple-100 dark:bg-purple-950/40' },
  { key: 'feedback' as const, label: 'Feedback', color: 'bg-emerald-500', trackColor: 'bg-emerald-100 dark:bg-emerald-950/40' },
  { key: 'screening' as const, label: 'Screening', color: 'bg-amber-500', trackColor: 'bg-amber-100 dark:bg-amber-950/40' },
];

export default function RankBreakdownPopover({ breakdown, weights, trigger }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-4 rounded-xl" align="start">
        <h4 className="text-sm font-semibold text-foreground mb-3">Score Breakdown</h4>
        <div className="space-y-3">
          {categories.map(({ key, label, color, trackColor }) => {
            const score = breakdown[key] ?? 0;
            const weight = weights[key] ?? 0;
            const weightPct = Math.round(weight * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {label} <span className="text-[10px] opacity-60">({weightPct}%)</span>
                  </span>
                  <span className="text-xs font-semibold text-foreground">{Math.round(score)}</span>
                </div>
                <div className={`h-2 rounded-full ${trackColor} overflow-hidden`}>
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
