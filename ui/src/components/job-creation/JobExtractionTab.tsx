
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Brain, FileText, Sparkles } from 'lucide-react';
import { JDExtractionResult } from '@/types/api';

interface JobExtractionTabProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  jdFile: File | null;
  setJdFile: (file: File | null) => void;
  extractedData: JDExtractionResult | null;
  isExtracting: boolean;
  onExtract: () => void;
}

const JobExtractionTab = ({
  activeTab,
  setActiveTab,
  jdFile,
  setJdFile,
  extractedData,
  isExtracting,
  onExtract,
}: JobExtractionTabProps) => {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
      <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-1 rounded-xl">
        <TabsTrigger 
          value="extract"
          className="data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all duration-300 rounded-lg"
        >
          <Brain className="w-4 h-4 mr-2" />
          AI Extraction
        </TabsTrigger>
        <TabsTrigger 
          value="manual"
          className="data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all duration-300 rounded-lg"
        >
          <FileText className="w-4 h-4 mr-2" />
          Manual Entry
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="extract" className="space-y-6 mt-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">AI-Powered Extraction</h3>
              <p className="text-sm text-muted-foreground">Upload your job description and let AI extract the details</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="jd-file" className="text-sm font-medium text-foreground">
                Upload Job Description (PDF/DOCX/TXT)
              </Label>
              <div className="mt-2 relative">
                <Input
                  id="jd-file"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                  className="h-12 border-gray-200 rounded-xl file:bg-blue-50 file:text-blue-700 file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:text-sm file:font-medium hover:file:bg-blue-100 transition-all duration-300"
                />
                <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
              </div>
            </div>
            
            <Button
              type="button"
              onClick={onExtract}
              disabled={!jdFile || isExtracting}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
            >
              {isExtracting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Extracting...</span>
                </div>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" />
                  Extract Job Information
                </>
              )}
            </Button>
          </div>
          
          {extractedData && (
            <div className="mt-6 bg-card p-4 rounded-xl border border-green-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h4 className="font-semibold text-green-900">
                  Successfully Extracted: {extractedData.ai_result.job_title}
                </h4>
              </div>
              <p className="text-sm text-green-800 leading-relaxed">
                AI has successfully extracted the job information. You can edit the details below before proceeding to the next step.
              </p>
            </div>
          )}
        </div>
      </TabsContent>
      
      <TabsContent value="manual" className="space-y-6 mt-6">
        <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-2xl border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-slate-500 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Manual Entry</h3>
              <p className="text-sm text-muted-foreground">Enter the job information manually with full control</p>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default JobExtractionTab;
