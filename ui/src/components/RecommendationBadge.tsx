
import { Badge } from '@/components/ui/badge';

interface RecommendationBadgeProps {
  recommendation: 'Interview Immediately' | 'Interview' | 'Consider' | 'Reject' | 'Do Not Recommend' | 'Manual Review Required';
  className?: string;
}

const RecommendationBadge = ({ recommendation, className = '' }: RecommendationBadgeProps) => {
  const getVariant = () => {
    switch (recommendation) {
      case 'Interview Immediately':
      case 'Interview':
        return 'default';
      case 'Consider':
      case 'Manual Review Required':
        return 'secondary';
      case 'Reject':
      case 'Do Not Recommend':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getBgColor = () => {
    switch (recommendation) {
      case 'Interview Immediately':
        return 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200 hover:from-emerald-200 hover:to-green-200 shadow-sm';
      case 'Interview':
        return 'bg-gradient-to-r from-green-100 to-lime-100 text-green-800 border-green-200 hover:from-green-200 hover:to-lime-200 shadow-sm';
      case 'Consider':
        return 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-200 hover:from-amber-200 hover:to-yellow-200 shadow-sm';
      case 'Manual Review Required':
        return 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 border-purple-200 hover:from-purple-200 hover:to-indigo-200 shadow-sm';
      case 'Reject':
      case 'Do Not Recommend':
        return 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-200 hover:from-red-200 hover:to-rose-200 shadow-sm';
      default:
        return 'bg-gradient-to-r from-gray-100 to-slate-100 text-foreground border-border shadow-sm';
    }
  };

  const getIcon = () => {
    switch (recommendation) {
      case 'Interview Immediately':
        return '⚡';
      case 'Interview':
        return '✅';
      case 'Consider':
        return '⚠️';
      case 'Manual Review Required':
        return '🔍';
      case 'Reject':
      case 'Do Not Recommend':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <Badge 
      variant={getVariant()} 
      className={`${getBgColor()} ${className} px-3 py-1.5 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105`}
    >
      <span className="mr-1.5">{getIcon()}</span>
      {recommendation}
    </Badge>
  );
};

export default RecommendationBadge;
