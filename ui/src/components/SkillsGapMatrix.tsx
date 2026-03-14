import { motion } from 'framer-motion';
import { staggerContainer, scaleIn } from '@/lib/animations';
import { CheckCircle2, XCircle, PlusCircle } from 'lucide-react';

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
    matchPercentage >= 75 ? 'text-emerald-400' :
    matchPercentage >= 50 ? 'text-amber-400' :
    'text-red-400';

  const strokeColor =
    matchPercentage >= 75 ? '#34d399' :
    matchPercentage >= 50 ? '#fbbf24' :
    '#f87171';

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
              stroke="var(--orbis-border)"
              strokeWidth="10"
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
            <span className="text-xs text-slate-500">Match</span>
          </div>
        </div>
      </motion.div>

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Matched Skills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-emerald-400">
              Matched Skills
            </h4>
            <span className="ml-auto text-[10px] px-1.5 py-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-medium">
              {matched.length}
            </span>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-wrap gap-1.5">
            {matched.length === 0 ? (
              <p className="text-xs text-slate-500 italic">None</p>
            ) : (
              matched.map((skill) => (
                <motion.span
                  key={skill}
                  variants={scaleIn}
                  className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                  {skill}
                </motion.span>
              ))
            )}
          </motion.div>
        </div>

        {/* Missing Skills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <XCircle className="h-4 w-4 text-red-400" />
            <h4 className="text-sm font-semibold text-red-400">
              Missing Skills
            </h4>
            <span className="ml-auto text-[10px] px-1.5 py-0 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 font-medium">
              {missing.length}
            </span>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-wrap gap-1.5">
            {missing.length === 0 ? (
              <p className="text-xs text-slate-500 italic">None</p>
            ) : (
              missing.map((skill) => (
                <motion.span
                  key={skill}
                  variants={scaleIn}
                  className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-400"
                >
                  <XCircle className="h-3 w-3 mr-1 text-red-500" />
                  {skill}
                </motion.span>
              ))
            )}
          </motion.div>
        </div>

        {/* Bonus Skills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <PlusCircle className="h-4 w-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-blue-400">
              Bonus Skills
            </h4>
            <span className="ml-auto text-[10px] px-1.5 py-0 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 font-medium">
              {bonus.length}
            </span>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-wrap gap-1.5">
            {bonus.length === 0 ? (
              <p className="text-xs text-slate-500 italic">None</p>
            ) : (
              bonus.map((skill) => (
                <motion.span
                  key={skill}
                  variants={scaleIn}
                  className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400"
                >
                  <PlusCircle className="h-3 w-3 mr-1 text-blue-500" />
                  {skill}
                </motion.span>
              ))
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
