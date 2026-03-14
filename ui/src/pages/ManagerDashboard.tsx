import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import {
  FileText, Plus, Loader2, Clock, CheckCircle2, XCircle,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: Clock },
  approved: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle2 },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: XCircle },
  converted: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: ArrowRight },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#64748b', medium: '#f59e0b', high: '#f97316', urgent: '#ef4444',
};

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getJobRequests();
      // Filter to only show current user's requisitions
      const myReqs = (data || []).filter((r: any) =>
        String(r.requested_by) === String(user?.id)
      );
      setRequisitions(myReqs);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequisitions(); }, []);

  const stats = {
    total: requisitions.length,
    pending: requisitions.filter(r => r.status === 'pending').length,
    approved: requisitions.filter(r => r.status === 'approved' || r.status === 'converted').length,
    rejected: requisitions.filter(r => r.status === 'rejected').length,
  };

  const filtered = filter === 'all' ? requisitions : requisitions.filter(r => r.status === filter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#1B8EE5]" />
            My Requisitions
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage your job requisition requests</p>
        </div>
        <button
          onClick={() => navigate('/manager/requisitions/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
        >
          <Plus className="h-4 w-4" /> New Requisition
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests', value: stats.total, icon: FileText, color: '#1B8EE5' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: '#f59e0b' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: '#10b981' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: '#ef4444' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl p-4"
            style={glassCard}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {['all', 'pending', 'approved', 'rejected', 'converted'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'text-white bg-[#1B8EE5]/20 ring-1 ring-[#1B8EE5]/50' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#1B8EE5]" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={glassCard}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Position</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Department</th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Priority</th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Requested</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req: any) => {
                const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConf.icon;
                return (
                  <tr key={req.id} className="hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{req.title || 'Untitled'}</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs">{req.description || '\u2014'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">{req.department || '\u2014'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${PRIORITY_COLORS[req.priority] || '#64748b'}20`, color: PRIORITY_COLORS[req.priority] || '#64748b' }}>
                        {req.priority || 'medium'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: statusConf.bg, color: statusConf.color }}>
                        <StatusIcon className="h-3 w-3" />
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-slate-500">
                        {req.created_at ? format(new Date(req.created_at), 'MMM d, yyyy') : '\u2014'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    {filter === 'all' ? 'No requisitions yet. Create your first one!' : `No ${filter} requisitions`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
