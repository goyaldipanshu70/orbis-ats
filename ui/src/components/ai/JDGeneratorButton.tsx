import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { apiClient } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface JDGeneratedResult {
  summary: string;
  responsibilities: string[];
  requirements: string[];
  qualifications: string[];
  benefits: string[];
}

interface Props {
  jobTitle: string;
  department?: string;
  seniority?: string;
  location?: string;
  onGenerated: (jd: JDGeneratedResult) => void;
  disabled?: boolean;
}

export default function JDGeneratorButton({
  jobTitle,
  department,
  seniority,
  location,
  onGenerated,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!jobTitle.trim()) {
      toast({
        title: 'Job title required',
        description: 'Please enter a job title before generating a description.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.generateJD({
        job_title: jobTitle.trim(),
        department: department || undefined,
        seniority: seniority || undefined,
        location: location || undefined,
      }) as any;

      // The orchestrator returns the generated JD content
      const jd: JDGeneratedResult = {
        summary: result.summary || result.description || '',
        responsibilities: result.responsibilities || [],
        requirements: result.requirements || [],
        qualifications: result.qualifications || [],
        benefits: result.benefits || [],
      };

      onGenerated(jd);
      toast({
        title: 'JD Generated',
        description: 'AI-generated job description has been applied.',
      });
    } catch (err: any) {
      toast({
        title: 'Generation Failed',
        description: err?.message || 'Failed to generate job description. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-lg gap-1.5 text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
      onClick={handleGenerate}
      disabled={disabled || loading || !jobTitle.trim()}
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5" />
          Generate with AI
        </>
      )}
    </button>
  );
}
