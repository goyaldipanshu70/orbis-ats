interface RecommendationBadgeProps {
  recommendation: 'Interview Immediately' | 'Interview' | 'Consider' | 'Reject' | 'Do Not Recommend' | 'Manual Review Required';
  className?: string;
}

const RecommendationBadge = ({ recommendation, className = '' }: RecommendationBadgeProps) => {
  const getColors = () => {
    switch (recommendation) {
      case 'Interview Immediately':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Interview':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Consider':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Manual Review Required':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Reject':
      case 'Do Not Recommend':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-white/5 text-slate-400 border-white/10';
    }
  };

  const getIcon = () => {
    switch (recommendation) {
      case 'Interview Immediately':
        return '\u26A1';
      case 'Interview':
        return '\u2705';
      case 'Consider':
        return '\u26A0\uFE0F';
      case 'Manual Review Required':
        return '\uD83D\uDD0D';
      case 'Reject':
      case 'Do Not Recommend':
        return '\u274C';
      default:
        return '\u2753';
    }
  };

  return (
    <span
      className={`${getColors()} ${className} inline-flex items-center border px-3 py-1.5 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105`}
    >
      <span className="mr-1.5">{getIcon()}</span>
      {recommendation}
    </span>
  );
};

export default RecommendationBadge;
