
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { hoverLift, tapScale } from '@/lib/animations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Eye, MoreVertical, Trash2, Archive, Upload, UserPlus, Users, CheckCircle, Calendar } from 'lucide-react';
import type { Job } from '@/types/api';
import AddCandidateModal from '@/components/AddCandidateModal';
import BulkCandidateModal from '@/components/BulkCandidateModal';

interface JobCardProps {
  job: Job;
  onDelete: (jobId: string) => void;
  onClose: (jobId: string) => void;
  onCandidateAdded?: () => void;
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  Open: { label: 'Open', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Closed: { label: 'Closed', classes: 'bg-muted text-muted-foreground border-border' },
  Draft: { label: 'Draft', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const JobCard = ({ job, onDelete, onClose, onCandidateAdded }: JobCardProps) => {
  const navigate = useNavigate();
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  const status = job.status || 'Unknown';
  const statusStyle = statusConfig[status] || { label: status, classes: 'bg-gray-100 text-gray-600 border-gray-200' };

  const createdDate = job.created_date
    ? new Date(job.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <>
      <motion.div whileHover={hoverLift} whileTap={tapScale} className="group relative bg-card rounded-xl border border-border shadow-sm hover:shadow-lg hover:border-border transition-all duration-200 flex flex-col overflow-hidden">
        {/* Status accent line */}
        <div className={`h-0.5 w-full ${status === 'Open' ? 'bg-emerald-400' : status === 'Draft' ? 'bg-amber-400' : 'bg-muted-foreground'}`} />

        <div className="p-5 flex flex-col flex-1">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-semibold text-foreground text-base leading-snug line-clamp-2 flex-1 group-hover:text-[#1e3fae] transition-colors">
              {job.job_title || 'Untitled Job'}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle.classes}`}>
                {statusStyle.label}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {status === 'Open' && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClose(job.job_id); }} className="text-amber-600">
                      <Archive className="w-4 h-4 mr-2" />
                      Mark as Closed
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(job.job_id); }} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Job
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Summary */}
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
            {job.rubric_summary || (job.key_requirements?.length > 0
              ? `Requires: ${job.key_requirements.slice(0, 3).join(', ')}`
              : 'AI-evaluated position · Click Details to view requirements')}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 py-3 border-y border-border mb-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">{job.statistics?.total_candidates ?? 0}</span>
              <span className="text-xs text-muted-foreground">Candidates</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-sm font-bold text-foreground">{job.statistics?.recommended_count ?? 0}</span>
              <span className="text-xs text-muted-foreground">Recommended</span>
            </div>
            {createdDate && (
              <>
                <div className="w-px h-4 bg-border ml-auto" />
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span className="text-[10px]">{createdDate}</span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/jobs/${job.job_id}`)}
              className="flex-1 h-8 text-xs font-medium border-border text-foreground hover:bg-muted/50 hover:text-[#1e3fae] hover:border-[#1e3fae]/30 transition-all"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Details
            </Button>

            {status === 'Open' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddCandidateModalOpen(true)}
                  className="flex-1 h-8 text-xs font-medium border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkUploadModalOpen(true)}
                  className="flex-1 h-8 text-xs font-medium border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition-all"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Bulk
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <AddCandidateModal
        jobId={job.job_id}
        isOpen={isAddCandidateModalOpen}
        onClose={() => setIsAddCandidateModalOpen(false)}
        onSuccess={() => onCandidateAdded?.()}
      />
      <BulkCandidateModal
        jobId={job.job_id}
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        onSuccess={() => onCandidateAdded?.()}
      />
    </>
  );
};

export default JobCard;
