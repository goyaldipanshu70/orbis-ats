
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase, ArrowRight } from 'lucide-react';

const EmptyState = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-16 h-16 bg-[#1e3fae]/8 rounded-2xl flex items-center justify-center mb-6 border border-[#1e3fae]/10"
      >
        <Briefcase className="w-8 h-8 text-[#1e3fae]" />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-lg font-bold text-foreground mb-2"
      >
        No job postings yet
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-muted-foreground text-center max-w-sm mb-8 leading-relaxed"
      >
        Create your first job posting to start evaluating candidates with AI-powered insights.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          onClick={() => navigate('/jobs/create')}
          className="bg-[#1e3fae] hover:bg-[#1632a0] text-white px-6 h-10 rounded-lg text-sm font-semibold shadow-sm transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Your First Job
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </div>
  );
};

export default EmptyState;
