import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

interface TimelineStep {
  label: string;
  status: 'completed' | 'current' | 'upcoming' | 'rejected';
  date?: string;
}

interface StatusTimelineProps {
  currentStatus: string;
  lastUpdated?: string;
  rejectionReason?: string;
}

const STAGES = ['submitted', 'screening', 'shortlisted', 'interview', 'offered', 'hired'];

function getSteps(currentStatus: string): TimelineStep[] {
  if (currentStatus === 'withdrawn') {
    return [{ label: 'Withdrawn', status: 'rejected' }];
  }

  const currentIndex = STAGES.indexOf(currentStatus);
  const isRejected = currentStatus === 'rejected';

  return STAGES.map((stage, i) => {
    let status: TimelineStep['status'] = 'upcoming';
    if (isRejected) {
      status = i === 0 ? 'completed' : 'upcoming';
    } else if (i < currentIndex) {
      status = 'completed';
    } else if (i === currentIndex) {
      status = 'current';
    }
    return { label: stage.charAt(0).toUpperCase() + stage.slice(1), status };
  });
}

export default function StatusTimeline({ currentStatus, lastUpdated, rejectionReason }: StatusTimelineProps) {
  const steps = getSteps(currentStatus);

  return (
    <div className="space-y-3">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex items-center gap-2">
        {steps.map((step, i) => (
          <motion.div key={i} variants={fadeInUp} className="flex items-center gap-1">
            {step.status === 'completed' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            {step.status === 'current' && <Clock className="w-5 h-5 text-[#1B8EE5] animate-pulse" />}
            {step.status === 'upcoming' && (
              <div
                className="w-5 h-5 rounded-full"
                style={{ border: '2px solid var(--orbis-border-strong)' }}
              />
            )}
            {step.status === 'rejected' && <XCircle className="w-5 h-5 text-red-400" />}
            <span
              className={`text-sm ${
                step.status === 'current'
                  ? 'font-semibold text-[#1B8EE5]'
                  : step.status === 'completed'
                    ? 'text-emerald-400'
                    : 'text-slate-500'
              }`}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className="w-8 h-0.5"
                style={{
                  background: step.status === 'completed'
                    ? 'rgba(52,211,153,0.5)'
                    : 'var(--orbis-border)',
                }}
              />
            )}
          </motion.div>
        ))}
      </motion.div>
      {lastUpdated && (
        <p className="text-xs text-slate-500">Last updated: {new Date(lastUpdated).toLocaleDateString()}</p>
      )}
      {currentStatus === 'rejected' && rejectionReason && (
        <p
          className="text-sm text-red-300 p-2 rounded"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          {rejectionReason}
        </p>
      )}
    </div>
  );
}
