import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 text-xs rounded-lg gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
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
    </Button>
  );
}
