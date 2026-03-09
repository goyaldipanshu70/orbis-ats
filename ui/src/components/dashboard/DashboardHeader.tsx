
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const DashboardHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-start mb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Job Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your job postings and candidate evaluations</p>
      </div>

      <Button
        onClick={() => navigate('/jobs/create')}
        className="bg-[#1e3fae] hover:bg-[#1632a0] text-white px-4 py-2 h-9 rounded-lg shadow-sm text-sm font-semibold transition-all"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Create New Job
      </Button>
    </div>
  );
};

export default DashboardHeader;
