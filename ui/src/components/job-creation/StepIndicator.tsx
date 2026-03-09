
import { CheckCircle, Circle } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
}

const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-center space-x-8">
        <div className={`flex items-center space-x-3 transition-all duration-500 ${currentStep === 1 ? 'text-blue-600 scale-110' : currentStep > 1 ? 'text-green-600' : 'text-muted-foreground'}`}>
          <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
            currentStep === 1 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
              : currentStep > 1 
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30' 
                : 'bg-muted text-muted-foreground'
          }`}>
            {currentStep > 1 ? <CheckCircle className="w-6 h-6" /> : '1'}
            {currentStep === 1 && (
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20"></div>
            )}
          </div>
          <span className="font-semibold text-lg">Job Details</span>
        </div>

        <div className={`relative w-24 h-1 rounded-full transition-all duration-700 ${
          currentStep > 1 ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-border'
        }`}>
          {currentStep > 1 && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 to-green-600 animate-pulse opacity-60"></div>
          )}
        </div>

        <div className={`flex items-center space-x-3 transition-all duration-500 ${currentStep === 2 ? 'text-blue-600 scale-110' : currentStep > 2 ? 'text-green-600' : 'text-muted-foreground'}`}>
          <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
            currentStep === 2 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
              : currentStep > 2 
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30' 
                : 'bg-muted text-muted-foreground'
          }`}>
            {currentStep > 2 ? <CheckCircle className="w-6 h-6" /> : '2'}
            {currentStep === 2 && (
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20"></div>
            )}
          </div>
          <span className="font-semibold text-lg">Upload Files</span>
        </div>
      </div>
    </div>
  );
};

export default StepIndicator;
