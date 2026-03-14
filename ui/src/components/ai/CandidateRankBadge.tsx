import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  score: number;
  onClick?: () => void;
}

function getScoreStyle(score: number): React.CSSProperties {
  if (score >= 70) return { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.3)' };
  if (score >= 40) return { background: 'rgba(245,158,11,0.15)', color: '#fcd34d', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.3)' };
  return { background: 'rgba(239,68,68,0.15)', color: '#fca5a5', boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.3)' };
}

export default function CandidateRankBadge({ score, onClick }: Props) {
  const style = getScoreStyle(score);

  const badge = (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity"
      style={style}
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
