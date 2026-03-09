import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, hoverLift, tapScale } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  index?: number;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function AnimatedCard({
  children,
  index = 0,
  className,
  hover = true,
  onClick,
}: AnimatedCardProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      whileHover={hover ? hoverLift : undefined}
      whileTap={onClick ? tapScale : undefined}
      custom={index}
      onClick={onClick}
      className={cn(onClick && 'cursor-pointer', className)}
    >
      {children}
    </motion.div>
  );
}
