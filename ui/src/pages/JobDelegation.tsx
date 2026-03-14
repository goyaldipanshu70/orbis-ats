import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import {
  Lock, Search, Loader2, Plus, X, Briefcase, Users, Shield, Trash2, UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  editor: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  viewer: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
};

export default function JobDelegation() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('viewer');
  const [saving, setSaving] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const [jobsData, usersData] = await Promise.all([
        apiClient.getJobs(),
        apiClient.getAdminUsers(),
      ]);
      setJobs(jobsData || []);
      setAllUsers(usersData || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (jobId: string) => {
    setMembersLoading(true);
    try {
      const data = await apiClient.getJobMembers(jobId);
      setMembers(data || []);
    } catch (err: any) {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchMembers(String(selectedJob.id));
    }
  }, [selectedJob]);

  const handleSelectJob = (job: any) => {
    setSelectedJob(job);
  };

  const handleAddMember = async () => {
    if (!addUserId || !selectedJob) return;
    setSaving(true);
    try {
      await apiClient.addJobMember(String(selectedJob.id), { user_id: parseInt(addUserId), role: addRole });
      toast({ title: 'Member added', description: 'Team member has been assigned to this job.' });
      setShowAdd(false);
      setAddUserId('');
      setAddRole('viewer');
      fetchMembers(String(selectedJob.id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (memberUserId: number, newRole: string) => {
    if (!selectedJob) return;
    try {
      await apiClient.updateJobMember(String(selectedJob.id), memberUserId, { role: newRole });
      toast({ title: 'Updated', description: 'Access level updated.' });
      fetchMembers(String(selectedJob.id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (memberUserId: number) => {
    if (!selectedJob) return;
    if (!confirm('Remove this member from the job?')) return;
    try {
      await apiClient.removeJobMember(String(selectedJob.id), memberUserId);
      toast({ title: 'Removed', description: 'Member removed from job.' });
      fetchMembers(String(selectedJob.id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filteredJobs = jobs.filter(j =>
    (j.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (j.company || '').toLowerCase().includes(search.toLowerCase())
  );

  // Find user info by ID
  const getUserInfo = (userId: number) => {
    return allUsers.find(u => parseInt(u.id) === userId);
  };

  // Users not already members of selected job
  const availableUsers = allUsers.filter(u =>
    !members.some(m => m.user_id === parseInt(u.id)) && u.role !== 'candidate'
  );

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Lock className="h-6 w-6 text-[#1B8EE5]" />
              Job Delegation
            </h1>
            <p className="text-sm text-slate-400 mt-1">Assign team members and control access per job</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#1B8EE5]" />
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Left: Job list */}
            <div className="w-80 shrink-0">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                  style={glassInput}
                />
              </div>
              <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {filteredJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job)}
                    className={`w-full text-left rounded-lg px-3 py-3 transition-all ${
                      selectedJob?.id === job.id ? 'ring-1 ring-[#1B8EE5] bg-[#1B8EE5]/10' : 'hover:bg-white/5'
                    }`}
                    style={{ border: '1px solid var(--orbis-border)' }}
                  >
                    <p className="text-sm font-medium text-white truncate">{job.title || 'Untitled Job'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{job.company || '—'}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${job.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {job.status || 'draft'}
                      </span>
                    </div>
                  </button>
                ))}
                {filteredJobs.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">No jobs found</p>
                )}
              </div>
            </div>

            {/* Right: Members panel */}
            <div className="flex-1">
              {selectedJob ? (
                <div className="rounded-xl p-5" style={glassCard}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{selectedJob.title}</h2>
                      <p className="text-xs text-slate-500">{members.length} team member{members.length !== 1 ? 's' : ''} assigned</p>
                    </div>
                    <button
                      onClick={() => setShowAdd(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                    >
                      <UserPlus className="h-4 w-4" /> Add Member
                    </button>
                  </div>

                  {membersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1B8EE5]" />
                    </div>
                  ) : members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <Users className="h-10 w-10 mb-2 opacity-50" />
                      <p className="text-sm">No team members assigned</p>
                      <p className="text-xs mt-1">Add members to delegate access to this job</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                          <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-2">Member</th>
                          <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-2">Access Level</th>
                          <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member: any) => {
                          const userInfo = getUserInfo(member.user_id);
                          const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.viewer;
                          return (
                            <tr key={member.user_id} className="hover:bg-white/5" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                                    {(userInfo?.first_name?.[0] || '')}{(userInfo?.last_name?.[0] || '')}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : `User #${member.user_id}`}
                                    </p>
                                    <p className="text-xs text-slate-500">{userInfo?.email || ''}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <Select value={member.role} onValueChange={(val) => handleUpdateRole(member.user_id, val)}>
                                  <SelectTrigger className="w-28 mx-auto" style={glassInput}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="owner">Owner</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <button
                                  onClick={() => handleRemoveMember(member.user_id)}
                                  className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={glassCard}>
                  <Briefcase className="h-12 w-12 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">Select a job to manage team access</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Select User</label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger style={glassInput}><SelectValue placeholder="Choose a user..." /></SelectTrigger>
                <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                  {availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Access Level</label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger style={glassInput}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                  <SelectItem value="viewer">Viewer — Can view job and candidates</SelectItem>
                  <SelectItem value="editor">Editor — Can edit job and manage pipeline</SelectItem>
                  <SelectItem value="owner">Owner — Full access including delegation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400" style={{ border: '1px solid var(--orbis-border)' }}>Cancel</button>
            <button onClick={handleAddMember} disabled={saving || !addUserId} className="px-4 py-2 rounded-lg text-sm text-white font-medium flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add Member
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
