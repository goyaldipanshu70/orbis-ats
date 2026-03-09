

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps, type Variant } from 'framer-motion';
import { cn } from '@/lib/utils';

type Direction = 'up' | 'down' | 'left' | 'right';

interface FadeProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
  direction?: Direction;
  distance?: number;
  duration?: number;
  delay?: number;
  blur?: boolean;
  inView?: boolean;
  inViewMargin?: string;
  children: React.ReactNode;
}

const directionOffset = (direction: Direction, distance: number): { x?: number; y?: number } => {
  switch (direction) {
    case 'up': return { y: distance };
    case 'down': return { y: -distance };
    case 'left': return { x: distance };
    case 'right': return { x: -distance };
  }
};

export const Fade = forwardRef<HTMLDivElement, FadeProps>(
  (
    {
      direction = 'up',
      distance = 20,
      duration = 0.5,
      delay = 0,
      blur = false,
      inView = true,
      inViewMargin = '-50px',
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const offset = directionOffset(direction, distance);
    const hidden: Variant = {
      opacity: 0,
      ...offset,
      ...(blur && { filter: 'blur(8px)' }),
    };
    const visible: Variant = {
      opacity: 1,
      x: 0,
      y: 0,
      ...(blur && { filter: 'blur(0px)' }),
    };

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        {...(inView ? { whileInView: 'visible', viewport: { once: true, margin: inViewMargin } } : { animate: 'visible' })}
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

Fade.displayName = 'Fade';
