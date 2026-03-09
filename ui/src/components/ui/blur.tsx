

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BlurProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate'> {
  duration?: number;
  delay?: number;
  blur?: string;
  inView?: boolean;
  children: React.ReactNode;
}

export const Blur = forwardRef<HTMLDivElement, BlurProps>(
  ({ duration = 0.6, delay = 0, blur = '10px', inView = true, children, className, ...props }, ref) => {
    const hidden = { opacity: 0, filter: `blur(${blur})` };
    const visible = { opacity: 1, filter: 'blur(0px)' };

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        {...(inView ? { whileInView: 'visible', viewport: { once: true, margin: '-50px' } } : { animate: 'visible' })}
        variants={{ hidden, visible }}
        transition={{ duration, delay, ease: 'easeOut' }}
        className={cn(className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);

Blur.displayName = 'Blur';
