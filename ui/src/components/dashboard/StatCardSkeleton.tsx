
import { Card, CardContent } from '@/components/ui/card';

const StatCardSkeleton = () => {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3"></div>
          </div>
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCardSkeleton;
