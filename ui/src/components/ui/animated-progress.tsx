import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedProgressProps {
  value: number;
  className?: string;
  barClassName?: string;
  duration?: number;
}

export function AnimatedProgress({
  value,
  className,
  barClassName,
  duration = 0.8,
}: AnimatedProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-30px' });

  return (
    <div ref={ref} className={cn('w-full rounded-full bg-muted overflow-hidden', className)}>
      <motion.div
        className={cn('h-full rounded-full', barClassName || 'bg-primary')}
        initial={{ width: 0 }}
        animate={isInView ? { width: `${Math.min(Math.max(value, 0), 100)}%` } : { width: 0 }}
        transition={{ duration, ease: 'easeOut', delay: 0.2 }}
      />
    </div>
  );
}
