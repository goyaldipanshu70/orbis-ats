

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypingTextProps {
  text: string;
  speed?: number;
  className?: string;
  cursor?: boolean;
  onComplete?: () => void;
}

export function TypingText({
  text,
  speed = 20,
  className,
  cursor = true,
  onComplete,
}: TypingTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span className={cn('', className)}>
      {displayed}
      <AnimatePresence>
        {cursor && !done && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.5 }}
            className="inline-block w-[2px] h-[1em] bg-current ml-0.5 align-text-bottom"
          />
        )}
      </AnimatePresence>
    </span>
  );
}
