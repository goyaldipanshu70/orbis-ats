

import { cn } from '@/lib/utils';

interface ShineProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export function Shine({ children, className, duration = 2 }: ShineProps) {
  return (
    <span
      className={cn('relative overflow-hidden inline-flex', className)}
      style={{ isolation: 'isolate' }}
    >
      {children}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
          animation: `shine ${duration}s ease-in-out infinite`,
          backgroundSize: '200% 100%',
        }}
      />
      <style>{`
        @keyframes shine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </span>
  );
}
