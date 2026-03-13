import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  score: number;
  onClick?: () => void;
}

function getScoreColor(score: number) {
  if (score >= 70) return { bg: 'bg-emerald-100 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-800' };
  if (score >= 40) return { bg: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-800' };
  return { bg: 'bg-red-100 dark:bg-red-950/50', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-200 dark:ring-red-800' };
}

export default function CandidateRankBadge({ score, onClick }: Props) {
  const color = getScoreColor(score);

  const badge = (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full ${color.bg} ${color.text} ring-1 ${color.ring} flex items-center justify-center text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity`}
      type="button"
    >
      {Math.round(score)}
    </button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">AI Rank Score</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
