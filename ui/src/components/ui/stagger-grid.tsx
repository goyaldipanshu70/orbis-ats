import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface StaggerGridProps {
  children: ReactNode;
  className?: string;
  inView?: boolean;
}

export function StaggerGrid({ children, className, inView = true }: StaggerGridProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      {...(inView
        ? { whileInView: 'visible', viewport: { once: true, margin: '-30px' } }
        : { animate: 'visible' })}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
