
interface ScoreDisplayProps {
  score: number;
  maxScore?: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ScoreDisplay = ({ score, maxScore = 100, showPercentage = true, size = 'md' }: ScoreDisplayProps) => {
  const percentage = Math.round((score / maxScore) * 100);
  
  const getScoreColor = () => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-sm';
      case 'lg':
        return 'text-lg font-semibold';
      default:
        return 'text-base font-medium';
    }
  };

  return (
    <span className={`${getScoreColor()} ${getSizeClasses()}`}>
      {score}/{maxScore}
      {showPercentage && ` (${percentage}%)`}
    </span>
  );
};

export default ScoreDisplay;
