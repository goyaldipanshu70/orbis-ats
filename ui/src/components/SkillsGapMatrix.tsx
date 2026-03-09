import { motion } from 'framer-motion';
import { staggerContainer, scaleIn } from '@/lib/animations';
import { CheckCircle2, XCircle, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SkillsGapMatrixProps {
  matched: string[];
  missing: string[];
  bonus: string[];
  matchPercentage: number;
}

export function SkillsGapMatrix({ matched, missing, bonus, matchPercentage }: SkillsGapMatrixProps) {
  // Circular progress dimensions
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (matchPercentage / 100) * circumference;

  const percentColor =
    matchPercentage >= 75 ? 'text-green-600' :
    matchPercentage >= 50 ? 'text-amber-600' :
    'text-red-600';

  const strokeColor =
    matchPercentage >= 75 ? '#16a34a' :
    matchPercentage >= 50 ? '#d97706' :
    '#dc2626';

  return (
    <div className="space-y-6">
      {/* Match percentage ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center"
      >
        <div className="relative flex items-center justify-center">
          <svg width="140" height="140" className="-rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-muted/30"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${percentColor}`}>
              {matchPercentage}%
            </span>
            <span className="text-xs text-muted-foreground">Match</span>
          </div>
        </div>
      </motion.div>

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Matched Skills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <h4 className="text-sm font-semibold text-green-700">
              Matched Skills
            </h4>
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
              {matched.length}
            </Badge>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-wrap gap-1.5">
            {matched.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">None</p>
            ) : (
              matched.map((skill) => (
                <motion.span key={skill} variants={scaleIn}>
                  <Badge
                    className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 text-xs"
                    variant="outline"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    {skill}
                  </Badge>
                </motion.span>
              ))
            )}
          </motion.div>
        </div>

        {/* Missing Skills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <XCircle className="h-4 w-4 text-red-600" />
            <h4 className="text-sm font-semibold text-red-700">
              Missing Skills
            </h4>
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">
              {missing.length}
            </Badge>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-wrap gap-1.5">
            {missing.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">None</p>
            ) : (
              missing.map((skill) => (
                <motion.span key={skill} variants={scaleIn}>
                  <Badge
                    className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 text-xs"
                    variant="outline"
                  >
                    <XCircle className="h-3 w-3 mr-1 text-red-500" />
                    {skill}
                  </Badge>
                </motion.span>
              ))
            )}
          </motion.div>
        </div>

        {/* Bonus Skills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <PlusCircle className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-blue-700">
              Bonus Skills
            </h4>
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">
              {bonus.length}
            </Badge>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-wrap gap-1.5">
            {bonus.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">None</p>
            ) : (
              bonus.map((skill) => (
                <motion.span key={skill} variants={scaleIn}>
                  <Badge
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs"
                    variant="outline"
                  >
                    <PlusCircle className="h-3 w-3 mr-1 text-blue-500" />
                    {skill}
                  </Badge>
                </motion.span>
              ))
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
