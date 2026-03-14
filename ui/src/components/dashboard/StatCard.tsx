import { motion } from 'framer-motion';
import { scaleIn, hoverLift, tapScale } from '@/lib/animations';
import { LucideIcon, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorClasses?: string;
  iconColorClasses?: string;
  textColorClasses?: string;
  trend?: string;
  trendLabel?: string;
  accentColor?: string;
  delay?: number;
}

const StatCard = ({ title, value, icon: Icon, iconColorClasses, trend, trendLabel, accentColor = 'bg-blue-500', delay = 0 }: StatCardProps) => {
  return (
    <motion.div
      variants={scaleIn}
      whileHover={hoverLift}
      whileTap={tapScale}
      className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{
        background: 'var(--orbis-card)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--orbis-border)',
      }}
    >
      {/* Accent top bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accentColor} transition-all duration-300 group-hover:h-1`} />

      <div className="p-5 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</span>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${iconColorClasses || 'bg-blue-500/10 text-blue-400'}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
          {trend && (
            <span className="mb-0.5 flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              +{trend}
            </span>
          )}
          {trendLabel && !trend && (
            <span className="mb-0.5 text-xs font-semibold text-amber-400">{trendLabel}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
