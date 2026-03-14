import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import OrgTree, { OrgNode } from '@/components/admin/OrgTree';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import {
  Users, Plus, Loader2, X, UserMinus, ArrowRightLeft, Mail, Shield, Building2, Briefcase,
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

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444', hr: '#3b82f6', hiring_manager: '#8b5cf6',
  manager: '#f59e0b', interviewer: '#10b981', candidate: '#64748b',
};

export default function OrgHierarchy() {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgNode | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add form
  const [addUserId, setAddUserId] = useState('');
  const [addReportsTo, setAddReportsTo] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addTitle, setAddTitle] = useState('');

  // Reassign form
  const [reassignTo, setReassignTo] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [treeData, usersData] = await Promise.all([
        apiClient.getOrgTree(),
        apiClient.getAdminUsers(),
      ]);
      setNodes(treeData);
      setAllUsers(usersData);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!addUserId) return;
    setSaving(true);
    try {
      await apiClient.setReporting({
        user_id: parseInt(addUserId),
        reports_to: addReportsTo ? parseInt(addReportsTo) : null,
        department: addDepartment || undefined,
        title: addTitle || undefined,
      });
      toast({ title: 'Added', description: 'Team member added to hierarchy.' });
      setShowAdd(false);
      setAddUserId(''); setAddReportsTo(''); setAddDepartment(''); setAddTitle('');
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.setReporting({
        user_id: selected.user_id,
        reports_to: reassignTo ? parseInt(reassignTo) : null,
      });
      toast({ title: 'Reassigned', description: 'Manager updated successfully.' });
      setShowReassign(false);
      setReassignTo('');
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!selected) return;
    if (!confirm(`Remove ${selected.first_name} ${selected.last_name} from the org hierarchy?`)) return;
    try {
      await apiClient.removeFromOrg(selected.user_id);
      toast({ title: 'Removed', description: 'User removed from org hierarchy.' });
      setSelected(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Users not yet in the org tree
  const usersNotInTree = allUsers.filter(u =>
    !nodes.some(n => n.user_id === parseInt(u.id)) && u.role !== 'candidate'
  );

  // Existing tree members for manager selection
  const treeMembers = nodes.map(n => ({
    user_id: n.user_id,
    label: `${n.first_name || ''} ${n.last_name || ''} (${n.role || ''})`,
  }));

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-[#1B8EE5]" />
              Organization Hierarchy
            </h1>
            <p className="text-sm text-slate-400 mt-1">Manage reporting structure and team organization</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            <Plus className="h-4 w-4" /> Add Team Member
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#1B8EE5]" />
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Tree */}
            <div className="flex-1 rounded-xl p-4 min-h-[500px]" style={glassCard}>
              <OrgTree
                nodes={nodes}
                onNodeClick={setSelected}
                selectedId={selected?.user_id}
              />
            </div>

            {/* Detail panel */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="w-80 rounded-xl p-5 h-fit sticky top-6"
                  style={glassCard}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-white">Details</h3>
                    <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        background: `${ROLE_COLORS[selected.role || ''] || '#64748b'}30`,
                        color: ROLE_COLORS[selected.role || ''] || '#64748b',
                      }}
                    >
                      {`${(selected.first_name || '')[0] || ''}${(selected.last_name || '')[0] || ''}`.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{selected.first_name} {selected.last_name}</p>
                      <p className="text-xs text-slate-500">{selected.title || selected.role}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-slate-400">{selected.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-3.5 w-3.5 text-slate-500" />
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${ROLE_COLORS[selected.role || ''] || '#64748b'}20`, color: ROLE_COLORS[selected.role || ''] || '#64748b' }}>
                        {selected.role}
                      </span>
                    </div>
                    {selected.department && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-slate-400">{selected.department}</span>
                      </div>
                    )}
                    {selected.title && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-slate-400">{selected.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => { setReassignTo(''); setShowReassign(true); }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-[#1B8EE5] hover:bg-[#1B8EE5]/10 transition-colors"
                      style={{ border: '1px solid var(--orbis-border)' }}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Reassign Manager
                    </button>
                    <button
                      onClick={handleRemove}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      style={{ border: '1px solid var(--orbis-border)' }}
                    >
                      <UserMinus className="h-3.5 w-3.5" /> Remove from Hierarchy
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Dialog */}
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
                  {usersNotInTree.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Reports To (optional)</label>
              <Select value={addReportsTo} onValueChange={setAddReportsTo}>
                <SelectTrigger style={glassInput}><SelectValue placeholder="No manager (top-level)" /></SelectTrigger>
                <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                  <SelectItem value="none">No manager (top-level)</SelectItem>
                  {treeMembers.map(m => (
                    <SelectItem key={m.user_id} value={String(m.user_id)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Department</label>
              <input type="text" value={addDepartment} onChange={e => setAddDepartment(e.target.value)} placeholder="e.g. Engineering" className="w-full px-3 py-2 rounded-lg text-sm" style={glassInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
              <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="e.g. VP of Engineering" className="w-full px-3 py-2 rounded-lg text-sm" style={glassInput} />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400" style={{ border: '1px solid var(--orbis-border)' }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving || !addUserId} className="px-4 py-2 rounded-lg text-sm text-white font-medium flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={showReassign} onOpenChange={setShowReassign}>
        <DialogContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Reassign Manager</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-400 mb-3">
              Select a new manager for {selected?.first_name} {selected?.last_name}
            </p>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger style={glassInput}><SelectValue placeholder="Choose new manager..." /></SelectTrigger>
              <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                <SelectItem value="none">No manager (top-level)</SelectItem>
                {treeMembers.filter(m => m.user_id !== selected?.user_id).map(m => (
                  <SelectItem key={m.user_id} value={String(m.user_id)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <button onClick={() => setShowReassign(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400" style={{ border: '1px solid var(--orbis-border)' }}>Cancel</button>
            <button onClick={handleReassign} disabled={saving} className="px-4 py-2 rounded-lg text-sm text-white font-medium flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Reassign
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
