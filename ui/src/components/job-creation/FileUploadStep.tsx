
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, FileText, BookOpen } from 'lucide-react';
import { JobFormData } from '@/types/api';

interface FileUploadStepProps {
  rubricFile: File | null;
  setRubricFile: (file: File | null) => void;
  modelAnswerFile: File | null;
  setModelAnswerFile: (file: File | null) => void;
  formData: JobFormData;
  isLoading: boolean;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const FileUploadStep = ({
  rubricFile,
  setRubricFile,
  modelAnswerFile,
  setModelAnswerFile,
  formData,
  isLoading,
  onBack,
  onSubmit,
}: FileUploadStepProps) => {
  return (
    <Card className="bg-card/90 backdrop-blur-sm border-0 shadow-2xl rounded-3xl overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50 pb-8">
        <CardTitle className="text-2xl font-bold text-foreground">Step 2: Upload Files</CardTitle>
        <CardDescription className="text-muted-foreground text-lg">
          Upload the rubric file and optional model answer to complete job creation
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={onSubmit} className="space-y-8">
          {/* Rubric File Upload */}
          <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-2xl border border-red-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <Label htmlFor="rubric-file" className="text-lg font-semibold text-foreground">
                  Evaluation Rubric (Required) *
                </Label>
                <p className="text-sm text-muted-foreground">Upload the evaluation criteria and scoring rubric</p>
              </div>
            </div>
            <div className="relative">
              <Input
                id="rubric-file"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setRubricFile(e.target.files?.[0] || null)}
                className="h-12 border-gray-200 rounded-xl file:bg-red-50 file:text-red-700 file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:text-sm file:font-medium hover:file:bg-red-100 transition-all duration-300"
                required
              />
              <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
            </div>
          </div>
          
          {/* Model Answer File Upload */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <Label htmlFor="model-answer-file" className="text-lg font-semibold text-foreground">
                  Model Answer (Optional)
                </Label>
                <p className="text-sm text-muted-foreground">Upload sample answers for interview questions</p>
              </div>
            </div>
            <div className="relative">
              <Input
                id="model-answer-file"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setModelAnswerFile(e.target.files?.[0] || null)}
                className="h-12 border-gray-200 rounded-xl file:bg-green-50 file:text-green-700 file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:text-sm file:font-medium hover:file:bg-green-100 transition-all duration-300"
              />
              <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
            </div>
          </div>
          
          {/* Job Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
            <h4 className="font-bold text-foreground mb-4 text-lg">Job Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card p-4 rounded-xl border border-blue-200">
                <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
                <p className="text-foreground font-semibold">{formData.job_title || 'Not specified'}</p>
              </div>
              <div className="bg-card p-4 rounded-xl border border-blue-200">
                <p className="text-sm font-medium text-muted-foreground mb-1">Core Skills</p>
                <p className="text-foreground text-sm">
                  {formData.core_skills.filter(Boolean).length > 0 
                    ? formData.core_skills.filter(Boolean).join(', ')
                    : 'None specified'
                  }
                </p>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="px-6 py-3 rounded-xl border-gray-200 hover:bg-muted/50 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Creating Job...</span>
                </div>
              ) : (
                'Create Job'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default FileUploadStep;
